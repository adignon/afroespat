# e2e — notes sur les fichiers qui ne sont pas des specs

- `aide-w5a.ts`, `aide-w5b.ts` : aides PARTAGÉES importées par plusieurs specs (compte d'équipe,
  TOTP, décors montés par les vraies routes). Ce ne sont pas des tests ; ne pas les supprimer.
- `balayage-mobile.mjs`, `balayage-clics.mjs` : scripts d'audit autonomes (`node e2e/balayage-mobile.mjs`),
  hors CI. Ils montent des comptes sur une API locale lancée ; voir l'en-tête de chaque fichier.
- `session.ts`, `sms.ts`, `niveau.ts`, `mots-visibles.ts`, … : aides communes aux specs.
