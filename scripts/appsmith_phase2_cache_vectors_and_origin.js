/* eslint-disable no-console */
// Phase 2 polish: add client-side embedding cache + origin markers to Busca_Normas.
//
// Changes:
// - Btn_Buscar onClick now:
//   - always runs lexical (FTS)
//   - runs semantic only if GEMINI_API_KEY is present
//   - caches vector per normalized query (client-side appsmith.store)
//   - merges + dedups results and annotates each row with origin: lexical|semantic|both
// - Table adds a "tipo" column (icon) based on origin
// - Keeps "no billing" mode functional (FTS works without key)
//
// Safety:
// - Takes a local backup of the current DSL/actions into tmp/appsmith/backups/
// - Does NOT store any secrets; API key stays in appsmith.store client-side.
//
// Usage:
//   node scripts/appsmith_phase2_cache_vectors_and_origin.js
//
// Reads APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD from MEUS_SEGREDOS.txt (gitignored).

const fs = require("node:fs/promises");
const path = require("node:path");

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const APPLICATION_ID = "6992325c8a3a0012fc7c5ed5";
const PAGE_ID = "6992325c8a3a0012fc7c5ed7";

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
}

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

  // login
  await request("get", "/api/v1/users/me");
  const token = await xsrf();
  await request("post", "/api/v1/login", {
    data: new URLSearchParams({ username: email, password }).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-XSRF-TOKEN": token },
  });

  // Fetch actions (for backup only)
  const actionsResp = await request("get", "/api/v1/actions", { params: { pageId: PAGE_ID } });
  const actions = Array.isArray(actionsResp?.data) ? actionsResp.data : [];
  const aGerar = actions.find((a) => a?.name === "GerarEmbedding2") || null;
  const aBuscar = actions.find((a) => a?.name === "BuscarNormas") || null;
  const aFts = actions.find((a) => a?.name === "BuscarNormasFTS") || null;
  if (!aGerar?.id || !aBuscar?.id || !aFts?.id) throw new Error("Missing expected actions (GerarEmbedding2/BuscarNormas/BuscarNormasFTS)");

  // Fetch page DSL
  const page = await request("get", `/api/v1/pages/${encodeURIComponent(PAGE_ID)}`, { params: { migrateDsl: "false" } });
  const layout = page?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("No layout/dsl found");
  const layoutId = layout.id;
  const dsl = deepCloneJson(layout.dsl);

  const btnBuscar = findWidgetByName(dsl, "Btn_Buscar");
  const tbl = findWidgetByName(dsl, "Table_Resultados");
  const dbg = findWidgetByName(dsl, "Txt_DebugBusca");
  const build = findWidgetByName(dsl, "Txt_Build");
  if (!btnBuscar) throw new Error("Btn_Buscar not found in DSL");
  if (!tbl) throw new Error("Table_Resultados not found in DSL");

  // Backup before changes (rollback friendly).
  const backupDir = path.join(process.cwd(), "tmp", "appsmith", "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `busca_normas_pre_cache_${nowStamp()}.json`);
  const backup = {
    ts: new Date().toISOString(),
    applicationId: APPLICATION_ID,
    pageId: PAGE_ID,
    layoutId,
    layoutOnLoadActions: layout.layoutOnLoadActions,
    actions: {
      GerarEmbedding2: { id: aGerar.id, name: aGerar.name, pluginType: aGerar.pluginType, actionConfiguration: aGerar.actionConfiguration },
      BuscarNormas: { id: aBuscar.id, name: aBuscar.name, pluginType: aBuscar.pluginType, actionConfiguration: aBuscar.actionConfiguration },
      BuscarNormasFTS: { id: aFts.id, name: aFts.name, pluginType: aFts.pluginType, actionConfiguration: aFts.actionConfiguration },
    },
    widgets: {
      Btn_Buscar: { onClick: btnBuscar.onClick, isDisabled: btnBuscar.isDisabled, isLoading: btnBuscar.isLoading },
      Table_Resultados: { tableData: tbl.tableData, columnOrder: tbl.columnOrder, primaryColumns: tbl.primaryColumns },
      Txt_DebugBusca: dbg ? { text: dbg.text } : null,
      Txt_Build: build ? { text: build.text } : null,
    },
    dsl,
  };
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8");

  // Update Btn_Buscar to: FTS always + semantic (cached) when possible + store-based output.
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
    "    function hashString(s){\n" +
    "      // FNV-1a 32-bit (fast + stable)\n" +
    "      var h = 2166136261;\n" +
    "      for (var i = 0; i < s.length; i++) {\n" +
    "        h ^= s.charCodeAt(i);\n" +
    "        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;\n" +
    "      }\n" +
    "      return String(h);\n" +
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
    "        // Local rate-window counters (best-effort); only when actually calling embeddings.\n" +
    "        var now = Date.now();\n" +
    "        var start = appsmith.store.GEMINI_WINDOW_START || 0;\n" +
    "        var used = appsmith.store.GEMINI_WINDOW_COUNT || 0;\n" +
    "        if (!start || (now - start) > 60000) {\n" +
    "          start = now;\n" +
    "          used = 0;\n" +
    "          storeValue('GEMINI_WINDOW_START', start);\n" +
    "          storeValue('GEMINI_WINDOW_COUNT', used);\n" +
    "        }\n" +
    "        used = used + 1;\n" +
    "        storeValue('GEMINI_WINDOW_COUNT', used);\n" +
    "        storeValue('GEMINI_TOTAL_CALLS', (appsmith.store.GEMINI_TOTAL_CALLS || 0) + 1);\n" +
    "\n" +
    "        pSemantica = GerarEmbedding2.run({ text: termo, key: apiKey })\n" +
    "          .then(function(resp){\n" +
    "            var v = (resp && resp.embedding && resp.embedding.values) ? resp.embedding.values : [];\n" +
    "            storeValue('LAST_EMBED_LEN', (v && v.length) ? v.length : 0);\n" +
    "            if (!v || !v.length) throw new Error('Embedding vazio');\n" +
    "            if (v.length !== 768) throw new Error('Embedding invalido (len=' + v.length + ')');\n" +
    "            var vectorStr = '[' + v.join(',') + ']';\n" +
    "            storeValue(cacheKey, vectorStr);\n" +
    "\n" +
    "            // Keep a bounded list of cache keys to avoid unbounded local storage growth.\n" +
    "            var keys = appsmith.store.CACHE_VEC_KEYS;\n" +
    "            if (!Array.isArray(keys)) keys = [];\n" +
    "            if (keys.indexOf(cacheKey) === -1) keys.push(cacheKey);\n" +
    "            var MAX = 30;\n" +
    "            while (keys.length > MAX) {\n" +
    "              var oldKey = keys.shift();\n" +
    "              storeValue(oldKey, null);\n" +
    "            }\n" +
    "            storeValue('CACHE_VEC_KEYS', keys);\n" +
    "\n" +
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
    "\n" +
    "        // Merge with lexical priority; if a row appears in both, mark origin='both'.\n" +
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
    "        storeValue('SEARCH_RESULTS', merged);\n" +
    "        storeValue('SEARCH_LEX_COUNT', lex.length);\n" +
    "        storeValue('SEARCH_SEM_COUNT', sem.length);\n" +
    "        storeValue('SEARCH_COMBINED_COUNT', merged.length);\n" +
    "        storeValue('DEBUG_INFO', { lexica: lex.length, semantica: sem.length, total: merged.length, cached: wasCached });\n" +
    "\n" +
    "        showAlert('Resultados: ' + merged.length + (apiKey ? (' (L=' + lex.length + ', S=' + sem.length + (wasCached ? ', cache' : '') + ')') : ''), merged.length ? 'success' : 'warning');\n" +
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

  // Prevent double clicks while searching (and enable a loading state if supported by this widget version).
  btnBuscar.isDisabled = "{{!!appsmith.store.IS_SEARCHING}}";
  ensureDynBinding(btnBuscar, "isDisabled");
  btnBuscar.isLoading = "{{!!appsmith.store.IS_SEARCHING}}";
  ensureDynBinding(btnBuscar, "isLoading");

  // Ensure table binds to the merged store (not action .data).
  tbl.tableData = "{{Array.isArray(appsmith.store.SEARCH_RESULTS) ? appsmith.store.SEARCH_RESULTS : []}}";
  ensureDynBinding(tbl, "tableData");

  // Add/Upsert "tipo" column so users can see why a row matched.
  tbl.primaryColumns = tbl.primaryColumns || {};
  tbl.primaryColumns.tipo = {
    id: "tipo",
    label: "Tipo",
    columnType: "text",
    computedValue:
      "{{\n" +
      "  (function(){\n" +
      "    var o = currentRow.origin;\n" +
      "    var sem = String.fromCharCode(0xD83E, 0xDDE0); // brain\n" +
      "    var lex = String.fromCharCode(0xD83D, 0xDD0D); // magnifier\n" +
      "    if (o === 'both') return sem + lex;\n" +
      "    return (o === 'semantic') ? sem : lex;\n" +
      "  })()\n" +
      "}}",
    isVisible: true,
  };

  // Prefer showing the icon column first (best-effort; keep existing if present).
  if (Array.isArray(tbl.columnOrder) && tbl.columnOrder.length) {
    const filtered = tbl.columnOrder.filter((c) => c !== "tipo");
    tbl.columnOrder = ["tipo", ...filtered];
  } else {
    tbl.columnOrder = ["tipo", "similarity", "conteudo_texto", "id"];
  }

  // Keep computed values stable for core columns.
  if (tbl.primaryColumns.id) tbl.primaryColumns.id.computedValue = "{{currentRow.id}}";
  if (tbl.primaryColumns.conteudo_texto) tbl.primaryColumns.conteudo_texto.computedValue = "{{currentRow.conteudo_texto}}";
  if (tbl.primaryColumns.similarity) tbl.primaryColumns.similarity.computedValue = "{{currentRow.similarity}}";

  ensureDynBinding(tbl, "primaryColumns.tipo.computedValue");
  ensureDynBinding(tbl, "primaryColumns.id.computedValue");
  ensureDynBinding(tbl, "primaryColumns.conteudo_texto.computedValue");
  ensureDynBinding(tbl, "primaryColumns.similarity.computedValue");

  // Debug footer: show counts + embedLen + cache hit.
  if (dbg) {
    dbg.text =
      "{{\n" +
      "  'Debug: mode=' + (appsmith.store.LAST_MODE || '-') +\n" +
      "  ' lex=' + (appsmith.store.SEARCH_LEX_COUNT || 0) +\n" +
      "  ' sem=' + (appsmith.store.SEARCH_SEM_COUNT || 0) +\n" +
      "  ' total=' + (appsmith.store.SEARCH_COMBINED_COUNT || 0) +\n" +
      "  ' embedLen=' + (appsmith.store.LAST_EMBED_LEN || 0) +\n" +
      "  ' cached=' + (!!(appsmith.store.DEBUG_INFO && appsmith.store.DEBUG_INFO.cached))\n" +
      "}}";
    ensureDynBinding(dbg, "text");
  }

  if (build) {
    build.text = "{{\"Build: 2026-02-16 (cache vetores + origem)\"}}";
    ensureDynBinding(build, "text");
  }

  // Persist DSL + ensure nothing executes on page load.
  await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(PAGE_ID)}`, {
    params: { applicationId: APPLICATION_ID },
    data: { dsl, layoutOnLoadActions: [], layoutOnLoadActionErrors: [] },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(APPLICATION_ID)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(JSON.stringify({ ok: true, applicationId: APPLICATION_ID, pageId: PAGE_ID, layoutId, backupPath }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});

