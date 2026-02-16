/* eslint-disable no-console */
// Improves Btn_Buscar UX: validates Gemini API key and search text before running actions.

const fs = require("node:fs/promises");
const path = require("node:path");

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

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

  const page = await request("get", `/api/v1/pages/${encodeURIComponent(pageId)}`, { params: { migrateDsl: "false" } });
  const layout = page?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("No layout/dsl found");
  const layoutId = layout.id;
  const dsl = JSON.parse(JSON.stringify(layout.dsl));
  if (!Array.isArray(dsl.children)) dsl.children = [];

  const btn = dsl.children.find((c) => c?.widgetName === "Btn_Buscar");
  if (!btn) throw new Error("Btn_Buscar not found in DSL children");

  btn.onClick =
    "{{\n" +
    "  (function(){\n" +
    "    if (!appsmith.store.GEMINI_API_KEY) {\n" +
    "      showAlert('Defina a Gemini API Key e clique em Salvar Key antes de buscar.', 'warning');\n" +
    "      return;\n" +
    "    }\n" +
    "    if (!Input_Busca.text || !Input_Busca.text.trim()) {\n" +
    "      showAlert('Digite o que voce procura no campo de busca.', 'warning');\n" +
    "      return;\n" +
    "    }\n" +
    "    GerarEmbedding.run()\n" +
    "      .then(() => BuscarNormas.run())\n" +
    "      .catch((e) => {\n" +
    "        showAlert('Falha na busca (embedding ou SQL). Abra os logs da action para ver detalhes.', 'error');\n" +
    "      });\n" +
    "  })()\n" +
    "}}";

  if (!Array.isArray(btn.dynamicTriggerPathList)) btn.dynamicTriggerPathList = [];
  if (!btn.dynamicTriggerPathList.some((e) => e && e.key === "onClick")) btn.dynamicTriggerPathList.push({ key: "onClick" });

  const saved = await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(pageId)}`, {
    params: { applicationId },
    data: { dsl },
    headers: { "Content-Type": "application/json" },
  });

  const published = await request("post", `/api/v1/applications/publish/${encodeURIComponent(applicationId)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  console.log(
    JSON.stringify(
      {
        pageId,
        layoutId,
        saved_ok: Boolean(saved?.responseMeta?.success),
        published_ok: Boolean(published?.data === true || published?.responseMeta?.success),
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

