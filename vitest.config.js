import { defineConfig } from 'vitest/config';
import webConfig from './apps/web/vite.config.js';
export default defineConfig({
  plugins: webConfig.plugins,
  test: {
    environment: 'node',
    include: ['apps/**/*.test.{js,jsx}', 'packages/**/*.test.js'],
  },
});
