import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
    environment: 'node',

    /**
     * Profil de coût réduit pour le hachage des mots de passe d'équipe.
     *
     * Les paramètres argon2id de production (OWASP : m=19456, t=2, p=1) coûtent
     * 14 ms, ce qui serait tenable — mais le dépôt a déjà payé la leçon inverse
     * avec scrypt, dont le coût faisait expirer des tests SOUS CHARGE et pas au
     * repos, si bien qu'ils arrivaient verts et rougissaient ensuite sans qu'une
     * ligne ait changé. On ne rejoue pas ce jeu : la suite a ses paramètres, la
     * production a les siens.
     *
     * `resolveArgon2Cost` exige NODE_ENV=test EN PLUS de cette variable — que
     * vitest pose lui-même. Un `.env` de production qui porterait la variable par
     * accident n'affaiblirait donc rien ; c'est éprouvé dans
     * `staff-password.test.ts`.
     */
    env: { STAFF_PASSWORD_FAST_HASH: '1' },
  },
});
