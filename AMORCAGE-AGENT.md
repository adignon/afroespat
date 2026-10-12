# Mémo d'amorçage — à lire AVANT de toucher quoi que ce soit

Ce fichier existe pour une raison chiffrée. Sept agents ont travaillé sur ce dépôt
en une session ; chacun est reparti de zéro, et chacun a repayé les mêmes pièges.
L'un d'eux a coûté **cinq redécouvertes par cinq agents différents**. Le temps perdu
n'est pas dans la mesure — la mesure est ce qui attrape les vrais défauts — il est
dans la redécouverte.

Lis ce fichier en entier. Il est court exprès. Ce qui n'y est pas est dans le code.

---

## 1. LES RÈGLES PERMANENTES DU PORTEUR

Elles priment sur toute autre considération, y compris sur ce qui te semblerait
une amélioration.

- **NE COMMITE JAMAIS.** Laisse le worktree propre de tout fichier temporaire
  (`apps/web/test-results`, specs jetables, scripts). Tu rapportes, c'est tout.
- **NE RÉÉCRIS JAMAIS UNE MAQUETTE — TRANSCODE-LA.** Mot pour mot :
  « Non ne récris pas. Utilise directement la maquette c'est un fichier html. »
  Tout dessin passe par `tools/generate-screens.mjs` + `tools/screens/*.mjs`, puis
  `node tools/generate-screens.mjs`. **N'édite JAMAIS un `.generated.tsx`** : il
  sera écrasé à la génération suivante, sans un mot.
- **`docs/` est en LECTURE SEULE.** `git status --porcelain -- docs/` doit rester
  vide à la fin de ton lot. Tu lis les maquettes, tu n'y touches pas.
- **N'ASSOMBRIS PAS LES COULEURS.** « N'assombrie pas. »
  `node packages/config/guardrails/check-contrast.mjs` doit rester à
  **« 16 paires conformes AA sur 24 »**. Ni plus, ni moins : une paire de plus veut
  dire qu'une couleur a bougé.
- **TOUTE CORRECTION PREND SUR LES DEUX PLANCHES**, 1440 px ET 390 px. Mot pour
  mot : « Veille toujours à ce que toutes les corrections soient aussi faites sur
  mobile. » Le porteur l'a redemandé plusieurs fois ; c'est l'oubli le plus
  fréquent.
- **NE LANCE JAMAIS `next build`.** Le porteur teste en permanence sur les ports
  **3000** (web) et **3001** (API). Monte ta pile ailleurs (voir §4) et arrête-la.
- **PAS DE BATTERIE PLAYWRIGHT.** Le porteur s'en est plaint deux fois : « Les
  tests que tu exécutes prennent trop de temps. » Au plus **un** fichier ciblé, que
  tu supprimes ensuite.
- **AUCUNE OPÉRATION DESTRUCTRICE EN BASE.** Seulement `pnpm prisma migrate dev`
  **additif**, depuis `packages/db`, et relis le SQL généré avant de l'appliquer :
  aucun `DROP`, aucun `TRUNCATE`, aucun `ALTER COLUMN`. N'invoque JAMAIS
  `migrate reset` et **ne demande JAMAIS** `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` :
  le porteur n'y a jamais consenti. Les déclencheurs PostgreSQL
  `audit_logs_append_only` et `audit_logs_no_truncate` restent intacts.
- **TERMINE AVANT DE VÉRIFIER.** « Finis toujours avant de compiler. » Ne
  typecheck pas après chaque ligne : finis le lot, puis vérifie une fois.
- **DIS CE QUE TU N'AS PAS FAIT.** Un écart nommé vaut mieux qu'un demi-branchement
  silencieux. Si la maquette ne dessine pas quelque chose, **ne l'invente pas** :
  remonte-le.

---

## 2. CE QU'EST CE DÉPÔT, EN SIX LIGNES

- pnpm + Turborepo. TypeScript **strict**, avec `exactOptionalPropertyTypes` et
  `noUncheckedIndexedAccess` — les deux mordent, prévois-le.
- `packages/shared` est **la seule source** de validation (Zod) et de constantes
  métier. Les bornes ne se recopient jamais : on les importe.
  **Après toute modification : `cd packages/shared && npm run build`**, sinon ni
  l'API ni le web ne voient le changement.
- API NestJS, Prisma 6, schéma multi-fichiers dans `packages/db/prisma/schema/`.
- Web Next.js 15 / React 19, App Router.
- Le style de commentaire du dépôt est **long et explicatif, en français** : le
  POURQUOI, ce qui a été MESURÉ, ce qui reste non résolu. Imite-le. Un en-tête qui
  survit à la décision qu'il décrit est un piège pour le prochain lecteur :
  **corrige les commentaires périmés que tu croises.**

---

