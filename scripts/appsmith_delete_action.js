/* eslint-disable no-console */
// Deletes an Appsmith action by id.
//
// Usage:
//   node scripts/appsmith_delete_action.js <actionId>
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

async function main() {
  await loadEnvFromSecretsFile();

  const baseUrl = process.env.APPSMITH_URL;
  const email = process.env.APPSMITH_EMAIL;
  const password = process.env.APPSMITH_PASSWORD;
  if (!baseUrl || !email || !password) throw new Error("Missing APPSMITH_URL/APPSMITH_EMAIL/APPSMITH_PASSWORD");

  const actionId = process.argv[2];
  if (!actionId) throw new Error("Usage: node scripts/appsmith_delete_action.js <actionId>");

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

  await request("delete", `/api/v1/actions/${encodeURIComponent(actionId)}`);

  console.log(JSON.stringify({ ok: true, deleted: actionId }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});

