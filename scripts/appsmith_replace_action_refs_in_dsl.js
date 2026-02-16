/* eslint-disable no-console */
// Replaces references to an action name inside the page DSL (e.g., widget bindings like GerarEmbedding.data).
// This is a pragmatic way to swap an action while keeping widget logic intact.
//
// Usage:
//   node scripts/appsmith_replace_action_refs_in_dsl.js GerarEmbedding GerarEmbedding2
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

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function traverse(obj, cb) {
  if (!obj) return;
  const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    cb(cur);
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i -= 1) stack.push(cur[i]);
    } else if (typeof cur === "object") {
      for (const k of Object.keys(cur)) stack.push(cur[k]);
    }
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

  const fromName = process.argv[2] || "GerarEmbedding";
  const toName = process.argv[3] || "GerarEmbedding2";
  if (!fromName || !toName) throw new Error("Usage: node scripts/appsmith_replace_action_refs_in_dsl.js <from> <to>");

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

  const dsl = deepClone(layout.dsl);

  const needle = new RegExp(`\\b${fromName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "g");
  let replacements = 0;
  traverse(dsl, (node) => {
    if (typeof node !== "string") return;
    const next = node.replace(needle, (m) => {
      replacements += 1;
      return toName;
    });
    // Mutation in traverse isn't safe here because strings are primitives.
    // We handle mutation in the parent traversal below.
  });

  // Second pass with parent-aware mutation.
  const mutate = (obj) => {
    if (!obj) return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i += 1) {
        const v = obj[i];
        if (typeof v === "string") obj[i] = v.replace(needle, toName);
        else mutate(v);
      }
      return;
    }
    if (typeof obj === "object") {
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "string") obj[k] = v.replace(needle, toName);
        else mutate(v);
      }
    }
  };
  mutate(dsl);

  await request("put", `/api/v1/layouts/${encodeURIComponent(layout.id)}/pages/${encodeURIComponent(pageId)}`, {
    params: { applicationId },
    data: { dsl },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(applicationId)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(JSON.stringify({ ok: true, fromName, toName, pageId, layoutId: layout.id }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});