## 3. LE GÉNÉRATEUR D'ÉCRANS — ET SES PIÈGES DÉJÀ PAYÉS

`tools/generate-screens.mjs` transcode le dialecte `.dc.html` des maquettes en JSX
avec les styles en ligne **verbatim**. Les déclarations par module vivent dans
`tools/screens/*.mjs`.

**Les mécanismes, du plus simple au plus lourd** — étudie-les avant d'inventer :

| mécanisme | ce qu'il fait |
|---|---|
| `donnees` | remplace un nœud dessiné par une interpolation, avec 4 contrôles |
| `motifs` | déclare un fragment à emprunter, éventuellement `from` une autre planche |
| `borrows` | copie une région d'une planche vers une autre |
| adaptations | `{ screens, nom, why, provides, apply(jsx) }` — rendent un dessin vivant |
| `composants:` | extrait un corps de boucle dans son propre fichier généré |
| `regions:` | extrait une région bornée (voile + panneau) dans son propre fichier |

### Les pièges, avec le prix déjà payé

1. **UN MOTIF QUI FIGE UNE VALEUR DE DESSIN NE DÉCRIT QU'UN SEUL CADRE.**
   *Payé cinq fois.* La planche de 390 px ne dessine presque jamais les mêmes
   valeurs que celle de 1440 px — `height: "44px"` contre `42px`, rayon 14 contre
   12, `fontSize` différente. Ancre tes motifs sur la **structure** (un attribut,
   un texte, une prise), jamais sur une mesure. Si tu dois relever une mesure,
   relève-la **sur chaque cadre** ou écris-la en classe : `height: "4[24]px"`.

2. **`String.replace` AVEC UN MOTIF EN CHAÎNE NE COUPE QUE LA PREMIÈRE OCCURRENCE.**
   Les rangées de pastilles, les ronds d'en-tête et les cartes se ressemblent
   beaucoup. Emploie une regex `g` avec `exec` en boucle et un découpage d'index.

3. **UNE COUPE DE RÉGION DOIT COMPTER LES BALISES.** Ouverture +1, fermeture −1,
   auto-fermante 0. Sans ça tu rends du JSX déséquilibré — et parfois ça compile.
   Vérifie le bilan et **refuse la coupe** s'il ne retombe pas à zéro.

4. **`NOM_VERS_PROFIL` TIENT À CENT CARACTÈRES PRÈS.** Il cherche l'avatar d'un
   membre dans les **1 500 caractères** qui précèdent un nom. Sur A01C l'écart vaut
   déjà 1 400. Une insertion dans cette zone le fait basculer hors de portée, le
   cadre perd son `data-nom-profil`, `Link` disparaît des imports — **et ça compile
   sans un mot**. Après toute insertion dans un cadre qu'il adapte, vérifie que
   `data-nom-profil` et `data-avatar-profil` sont toujours là.

5. **UNE LIAISON QUI NE NOMME QU'UN CADRE LAISSE LES AUTRES MENTIR.** *Payé trois
   fois sur A04 seul* (« 14 COMMENTAIRES », « Marc Koudou et 3 contributeurs »,
   « Marc K. et 3 » peints en dur sur la vue auteur). La génération réussit, le
   contrôle `fois: 1` est satisfait sur le cadre nommé, et c'est l'écran qui ment.
   **Quand la maquette dessine quatre cadres pour un écran, une liaison qui n'en
   nomme qu'un est une liaison à vérifier sur les trois autres.**

6. **LA MAQUETTE EST UNE IMAGE QUI NE DÉFILE PAS.** Ses `position: absolute` et
   ses hauteurs supposent un cadre figé. Mesuré : un voile dessiné en `absolute`
   faisait **3 100 px de haut** sur un guide réel, et son panneau finissait hors
   écran. Un panneau ou une feuille passe en `fixed`, avec `zIndex`,
   `overflowY: auto` et une hauteur bornée.

7. **`⚠ adaptation attendue introuvable` VEUT DIRE « SUR CE CADRE »**, pas
   « inutilisée ». Ce n'est pas forcément un défaut.

8. **DEUX `cursor` DANS UN MÊME STYLE DONNENT `TS1117`.** `resetBoutonManquant`
   en pose déjà un. Substitue quand c'est dessiné, ajoute seulement sinon. Même
   prudence pour toute clé que tu suffixes.

9. **REACT RÉÉCRIT LE RACCOURCI `background`** et remet `background-clip` à
   `border-box`. Si tu poses une couleur de fond par adaptation, écris
   `backgroundColor`.

10. **LES APOSTROPHES DE LA MAQUETTE SONT PARFOIS DROITES**, pas typographiques.
    Le deuxième contrôle d'`applyData` t'attrapera — c'est pour ça qu'il existe.

**Après génération, toujours :** `node tools/generate-screens.mjs --self-test`
(65 cas), et vérifie que la régénération est idempotente.

