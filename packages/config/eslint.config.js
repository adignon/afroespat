import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Configuration ESLint partagée.
 *
 * 00-fondations.md §4 : « Lint et formatage imposés ; la CI échoue sur un
 * avertissement. » Toutes les règles sont donc en `error`, jamais en `warn` —
 * un avertissement que personne ne traite est du bruit.
 *
 * Aucun `any` : toute donnée externe est validée avant usage (§4).
 */
export default tseslint.config(
  { ignores: ['dist/**', 'generated/**', '.next/**', 'coverage/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
    },
    rules: {
      // §4 — aucun `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Un argument inutilisé préfixé d'un souligné est volontaire.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Les promesses non attendues sont la première source de bogues silencieux
      // dans un back-end à files d'attente.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // §4 — dates en UTC en base ; on ne construit pas de date à la main.
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-param-reassign': 'error',
    },
  },
  {
    // Les scripts d'outillage et les tests parlent à la console.
    files: ['**/scripts/**', '**/*.test.ts', '**/*.config.*', '**/vitest.setup.ts'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
);
