import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Le JSX est transformé par le runtime automatique de React 19 :
  // aucun `import React` n'est nécessaire dans les composants ni les tests.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
  },
});