---

## 4. L'ENVIRONNEMENT, ET COMMENT MESURER SANS GÊNER LE PORTEUR

| quoi | où |
|---|---|
| base | `postgresql://app:app@localhost:5460/app?schema=public` |
| conteneurs | `afroespat-postgres-1`, `afroespat-redis-1` (`docker start …`) |
| psql | `docker exec afroespat-postgres-1 psql -U app -d app` (pas de `psql` local) |
| **API du porteur** | **3001 — ne pas toucher** |
| **web du porteur** | **3000 — ne pas toucher, et jamais `next build`** |
| ta pile | `next dev` sur 3100 (et une API sur 3002 si tu dois en relancer une) |
| lancer une API | `node -r @swc-node/register src/main.ts` depuis `apps/api` |

⚠ **JAMAIS `tsx` pour l'API** : esbuild n'émet pas les métadonnées de décorateur,
et Nest ne démarre pas.

⚠ **LE BUDGET OTP — ET CE MÉMO DISAIT LE CONTRAIRE DE LA VÉRITÉ.**

Il affirmait « 10 demandes par heure et par IP, donc monte UN compte et
réutilise-le ». **C'est faux en local, et le conseil était l'inverse du bon.**
Mesuré dans le code (`AuthService.assertWithinRateLimits` + `RATE_LIMITS`) :

| limite | valeur | mord en local ? |
|---|---|---|
| `otpPerIpPerHour` | 10 | **non** — `isExemptLocalIp` exempte `127.0.0.1` et `::1` hors production |
| `otpPerPhonePerHour` | **3** | **oui**, et c'est la seule |

**Donc : tire un NUMÉRO NEUF à chaque compte.** C'est ce qui ne bloque jamais.
Réutiliser le même numéro est précisément ce qui épuise le quota — un agent y a
perdu du temps en suivant la version fausse de ce paragraphe.

Le code de développement est `123456` (`SMS_FAKE_FIXED_CODE`).

⚠ **Le jeton de rafraîchissement TOURNE à chaque usage**, avec détection de rejeu.
Une valeur recopiée d'une exécution à l'autre est morte. `connecter()` et
`monterEnL1/L2` gèrent déjà ça correctement : emploie-les plutôt que de refaire
la connexion à la main.

### Monter un compte au bon niveau

Les niveaux sont **dérivés**, pas déclarés — `VerificationLevelService.levelFor()`
les recalcule depuis deux faits, et `auth.guard` relance le calcul dès qu'un jeton
est périmé. Écrire `users.verification_level` à la main ne tient pas.

- **N0** : `POST /auth/otp/request` puis `/auth/otp/verify`.
- **N1** : + KYC approuvé et majeur (`POST /me/kyc/session`, puis le webhook signé
  `POST /webhooks/didit`).
- **N2** : + un numéro vérifié d'un pays de **destination actif** (la France ;
  le Bénin est un pays d'ORIGINE et ne donne pas N2).

`apps/web/e2e/niveau.ts` porte **`monterEnL1` ET `monterEnL2`** — emploie-les, ne
réécris pas une montée en niveau à la main. `monterEnL2` nomme les trois pièges
qu'elle évite : le Bénin est un pays d'ORIGINE et ne donne pas N2, le numéro doit
être tiré au hasard (`phone_hmac` est unique), et le jeton est périmé **deux fois**
(N0→N1, puis N1→N2).

---

## 5. LES NIVEAUX, REFONDUS PAR LE PORTEUR

La table fait foi : `packages/shared/src/capabilities/capabilities.ts`. Ne la
recopie jamais, importe-la. Le résumé, pour éviter les contresens :

- **N0** — lire, **commenter et réagir**, **voter « ça m'a aidé »** sur un guide,
  demander de l'aide, ajouter des contacts, discuter, créer et gérer ses parcours.
- **N1** — publier dans le fil et les stories (**donc `POST /media`**), répondre à
  l'entraide, demander un parrain.
- **N2** — tout le reste, **sans exception**, y compris signaler un contenu et
  contester une sanction.

**LE FRONT PRÉVIENT, IL N'AUTORISE PAS.** Aucun `if (niveau >= 1)` ne décide quoi
que ce soit : on tente, le serveur refuse en `403 LEVEL_REQUIRED`, et
`components/fenetre-niveau.tsx` explique. `lib/capacites.ts` sert à **éteindre** un
bouton et à dire pourquoi, jamais à ouvrir une porte.

⚠ **Plusieurs maquettes et plusieurs tests figent l'ANCIENNE matrice.** Si un test
affirme un niveau que la table contredit, **c'est le test qu'on corrige**, et on
écrit dans son en-tête quel arbitrage l'a retourné et quand.

---

## 6. LA RECETTE D'UN LOT

1. **Mesure d'abord.** Navigateur ou `curl`, jamais une supposition. Les relevés
   chiffrés vont dans le rapport.
