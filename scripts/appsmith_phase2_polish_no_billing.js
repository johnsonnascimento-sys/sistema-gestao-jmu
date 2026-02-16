/* eslint-disable no-console */
// Polishes Busca_Normas for "no billing" mode:
// - Add Clear API Key button
// - Add local (client-side) rate window counter + "remaining" estimate (best-effort)
// - Fix footer text overlap (grid positioning) and remove legacy left/top fields
// - Ensure Gemini embedding action uses a valid model for this project key
// - Keep automatic fallback to FTS

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

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

function ensureDynTrigger(widget, key) {
  if (!widget || !key) return;
  if (!Array.isArray(widget.dynamicTriggerPathList)) widget.dynamicTriggerPathList = [];
  if (!widget.dynamicTriggerPathList.some((e) => e && e.key === key)) widget.dynamicTriggerPathList.push({ key });
}

function ensureChild(root, widget) {
  if (!Array.isArray(root.children)) root.children = [];
  const existing = root.children.find((c) => c?.widgetName === widget.widgetName);
  if (existing) return existing;
  root.children.push(widget);
  return widget;
}

function removeLegacyPosFields(widget) {
  // Some earlier patches introduced FIXED-layout fields (left/top/right/bottom). Remove them so grid wins.
  delete widget.left;
  delete widget.right;
  delete widget.top;
  delete widget.bottom;
}

