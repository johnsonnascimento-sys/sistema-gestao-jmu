/* eslint-disable no-console */
// Appsmith MCP server (stdio). Keeps all secrets in env vars / MEUS_SEGREDOS.txt (gitignored).

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const axios = require("axios");
const FormData = require("form-data");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const { z } = require("zod");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBool(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(v)) return true;
    if (["0", "false", "no", "n"].includes(v)) return false;
  }
  return defaultValue;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
}

function truncateText(s, max = 1500) {
  if (typeof s !== "string") return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max)}... (truncated)`;
}

function toolOk(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: { data },
  };
}

function toolWarn(message, data = {}) {
  return {
    content: [
      {
        type: "text",
        text: `${message}\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
    structuredContent: { warning: message, ...data },
  };
}

class AppsmithClient {
  constructor({ baseUrl, email, password, timeoutMs }) {
    if (!baseUrl) throw new Error("APPSMITH_URL is required");
    const u = new URL(baseUrl);
    this.baseUrl = u.origin;
    this.email = email || "";
    this.password = password || "";
    this.timeoutMs = timeoutMs || 30_000;

    this.jar = new CookieJar();
    this.http = wrapper(
      axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeoutMs,
        withCredentials: true,
        jar: this.jar,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "appsmith-mcp/0.1.0",
        },
      }),
    );
  }

  async getXsrfToken() {
    const cookies = await this.jar.getCookies(this.baseUrl);
    const xsrf = cookies.find((c) => c.key === "XSRF-TOKEN");
    return xsrf?.value || "";
  }

  async ensureXsrfToken() {
    let token = await this.getXsrfToken();
    if (token) return token;
    // /users/me returns anonymous info AND sets XSRF-TOKEN cookie
    await this.http.get("/api/v1/users/me");
    token = await this.getXsrfToken();
    if (!token) {
      throw new Error("XSRF-TOKEN cookie not found after GET /api/v1/users/me");
    }
    return token;
  }

  async request(method, url, { params, data, headers, responseType } = {}) {
    const m = String(method || "get").toLowerCase();
    const isWrite = !["get", "head", "options"].includes(m);
    const h = { ...(headers || {}) };
    if (isWrite) {
      const token = await this.ensureXsrfToken();
      h["X-XSRF-TOKEN"] = token;
    }

    const resp = await this.http.request({
      method: m,
      url,
      params,
      data,
      headers: h,
      responseType,
    });

    if (resp.status >= 400) {
      const bodyPreview =
        typeof resp.data === "string"
          ? truncateText(resp.data, 1500)
          : truncateText(JSON.stringify(resp.data ?? {}, null, 2), 1500);
      throw new Error(`Appsmith API ${m.toUpperCase()} ${url} failed: HTTP ${resp.status}\n${bodyPreview}`);
    }

    return resp;
  }

  async health() {
    const resp = await this.request("get", "/api/v1/health");
    return resp.data;
  }

  async whoami() {
    const resp = await this.request("get", "/api/v1/users/me");
    return resp.data;
  }

  _isAnonymousFromWhoami(who) {
    // Appsmith response commonly uses { data: { isAnonymous: boolean, ... } }
    const val = who?.data?.isAnonymous ?? who?.isAnonymous;
    return typeof val === "boolean" ? val : true;
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error("Missing credentials. Set APPSMITH_EMAIL and APPSMITH_PASSWORD (preferably via MEUS_SEGREDOS.txt).");
    }

    await this.ensureXsrfToken();
    const body = new URLSearchParams({ username: this.email, password: this.password }).toString();
    await this.request("post", "/api/v1/login", {
      data: body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const who = await this.whoami();
    if (this._isAnonymousFromWhoami(who)) {
      throw new Error("Login failed: still anonymous after /api/v1/login");
    }
    return who;
  }

  async ensureLoggedIn() {
    const who = await this.whoami();
    if (!this._isAnonymousFromWhoami(who)) return who;
    return await this.login();
  }

  async listWorkspaces() {
    await this.ensureLoggedIn();
    const resp = await this.request("get", "/api/v1/workspaces/home");
    return resp.data;
  }

  async listApps(workspaceId) {
    await this.ensureLoggedIn();
    const resp = await this.request("get", "/api/v1/applications/home", {
      params: { workspaceId },
    });
    return resp.data;
  }

  async exportApp(appId, branchName) {
    await this.ensureLoggedIn();
    const resp = await this.request("get", `/api/v1/applications/export/${encodeURIComponent(appId)}`, {
      params: branchName ? { branchName } : undefined,
      responseType: "arraybuffer",
    });

    const contentType = String(resp.headers?.["content-type"] || "");
    const bytes = Buffer.from(resp.data);
    const isJson =
      contentType.includes("application/json") || (bytes.length > 0 && bytes[0] === 0x7b /* "{" */);
    const ext = isJson ? "json" : "zip";

    const outDir = path.join(process.cwd(), "tmp", "appsmith", "exports");
    await fs.mkdir(outDir, { recursive: true });
    const filePath = path.join(outDir, `${appId}-${nowStamp()}.${ext}`);
    await fs.writeFile(filePath, bytes);

    return { file_path: filePath, bytes: bytes.length, content_type: contentType || "application/octet-stream" };
  }

  async importApp(workspaceId, filePath, replaceAppId) {
    await this.ensureLoggedIn();

    const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const fileBuf = await fs.readFile(absPath);

    const form = new FormData();
    form.append("file", fileBuf, {
      filename: path.basename(absPath),
      contentType: "application/octet-stream",
    });

    const headers = form.getHeaders();
    const params = replaceAppId ? { applicationId: replaceAppId } : undefined;

    const resp = await this.request("post", `/api/v1/applications/import/${encodeURIComponent(workspaceId)}`, {
      params,
      data: form,
      headers,
    });
    return resp.data;
  }

  async listPages(applicationId) {
    await this.ensureLoggedIn();
    const resp = await this.request("get", "/api/v1/pages", { params: { applicationId } });
    return resp.data;
  }

  async fetchPage(pageId, migrateDsl = false) {
    await this.ensureLoggedIn();
    const resp = await this.request("get", `/api/v1/pages/${encodeURIComponent(pageId)}`, {
      params: { migrateDsl: migrateDsl ? "true" : "false" },
    });
    return resp.data;
  }

  async savePageDsl({ applicationId, pageId, layoutId, dsl }) {
    await this.ensureLoggedIn();
    const resp = await this.request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(pageId)}`, {
      params: { applicationId },
      data: { dsl },
      headers: { "Content-Type": "application/json" },
    });
    return resp.data;
  }

  async createPage(applicationId, pageName) {
    // Appsmith endpoints vary a bit across versions; try a few variants.
    const attempts = [
      { url: "/api/v1/pages", params: undefined, body: { applicationId, name: pageName } },
      { url: "/api/v1/pages", params: { applicationId }, body: { name: pageName } },
      { url: "/api/v1/pages", params: { applicationId }, body: { applicationId, name: pageName } },
    ];

    let lastErr;
    for (const a of attempts) {
      try {
        const resp = await this.request("post", a.url, {
          params: a.params,
          data: a.body,
          headers: { "Content-Type": "application/json" },
        });
        return resp.data;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Failed to create page");
  }

  async ensurePage(applicationId, pageName) {
    const pagesResp = await this.listPages(applicationId);
    const pages = pagesResp?.data?.pages ?? pagesResp?.pages ?? [];
    const found = Array.isArray(pages) ? pages.find((p) => p?.name === pageName) : undefined;
    if (found?.id) {
      // Find layoutId via fetchPage to keep callers from having to do a second step.
      const page = await this.fetchPage(found.id, false);
      const layoutId = page?.data?.layouts?.[0]?.id ?? page?.data?.layoutId ?? null;
      return { created: false, pageId: found.id, layoutId, pageName };
    }

    const created = await this.createPage(applicationId, pageName);
    const createdId = created?.data?.id ?? created?.data?.page?.id ?? created?.data?.pageId ?? null;
    if (!createdId) {
      throw new Error(`Page creation succeeded but could not find pageId in response: ${truncateText(JSON.stringify(created), 1200)}`);
    }
    const page = await this.fetchPage(createdId, false);
    const layoutId = page?.data?.layouts?.[0]?.id ?? page?.data?.layoutId ?? null;
    return { created: true, pageId: createdId, layoutId, pageName };
  }

  async listDatasources(workspaceId) {
    await this.ensureLoggedIn();
    const resp = await this.request("get", "/api/v1/datasources", { params: { workspaceId } });
    return resp.data;
  }

  async createDatasource(payload) {
    await this.ensureLoggedIn();
    const resp = await this.request("post", "/api/v1/datasources", {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    return resp.data;
  }

  async testDatasource(payload) {
    await this.ensureLoggedIn();
    const resp = await this.request("post", "/api/v1/datasources/test", {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    return resp.data;
  }

  async updateDatasource(id, payload) {
    await this.ensureLoggedIn();
    const resp = await this.request("put", `/api/v1/datasources/${encodeURIComponent(id)}`, {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    return resp.data;
  }

  async fetchDatasourceStructure(id, ignoreCache = false) {
    await this.ensureLoggedIn();
    const resp = await this.request("get", `/api/v1/datasources/${encodeURIComponent(id)}/structure`, {
      params: { ignoreCache: ignoreCache ? "true" : "false" },
    });
    return resp.data;
  }

  async listActionsByPage(pageId) {
    await this.ensureLoggedIn();
    const resp = await this.request("get", "/api/v1/actions", { params: { pageId } });
    return resp.data;
  }

  async createAction(payload) {
    await this.ensureLoggedIn();
    const resp = await this.request("post", "/api/v1/actions", {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    return resp.data;
  }

  async updateAction(id, payload) {
    await this.ensureLoggedIn();
    const resp = await this.request("put", `/api/v1/actions/${encodeURIComponent(id)}`, {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    return resp.data;
  }

  async executeAction(payload, timeoutMs) {
    await this.ensureLoggedIn();

    // Appsmith execute endpoint commonly expects multipart, but keep it flexible.
    // If the payload includes { form: {...} } we send multipart; otherwise JSON.
    const to = Number(timeoutMs) > 0 ? Number(timeoutMs) : undefined;
    if (payload && isObject(payload) && isObject(payload.form)) {
      const form = new FormData();
      for (const [k, v] of Object.entries(payload.form)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          form.append(k, String(v));
        } else {
          form.append(k, JSON.stringify(v));
        }
      }
      const resp = await this.request("post", "/api/v1/actions/execute", {
        data: form,
        headers: form.getHeaders(),
      });
      return resp.data;
    }

    const resp = await this.request("post", "/api/v1/actions/execute", {
      data: payload,
      headers: { "Content-Type": "application/json" },
    });
    if (to) {
      // Note: axios timeout is set per-client; keep this as metadata only.
      // If you need per-call timeout, run a dedicated client instance.
    }
    return resp.data;
  }
}

function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

function findFirstWidgetByType(root, type) {
  let found = null;
  traverseWidgets(root, (w) => {
    if (!found && w?.type === type) found = w;
  });
  return found;
}

function ensureDynamicBindingPath(widget, key) {
  if (!widget || !key) return;
  if (!Array.isArray(widget.dynamicBindingPathList)) widget.dynamicBindingPathList = [];
  const exists = widget.dynamicBindingPathList.some((e) => e && e.key === key);
  if (!exists) widget.dynamicBindingPathList.push({ key });
}

function ensureDynamicTriggerPath(widget, key) {
  if (!widget || !key) return;
  if (!Array.isArray(widget.dynamicTriggerPathList)) widget.dynamicTriggerPathList = [];
  const exists = widget.dynamicTriggerPathList.some((e) => e && e.key === key);
  if (!exists) widget.dynamicTriggerPathList.push({ key });
}

function normalizeWidgetType(type) {
  const t = String(type || "").trim();
  if (!t) return "";
  // Friendly aliases -> Appsmith widget type constants (best-effort).
  const map = {
    Text: "TEXT_WIDGET",
    Input: "INPUT_WIDGET_V2",
    Button: "BUTTON_WIDGET",
    Table: "TABLE_WIDGET",
    FilePicker: "FILE_PICKER_WIDGET_V2",
  };
  return map[t] || t;
}

function applyPropsAndBindings(widget, { props, bindings } = {}) {
  if (!widget) return;
  if (isObject(props)) {
    for (const [k, v] of Object.entries(props)) widget[k] = v;
  }
  if (isObject(bindings)) {
    for (const [k, v] of Object.entries(bindings)) {
      widget[k] = v;
      if (typeof v === "string" && v.includes("{{")) {
        // Heuristic: events are triggers; the rest are bindings.
        if (k.startsWith("on")) ensureDynamicTriggerPath(widget, k);
        else ensureDynamicBindingPath(widget, k);
      }
    }
  }
}

function ensureChildrenArray(widget) {
  if (!Array.isArray(widget.children)) widget.children = [];
}

function buildMinimalWidget({ widgetName, type, position, parentId }) {
  const widgetId = crypto.randomUUID();
  const pos = position || {};
  return {
    widgetId,
    widgetName,
    type,
    parentId,
    left: pos.left ?? 0,
    top: pos.top ?? 0,
    right: pos.right ?? 20,
    bottom: pos.bottom ?? 4,
    isVisible: true,
    version: 1,
    children: [],
    dynamicBindingPathList: [],
    dynamicTriggerPathList: [],
    dynamicPropertyPathList: [],
  };
}

function upsertWidgetsIntoDsl({ dslRoot, widgets }) {
  if (!dslRoot || !Array.isArray(widgets)) throw new Error("Invalid DSL/widgets");
  ensureChildrenArray(dslRoot);

  const created = [];
  const updated = [];
  const rootId = dslRoot.widgetId || dslRoot.widgetID || null;
  if (!rootId) {
    throw new Error("DSL root missing widgetId (cannot set parentId for new widgets).");
  }

  for (const spec of widgets) {
    const widgetName = spec.widgetName;
    if (!widgetName) throw new Error("Widget missing widgetName");
    const type = normalizeWidgetType(spec.type);
    if (!type) throw new Error(`Widget ${widgetName} missing type`);

    const existing = findWidgetByName(dslRoot, widgetName);
    if (existing) {
      if (spec.position && isObject(spec.position)) {
        existing.left = spec.position.left ?? existing.left;
        existing.top = spec.position.top ?? existing.top;
        existing.right = spec.position.right ?? existing.right;
        existing.bottom = spec.position.bottom ?? existing.bottom;
      }
      applyPropsAndBindings(existing, spec);
      updated.push({ widgetName, widgetId: existing.widgetId, type: existing.type });
      continue;
    }

    // Try cloning an existing widget of same type as a template (better than guessing required fields).
    const template = findFirstWidgetByType(dslRoot, type);
    let next = template ? deepCloneJson(template) : buildMinimalWidget({ widgetName, type, position: spec.position, parentId: rootId });

    next.widgetId = crypto.randomUUID();
    next.widgetName = widgetName;
    next.type = type;
    next.parentId = rootId;
    if (spec.position && isObject(spec.position)) {
      next.left = spec.position.left ?? next.left;
      next.top = spec.position.top ?? next.top;
      next.right = spec.position.right ?? next.right;
      next.bottom = spec.position.bottom ?? next.bottom;
    }
    next.children = [];
    applyPropsAndBindings(next, spec);

    dslRoot.children.push(next);
    created.push({ widgetName, widgetId: next.widgetId, type: next.type, clonedFromTemplate: Boolean(template) });
  }

  return { created, updated };
}

async function runSelfTest() {
  const client = new AppsmithClient({
    baseUrl: process.env.APPSMITH_URL,
    email: process.env.APPSMITH_EMAIL,
    password: process.env.APPSMITH_PASSWORD,
    timeoutMs: Number(process.env.APPSMITH_TIMEOUT_MS || "30000"),
  });
  const who = await client.ensureLoggedIn();
  const workspaces = await client.listWorkspaces();
  console.error("SELF-TEST whoami.isAnonymous =", client._isAnonymousFromWhoami(who));
  console.error("SELF-TEST workspaces keys =", Object.keys(workspaces || {}));
  return 0;
}

async function main() {
  if (process.argv.includes("--self-test")) {
    process.exit(await runSelfTest());
  }

  const client = new AppsmithClient({
    baseUrl: process.env.APPSMITH_URL,
    email: process.env.APPSMITH_EMAIL,
    password: process.env.APPSMITH_PASSWORD,
    timeoutMs: Number(process.env.APPSMITH_TIMEOUT_MS || "30000"),
  });

  const server = new McpServer({ name: "appsmith-mcp", version: "0.1.0" });

  server.tool("health", "GET /api/v1/health", async () => toolOk(await client.health()));
  server.tool("whoami", "GET /api/v1/users/me", async () => toolOk(await client.whoami()));
  server.tool("login", "POST /api/v1/login (form-urlencoded) with XSRF; then returns whoami()", async () => toolOk(await client.login()));

  server.tool("list_workspaces", "List workspaces (GET /api/v1/workspaces/home). Requires login.", async () =>
    toolOk(await client.listWorkspaces()),
  );

  server.tool(
    "list_apps",
    "List apps in a workspace (GET /api/v1/applications/home?workspaceId=...). Requires login.",
    { workspaceId: z.string().min(1) },
    async ({ workspaceId }) => toolOk(await client.listApps(workspaceId)),
  );

  server.tool(
    "export_app",
    "Export an application and save it under tmp/appsmith/exports/. Returns file_path.",
    { appId: z.string().min(1), branchName: z.string().optional() },
    async ({ appId, branchName }) => toolOk(await client.exportApp(appId, branchName)),
  );

  server.tool(
    "import_app",
    "Import an application JSON/zip into a workspace (multipart file). Optional replaceAppId updates an existing app.",
    { workspaceId: z.string().min(1), filePath: z.string().min(1), replaceAppId: z.string().optional() },
    async ({ workspaceId, filePath, replaceAppId }) => toolOk(await client.importApp(workspaceId, filePath, replaceAppId)),
  );

  server.tool(
    "list_pages",
    "List pages in an application (GET /api/v1/pages?applicationId=...). Requires login.",
    { applicationId: z.string().min(1) },
    async ({ applicationId }) => toolOk(await client.listPages(applicationId)),
  );

  server.tool(
    "fetch_page",
    "Fetch full page with layouts+DSL (GET /api/v1/pages/{pageId}?migrateDsl=false). Requires login.",
    { pageId: z.string().min(1), migrateDsl: z.boolean().optional() },
    async ({ pageId, migrateDsl }) => toolOk(await client.fetchPage(pageId, migrateDsl ?? false)),
  );

  server.tool(
    "ensure_page",
    "Ensure a page exists by name (creates if missing). Returns {pageId, layoutId, created}.",
    { applicationId: z.string().min(1), pageName: z.string().min(1) },
    async ({ applicationId, pageName }) => toolOk(await client.ensurePage(applicationId, pageName)),
  );

  server.tool(
    "save_page_dsl",
    "Save DSL for a given layoutId/pageId (PUT /api/v1/layouts/{layoutId}/pages/{pageId}?applicationId=...).",
    {
      applicationId: z.string().min(1),
      pageId: z.string().min(1),
      layoutId: z.string().min(1),
      dsl: z.any(),
    },
    async ({ applicationId, pageId, layoutId, dsl }) => toolOk(await client.savePageDsl({ applicationId, pageId, layoutId, dsl })),
  );

  server.tool(
    "upsert_widgets",
    "Upsert widgets into a FIXED-layout DSL by widgetName, then saves it back. Best-effort (DSL shape varies by Appsmith version).",
    {
      applicationId: z.string().min(1),
      pageId: z.string().min(1),
      layoutId: z.string().optional(),
      widgets: z.array(
        z.object({
          type: z.string().min(1),
          widgetName: z.string().min(1),
          position: z
            .object({
              left: z.number().optional(),
              top: z.number().optional(),
              right: z.number().optional(),
              bottom: z.number().optional(),
            })
            .optional(),
          props: z.record(z.string(), z.any()).optional(),
          bindings: z.record(z.string(), z.string()).optional(),
        }),
      ),
    },
    async ({ applicationId, pageId, layoutId, widgets }) => {
      const page = await client.fetchPage(pageId, false);
      const layouts = page?.data?.layouts;
      if (!Array.isArray(layouts) || layouts.length === 0) {
        return toolWarn("fetch_page returned no layouts; cannot upsert widgets", { pageId });
      }
      const chosenLayout =
        (layoutId && layouts.find((l) => l?.id === layoutId)) || layouts[0] || null;
      if (!chosenLayout?.id) {
        return toolWarn("Could not determine layoutId from fetch_page response", { pageId, layoutId });
      }
      const dslRoot = chosenLayout.dsl;
      if (!dslRoot) {
        return toolWarn("Layout has no dsl field; cannot upsert widgets", { pageId, layoutId: chosenLayout.id });
      }

      // Hard fail early for AutoLayout if the flag exists.
      const lst = dslRoot.layoutSystemType || chosenLayout.layoutSystemType;
      if (lst && String(lst).toUpperCase().includes("AUTO")) {
        throw new Error(
          `AutoLayout detected (layoutSystemType=${lst}). upsert_widgets currently supports only FIXED layout.`,
        );
      }

      const nextDsl = deepCloneJson(dslRoot);
      const { created, updated } = upsertWidgetsIntoDsl({ dslRoot: nextDsl, widgets });

      const saved = await client.savePageDsl({
        applicationId,
        pageId,
        layoutId: chosenLayout.id,
        dsl: nextDsl,
      });

      return toolOk({
        layoutId: chosenLayout.id,
        created,
        updated,
        save_result_preview: truncateText(JSON.stringify(saved), 800),
      });
    },
  );

  server.tool(
    "list_datasources",
    "List datasources in a workspace (GET /api/v1/datasources?workspaceId=...).",
    { workspaceId: z.string().min(1) },
    async ({ workspaceId }) => toolOk(await client.listDatasources(workspaceId)),
  );

  server.tool(
    "create_datasource",
    "Create datasource (POST /api/v1/datasources). Payload is passed through as-is.",
    { payload: z.record(z.string(), z.any()) },
    async ({ payload }) => toolOk(await client.createDatasource(payload)),
  );

  server.tool(
    "test_datasource",
    "Test datasource (POST /api/v1/datasources/test). Payload is passed through as-is.",
    { payload: z.record(z.string(), z.any()) },
    async ({ payload }) => toolOk(await client.testDatasource(payload)),
  );

  server.tool(
    "update_datasource",
    "Update datasource (PUT /api/v1/datasources/{id}). Payload is passed through as-is.",
    { id: z.string().min(1), payload: z.record(z.string(), z.any()) },
    async ({ id, payload }) => toolOk(await client.updateDatasource(id, payload)),
  );

  server.tool(
    "fetch_datasource_structure",
    "Fetch datasource structure (GET /api/v1/datasources/{id}/structure?ignoreCache=...).",
    { id: z.string().min(1), ignoreCache: z.boolean().optional() },
    async ({ id, ignoreCache }) => toolOk(await client.fetchDatasourceStructure(id, ignoreCache ?? false)),
  );

  server.tool(
    "list_actions_by_page",
    "List actions (queries/apis) by pageId (GET /api/v1/actions?pageId=...).",
    { pageId: z.string().min(1) },
    async ({ pageId }) => toolOk(await client.listActionsByPage(pageId)),
  );

  server.tool(
    "create_action",
    "Create action (POST /api/v1/actions). Payload is passed through as-is.",
    { payload: z.record(z.string(), z.any()) },
    async ({ payload }) => toolOk(await client.createAction(payload)),
  );

  server.tool(
    "update_action",
    "Update action (PUT /api/v1/actions/{id}). Payload is passed through as-is.",
    { id: z.string().min(1), payload: z.record(z.string(), z.any()) },
    async ({ id, payload }) => toolOk(await client.updateAction(id, payload)),
  );

  server.tool(
    "execute_action",
    "Execute an action (POST /api/v1/actions/execute). If payload.form exists, sends multipart form-data; else sends JSON.",
    { payload: z.record(z.string(), z.any()), timeoutMs: z.number().optional() },
    async ({ payload, timeoutMs }) => toolOk(await client.executeAction(payload, timeoutMs)),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