2. **Déclare et transcode.** Jamais un fichier généré à la main.
3. **Finis tout**, puis vérifie une seule fois :
   - `node tools/generate-screens.mjs` puis `--self-test`
   - `npx tsc --noEmit` depuis `apps/web` **et** `apps/api`
   - `npx eslint src` des deux côtés
   - `node packages/config/guardrails/check-contrast.mjs` → **16 / 24**
   - `node tools/check-duplicate-spread-keys.mjs` → aucune alerte
   - `npx vitest run src/screens` depuis `apps/web` (**336 cas** au dernier lot — si
     tu en ajoutes, dis-le : ce nombre sert de repère aux suivants)
   - les tests d'intégration des modules touchés :
     `npx vitest run --config vitest.int.config.ts <fichier>` depuis `apps/api`
     (repère : `guides.int.test.ts` **69**, `feed.int.test.ts` **41**, `communities.int.test.ts` **60**, `events.int.test.ts` **49**)

⚠ **UNE SESSION PAR RÔLE.** `dp_refresh` tourne à chaque usage avec détection de
rejeu : réinstaller le MÊME cookie dans un second contexte de navigateur donne une
session **morte**, sans aucun message. Le symptôme ne désigne pas la cause — sur la
page d'un guide, `isAuthor` tombe à faux et la carte d'auteur disparaît, ce qui se
lit comme un défaut d'affichage. Un agent l'a payé deux fois.

⚠ **NE JOUE PAS LES PROJETS PLAYWRIGHT `ordinateur` ET `mobile` EN PARALLÈLE**
sur un même `next dev` : ils se marchent dessus, et un échec reproductible en
parallèle disparaît en série. Un projet à la fois. (Et de toute façon : pas de
batterie, un fichier ciblé au plus — §1.)
4. **Exerce dans un vrai navigateur, aux deux largeurs.** Monte le décor par les
   **vraies routes** du produit, pas par des écritures en base.
5. **Range.** Supprime tes specs, ton `test-results`, tes scripts. Vérifie
   `git status`.
6. **Rapporte** : fichier par fichier, les relevés chiffrés, les décisions avec
   leur raison, les écarts de maquette, et ce que tu n'as pas fait et pourquoi.

---

## 6 bis. LES BOUCLES D'ATTENTE — QUATRE EN ONT TOURNÉ POUR RIEN

N'attends pas la fin d'une commande par une boucle qui interroge le système. Quatre
l'ont fait dans une seule session et **aucune n'est jamais sortie** : deux ont tourné
six heures, deux autres vingt et une. Elles ne coûtaient presque rien, mais elles
faisaient croire à des lots en cours longtemps après leur rapport.

**Les deux façons de se piéger, toutes deux payées :**

1. **LA BOUCLE SE TROUVE ELLE-MÊME.**
   ```
   until ! pgrep -f "eslint src -f json" >/dev/null; do sleep 5; done
   ```
   `pgrep -f` lit les lignes de commande ENTIÈRES — y compris celle du shell qui
   porte cette boucle, puisque le motif y figure en toutes lettres. La boucle se
   voit, conclut que le lint tourne encore, et repart. Pour toujours.

2. **ELLE GUETTE UN FICHIER QUE PLUS PERSONNE N'ÉCRIRA.**
   ```
   until grep -qE "[0-9]+ (passed|failed)" .../run1.log; do sleep 5; done
   ```
   L'exécution qui devait remplir ce journal avait été interrompue. Le fichier est
   resté vide, et la boucle l'a regardé vingt et une heures.

**CE QU'IL FAUT FAIRE À LA PLACE :** lance la commande au PREMIER PLAN et lis sa
sortie. C'est plus simple, et c'est ce que fait toute la recette du §6. Une
commande longue a un `timeout` ; c'est à ça qu'il sert.

**SI TU DOIS VRAIMENT ATTENDRE** — un service qui démarre, un port qui s'ouvre —
alors : une BORNE D'ITÉRATIONS, toujours ; un motif qui ne peut pas figurer dans ta
propre ligne de commande (teste le port, pas le nom du processus) ; et une sortie
qui dit ce qui s'est passé quand la borne est atteinte.

## 7. CE QUI N'EST PAS DE TOI

Deux échecs sont **antérieurs** et ne viennent d'aucun lot récent. Ne les répare
pas en passant, et ne crois pas les avoir causés :

- `packages/shared` : 2 cas de `messagerie-responses.test.ts` (`items[0].muted`).
- `apps/api` : `users.int.test.ts:1:10 'randomUUID' is defined but never used`.

Trois fichiers de sonde sont **commités** et ressemblent à des oublis :
`apps/web/e2e/zzprobe{,2,3}.spec.ts`. Ne les supprime pas de ta propre initiative.
