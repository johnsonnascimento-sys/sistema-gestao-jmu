/* eslint-disable no-console */
// Improves Busca_Normas result context:
// - Adds norma_id/chunk_index/source_url in query output (joins by id)
// - Adds table columns: norma_id, artigo
// - Keeps existing search flow/store logic intact
//
// Usage:
//   node scripts/appsmith_phase2_show_norma_context.js

const fs = require("node:fs/promises");
const path = require("node:path");

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const APPLICATION_ID = "6992325c8a3a0012fc7c5ed5";
const PAGE_ID = "6992325c8a3a0012fc7c5ed7";

async function loadEnvFromSecretsFile() {
  const secretsPath = path.join(process.cwd(), "MEUS_SEGREDOS.txt");
  try {
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

function deepCloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function traverseWidgets(root, cb) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    cb(node);
    const children = Array.isArray(node.children) ? node.children : [];
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i]);
  }
}

function findWidgetByName(root, widgetName) {
  let found = null;
  traverseWidgets(root, (w) => {
    if (!found && w?.widgetName === widgetName) found = w;
  });
  return found;
}

function ensureDynBinding(widget, key) {
  if (!widget || !key) return;
  if (!Array.isArray(widget.dynamicBindingPathList)) widget.dynamicBindingPathList = [];
  if (!widget.dynamicBindingPathList.some((e) => e && e.key === key)) widget.dynamicBindingPathList.push({ key });
}

async function main() {
  await loadEnvFromSecretsFile();

  const baseUrl = process.env.APPSMITH_URL;
  const email = process.env.APPSMITH_EMAIL;
  const password = process.env.APPSMITH_PASSWORD;
  if (!baseUrl || !email || !password) throw new Error("Missing APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD");

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
    if (r.status >= 400) throw new Error(`${m.toUpperCase()} ${url} failed: HTTP ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
    return r.data;
  };

  await request("get", "/api/v1/users/me");
  await request("post", "/api/v1/login", {
    data: new URLSearchParams({ username: email, password }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-XSRF-TOKEN": await xsrf() },
  });

  const actionsResp = await request("get", "/api/v1/actions", { params: { pageId: PAGE_ID } });
  const actions = Array.isArray(actionsResp?.data) ? actionsResp.data : [];
  const buscarNormas = actions.find((a) => a?.name === "BuscarNormas");
  const buscarNormasFTS = actions.find((a) => a?.name === "BuscarNormasFTS");
  if (!buscarNormas || !buscarNormasFTS) throw new Error("Actions BuscarNormas/BuscarNormasFTS not found");

  const sqlSemantica =
    "select\n" +
    "  r.id,\n" +
    "  ni.norma_id,\n" +
    "  ni.chunk_index,\n" +
    "  r.conteudo_texto,\n" +
    "  r.similarity,\n" +
    "  r.metadata,\n" +
    "  coalesce(r.metadata->>'source_url', ni.metadata->>'source_url', '') as source_url\n" +
    "from match_documents(\n" +
    "  ('{{this.params.vector || \"[]\"}}')::vector(768),\n" +
    "  0.2,\n" +
    "  10\n" +
    ") r\n" +
    "join adminlog.normas_index ni on ni.id = r.id\n" +
    "order by r.similarity desc;";

  const sqlLexica =
    "with r as (\n" +
    "  select id, conteudo_texto, similarity, metadata\n" +
    "  from match_documents_lexical(\n" +
    "    $q${{((this.params.text || Input_Busca.text || \"\") + \"\").trim()}}$q$,\n" +
    "    10\n" +
    "  )\n" +
    ")\n" +
    "select\n" +
    "  r.id,\n" +
    "  ni.norma_id,\n" +
    "  ni.chunk_index,\n" +
    "  r.conteudo_texto,\n" +
    "  r.similarity,\n" +
    "  r.metadata,\n" +
    "  coalesce(r.metadata->>'source_url', ni.metadata->>'source_url', '') as source_url\n" +
    "from r\n" +
    "join adminlog.normas_index ni on ni.id = r.id\n" +
    "order by r.similarity desc;";

  const updSem = deepCloneJson(buscarNormas);
  updSem.actionConfiguration = updSem.actionConfiguration || {};
  updSem.actionConfiguration.body = sqlSemantica;
  await request("put", `/api/v1/actions/${encodeURIComponent(updSem.id)}`, {
    data: updSem,
    headers: { "Content-Type": "application/json" },
  });

  const updFts = deepCloneJson(buscarNormasFTS);
  updFts.actionConfiguration = updFts.actionConfiguration || {};
  updFts.actionConfiguration.body = sqlLexica;
  await request("put", `/api/v1/actions/${encodeURIComponent(updFts.id)}`, {
    data: updFts,
    headers: { "Content-Type": "application/json" },
  });

  const page = await request("get", `/api/v1/pages/${encodeURIComponent(PAGE_ID)}`, { params: { migrateDsl: "false" } });
  const layout = page?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("No layout/dsl found");
  const layoutId = layout.id;
  const dsl = deepCloneJson(layout.dsl);

  const table = findWidgetByName(dsl, "Table_Resultados");
  if (!table) throw new Error("Table_Resultados not found");

  table.primaryColumns = table.primaryColumns || {};

  table.primaryColumns.norma_id = {
    id: "norma_id",
    label: "norma_id",
    columnType: "text",
    computedValue: "{{currentRow.norma_id}}",
    isVisible: true,
  };
  table.primaryColumns.artigo = {
    id: "artigo",
    label: "artigo",
    columnType: "text",
    computedValue:
      "{{\n" +
      "  (function(){\n" +
      "    var txt = String(currentRow.conteudo_texto || '');\n" +
      "    var m = txt.match(/Art\\.?\\s*\\d+[A-Za-zº°-]*/i);\n" +
      "    return m ? m[0] : '-';\n" +
      "  })()\n" +
      "}}",
    isVisible: true,
  };
  table.primaryColumns.chunk_index = {
    id: "chunk_index",
    label: "chunk",
    columnType: "number",
    computedValue: "{{currentRow.chunk_index}}",
    isVisible: false,
  };
  table.primaryColumns.source_url = {
    id: "source_url",
    label: "fonte",
    columnType: "text",
    computedValue: "{{currentRow.source_url || ''}}",
    isVisible: false,
  };

  table.columnOrder = ["tipo", "norma_id", "artigo", "similarity", "conteudo_texto", "id"];
  ensureDynBinding(table, "primaryColumns.norma_id.computedValue");
  ensureDynBinding(table, "primaryColumns.artigo.computedValue");
  ensureDynBinding(table, "primaryColumns.chunk_index.computedValue");
  ensureDynBinding(table, "primaryColumns.source_url.computedValue");

  await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(PAGE_ID)}`, {
    params: { applicationId: APPLICATION_ID },
    data: { dsl, layoutOnLoadActions: [], layoutOnLoadActionErrors: [] },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(APPLICATION_ID)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        applicationId: APPLICATION_ID,
        pageId: PAGE_ID,
        layoutId,
        updatedActions: [updSem.name, updFts.name],
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});

