/* eslint-disable no-console */
// Adds two UX improvements to Busca_Normas page:
// 1) Clear search button (clears input + old results/debug stores)
// 2) Search stats text with chunks and total occurrences of query term
//
// Usage:
//   node scripts/appsmith_phase2_add_clear_and_counts.js
//
// Reads APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD from MEUS_SEGREDOS.txt.

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

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

function ensureDynTrigger(widget, key) {
  if (!widget || !key) return;
  if (!Array.isArray(widget.dynamicTriggerPathList)) widget.dynamicTriggerPathList = [];
  if (!widget.dynamicTriggerPathList.some((e) => e && e.key === key)) widget.dynamicTriggerPathList.push({ key });
}

function mkBase(rootId, widgetName, type, left, top, right, bottom) {
  return {
    widgetId: crypto.randomUUID(),
    widgetName,
    type,
    parentId: rootId,
    leftColumn: left,
    topRow: top,
    rightColumn: right,
    bottomRow: bottom,
    isVisible: true,
    version: 1,
    children: [],
    dynamicBindingPathList: [],
    dynamicTriggerPathList: [],
    dynamicPropertyPathList: [],
  };
}

function setPos(widget, left, top, right, bottom) {
  widget.leftColumn = left;
  widget.topRow = top;
  widget.rightColumn = right;
  widget.bottomRow = bottom;
  delete widget.left;
  delete widget.top;
  delete widget.right;
  delete widget.bottom;
}

