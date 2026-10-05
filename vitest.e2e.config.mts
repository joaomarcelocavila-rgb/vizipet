import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup-env.ts'],
    globalSetup: ['test/global-setup.ts'],
    // As suítes dividem o mesmo banco de teste: rodam uma de cada vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
