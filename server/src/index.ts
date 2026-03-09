import { buildApp } from "./app";
import { loadConfig } from "./config";

async function start() {
  const config = loadConfig();
  const app = await buildApp({ config });

  await app.listen({
    host: "0.0.0.0",
    port: config.PORT,
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
