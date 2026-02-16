/* eslint-disable no-console */
// Phase 3-A: create/update Upload_Normas page in Appsmith with 2 tabs
// (WEB functional now, PDF placeholder), and a REST action that calls
// n8n webhook index-norma-web-v3.

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const APPLICATION_ID = "6992325c8a3a0012fc7c5ed5";
const PAGE_NAME = "Upload_Normas";
const PAGE_SLUG = "upload-normas";
const WORKSPACE_ID = "69894b618a3a0012fc7c5eb2";
const REST_PLUGIN_ID = "69892a638a3a0012fc7c5e82";
const WEBHOOK_URL = "https://n8n.johnsontn.com.br/webhook/index-norma-web-v3";

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

function ensureChildrenArray(root) {
  if (!Array.isArray(root.children)) root.children = [];
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

  // Use an existing page layout as template because some Appsmith versions
  // require "layouts" when creating a new page.
  let layoutTemplate = null;
  try {
    const basePage = await request("get", "/api/v1/pages/6992325c8a3a0012fc7c5ed7", { params: { migrateDsl: "false" } });
    const baseLayout = basePage?.data?.layouts?.[0];
    if (baseLayout?.dsl) {
      const cleanDsl = deepCloneJson(baseLayout.dsl);
      cleanDsl.children = [];
      layoutTemplate = {
        dsl: cleanDsl,
        layoutOnLoadActions: [],
        layoutOnLoadActionErrors: []
      };
    }
  } catch {
    // ignore template fetch failure
  }

  // Ensure page exists
  const pagesResp = await request("get", "/api/v1/pages", { params: { applicationId: APPLICATION_ID } });
  const pages = pagesResp?.data?.pages || [];
  let page = pages.find((p) => p?.name === PAGE_NAME);
  if (!page) {
    const attempts = [
      { params: undefined, body: { applicationId: APPLICATION_ID, name: PAGE_NAME } },
      { params: { applicationId: APPLICATION_ID }, body: { name: PAGE_NAME } },
      { params: { applicationId: APPLICATION_ID }, body: { applicationId: APPLICATION_ID, name: PAGE_NAME } },
      {
        params: undefined,
        body: {
          applicationId: APPLICATION_ID,
          name: PAGE_NAME,
          layouts: layoutTemplate ? [layoutTemplate] : []
        }
      },
      {
        params: { applicationId: APPLICATION_ID },
        body: {
          applicationId: APPLICATION_ID,
          name: PAGE_NAME,
          layouts: layoutTemplate ? [layoutTemplate] : []
        }
      }
    ];
    let created = null;
    let lastErr = null;
    for (const a of attempts) {
      try {
        created = await request("post", "/api/v1/pages", {
          params: a.params,
          data: a.body,
          headers: { "Content-Type": "application/json" },
        });
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!created) throw lastErr || new Error("Failed to create Upload_Normas page");
    const pageId = created?.data?.id || created?.data?.page?.id || created?.data?.pageId;
    if (!pageId) throw new Error(`Page created but pageId missing: ${JSON.stringify(created).slice(0, 800)}`);
    page = { id: pageId, name: PAGE_NAME };
  }

  const pageId = page.id;
  const pageFull = await request("get", `/api/v1/pages/${encodeURIComponent(pageId)}`, {
    params: { migrateDsl: "false" },
  });
  const layout = pageFull?.data?.layouts?.[0];
  if (!layout?.id || !layout?.dsl) throw new Error("Upload_Normas page has no layout/dsl");
  const layoutId = layout.id;
  const dsl = deepCloneJson(layout.dsl);
  ensureChildrenArray(dsl);
  const rootId = dsl.widgetId;
  if (!rootId) throw new Error("DSL root missing widgetId");

  const ensureWidget = (widgetName, type, left, top, right, bottom) => {
    let w = findWidgetByName(dsl, widgetName);
    if (!w) {
      w = mkBase(rootId, widgetName, type, left, top, right, bottom);
      dsl.children.push(w);
    }
    setPos(w, left, top, right, bottom);
    return w;
  };

  // Header
  const title = ensureWidget("Txt_Upload_Title", "TEXT_WIDGET", 0, 0, 56, 4);
  title.text = "{{'Central de Ingestao Hibrida - Fase 3'}}";
  ensureDynBinding(title, "text");

  // Tabs (buttons controlled by store UPLOAD_TAB)
  const btnPdf = ensureWidget("Btn_Tab_PDF", "BUTTON_WIDGET", 0, 4, 28, 8);
  btnPdf.text = "Normas Internas (PDF)";
  btnPdf.onClick = "{{storeValue('UPLOAD_TAB', 'pdf')}}";
  ensureDynTrigger(btnPdf, "onClick");

  const btnWeb = ensureWidget("Btn_Tab_WEB", "BUTTON_WIDGET", 28, 4, 56, 8);
  btnWeb.text = "Legislacao Federal (Web)";
  btnWeb.onClick = "{{storeValue('UPLOAD_TAB', 'web')}}";
  ensureDynTrigger(btnWeb, "onClick");

  // WEB section
  const txtWeb = ensureWidget("Txt_Web_Header", "TEXT_WIDGET", 0, 9, 56, 12);
  txtWeb.text = "{{'Pipeline B: Informe URL do Planalto para indexacao.'}}";
  txtWeb.isVisible = "{{(appsmith.store.UPLOAD_TAB || 'web') === 'web'}}";
  ensureDynBinding(txtWeb, "text");
  ensureDynBinding(txtWeb, "isVisible");

  const inWebUrl = ensureWidget("Input_Web_URL", "INPUT_WIDGET_V2", 0, 12, 42, 18);
  inWebUrl.label = "URL da Legislacao";
  inWebUrl.labelPosition = "Top";
  inWebUrl.placeholderText = "https://www.planalto.gov.br/...";
  inWebUrl.isVisible = "{{(appsmith.store.UPLOAD_TAB || 'web') === 'web'}}";
  ensureDynBinding(inWebUrl, "isVisible");

  const inWebNorma = ensureWidget("Input_Web_NormaId", "INPUT_WIDGET_V2", 42, 12, 56, 18);
  inWebNorma.label = "Norma ID (opcional)";
  inWebNorma.labelPosition = "Top";
  inWebNorma.placeholderText = "LEI-8112";
  inWebNorma.isVisible = "{{(appsmith.store.UPLOAD_TAB || 'web') === 'web'}}";
  ensureDynBinding(inWebNorma, "isVisible");

  const btnSendWeb = ensureWidget("Btn_Enviar_Web", "BUTTON_WIDGET", 0, 18, 16, 22);
  btnSendWeb.text = "Ingerir URL";
  btnSendWeb.isVisible = "{{(appsmith.store.UPLOAD_TAB || 'web') === 'web'}}";
  btnSendWeb.onClick =
    "{{\n" +
    "  (function(){\n" +
    "    var url = (Input_Web_URL.text || '').trim();\n" +
    "    if (!url) { showAlert('Informe a URL da legislacao.', 'warning'); return; }\n" +
    "    storeValue('UPLOAD_LAST_ERROR', '');\n" +
    "    showAlert('Enviando para indexacao web...', 'info');\n" +
    "    IngerirNormaWeb.run({ url: url, norma_id: (Input_Web_NormaId.text || '').trim() || null })\n" +
    "      .then(function(){\n" +
    "        showAlert('Webhook aceito. Processamento iniciado no n8n.', 'success');\n" +
    "        storeValue('UPLOAD_LAST_OK', new Date().toISOString());\n" +
    "      })\n" +
    "      .catch(function(e){\n" +
    "        var msg = (e && e.message) ? e.message : String(e);\n" +
    "        storeValue('UPLOAD_LAST_ERROR', msg);\n" +
    "        showAlert('Falha ao enviar URL: ' + msg.slice(0, 140), 'error');\n" +
    "      });\n" +
    "  })()\n" +
    "}}";
  ensureDynBinding(btnSendWeb, "isVisible");
  ensureDynTrigger(btnSendWeb, "onClick");

  const txtWebHint = ensureWidget("Txt_Web_Hint", "TEXT_WIDGET", 16, 18, 56, 22);
  txtWebHint.text = "{{'Endpoint: /webhook/index-norma-web-v3'}}";
  txtWebHint.isVisible = "{{(appsmith.store.UPLOAD_TAB || 'web') === 'web'}}";
  ensureDynBinding(txtWebHint, "text");
  ensureDynBinding(txtWebHint, "isVisible");

  // PDF placeholder section
  const txtPdf = ensureWidget("Txt_PDF_Placeholder", "TEXT_WIDGET", 0, 9, 56, 16);
  txtPdf.text =
    "{{'Pipeline A (PDF) sera implementado na proxima etapa: upload binario + Google Drive (pasta 00_JMU_Normas_Originais).'}}";
  txtPdf.isVisible = "{{(appsmith.store.UPLOAD_TAB || 'web') === 'pdf'}}";
  ensureDynBinding(txtPdf, "text");
  ensureDynBinding(txtPdf, "isVisible");

  // Status footer
  const txtStatus = ensureWidget("Txt_Upload_Status", "TEXT_WIDGET", 0, 23, 56, 28);
  txtStatus.text =
    "{{\n" +
    "  'Ultimo envio: ' + (appsmith.store.UPLOAD_LAST_OK || 'n/a') +\n" +
    "  (appsmith.store.UPLOAD_LAST_ERROR ? (' | erro: ' + appsmith.store.UPLOAD_LAST_ERROR) : '')\n" +
    "}}";
  ensureDynBinding(txtStatus, "text");

  // Ensure REST action exists/updated on this page
  const actionsResp = await request("get", "/api/v1/actions", { params: { pageId } });
  const actions = Array.isArray(actionsResp?.data) ? actionsResp.data : [];
  let ingestAction = actions.find((a) => a?.name === "IngerirNormaWeb");

  // Reuse any existing REST datasource from workspace (DEFAULT_REST_DATASOURCE
  // may not exist in some Appsmith deployments).
  const dsResp = await request("get", "/api/v1/datasources", { params: { workspaceId: WORKSPACE_ID } });
  const datasources = Array.isArray(dsResp?.data) ? dsResp.data : [];
  const restDs =
    datasources.find((d) => d?.pluginId === REST_PLUGIN_ID && /n8n|webhook/i.test(d?.name || "")) ||
    datasources.find((d) => d?.pluginId === REST_PLUGIN_ID);
  if (!restDs?.id) {
    throw new Error("Nenhum datasource REST encontrado no workspace. Crie um datasource REST primeiro.");
  }

  const actionPayload = {
    name: "IngerirNormaWeb",
    pageId,
    applicationId: APPLICATION_ID,
    workspaceId: WORKSPACE_ID,
    pluginId: REST_PLUGIN_ID,
    pluginType: "API",
    datasource: {
      id: restDs.id,
      name: restDs.name || "REST",
      pluginId: REST_PLUGIN_ID,
      workspaceId: WORKSPACE_ID,
      userPermissions: [],
      datasourceStorages: {},
      invalids: [],
      messages: [],
      isValid: true
    },
    actionConfiguration: {
      timeoutInMillisecond: 20000,
      paginationType: "NONE",
      encodeParamsToggle: true,
      httpMethod: "POST",
      httpVersion: "HTTP11",
      url: WEBHOOK_URL,
      path: WEBHOOK_URL,
      headers: [{ key: "Content-Type", value: "application/json" }],
      queryParameters: [],
      body: "{\"url\":\"{{this.params.url}}\",\"norma_id\":{{JSON.stringify(this.params.norma_id)}}}",
      bodyFormData: [],
      formData: { apiContentType: "application/json" },
      pluginSpecifiedTemplates: [{ value: false }]
    },
    dynamicBindingPathList: [
      { key: "actionConfiguration.body" },
      { key: "actionConfiguration.url" },
      { key: "actionConfiguration.path" }
    ]
  };

  if (!ingestAction) {
    ingestAction = await request("post", "/api/v1/actions", {
      data: actionPayload,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    const merged = deepCloneJson(ingestAction);
    merged.datasource = actionPayload.datasource;
    merged.pluginId = actionPayload.pluginId;
    merged.actionConfiguration = actionPayload.actionConfiguration;
    merged.dynamicBindingPathList = actionPayload.dynamicBindingPathList;
    await request("put", `/api/v1/actions/${encodeURIComponent(ingestAction.id)}`, {
      data: merged,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Save page DSL, keep onload clean, publish app
  await request("put", `/api/v1/layouts/${encodeURIComponent(layoutId)}/pages/${encodeURIComponent(pageId)}`, {
    params: { applicationId: APPLICATION_ID },
    data: { dsl, layoutOnLoadActions: [], layoutOnLoadActionErrors: [] },
    headers: { "Content-Type": "application/json" },
  });

  await request("post", `/api/v1/applications/publish/${encodeURIComponent(APPLICATION_ID)}`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });

  const viewLink = `${baseUrl.replace(/\/+$/, "")}/app/jmu-gestao-inteligente/${PAGE_SLUG}-${pageId}`;
  console.log(JSON.stringify({ ok: true, applicationId: APPLICATION_ID, pageId, layoutId, pageName: PAGE_NAME, viewLink }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e.message || String(e));
  process.exit(1);
});
