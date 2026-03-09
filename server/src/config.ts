import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_VERSION: z.string().trim().min(1).optional(),
  APP_COMMIT_SHA: z.string().trim().min(1).optional(),
  QUEUE_ATTENTION_DAYS: z.coerce.number().int().positive().default(2),
  QUEUE_CRITICAL_DAYS: z.coerce.number().int().positive().default(5),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppConfig = z.infer<typeof envSchema> & {
  isProduction: boolean;
};

export function loadConfig(overrides: Partial<NodeJS.ProcessEnv> = {}): AppConfig {
  const parsed = envSchema.safeParse({
    PORT: overrides.PORT ?? process.env.PORT,
    DATABASE_URL: overrides.DATABASE_URL ?? process.env.DATABASE_URL,
    SESSION_SECRET: overrides.SESSION_SECRET ?? process.env.SESSION_SECRET,
    CLIENT_ORIGIN: overrides.CLIENT_ORIGIN ?? process.env.CLIENT_ORIGIN,
    APP_BASE_URL: overrides.APP_BASE_URL ?? process.env.APP_BASE_URL,
    APP_VERSION: overrides.APP_VERSION ?? process.env.APP_VERSION,
    APP_COMMIT_SHA: overrides.APP_COMMIT_SHA ?? process.env.APP_COMMIT_SHA,
    QUEUE_ATTENTION_DAYS: overrides.QUEUE_ATTENTION_DAYS ?? process.env.QUEUE_ATTENTION_DAYS,
    QUEUE_CRITICAL_DAYS: overrides.QUEUE_CRITICAL_DAYS ?? process.env.QUEUE_CRITICAL_DAYS,
    NODE_ENV: overrides.NODE_ENV ?? process.env.NODE_ENV,
  });

  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  return {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === "production",
  };
}
