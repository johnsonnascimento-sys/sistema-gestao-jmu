/* eslint-disable no-console */
// Sets `executeOnLoad` on an Appsmith action (if the backend supports it) and verifies by re-listing.
//
// Usage:
//   node scripts/appsmith_set_execute_on_load.js GerarEmbedding2 false
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

function parseBool(v) {
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  throw new Error(`Invalid boolean: ${v}`);
}

async function main() {
  await loadEnvFromSecretsFile();

  const baseUrl = process.env.APPSMITH_URL;
  const email = process.env.APPSMITH_EMAIL;
  const password = process.env.APPSMITH_PASSWORD;
  if (!baseUrl || !email || !password) throw new Error("Missing APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD");

  const actionName = process.argv[2] || "GerarEmbedding2";
  const executeOnLoad = parseBool(process.argv[3] ?? "false");
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

  const list = async () => {
    const actionsResp = await request("get", "/api/v1/actions", { params: { pageId } });
    return Array.isArray(actionsResp?.data) ? actionsResp.data : [];
  };

  const actionsBefore = await list();
  const a = actionsBefore.find((x) => x?.name === actionName);
  if (!a?.id) throw new Error(`Action not found: ${actionName}`);

  const before = a.runBehaviour;
  a.executeOnLoad = executeOnLoad;
  await request("put", `/api/v1/actions/${encodeURIComponent(a.id)}`, { data: a, headers: { "Content-Type": "application/json" } });

  const actionsAfter = await list();
  const b = actionsAfter.find((x) => x?.id === a.id);
  const after = b?.runBehaviour;

  console.log(JSON.stringify({ actionName, id: a.id, executeOnLoad, before, after }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});

