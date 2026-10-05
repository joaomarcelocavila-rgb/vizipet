import { tmpdir } from 'node:os';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://vizipet:vizipet@localhost:5432/vizipet_test';
process.env.JWT_ACCESS_SECRET = 'segredo-de-teste-com-tamanho-suficiente-123';
process.env.CRON_SECRET = 'cron-de-teste';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = `${tmpdir()}/vizipet-test-storage`;
process.env.THROTTLE_LIMIT = '100000';
process.env.RESEND_API_KEY = '';
process.env.INTERNAL_JOBS = 'false';
