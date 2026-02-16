/* eslint-disable no-console */
// Tweaks Busca_Normas UX: only show Txt_Erro after a search was attempted.
//
// Usage: node scripts/appsmith_patch_busca_normas_err_visibility.js
//
// Reads APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD from MEUS_SEGREDOS.txt (gitignored).

const fs = require("node:fs/promises");
const path = require("node:path");

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

  const page = await request("get", `/api/v1/pages/${encodeURIComponent(pageId)}`, { params: { migrateDsl: "false" } });
  const layout = page?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("No layout/dsl found");

  const dsl = JSON.parse(JSON.stringify(layout.dsl));
  const w = findWidgetByName(dsl, "Txt_Erro");
  if (!w) throw new Error("Txt_Erro not found");

  w.isVisible =
    "{{\n" +
    "  !!((appsmith.store.SEARCH_QUERY || '').trim())\n" +
    "  && !(Array.isArray(appsmith.store.SEARCH_RESULTS) && appsmith.store.SEARCH_RESULTS.length)\n" +
    "  && !!(BuscarNormasFTS.error || GerarEmbedding2.error || BuscarNormas.error)\n" +
    "}}";
  ensureDynBinding(w, "isVisible");

  await request("put", `/api/v1/layouts/${encodeURIComponent(layout.id)}/pages/${encodeURIComponent(pageId)}`, {
    params: { applicationId },
    data: { dsl },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(applicationId)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(JSON.stringify({ ok: true, pageId, layoutId: layout.id }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});

