const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const email = process.env.SMOKE_TEST_EMAIL;
const password = process.env.SMOKE_TEST_PASSWORD;
const adminEmail = process.env.SMOKE_TEST_ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_TEST_ADMIN_PASSWORD;
const requireAuth = process.env.SMOKE_TEST_REQUIRE_AUTH === "true";
const requireAdmin = process.env.SMOKE_TEST_REQUIRE_ADMIN === "true";

function assertCredentials(label: string, nextEmail: string | undefined, nextPassword: string | undefined) {
  if (!nextEmail || !nextPassword) {
    throw new Error(`${label} smoke test requires credentials.`);
  }
}

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`Unexpected response content-type: ${contentType || "unknown"}.`);
  }

  return response.json() as Promise<{
    ok: boolean;
    data: unknown;
    error: {
      code: string;
      message: string;
    } | null;
  }>;
}

function extractCookie(response: Response) {
  const cookie = response.headers.get("set-cookie");

  if (!cookie) {
    throw new Error("Smoke test login did not return a session cookie.");
  }

  const [sessionCookie] = cookie.split(";");

  if (!sessionCookie) {
    throw new Error("Smoke test login returned an invalid session cookie.");
  }

  return sessionCookie;
}

async function loginWithCredentials(nextEmail: string, nextPassword: string) {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: nextEmail, password: nextPassword }),
  });

  if (!login.ok) {
    throw new Error(`Login smoke test failed with ${login.status}.`);
  }

  const body = await readJson(login);

  if (!body.ok) {
    throw new Error(body.error?.message ?? "Login smoke test returned invalid envelope.");
  }

  return {
    cookie: extractCookie(login),
    user: body.data as {
      id: number;
      email: string;
      name: string;
      role: "admin" | "operador";
      permissions: string[];
    },
  };
}

async function authenticatedGet(path: string, cookie: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      cookie,
    },
  });

  if (!response.ok) {
    throw new Error(`Authenticated smoke test failed on ${path} with ${response.status}.`);
  }

  const body = await readJson(response);

  if (!body.ok) {
    throw new Error(body.error?.message ?? `Authenticated smoke test returned invalid envelope on ${path}.`);
  }

  return body.data;
}

async function run() {
  const health = await fetch(`${baseUrl}/api/health`);

  if (!health.ok) {
    throw new Error(`Healthcheck failed with ${health.status}.`);
  }

  console.log("health ok");

  const ready = await fetch(`${baseUrl}/api/ready`);

  if (!ready.ok) {
    throw new Error(`Readiness failed with ${ready.status}.`);
  }

  console.log("ready ok");

  if (requireAuth) {
    assertCredentials("Authenticated", email, password);
  }

  if (!email || !password) {
    console.log("authenticated smoke test skipped");
  } else {
    const smokeEmail = email;
    const smokePassword = password;
    const session = await loginWithCredentials(smokeEmail, smokePassword);
    const currentUser = (await authenticatedGet("/api/auth/me", session.cookie)) as {
      email: string;
      role: "admin" | "operador";
    };

    if (currentUser.email !== smokeEmail) {
      throw new Error("Authenticated smoke test returned a different session user.");
    }

    await authenticatedGet("/api/pre-demandas?page=1&pageSize=5", session.cookie);
    await authenticatedGet("/api/pre-demandas/dashboard/resumo", session.cookie);
    console.log(`authenticated smoke test ok (${session.user.role})`);
  }

  if (requireAdmin) {
    assertCredentials("Admin", adminEmail, adminPassword);
  }

  if (!adminEmail || !adminPassword) {
    console.log("admin smoke test skipped");
    return;
  }

  const smokeAdminEmail = adminEmail;
  const smokeAdminPassword = adminPassword;
  const adminSession = await loginWithCredentials(smokeAdminEmail, smokeAdminPassword);

  if (adminSession.user.role !== "admin") {
    throw new Error("Admin smoke test requires an admin account.");
  }

  await authenticatedGet("/api/admin/ops/resumo?limit=3", adminSession.cookie);
  await authenticatedGet("/api/admin/ops/queue-health-config", adminSession.cookie);
  await authenticatedGet("/api/admin/users", adminSession.cookie);
  console.log("admin smoke test ok");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
