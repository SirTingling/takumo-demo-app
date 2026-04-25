import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRY: z.string().default('24h'),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  OTEL_SERVICE_NAME: z.string().default('acme-payments-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

type Env = z.infer<typeof envSchema>;

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Invalid environment variables:\n${result.error.flatten().fieldErrors}`,
      );
    }
    // Dev mode: warn and use defaults
    console.warn('[config] Some env vars are missing — using dev defaults');
    console.warn('[config] Errors:', JSON.stringify(result.error.flatten().fieldErrors));
  }

  const env: Env = result.success ? result.data : (envSchema.parse({
    ...process.env,
    DATABASE_URL: undefined,
    REDIS_URL: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
    JWT_SECRET: undefined,
    ENCRYPTION_KEY: undefined,
    OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
  }) as Env);

  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    database: {
      url: env.DATABASE_URL ?? '',
    },
    redis: {
      url: env.REDIS_URL ?? '',
    },
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    },
    jwt: {
      secret: env.JWT_SECRET ?? 'dev-only-jwt-secret-not-for-production',
      expiry: env.JWT_EXPIRY,
    },
    encryption: {
      key: env.ENCRYPTION_KEY ?? '',
    },
    otel: {
      serviceName: env.OTEL_SERVICE_NAME,
      endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '',
    },
  } as const;
}

export const config = loadConfig();
export type Config = ReturnType<typeof loadConfig>;

