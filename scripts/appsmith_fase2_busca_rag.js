/* eslint-disable no-console */
// Builds Appsmith app + page + actions + widgets for RAG search, via Appsmith REST API (no UI clicks).
//
// Secrets: read from env vars APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD.
// Gemini key: left as {{appsmith.store.GEMINI_API_KEY}} inside the API action URL.

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const WORKSPACE_FALLBACK_ID = "69894b618a3a0012fc7c5eb2"; // from environment; safe fallback

const PLUGIN_POSTGRES = "69892a638a3a0012fc7c5e81";
const PLUGIN_REST = "69892a638a3a0012fc7c5e82";

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
}

function safeJsonPreview(value, max = 1200) {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > max ? `${s.slice(0, max)}... (truncated)` : s;
  } catch {
    return String(value);
  }
}

async function loadEnvFromSecretsFile() {
  const secretsPath = path.join(process.cwd(), "MEUS_SEGREDOS.txt");
  try {
    const raw = await fs.readFile(secretsPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+):\s*(.+)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // ignore
  }
}

async function makeClient() {
  await loadEnvFromSecretsFile();
  const baseUrl = process.env.APPSMITH_URL;
  const email = process.env.APPSMITH_EMAIL;
  const password = process.env.APPSMITH_PASSWORD;
  if (!baseUrl || !email || !password) {
    throw new Error("Missing APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD (set env vars or MEUS_SEGREDOS.txt).");
  }

  const jar = new CookieJar();
  const http = wrapper(
    axios.create({
      baseURL: baseUrl,
      withCredentials: true,
      jar,
      timeout: 30_000,
      validateStatus: () => true,
      headers: { Accept: "application/json, text/plain, */*" },
    }),
  );

  async function xsrf() {
    const cookies = await jar.getCookies(baseUrl);
    return cookies.find((c) => c.key === "XSRF-TOKEN")?.value || "";
  }

  async function request(method, url, { params, data, headers } = {}) {
    const m = String(method).toLowerCase();
    const isWrite = !["get", "head", "options"].includes(m);
    const h = { ...(headers || {}) };
    if (isWrite) {
      const token = await xsrf();
      if (!token) throw new Error("Missing XSRF token cookie");
      h["X-XSRF-TOKEN"] = token;
    }
    const r = await http.request({ method: m, url, params, data, headers: h });
    if (r.status >= 400) {
      throw new Error(`${m.toUpperCase()} ${url} failed: HTTP ${r.status}\n${safeJsonPreview(r.data)}`);
    }
    return r.data;
  }

  async function login() {
    await request("get", "/api/v1/users/me");
    const token = await xsrf();
    const body = new URLSearchParams({ username: email, password }).toString();
    await request("post", "/api/v1/login", {
      data: body,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-XSRF-TOKEN": token },
    });
    const who = await request("get", "/api/v1/users/me");
    if (who?.data?.isAnonymous) throw new Error("Login failed: still anonymous");
  }

  await login();

  return { baseUrl, request };
}