function setGridPos(widget, { leftColumn, rightColumn, topRow, bottomRow }) {
  widget.leftColumn = leftColumn;
  widget.rightColumn = rightColumn;
  widget.topRow = topRow;
  widget.bottomRow = bottomRow;
  widget.detachFromLayout = false;
  removeLegacyPosFields(widget);
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
    if (r.status >= 400) throw new Error(`${m.toUpperCase()} ${url} failed: HTTP ${r.status}\n${JSON.stringify(r.data, null, 2)}`);
    return r.data;
  };

  // login
  await request("get", "/api/v1/users/me");
  const token = await xsrf();
  await request("post", "/api/v1/login", {
    data: new URLSearchParams({ username: email, password }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-XSRF-TOKEN": token },
  });

  // Fetch actions
  const actionsResp = await request("get", "/api/v1/actions", { params: { pageId } });
  const actions = Array.isArray(actionsResp?.data) ? actionsResp.data : [];
  const gerar = actions.find((a) => a?.name === "GerarEmbedding");
  const buscar = actions.find((a) => a?.name === "BuscarNormas");
  const fts = actions.find((a) => a?.name === "BuscarNormasFTS");
  if (!gerar?.id || !buscar?.id || !fts?.id) throw new Error("Missing expected actions (GerarEmbedding/BuscarNormas/BuscarNormasFTS)");

  // Ensure embedding uses gemini-embedding-001 with outputDimensionality 768
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
  gerar.actionConfiguration.formData = { apiContentType: "application/json" };
  gerar.actionConfiguration.pluginSpecifiedTemplates = [{ value: false }];
  gerar.dynamicBindingPathList = [
    { key: "actionConfiguration.body" },
    { key: "actionConfiguration.path" },
    { key: "actionConfiguration.headers" },
  ];
  await request("put", `/api/v1/actions/${encodeURIComponent(gerar.id)}`, { data: gerar, headers: { "Content-Type": "application/json" } });

  // Ensure FTS action is parameterized (avoid relying on widget context inside SQL).
  fts.actionConfiguration = fts.actionConfiguration || {};
  fts.actionConfiguration.timeoutInMillisecond = 20000;
  fts.actionConfiguration.paginationType = "NONE";
  fts.actionConfiguration.encodeParamsToggle = true;
  fts.actionConfiguration.body =
    "select id, conteudo_texto, similarity, metadata\n" +
    "from match_documents_lexical(\n" +
    "  $q${{this.params.text || \"\"}}$q$,\n" +
    "  10\n" +
    ");";
  fts.actionConfiguration.pluginSpecifiedTemplates = [{ value: false }];
  fts.dynamicBindingPathList = [{ key: "body" }];
  fts.runBehaviour = "MANUAL";
  await request("put", `/api/v1/actions/${encodeURIComponent(fts.id)}`, {
    data: fts,
    headers: { "Content-Type": "application/json" },
  });

  // Fetch page DSL
  const page = await request("get", `/api/v1/pages/${encodeURIComponent(pageId)}`, { params: { migrateDsl: "false" } });
  const layout = page?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("No layout/dsl found");
  const layoutId = layout.id;
  const dsl = deepCloneJson(layout.dsl);
  if (!Array.isArray(dsl.children)) dsl.children = [];
  const rootId = dsl.widgetId;

  // Input_ApiKey should reflect store and be clearable.
  const inputKey = findWidgetByName(dsl, "Input_ApiKey");
  if (inputKey) {
    inputKey.defaultText = "{{appsmith.store.GEMINI_API_KEY || ''}}";
    ensureDynBinding(inputKey, "defaultText");
  }

  // Add Clear Key button next to Salvar Key.
  const btnClearName = "Btn_LimparKey";
  let btnClear = findWidgetByName(dsl, btnClearName);
  if (!btnClear) {
    btnClear = ensureChild(dsl, {
      widgetId: crypto.randomUUID(),
      widgetName: btnClearName,
      type: "BUTTON_WIDGET",
      parentId: rootId,
      version: 1,
      children: [],
      dynamicBindingPathList: [],
      dynamicTriggerPathList: [],
      dynamicPropertyPathList: [],
      text: "Apagar Key",
      buttonVariant: "TERTIARY",
      isVisible: true,
      borderRadius: "0px",
      recaptchaType: "V3",
      zIndex: 1,
    });
  }
  btnClear.onClick =
    "{{storeValue('GEMINI_API_KEY', '').then(() => showAlert('API key apagada do store', 'success'))}}";
  ensureDynTrigger(btnClear, "onClick");
  btnClear.buttonVariant = "SECONDARY";
  btnClear.isDisabled = "{{!appsmith.store.GEMINI_API_KEY}}";
  btnClear.isVisible = true;
  ensureDynBinding(btnClear, "isDisabled");
  // Position inside the API Key row block (7..13) to avoid overlapping the table (starts at 14).
  setGridPos(btnClear, { leftColumn: 41, rightColumn: 56, topRow: 10, bottomRow: 13 });

  // Adjust Salvar Key to share the block with Apagar Key (no overlap).
  const btnSave = findWidgetByName(dsl, "Btn_SalvarKey");
  if (btnSave) setGridPos(btnSave, { leftColumn: 41, rightColumn: 56, topRow: 7, bottomRow: 10 });

  // Improve footer layout: stack KeyStatus, Build, Debug, Quota without overlap.
  const keyStatus = findWidgetByName(dsl, "Txt_KeyStatus");
  const build = findWidgetByName(dsl, "Txt_Build");
  const dbg = findWidgetByName(dsl, "Txt_DebugBusca");

  if (keyStatus) setGridPos(keyStatus, { leftColumn: 0, rightColumn: 56, topRow: 47, bottomRow: 51 });
  if (build) setGridPos(build, { leftColumn: 0, rightColumn: 56, topRow: 51, bottomRow: 55 });
  if (dbg) setGridPos(dbg, { leftColumn: 0, rightColumn: 56, topRow: 55, bottomRow: 61 });

  // Quota/usage estimate widget (local counter; cannot fetch real remaining quota from API key alone).
  const quotaName = "Txt_Quota";
  let quota = findWidgetByName(dsl, quotaName);
  if (!quota) {
    quota = ensureChild(dsl, {
      widgetId: crypto.randomUUID(),
      widgetName: quotaName,
      type: "TEXT_WIDGET",
      parentId: rootId,
      version: 1,
      children: [],
      dynamicBindingPathList: [],
      dynamicTriggerPathList: [],
      dynamicPropertyPathList: [],
      isVisible: true,
    });
  }
  quota.text =
    "{{\n" +
    "  (function(){\n" +
    "    var rpmLimit = 100; // best-effort default for free tier\n" +
    "    var start = appsmith.store.GEMINI_WINDOW_START || 0;\n" +
    "    var used = appsmith.store.GEMINI_WINDOW_COUNT || 0;\n" +
    "    var now = Date.now();\n" +
    "    var age = start ? Math.max(0, Math.floor((now - start)/1000)) : 0;\n" +
    "    var remaining = Math.max(0, rpmLimit - used);\n" +
    "    return 'Quota (estimativa local): RPM ' + used + '/' + rpmLimit + ' (janela ' + age + 's), restante~ ' + remaining + '. ' +\n" +
    "      'Chamadas embedding na sessao: ' + (appsmith.store.GEMINI_TOTAL_CALLS || 0) + '.';\n" +
    "  })()\n" +
    "}}";
  ensureDynBinding(quota, "text");
  setGridPos(quota, { leftColumn: 0, rightColumn: 56, topRow: 61, bottomRow: 67 });

  // Update search button to keep counters and use FTS fallback.
  const btnBuscar = findWidgetByName(dsl, "Btn_Buscar");
  if (btnBuscar) {
    btnBuscar.onClick =
      "{{\n" +
      "  (function(){\n" +
      "    var key = appsmith.store.GEMINI_API_KEY;\n" +
      "    var q = (Input_Busca.text || '').trim();\n" +
      "    if (!q) {\n" +
      "      showAlert('Digite o que voce procura no campo de busca.', 'warning');\n" +
      "      return;\n" +
      "    }\n" +
      "\n" +
      "    function runFts(){\n" +
      "      return BuscarNormasFTS.run({ text: q })\n" +
      "        .then(() => {\n" +
      "          var n = (BuscarNormasFTS.data && BuscarNormasFTS.data.length) ? BuscarNormasFTS.data.length : 0;\n" +
      "          showAlert('Resultados (texto): ' + n, n ? 'success' : 'warning');\n" +
      "        });\n" +
      "    }\n" +
      "\n" +
      "    if (!key) {\n" +
      "      showAlert('Sem API key: usando busca por texto (FTS).', 'info');\n" +
      "      runFts().catch(() => showAlert('Falha na busca por texto. Veja logs de BuscarNormasFTS.', 'error'));\n" +
      "      return;\n" +
      "    }\n" +
      "\n" +
      "    // Local rate-window counters (best-effort)\n" +
      "    var now = Date.now();\n" +
      "    var start = appsmith.store.GEMINI_WINDOW_START || 0;\n" +
      "    var used = appsmith.store.GEMINI_WINDOW_COUNT || 0;\n" +
      "    if (!start || (now - start) > 60000) {\n" +
      "      start = now;\n" +
      "      used = 0;\n" +
      "      storeValue('GEMINI_WINDOW_START', start);\n" +
      "      storeValue('GEMINI_WINDOW_COUNT', used);\n" +
      "    }\n" +
      "    used = used + 1;\n" +
      "    storeValue('GEMINI_WINDOW_COUNT', used);\n" +
      "    storeValue('GEMINI_TOTAL_CALLS', (appsmith.store.GEMINI_TOTAL_CALLS || 0) + 1);\n" +
      "\n" +
      "    showAlert('Buscando (semantica)...', 'info');\n" +
      "    GerarEmbedding.run({ key: key, text: q })\n" +
      "      .then(() => {\n" +
      "        var v = (GerarEmbedding.data && GerarEmbedding.data.embedding && GerarEmbedding.data.embedding.values) ? GerarEmbedding.data.embedding.values : [];\n" +
      "        if (!v || !v.length) throw new Error('Embedding vazio');\n" +
      "        if (v.length !== 768) throw new Error('Embedding invalido (len=' + v.length + ')');\n" +
      "        return BuscarNormas.run();\n" +
      "      })\n" +
      "      .then(() => {\n" +
      "        var n = (BuscarNormas.data && BuscarNormas.data.length) ? BuscarNormas.data.length : 0;\n" +
      "        showAlert('Resultados (semantica): ' + n, n ? 'success' : 'warning');\n" +
      "      })\n" +
      "      .catch(() => {\n" +
      "        showAlert('Semantica falhou; usando busca por texto (FTS).', 'warning');\n" +
      "        runFts().catch(() => showAlert('Falha na busca por texto. Veja logs de BuscarNormasFTS.', 'error'));\n" +
      "      });\n" +
      "  })()\n" +
      "}}";
    ensureDynTrigger(btnBuscar, "onClick");
  }

  // Build tag
  if (build) {
    build.text = "{{\"Build: 2026-02-15 22:40Z (lexical FTS + logs tips)\"}}";
    ensureDynBinding(build, "text");
  }

  // Persist DSL + clear on-load actions (avoid calling Gemini with empty input on page open).
  await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(pageId)}`, {
    params: { applicationId },
    data: { dsl, layoutOnLoadActions: [], layoutOnLoadActionErrors: [] },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(applicationId)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(JSON.stringify({ ok: true, applicationId, pageId, layoutId }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
