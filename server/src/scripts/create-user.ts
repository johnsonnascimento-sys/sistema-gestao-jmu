import { hashPassword } from "../auth/password";
import { loadConfig } from "../config";
import { createPool } from "../db";
import { PostgresUserRepository } from "../repositories/postgres-user-repository";

function getArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

async function run() {
  const email = getArg("email");
  const name = getArg("name");
  const password = getArg("password");
  const role = (getArg("role") || "operador") as "admin" | "operador";

  if (!email || !name || !password) {
    throw new Error("Uso: npm run db:create-user -- --email=usuario@exemplo.com --name=\"Nome\" --password=Senha123 --role=admin");
  }

  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  const repository = new PostgresUserRepository(pool);

  try {
    const passwordHash = await hashPassword(password);
    const user = await repository.create({
      email,
      name,
      passwordHash,
      role,
    });

    console.log(`Usuario criado: ${user.email} (${user.role})`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
