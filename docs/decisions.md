# Journal des décisions

> Exigé par `00-fondations.md` §0.5 et §12.2 : toute hypothèse prise pendant la
> construction s'inscrit ici. Une ligne par décision. **On ne réécrit pas
> l'historique** : on ajoute une décision qui remplace la précédente.
>
> Les décisions de conception, antérieures au code, sont dans
> `specs/T4-api-runbook-decisions.md`. Ce fichier prend la suite.

| Date | Décision | Motif | Remplace |
|---|---|---|---|
| 2026-09-27 | **D1 — ORM : Prisma 6**, avec migrations SQL écrites à la main pour ce que Prisma n'exprime pas | Le plus rapide sur 105 tables, client typé, schéma multi-fichiers. Le modèle relationnel restant indépendant de l'ORM, le choix est réversible | `T4` : « ORM non désigné » |
| 2026-09-27 | **D2 — Les maquettes v2 sont la source de vérité du design**, et `T1-design-system.md` §2 doit être réaligné sur elles | `T1` était le *prompt d'entrée* de Claude Design ; la bibliothèque UI v2 en est la sortie itérée. Le brief ne peut pas primer sur son propre résultat. Porter 88 écrans vers les jetons de `T1` coûterait une relecture complète | La phrase de préséance de `T1` §0 et le préambule de `T5` §0 |
| 2026-09-27 | **D3 — Nom affiché : `DisaporyPlus`**, dans une constante unique (`@app/shared/constants/product.ts`) et un seul fichier de traduction | Décision du porteur. Le placer dans une constante rend un changement d'orthographe ultérieur trivial — la réserve consignée en `T4` sur « expates » vaut aussi ici | Le wordmark « Diaspora » des maquettes ; « afroexpates » des specs |
| 2026-09-27 | **D4 — Agrégateur Mobile Money toujours non désigné**, l'interface `MobileMoneyProvider` suffit jusqu'au lot 11 | Aucun code ne dépend du choix avant la facturation. Critères inchangés : MTN MoMo + Moov Money au Bénin, webhooks signés, remboursement | — |
| 2026-09-27 | **Lot 0 « socle technique » ajouté** avant les 12 lots de `00` §12.1 | Une quinzaine de briques transverses (boîte d'envoi, files, doublures de fournisseurs, audit, chiffrement, signets, réputation) sont consommées par tous les lots. Les rétro-ajouter coûterait un refactor par lot | L'ordre de `00` §12.1, complété — pas remplacé |
| 2026-09-27 | **Les 105 tables sont créées en une seule migration initiale**, et non lot par lot | Le modèle est figé et complet, et les modules n'ont pas le droit de le renommer (§0.2). Un schéma partiel forcerait à rejouer les clés étrangères à chaque lot | — |
| 2026-09-27 | **Les extensions PostgreSQL sont créées par migration Prisma**, pas par script d'init Docker | Deux sources concurrentes faisaient dériver l'historique de migration. `packages/db/docker/init-extensions.sql` reste en référence si l'utilisateur applicatif de production n'a pas le droit `CREATE EXTENSION` | Le montage dans `docker-compose.yml` |
| 2026-09-27 | **Certaines règles dures sont tenues par la base**, pas seulement par les services : `audit_logs` et `moderation_actions` en ajout seul par déclencheur, unicité partielle d'une seule version publiée, paire ordonnée des contacts, bornes des notes et des priorités | Une règle dure tenue par la base ne peut pas être contournée par un bogue de service. Voir `20260927050000_hard_rules_constraints` | — |
| 2026-09-27 | **Les déclencheurs d'ajout seul couvrent aussi `TRUNCATE`** (déclencheur de niveau instruction) | Un déclencheur `FOR EACH ROW` ne voit pas `TRUNCATE`, qui aurait effacé les 5 ans de journal d'audit exigés par §8.4 sans rien déclencher. Découvert en essayant de violer la contrainte | Le déclencheur initial, complété |
| 2026-09-27 | **`unaccent` est enveloppée dans `immutable_unaccent`** pour être utilisable dans un index | `unaccent()` est `STABLE`, pas `IMMUTABLE`, car le dictionnaire peut changer. L'enveloppe fixe le dictionnaire explicitement — solution documentée. Contrepartie assumée : un changement de dictionnaire impose une réindexation, que le runbook §7 prévoit déjà | — |
| 2026-09-27 | **Le `tsvector` de recherche est maintenu par déclencheur**, pas par colonne générée | Permet de pondérer le titre (A) plus fort que le corps (B), ce qu'une colonne générée ne fait pas aussi lisiblement | — |
| 2026-09-27 | **Les 95 enums de `@app/shared` sont générés** depuis `prisma/schema/*.prisma`, pas recopiés | Recopiés à la main, 95 enums dérivent, et une dérive d'enum entre base et front est un bogue silencieux. §6.1 demande d'ailleurs cette réexportation. Un test d'intégration ferme la boucle en interrogeant `pg_enum` | — |
| 2026-09-27 | **UUID v7 implémenté dans `@app/db`**, sans dépendance | 40 lignes et 5 tests, contre un paquet de plus dans la chaîne d'approvisionnement. La monotonie intra-milliseconde est couverte par un test de 10 000 identifiants | — |
| 2026-09-27 | **Image MinIO servie depuis `quay.io/minio/minio`** | `minio/minio` n'est plus public sur Docker Hub | L'image du `docker-compose.yml` initial |
| 2026-09-27 | **Les couleurs de la maquette sont conservées telles quelles, y compris sous le seuil AA.** Huit paires n'atteignent pas le contraste exigé, dont `text-subtle` sur blanc (3,10:1 pour 4,5 requis), le bandeau de sécurité terre cuite (3,91:1) et la piste d'interrupteur éteinte (1,54:1 pour 3,0 requis) | Décision du porteur : ne pas assombrir. Le design prime sur le seuil | Annule un assombrissement qui avait été appliqué en cours de session |
| 2026-09-27 | **Conséquence assumée** : la case « contrôle d'accessibilité sans violation » de §12.2 ne pourra pas être cochée, et `T1` §6 / §10.6 (« contraste AA minimum ») n'est pas tenu. La règle `color-contrast` est exclue du contrôle axe-core — **elle seule** : noms accessibles, rôles, ordre des titres et attributs ARIA continuent de bloquer | Un écart documenté vaut mieux qu'un test désactivé en silence. `check-contrast.mjs` liste les huit paires avec leur ratio mesuré et les **affiche à chaque build** ; il échoue sur toute paire nouvelle sous le seuil, et signale aussi toute exception devenue inutile | — |
| 2026-09-27 | **`opacity` est proscrite sur du texte** dans `packages/ui` : chaque ton porte sa couleur explicite | L'opacité mélange la couleur au fond, fait chuter le contraste réel, et reste invisible à un contrôle au niveau des jetons. Trouvée par axe-core sur le composant `Stat`, où elle était de mon fait — la maquette, elle, écrit `color:#5D6B66` en dur | — |
| 2026-09-27 | **Les specs ne sont PAS réalignées sur les jetons v2.** `packages/ui`, porté depuis le code de design existant, est la source de vérité de l'interface ; `T1` §2 et `T5` §0 restent tels quels et sont à lire comme le brief d'origine, non comme l'état courant | Décision du porteur : réutiliser le code de design déjà réalisé plutôt que réécrire le dossier. Évite une édition de 88 écrans de prompts pour un gain nul — le code porté vaut mieux qu'une spec corrigée | Précise D2 : la divergence est assumée et documentée, pas corrigée |

---

## Écarts relevés dans le dossier de specs, non encore corrigés

Ils n'empêchent pas de construire, mais le dossier devrait être aligné.

| Écart | Où | Correction attendue |
|---|---|---|
| Décompte des écrans incohérent : 81 (`PROJECT.md`), 78 (`T5` en-tête), **86** (inventaire `T5` §1) | `PROJECT.md`, `T5` | Retenir 86 |
| `H09 Mes demandes` et `H10 Mes réponses` sont maquettés mais absents de l'inventaire, alors que le panneau Entraide les référence | `T5` §1, `05 Entraide.dc.html` | Les ajouter à l'inventaire (lot 4) |
| Deux décisions contradictoires sur les jalons : « bandeau de jalons persistant, pas de stories » puis « stories 24 h en trois types ». `00` §10.1 tranche : « le bandeau de jalons n'existe plus » | `T4`, journal des décisions | Marquer la première ligne comme remplacée, selon la règle du journal |
| STUDIES annoncé à 12 étapes, 15 listées — le document le reconnaît lui-même | `T3` §A.2 | Corriger le titre |
| Jetons de design divergents entre `T1` §2 et les maquettes v2 | `T1`, `T5` §0 | **Non corrigé, volontairement.** `packages/ui` fait foi ; lire `T1` §2 comme le brief d'origine |
| `T1` §6 et §10.6 exigent AA, mais la palette du design ne l'atteint pas sur 8 paires | `T1` §2.1 et §6 | **Non corrigé, volontairement.** Écart mesuré, listé et affiché à chaque build par `check-contrast.mjs` |
| `T1` §2.3 exige 44 px de cible tactile, la maquette donne 37 px aux chips et 33 px au bouton « Continuer » | `T1` §2.3, `gen-helpers.js` | **Corrigé sans toucher au visuel** : le bouton fait 44 px, la pilule visuelle garde sa taille d'origine à l'intérieur |
