/* eslint-disable no-console */
// Tunes Busca_Normas: lower threshold/count and add user feedback on search.

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

async function loadEnvFromSecretsFile() {
  const secretsPath = path.join(process.cwd(), "MEUS_SEGREDOS.txt");
  try {
    // Some Windows editors may save UTF-8 with BOM; strip it so regex matches the first key.
    const raw = (await fs.readFile(secretsPath, "utf8")).replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+):\s*(.+)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // ignore
  }
}

async function main() {
  await loadEnvFromSecretsFile();

  const baseUrl = process.env.APPSMITH_URL;
  const email = process.env.APPSMITH_EMAIL;
  const password = process.env.APPSMITH_PASSWORD;
  if (!baseUrl || !email || !password) throw new Error("Missing APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD");

  const applicationId = "6992325c8a3a0012fc7c5ed5";
  const pageId = "6992325c8a3a0012fc7c5ed7";

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

  const xsrf = async () => {
    const cookies = await jar.getCookies(baseUrl);
    return cookies.find((c) => c.key === "XSRF-TOKEN")?.value || "";
  };

  const request = async (method, url, { params, data, headers } = {}) => {
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
      throw new Error(`${m.toUpperCase()} ${url} failed: HTTP ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
    }
    return r.data;
  };

  // login
  await request("get", "/api/v1/users/me");
  const token = await xsrf();
  const body = new URLSearchParams({ username: email, password }).toString();
  await request("post", "/api/v1/login", {
    data: body,
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-XSRF-TOKEN": token },
  });

  // Update BuscarNormas SQL
  const actionsResp = await request("get", "/api/v1/actions", { params: { pageId } });
  const actions = Array.isArray(actionsResp?.data) ? actionsResp.data : [];
  const gerar = actions.find((a) => a?.name === "GerarEmbedding");
  const buscar = actions.find((a) => a?.name === "BuscarNormas");
  if (!gerar?.id) throw new Error("GerarEmbedding action not found");
  if (!buscar?.id) throw new Error("BuscarNormas action not found");

  // Ensure GerarEmbedding uses an available embedding model and passes API key via header.
  gerar.actionConfiguration = gerar.actionConfiguration || {};
  gerar.actionConfiguration.httpMethod = "POST";
  gerar.actionConfiguration.httpVersion = "HTTP11";
  gerar.actionConfiguration.timeoutInMillisecond = 20000;
  gerar.actionConfiguration.paginationType = "NONE";
  gerar.actionConfiguration.encodeParamsToggle = true;
  gerar.actionConfiguration.path = "/v1beta/models/gemini-embedding-001:embedContent";
  gerar.actionConfiguration.headers = [
    { key: "Content-Type", value: "application/json" },
    { key: "x-goog-api-key", value: "{{this.params.key}}" },
  ];
  gerar.actionConfiguration.queryParameters = [];
  gerar.actionConfiguration.body = "{\"content\":{\"parts\":[{\"text\":\"{{this.params.text}}\"}]},\"outputDimensionality\":768}";
  gerar.actionConfiguration.bodyFormData = [];
  gerar.actionConfiguration.formData = { apiContentType: "application/json" };
  gerar.actionConfiguration.pluginSpecifiedTemplates = [{ value: false }];
  gerar.dynamicBindingPathList = [
    { key: "actionConfiguration.body" },
    { key: "actionConfiguration.path" },
    { key: "actionConfiguration.headers" },
  ];

  await request("put", `/api/v1/actions/${encodeURIComponent(gerar.id)}`, {
    data: gerar,
    headers: { "Content-Type": "application/json" },
  });

  const tunedSql =
    "select id, conteudo_texto, similarity, metadata\n" +
    "from match_documents(\n" +
    // Keep bindings compatible with older JS parsers (avoid optional chaining).
    "  ( '{{\"[\" + ((GerarEmbedding.data && GerarEmbedding.data.embedding && GerarEmbedding.data.embedding.values) ? GerarEmbedding.data.embedding.values : []).join(\",\") + \"]\"}}' )::vector(768),\n" +
    "  0.2,\n" +
    "  10\n" +
    ");";

  buscar.actionConfiguration = buscar.actionConfiguration || {};
  buscar.actionConfiguration.body = tunedSql;
  buscar.dynamicBindingPathList = [{ key: "body" }];

  await request("put", `/api/v1/actions/${encodeURIComponent(buscar.id)}`, {
    data: buscar,
    headers: { "Content-Type": "application/json" },
  });

  // Update Btn_Buscar onClick feedback
  const page = await request("get", `/api/v1/pages/${encodeURIComponent(pageId)}`, { params: { migrateDsl: "false" } });
  const layout = page?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("No layout/dsl found");
  const layoutId = layout.id;
  const dsl = JSON.parse(JSON.stringify(layout.dsl));
  if (!Array.isArray(dsl.children)) dsl.children = [];

  const btn = dsl.children.find((c) => c?.widgetName === "Btn_Buscar");
  if (!btn) throw new Error("Btn_Buscar not found");

  const tbl = dsl.children.find((c) => c?.widgetName === "Table_Resultados");
  if (!tbl) throw new Error("Table_Resultados not found");

  btn.onClick =
    "{{\n" +
    "  (function(){\n" +
    "    var key = appsmith.store.GEMINI_API_KEY;\n" +
    "    var q = (Input_Busca.text || '').trim();\n" +
    "    if (!key) {\n" +
    "      showAlert('Defina a Gemini API Key e clique em Salvar Key antes de buscar.', 'warning');\n" +
    "      return;\n" +
    "    }\n" +
    "    if (!q) {\n" +
    "      showAlert('Digite o que voce procura no campo de busca.', 'warning');\n" +
    "      return;\n" +
    "    }\n" +
    "    showAlert('Buscando...', 'info');\n" +
    "    GerarEmbedding.run({ key: key, text: q })\n" +
    "      .then(() => {\n" +
    "        var v = (GerarEmbedding.data && GerarEmbedding.data.embedding && GerarEmbedding.data.embedding.values) ? GerarEmbedding.data.embedding.values : [];\n" +
    "        if (!v || !v.length) {\n" +
    "          showAlert('Embedding vazio. Verifique a API key e o texto.', 'error');\n" +
    "          return;\n" +
    "        }\n" +
    "        if (v.length !== 768) {\n" +
    "          showAlert('Embedding invalido (len=' + v.length + ').', 'error');\n" +
    "          return;\n" +
    "        }\n" +
    "        return BuscarNormas.run();\n" +
    "      })\n" +
    "      .then(() => {\n" +
    "        var n = (BuscarNormas.data && BuscarNormas.data.length) ? BuscarNormas.data.length : 0;\n" +
    "        showAlert('Resultados: ' + n, n ? 'success' : 'warning');\n" +
    "      })\n" +
    "      .catch((e) => {\n" +
    "        var msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : '');\n" +
    "        showAlert('Falha na busca. ' + (msg ? msg.slice(0,120) : 'Abra os logs de GerarEmbedding/BuscarNormas.'), 'error');\n" +
    "      });\n" +
    "  })()\n" +
    "}}";

  if (!Array.isArray(btn.dynamicTriggerPathList)) btn.dynamicTriggerPathList = [];
  if (!btn.dynamicTriggerPathList.some((e) => e && e.key === "onClick")) btn.dynamicTriggerPathList.push({ key: "onClick" });

  // Ensure table doesn't break if BuscarNormas.data is an error string/object.
  tbl.tableData = "{{Array.isArray(BuscarNormas.data) ? BuscarNormas.data : []}}";
  if (!Array.isArray(tbl.dynamicBindingPathList)) tbl.dynamicBindingPathList = [];
  if (!tbl.dynamicBindingPathList.some((e) => e && e.key === "tableData")) tbl.dynamicBindingPathList.push({ key: "tableData" });

  // Fix table column computedValue bindings (some versions import with truncated keys).
  tbl.primaryColumns = tbl.primaryColumns || {};
  if (tbl.primaryColumns.id) tbl.primaryColumns.id.computedValue = "{{currentRow.id}}";
  if (tbl.primaryColumns.conteudo_texto) tbl.primaryColumns.conteudo_texto.computedValue = "{{currentRow.conteudo_texto}}";
  if (tbl.primaryColumns.similarity) tbl.primaryColumns.similarity.computedValue = "{{currentRow.similarity}}";
  if (!Array.isArray(tbl.dynamicBindingPathList)) tbl.dynamicBindingPathList = [];
  const ensureDb = (key) => {
    if (!tbl.dynamicBindingPathList.some((e) => e && e.key === key)) tbl.dynamicBindingPathList.push({ key });
  };
  ensureDb("primaryColumns.id.computedValue");
  ensureDb("primaryColumns.conteudo_texto.computedValue");
  ensureDb("primaryColumns.similarity.computedValue");

  // Update/Add a small debug text for quick triage
  const dbgText =
    "Debug: key={{!!appsmith.store.GEMINI_API_KEY}} " +
    "embedLen={{(GerarEmbedding.data && GerarEmbedding.data.embedding && GerarEmbedding.data.embedding.values) ? GerarEmbedding.data.embedding.values.length : 0}} " +
    "buscarIsArray={{Array.isArray(BuscarNormas.data)}} " +
    "buscarLen={{(BuscarNormas.data && BuscarNormas.data.length) ? BuscarNormas.data.length : 0}}";

  const dbg = dsl.children.find((c) => c?.widgetName === "Txt_DebugBusca");
  if (dbg) {
    dbg.text = dbgText;
    if (!Array.isArray(dbg.dynamicBindingPathList)) dbg.dynamicBindingPathList = [];
    if (!dbg.dynamicBindingPathList.some((e) => e && e.key === "text")) dbg.dynamicBindingPathList.push({ key: "text" });
  } else {
    dsl.children.push({
      widgetId: crypto.randomUUID(),
      widgetName: "Txt_DebugBusca",
      type: "TEXT_WIDGET",
      parentId: dsl.widgetId,
      leftColumn: 0,
      rightColumn: 56,
      topRow: 52,
      bottomRow: 56,
      detachFromLayout: false,
      isVisible: true,
      text: dbgText,
      dynamicBindingPathList: [{ key: "text" }],
      dynamicTriggerPathList: [],
      dynamicPropertyPathList: [],
      children: [],
      version: 1,
    });
  }

  await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(pageId)}`, {
    params: { applicationId },
    // Clear on-load auto executions so the page doesn't call Gemini with empty input.
    data: { dsl, layoutOnLoadActions: [], layoutOnLoadActionErrors: [] },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(applicationId)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(JSON.stringify({ ok: true, updatedActionId: buscar.id, layoutId }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