function ensureRootChildWidget(dsl, rootId, widgetName, type, left, top, right, bottom) {
  let w = findWidgetByName(dsl, widgetName);
  if (!w) {
    w = mkBase(rootId, widgetName, type, left, top, right, bottom);
    if (!Array.isArray(dsl.children)) dsl.children = [];
    dsl.children.push(w);
  }
  setPos(w, left, top, right, bottom);
  return w;
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
  const token = await xsrf();
  await request("post", "/api/v1/login", {
    data: new URLSearchParams({ username: email, password }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-XSRF-TOKEN": token },
  });

  const page = await request("get", `/api/v1/pages/${encodeURIComponent(PAGE_ID)}`, { params: { migrateDsl: "false" } });
  const layout = page?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("No layout/dsl found");
  const layoutId = layout.id;
  const dsl = deepCloneJson(layout.dsl);
  const rootId = dsl.widgetId;
  if (!rootId) throw new Error("Root widgetId missing");

  const btnBuscar = findWidgetByName(dsl, "Btn_Buscar");
  const tbl = findWidgetByName(dsl, "Table_Resultados");
  if (!btnBuscar) throw new Error("Btn_Buscar not found");
  if (!tbl) throw new Error("Table_Resultados not found");

  // Make room for clear button beside Buscar.
  setPos(btnBuscar, 41, 0, 48, 6);

  const btnLimparBusca = ensureRootChildWidget(dsl, rootId, "Btn_LimparBusca", "BUTTON_WIDGET", 49, 0, 56, 6);
  btnLimparBusca.text = "Limpar";
  btnLimparBusca.buttonColor = "#5f6b7a";
  btnLimparBusca.onClick =
    "{{\n" +
    "  (function(){\n" +
    "    resetWidget('Input_Busca', true);\n" +
    "    storeValue('SEARCH_QUERY', '');\n" +
    "    storeValue('SEARCH_RESULTS', []);\n" +
    "    storeValue('SEARCH_LEX_COUNT', 0);\n" +
    "    storeValue('SEARCH_SEM_COUNT', 0);\n" +
    "    storeValue('SEARCH_COMBINED_COUNT', 0);\n" +
    "    storeValue('MATCH_CHUNKS', 0);\n" +
    "    storeValue('MATCH_OCCURRENCES', 0);\n" +
    "    storeValue('LAST_ERROR', '');\n" +
    "    storeValue('DEBUG_INFO', {});\n" +
    "    showAlert('Busca limpa.', 'info');\n" +
    "  })()\n" +
    "}}";
  ensureDynTrigger(btnLimparBusca, "onClick");

  const txtBuscaStats = ensureRootChildWidget(dsl, rootId, "Txt_BuscaStats", "TEXT_WIDGET", 0, 46, 56, 49);
  txtBuscaStats.text =
    "{{\n" +
    "  'Busca: ' + (appsmith.store.SEARCH_QUERY || '-') +\n" +
    "  ' | Trechos: ' + (appsmith.store.MATCH_CHUNKS || 0) +\n" +
    "  ' | Ocorrencias: ' + (appsmith.store.MATCH_OCCURRENCES || 0)\n" +
    "}}";
  ensureDynBinding(txtBuscaStats, "text");

  // Shift footer block down by 2 rows to avoid overlap with stats line.
  const footerNames = ["Txt_KeyStatus", "Txt_Build", "Txt_DebugBusca", "Txt_Quota", "Txt_Erro"];
  for (const n of footerNames) {
    const w = findWidgetByName(dsl, n);
    if (!w) continue;
    const t = typeof w.topRow === "number" ? w.topRow : w.top;
    const b = typeof w.bottomRow === "number" ? w.bottomRow : w.bottom;
    if (typeof t === "number" && typeof b === "number") {
      setPos(w, w.leftColumn ?? w.left, t + 2, w.rightColumn ?? w.right, b + 2);
    }
  }

  // Update search logic: compute per-search chunk count and total term occurrences.
  btnBuscar.onClick =
    "{{\n" +
    "  (function(){\n" +
    "    var termo = (Input_Busca.text || '').trim();\n" +
    "    if (!termo) {\n" +
    "      showAlert('Digite algo para buscar!', 'warning');\n" +
    "      return;\n" +
    "    }\n" +
    "\n" +
    "    storeValue('IS_SEARCHING', true);\n" +
    "    storeValue('LAST_ERROR', '');\n" +
    "    storeValue('SEARCH_QUERY', termo);\n" +
    "\n" +
    "    function safeArray(x){ return Array.isArray(x) ? x : []; }\n" +
    "    function normalize(s){ return String(s || '').trim().toLowerCase().replace(/\\s+/g, ' '); }\n" +
    "    function normalizeFold(s){\n" +
    "      return normalize(s)\n" +
    "        .normalize('NFD')\n" +
    "        .replace(/[\\u0300-\\u036f]/g, '');\n" +
    "    }\n" +
    "    function hashString(s){\n" +
    "      var h = 2166136261;\n" +
    "      for (var i = 0; i < s.length; i++) {\n" +
    "        h ^= s.charCodeAt(i);\n" +
    "        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;\n" +
    "      }\n" +
    "      return String(h);\n" +
    "    }\n" +
    "    function countOccurrences(hay, needle){\n" +
    "      if (!needle) return 0;\n" +
    "      var c = 0; var pos = 0;\n" +
    "      while (true) {\n" +
    "        var idx = hay.indexOf(needle, pos);\n" +
    "        if (idx === -1) break;\n" +
    "        c += 1;\n" +
    "        pos = idx + needle.length;\n" +
    "      }\n" +
    "      return c;\n" +
    "    }\n" +
    "\n" +
    "    var apiKey = appsmith.store.GEMINI_API_KEY;\n" +
    "    var norm = normalize(termo);\n" +
    "    var cacheKey = 'CACHE_VEC_' + hashString(norm);\n" +
    "    var cachedVector = appsmith.store[cacheKey] || null;\n" +
    "    var wasCached = !!cachedVector;\n" +
    "\n" +
    "    var pLexica = BuscarNormasFTS.run({ text: termo })\n" +
    "      .then(function(res){\n" +
    "        res = safeArray(res);\n" +
    "        return res.map(function(item){ return Object.assign({}, item, { origin: 'lexical' }); });\n" +
    "      })\n" +
    "      .catch(function(err){\n" +
    "        var msg = (err && err.message) ? err.message : String(err);\n" +
    "        storeValue('LAST_ERROR', 'FTS: ' + msg);\n" +
    "        return [];\n" +
    "      });\n" +
    "\n" +
    "    var pSemantica = Promise.resolve([]);\n" +
    "    if (apiKey) {\n" +
    "      if (cachedVector) {\n" +
    "        pSemantica = BuscarNormas.run({ vector: cachedVector })\n" +
    "          .then(function(res){\n" +
    "            res = safeArray(res);\n" +
    "            return res.map(function(item){ return Object.assign({}, item, { origin: 'semantic' }); });\n" +
    "          })\n" +
    "          .catch(function(err){\n" +
    "            var msg = (err && err.message) ? err.message : String(err);\n" +
    "            storeValue('LAST_ERROR', 'SEM(cache): ' + msg);\n" +
    "            return [];\n" +
    "          });\n" +
    "      } else {\n" +
    "        pSemantica = GerarEmbedding2.run({ text: termo, key: apiKey })\n" +
    "          .then(function(resp){\n" +
    "            var v = (resp && resp.embedding && resp.embedding.values) ? resp.embedding.values : [];\n" +
    "            storeValue('LAST_EMBED_LEN', (v && v.length) ? v.length : 0);\n" +
    "            if (!v || !v.length) throw new Error('Embedding vazio');\n" +
    "            if (v.length !== 768) throw new Error('Embedding invalido (len=' + v.length + ')');\n" +
    "            var vectorStr = '[' + v.join(',') + ']';\n" +
    "            storeValue(cacheKey, vectorStr);\n" +
    "            var keys = appsmith.store.CACHE_VEC_KEYS;\n" +
    "            if (!Array.isArray(keys)) keys = [];\n" +
    "            if (keys.indexOf(cacheKey) === -1) keys.push(cacheKey);\n" +
    "            var MAX = 30;\n" +
    "            while (keys.length > MAX) {\n" +
    "              var oldKey = keys.shift();\n" +
    "              storeValue(oldKey, null);\n" +
    "            }\n" +
    "            storeValue('CACHE_VEC_KEYS', keys);\n" +
    "            return BuscarNormas.run({ vector: vectorStr });\n" +
    "          })\n" +
    "          .then(function(res){\n" +
    "            res = safeArray(res);\n" +
    "            return res.map(function(item){ return Object.assign({}, item, { origin: 'semantic' }); });\n" +
    "          })\n" +
    "          .catch(function(err){\n" +
    "            var msg = (err && err.message) ? err.message : String(err);\n" +
    "            storeValue('LAST_ERROR', 'IA: ' + msg);\n" +
    "            showAlert('Erro IA; mantendo resultados por texto.', 'warning');\n" +
    "            return [];\n" +
    "          });\n" +
    "      }\n" +
    "    }\n" +
    "\n" +
    "    storeValue('LAST_MODE', apiKey ? 'hybrid' : 'fts');\n" +
    "\n" +
    "    Promise.all([pLexica, pSemantica])\n" +
    "      .then(function(pair){\n" +
    "        var lex = safeArray(pair && pair[0]);\n" +
    "        var sem = safeArray(pair && pair[1]);\n" +
    "        var seen = {};\n" +
    "        var merged = [];\n" +
    "        for (var i = 0; i < lex.length; i++) {\n" +
    "          var it = lex[i];\n" +
    "          if (it && it.id != null) seen[it.id] = it;\n" +
    "          merged.push(it);\n" +
    "        }\n" +
    "        for (var j = 0; j < sem.length; j++) {\n" +
    "          var it2 = sem[j];\n" +
    "          if (it2 && it2.id != null && seen[it2.id]) {\n" +
    "            if (seen[it2.id].origin !== it2.origin) seen[it2.id].origin = 'both';\n" +
    "            continue;\n" +
    "          }\n" +
    "          if (it2 && it2.id != null) seen[it2.id] = it2;\n" +
    "          merged.push(it2);\n" +
    "        }\n" +
    "\n" +
    "        var termFold = normalizeFold(termo);\n" +
    "        var chunksWithTerm = 0;\n" +
    "        var occurrencesTotal = 0;\n" +
    "        for (var k = 0; k < merged.length; k++) {\n" +
    "          var txt = normalizeFold((merged[k] && merged[k].conteudo_texto) || '');\n" +
    "          var n = countOccurrences(txt, termFold);\n" +
    "          if (n > 0) chunksWithTerm += 1;\n" +
    "          occurrencesTotal += n;\n" +
    "        }\n" +
    "\n" +
    "        storeValue('SEARCH_RESULTS', merged);\n" +
    "        storeValue('SEARCH_LEX_COUNT', lex.length);\n" +
    "        storeValue('SEARCH_SEM_COUNT', sem.length);\n" +
    "        storeValue('SEARCH_COMBINED_COUNT', merged.length);\n" +
    "        storeValue('MATCH_CHUNKS', chunksWithTerm);\n" +
    "        storeValue('MATCH_OCCURRENCES', occurrencesTotal);\n" +
    "        storeValue('DEBUG_INFO', { lexica: lex.length, semantica: sem.length, total: merged.length, cached: wasCached });\n" +
    "      })\n" +
    "      .catch(function(e){\n" +
    "        var msg = (e && e.message) ? e.message : String(e);\n" +
    "        storeValue('LAST_ERROR', msg);\n" +
    "        showAlert('Erro critico: ' + (msg ? msg.slice(0, 160) : ''), 'error');\n" +
    "      })\n" +
    "      .finally(function(){\n" +
    "        storeValue('IS_SEARCHING', false);\n" +
    "      });\n" +
    "  })()\n" +
    "}}";
  ensureDynTrigger(btnBuscar, "onClick");

  await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(PAGE_ID)}`, {
    params: { applicationId: APPLICATION_ID },
    data: { dsl, layoutOnLoadActions: [], layoutOnLoadActionErrors: [] },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(APPLICATION_ID)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(JSON.stringify({ ok: true, applicationId: APPLICATION_ID, pageId: PAGE_ID, layoutId }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});

