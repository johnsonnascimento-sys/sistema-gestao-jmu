const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const email = process.env.SMOKE_TEST_EMAIL;
const password = process.env.SMOKE_TEST_PASSWORD;

async function run() {
  const health = await fetch(`${baseUrl}/api/health`);

  if (!health.ok) {
    throw new Error(`Healthcheck failed with ${health.status}.`);
  }

  console.log("health ok");

  if (!email || !password) {
    console.log("authenticated smoke test skipped");
    return;
  }

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!login.ok) {
    throw new Error(`Login smoke test failed with ${login.status}.`);
  }

  const cookie = login.headers.get("set-cookie");

  if (!cookie) {
    throw new Error("Login smoke test did not return a session cookie.");
  }

  const list = await fetch(`${baseUrl}/api/pre-demandas?page=1&pageSize=5`, {
    headers: {
      cookie,
    },
  });

  if (!list.ok) {
    throw new Error(`Authenticated smoke test failed with ${list.status}.`);
  }

  console.log("authenticated smoke test ok");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
