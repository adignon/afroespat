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

---

## Écarts relevés dans le dossier de specs, non encore corrigés

Ils n'empêchent pas de construire, mais le dossier devrait être aligné.

| Écart | Où | Correction attendue |
|---|---|---|
| Décompte des écrans incohérent : 81 (`PROJECT.md`), 78 (`T5` en-tête), **86** (inventaire `T5` §1) | `PROJECT.md`, `T5` | Retenir 86 |
| `H09 Mes demandes` et `H10 Mes réponses` sont maquettés mais absents de l'inventaire, alors que le panneau Entraide les référence | `T5` §1, `05 Entraide.dc.html` | Les ajouter à l'inventaire (lot 4) |
| Deux décisions contradictoires sur les jalons : « bandeau de jalons persistant, pas de stories » puis « stories 24 h en trois types ». `00` §10.1 tranche : « le bandeau de jalons n'existe plus » | `T4`, journal des décisions | Marquer la première ligne comme remplacée, selon la règle du journal |
| STUDIES annoncé à 12 étapes, 15 listées — le document le reconnaît lui-même | `T3` §A.2 | Corriger le titre |
| Jetons de design divergents entre `T1` §2 et les maquettes v2 | `T1`, `T5` §0 | Réécrire avec les valeurs v2, conformément à D2 |