async function main() {
  const { baseUrl, request } = await makeClient();

  const outDir = path.join(process.cwd(), "tmp", "appsmith");
  await fs.mkdir(outDir, { recursive: true });

  const ws = await request("get", "/api/v1/workspaces/home");
  const ws0 = Array.isArray(ws?.data) ? ws.data[0] : null;
  const workspaceId = ws0?._id || ws0?.id || WORKSPACE_FALLBACK_ID;

  const appName = "JMU_Gestao_Inteligente";
  const pageName = "Busca_Normas";

  const apps = await request("get", "/api/v1/applications/home", { params: { workspaceId } });
  const appArr = Array.isArray(apps?.data) ? apps.data : [];
  let app = appArr.find((a) => a?.name === appName);
  if (!app) {
    const created = await request("post", "/api/v1/applications", {
      data: { name: appName, workspaceId },
      headers: { "Content-Type": "application/json" },
    });
    app = created?.data;
    if (!app?.id) throw new Error(`App created but missing id: ${safeJsonPreview(created)}`);
  }

  const applicationId = app.id;
  const appSlug = app.slug;

  const pagesResp = await request("get", "/api/v1/pages", { params: { applicationId } });
  const pages = pagesResp?.data?.pages || [];
  let page = pages.find((p) => p?.name === pageName);

  if (!page) {
    // Appsmith page creation API varies and may require layouts; safest is to rename the default page.
    const defaultPage = pages.find((p) => p?.isDefault) || pages[0];
    if (!defaultPage?.id) throw new Error("Could not find a default page to rename.");
    await request("put", `/api/v1/pages/${encodeURIComponent(defaultPage.id)}`, {
      data: { name: pageName },
      headers: { "Content-Type": "application/json" },
    });
    const pagesResp2 = await request("get", "/api/v1/pages", { params: { applicationId } });
    const pages2 = pagesResp2?.data?.pages || [];
    page = pages2.find((p) => p?.name === pageName) || defaultPage;
  }

  const pageId = page.id;
  const pageSlug = page.slug || "busca-normas";

  // Find Postgres datasource (reuse existing Supabase datasource in workspace)
  const dsResp = await request("get", "/api/v1/datasources", { params: { workspaceId } });
  const datasources = Array.isArray(dsResp?.data) ? dsResp.data : [];
  const supabaseDs = datasources.find((d) => d?.pluginId === PLUGIN_POSTGRES && /supabase/i.test(d?.name || "")) || datasources.find((d) => d?.pluginId === PLUGIN_POSTGRES);
  if (!supabaseDs?.id) {
    throw new Error("No Postgres datasource found in workspace. Create one in Appsmith first (Supabase JMU).");
  }

  const postgresDatasourceId = supabaseDs.id;

  // Avoid duplicate actions on re-run.
  const existingActionsResp = await request("get", "/api/v1/actions", { params: { pageId } });
  const existingActions = Array.isArray(existingActionsResp?.data) ? existingActionsResp.data : [];
  const getActionByName = (name) => existingActions.find((a) => a?.name === name);

  // Create action: GerarEmbedding (REST API)
  const gerarEmbedding =
    getActionByName("GerarEmbedding") ||
    (await request("post", "/api/v1/actions", {
      data: {
        name: "GerarEmbedding",
      pageId,
      applicationId,
      workspaceId,
      pluginId: PLUGIN_REST,
      pluginType: "API",
      datasource: {
        name: "DEFAULT_REST_DATASOURCE",
        pluginId: PLUGIN_REST,
        workspaceId,
        userPermissions: [],
        datasourceStorages: {},
        invalids: [],
        messages: [],
        isValid: true,
      },
      actionConfiguration: {
        timeoutInMillisecond: 20000,
        paginationType: "NONE",
        encodeParamsToggle: true,
        httpMethod: "POST",
        httpVersion: "HTTP11",
        // Appsmith API action config is version-dependent. We provide both url and path (best-effort).
        url: `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={{appsmith.store.GEMINI_API_KEY}}`,
        path: `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={{appsmith.store.GEMINI_API_KEY}}`,
        headers: [
          { key: "Content-Type", value: "application/json" },
        ],
        queryParameters: [],
        body: `{\"content\":{\"parts\":[{\"text\":\"{{Input_Busca.text}}\"}]}}`,
        bodyFormData: [],
        formData: { apiContentType: "application/json" },
        pluginSpecifiedTemplates: [{ value: false }],
      },
        dynamicBindingPathList: [
          { key: "actionConfiguration.body" },
          { key: "actionConfiguration.url" },
          { key: "actionConfiguration.path" },
        ],
      },
      headers: { "Content-Type": "application/json" },
    }));

  // Create action: BuscarNormas (Postgres)
  const buscarNormasSql =
    "select id, conteudo_texto, similarity, metadata\n" +
    "from match_documents(\n" +
    "  ( '{{\"[\" + (GerarEmbedding.data.embedding.values || []).join(\",\") + \"]\"}}' )::vector,\n" +
    "  0.5,\n" +
    "  5\n" +
    ");";

  const buscarNormas =
    getActionByName("BuscarNormas") ||
    (await request("post", "/api/v1/actions", {
      data: {
        name: "BuscarNormas",
      pageId,
      applicationId,
      workspaceId,
      pluginId: PLUGIN_POSTGRES,
      pluginType: "DB",
      datasource: {
        id: postgresDatasourceId,
        name: supabaseDs.name,
        pluginId: PLUGIN_POSTGRES,
        datasourceStorages: {},
        messages: [],
        invalids: [],
        isValid: true,
        userPermissions: [],
      },
      actionConfiguration: {
        timeoutInMillisecond: 20000,
        paginationType: "NONE",
        encodeParamsToggle: true,
        body: buscarNormasSql,
        pluginSpecifiedTemplates: [{ value: false }],
      },
        dynamicBindingPathList: [{ key: "body" }],
      },
      headers: { "Content-Type": "application/json" },
    }));

  // Fetch page DSL + layoutId
  const pageFull = await request("get", `/api/v1/pages/${encodeURIComponent(pageId)}`, {
    params: { migrateDsl: "false" },
  });
  const layout = pageFull?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("Could not get layoutId/dsl for page.");
  const layoutId = layout.id;
  const dsl = JSON.parse(JSON.stringify(layout.dsl));

  // Insert widgets into root canvas children
  if (!Array.isArray(dsl.children)) dsl.children = [];
  const rootId = dsl.widgetId;
  if (!rootId) throw new Error("DSL root missing widgetId");

  const existingNames = new Set();
  const walk = (w) => {
    if (!w) return;
    if (w.widgetName) existingNames.add(w.widgetName);
    if (Array.isArray(w.children)) for (const c of w.children) walk(c);
  };
  walk(dsl);

  function addWidget(w) {
    if (!existingNames.has(w.widgetName)) {
      dsl.children.push(w);
      existingNames.add(w.widgetName);
    }
  }

  function findChildByName(name) {
    return (Array.isArray(dsl.children) ? dsl.children : []).find((c) => c?.widgetName === name) || null;
  }

  function mkBase(widgetName, type, pos) {
    return {
      widgetId: crypto.randomUUID(),
      widgetName,
      type,
      parentId: rootId,
      left: pos.left,
      top: pos.top,
      right: pos.right,
      bottom: pos.bottom,
      isVisible: true,
      version: 1,
      children: [],
      dynamicBindingPathList: [],
      dynamicTriggerPathList: [],
      dynamicPropertyPathList: [],
    };
  }

  // Input
  if (!existingNames.has("Input_Busca")) {
    const w = mkBase("Input_Busca", "INPUT_WIDGET_V2", { left: 0, top: 0, right: 40, bottom: 6 });
    w.label = "O que voce procura?";
    w.labelPosition = "Top";
    w.placeholderText = "Digite um trecho da norma...";
    addWidget(w);
  }

  // Button
  if (!existingNames.has("Btn_Buscar")) {
    const w = mkBase("Btn_Buscar", "BUTTON_WIDGET", { left: 41, top: 0, right: 56, bottom: 6 });
    w.text = "Buscar";
    w.onClick = "{{GerarEmbedding.run().then(() => BuscarNormas.run())}}";
    w.dynamicTriggerPathList = [{ key: "onClick" }];
    addWidget(w);
  }

  // Gemini API key helper (stores in appsmith.store.GEMINI_API_KEY)
  if (!existingNames.has("Input_ApiKey")) {
    const w = mkBase("Input_ApiKey", "INPUT_WIDGET_V2", { left: 0, top: 7, right: 40, bottom: 13 });
    w.label = "Gemini API Key";
    w.labelPosition = "Top";
    w.placeholderText = "Cole sua chave aqui (nao sera commitado)";
    addWidget(w);
  }

  if (!existingNames.has("Btn_SalvarKey")) {
    const w = mkBase("Btn_SalvarKey", "BUTTON_WIDGET", { left: 41, top: 7, right: 56, bottom: 13 });
    w.text = "Salvar Key";
    w.onClick = "{{storeValue('GEMINI_API_KEY', Input_ApiKey.text)}}";
    w.dynamicTriggerPathList = [{ key: "onClick" }];
    addWidget(w);
  }

  // Table
  {
    const existing = findChildByName("Table_Resultados");
    if (existing) {
      // Make room for the API key row.
      existing.top = 14;
      if (typeof existing.bottom === "number" && existing.bottom < 20) existing.bottom = 30;
      if (existing.tableData == null) existing.tableData = "{{BuscarNormas.data}}";
      if (!Array.isArray(existing.dynamicBindingPathList)) existing.dynamicBindingPathList = [];
      if (!existing.dynamicBindingPathList.some((e) => e && e.key === "tableData")) existing.dynamicBindingPathList.push({ key: "tableData" });
    } else {
      const w = mkBase("Table_Resultados", "TABLE_WIDGET", { left: 0, top: 14, right: 56, bottom: 30 });
      w.tableData = "{{BuscarNormas.data}}";
      w.dynamicBindingPathList = [{ key: "tableData" }];
      w.primaryColumns = {
        id: { id: "id", label: "id", columnType: "number", computedValue: "{{currentRow.id}}", isVisible: true },
        similarity: { id: "similarity", label: "similarity", columnType: "number", computedValue: "{{currentRow.similarity}}", isVisible: true },
        conteudo_texto: {
          id: "conteudo_texto",
          label: "conteudo_texto",
          columnType: "text",
          computedValue: "{{currentRow.conteudo_texto}}",
          isVisible: true,
        },
      };
      w.columnOrder = ["similarity", "conteudo_texto", "id"];
      addWidget(w);
    }
  }

  // Save DSL back
  const saved = await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(pageId)}`, {
    params: { applicationId },
    data: { dsl },
    headers: { "Content-Type": "application/json" },
  });

  // Deploy/publish so the /app/... (view mode) is not blank.
  // Endpoint confirmed in Appsmith client bundle: v1/applications/publish/{applicationId}
  const published = await request("post", `/api/v1/applications/publish/${encodeURIComponent(applicationId)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  const appLink = `${baseUrl.replace(/\\+$/, "").replace(/\/+$/, "")}/app/${appSlug}/${pageSlug}-${pageId}`;

  const result = {
    workspaceId,
    applicationId,
    appSlug,
    pageId,
    pageSlug,
    layoutId,
    actions: {
      GerarEmbedding: gerarEmbedding?.data?.id || gerarEmbedding?.id || null,
      BuscarNormas: buscarNormas?.data?.id || buscarNormas?.id || null,
    },
    link: appLink,
    savedPreview: safeJsonPreview(saved, 600),
    publishedPreview: safeJsonPreview(published, 300),
  };

  const outPath = path.join(outDir, `fase2-busca-rag-${nowStamp()}.json`);
  await fs.writeFile(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log(JSON.stringify(result, null, 2));
  console.error(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
