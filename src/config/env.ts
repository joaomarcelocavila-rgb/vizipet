export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  LOG_LEVEL: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  APP_URL: string;
  CORS_ORIGINS: string[];
  STORAGE_DRIVER: 'local' | 'supabase';
  STORAGE_LOCAL_DIR: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_BUCKET: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  CRON_SECRET: string;
  INTERNAL_JOBS: boolean;
  THROTTLE_LIMIT: number;
}

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'CRON_SECRET'] as const;

export function validateEnv(raw: Record<string, unknown>): Env {
  const get = (key: string, fallback = ''): string => {
    const value = raw[key];
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  };

  const missing = required.filter((key) => !get(key));
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  }

  const nodeEnv = get('NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV deve ser development, test ou production');
  }
  if (nodeEnv === 'production' && get('JWT_ACCESS_SECRET').length < 32) {
    throw new Error('JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres em produção');
  }

  const driver = get('STORAGE_DRIVER', 'local');
  if (driver !== 'local' && driver !== 'supabase') {
    throw new Error('STORAGE_DRIVER deve ser local ou supabase');
  }
  if (driver === 'supabase' && (!get('SUPABASE_URL') || !get('SUPABASE_SERVICE_ROLE_KEY'))) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias com STORAGE_DRIVER=supabase');
  }

  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: Number(get('PORT', '3000')),
    LOG_LEVEL: get('LOG_LEVEL', 'log'),
    DATABASE_URL: get('DATABASE_URL'),
    JWT_ACCESS_SECRET: get('JWT_ACCESS_SECRET'),
    APP_URL: get('APP_URL', 'http://localhost:5173'),
    CORS_ORIGINS: get('CORS_ORIGINS', get('APP_URL', 'http://localhost:5173'))
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    STORAGE_DRIVER: driver,
    STORAGE_LOCAL_DIR: get('STORAGE_LOCAL_DIR', './.storage'),
    SUPABASE_URL: get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_BUCKET: get('SUPABASE_BUCKET', 'vizipet-private'),
    RESEND_API_KEY: get('RESEND_API_KEY'),
    MAIL_FROM: get('MAIL_FROM', 'Vizipet <nao-responda@vizipet.local>'),
    CRON_SECRET: get('CRON_SECRET'),
    INTERNAL_JOBS: get('INTERNAL_JOBS') === 'true',
    THROTTLE_LIMIT: Number(get('THROTTLE_LIMIT', '120')),
  };
}
