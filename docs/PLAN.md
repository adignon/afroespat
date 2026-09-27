# Plan de construction

> Lu après `PROJECT.md`. Ce document est le **contrat de construction** : ce qui
> est fait, ce qui reste, dans quel ordre, et ce qu'il faut du porteur à chaque
> étape.
>
> Réécrit après le lot 0, qui a changé deux choses de fond : les écrans se
> **transcodent** des maquettes au lieu de se réécrire, et la vérification passe
> par le **navigateur** plutôt que par la relecture.

---

## 1. Où en est le projet

### Fait, et vérifié

| | |
|---|---|
| **Lot 0 — socle** | Monorepo, CI, 9 paquets, chaîne de vérification complète |
| **Base** | **105 tables** en PostgreSQL, 95 enums, 212 clés étrangères, 362 index |
| **Règles dures tenues par la base** | `audit_logs` et `moderation_actions` en ajout seul (UPDATE, DELETE et TRUNCATE refusés), une seule version de modèle publiée par (type, pays), paire ordonnée des contacts, bornes des notes et priorités |
| **Briques transverses** | Boîte d'envoi transactionnelle + relais 1 s, 9 files BullMQ, `apps/worker`, chiffrement AES-256-GCM, `AuditService`, 10 doublures de fournisseurs |
| **API** | NestJS, `/v1`, OpenAPI, format d'erreur, curseurs signés, décorateur de capacité. Module 02 (référentiels) en ligne |
| **Données de départ** | 17 pays, 43 villes, 24 langues, 60 compétences, 40 métiers |
| **Front** | Next.js 15, écran A01 transcodé de la maquette, responsive de 320 à 1920 px |
| **Outillage** | `tools/dc-to-jsx.mjs` — transcodeur de maquettes, réutilisable pour les 85 écrans restants |
| **Tests** | 50 unitaires, 14 d'intégration, 48 de bout en bout |
| **Garde-fous** | Couleurs (aucun rouge), terre cuite réservé, contraste, capacités déclarées |

### Ce qui reste

**85 écrans sur 86.** **23 modules API sur 24.** Les 12 lots fonctionnels.

---

## 2. Décisions

### Tranchées

| | |
|---|---|
| **D1 — ORM** | Prisma 6, schéma multi-fichiers |
| **D2 — Design** | Les maquettes font foi ; `T1` §2 est le brief d'origine, pas l'état courant |
| **D3 — Nom** | `DisaporyPlus`, dans une constante unique |
| **Couleurs** | Celles de la maquette, y compris les 8 paires sous le seuil AA. Écart consigné et affiché à chaque build |
| **Méthode** | Transcodage, pas réécriture |

### Encore ouvertes

| | Bloque à partir de |
|---|---|
| **D4 — Agrégateur Mobile Money** (FedaPay, KKiaPay, PayDunya) | Lot 11 |
| **D5 — Hébergeur UE + gestionnaire de secrets** | Premier déploiement |
| Comptes Didit, Stripe, Twilio, Brevo, Anthropic | Lot 5 pour Didit, lot 11 pour Stripe |
| **Contenu éditorial** — guides de départ, CGU, confidentialité, pages de ressources | Lancement |

---

## 3. La méthode

### Les écrans se transcodent

`tools/dc-to-jsx.mjs` traduit le dialecte des maquettes en JSX :

```
{{ expr }}                        →  {expr}
<sc-for list="{{xs}}" as="x">…</> →  {xs.map((x, i) => <Fragment key={i}>…</Fragment>)}
<sc-if value="{{c}}">…</sc-if>    →  {c ? <>…</> : null}
style="a:b;c:d"                   →  style={{ a: 'b', c: 'd' }}
```

**Les styles en ligne restent ceux de la maquette, à la virgule près.** C'est le
point : réécrire à la main introduit des écarts de jugement — sur A01, cela avait
produit un titre de page inventé, une pastille qui affichait le mauvais champ,
deux publications manquantes.

Ce qui **s'écrit à la main**, par écran :

1. **Les données** — reprises du `renderVals()` de la maquette, puis remplacées
   par des hooks branchés sur l'API quand le lot correspondant arrive. Le JSX ne
   bouge pas entre les deux.
2. **L'état** — ce que la maquette calcule dans son composant : filtre actif,
   type sélectionné, onglet courant.
3. **Le branchement** — mutations, navigation, gestion des erreurs.

### Les adaptations de cadre

Une maquette est une **image de taille fixe** : rien n'y défile, tout ce qui
dépasse y est coupé. Six adaptations, nommées et justifiées dans le générateur,
la rendent utilisable :

| | |
|---|---|
| Bandes horizontales | défilent au lieu d'être coupées, avec accès clavier |
| Contenu vertical | coule au lieu d'être borné par la hauteur du cadre |
| Encoche | la zone sûre remplace les 50 px simulés |
| Barre d'onglets basse | colle en bas |
| Colonne de gauche, barre haute, colonne de contexte | restent à l'écran au défilement |
| Au-delà de 1440 px | la mise en page se centre au lieu de se tasser à gauche |

**Cette liste est courte exprès.** Chaque ligne ajoutée est une liberté prise sur
le design et doit se défendre. Et chacune est couverte par un test : une
adaptation non testée repart à la première régénération.

### Les deux designs

La maquette fournit, pour la plupart des écrans, un cadre **ordinateur** et un
cadre **mobile**. On bascule au seuil de 1024 px que fixe §10.1, plutôt que
d'inventer un comportement intermédiaire que le design n'a pas défini.

Les deux sont rendus, l'un masqué par CSS : Next rend côté serveur et ne connaît
pas la largeur de la fenêtre ; choisir en JavaScript ferait sauter l'écran à
l'hydratation.

### Ce que les maquettes ne donnent pas

Un design n'exprime pas les **noms accessibles**, ni les **rôles ARIA**. Le
générateur les ajoute par annotations nommées — ce n'est pas réécrire la
maquette, c'est lui donner ce que le HTML doit porter en plus du pixel.

Les maquettes ne donnent pas non plus les **états** de `T1` §5 — chargement,
vide, erreur, permission insuffisante, hors ligne. Ils vivent dans `packages/ui`,
définis une fois, appliqués par convention.

---

## 4. La boucle de vérification

C'est ce que je fais à chaque écran et à chaque route, et c'est ce qui a trouvé
la quasi-totalité des défauts jusqu'ici. Aucun n'a été trouvé en relisant du code.

```
 1. transcoder / écrire
 2. typecheck + lint          la CI échoue sur un avertissement
 3. build
 4. OUVRIR DANS LE NAVIGATEUR  capture 1440 px et 390 px
 5. MESURER                    géométrie, couleurs calculées, axe-core
 6. EXERCER                    curl sur l'API, clics, défilement, seuils
 7. corriger, retour en 1
 8. tests figés                pour que le défaut ne revienne pas
```

**Ce que l'étape 6 a déjà trouvé** : le filtre d'erreurs qui laissait passer les
404 au format de Nest, les services `undefined` par métadonnées de décorateur
manquantes, un `TRUNCATE` qui contournait le journal d'audit en ajout seul, une
zone défilable sans accès clavier, six contrôles sous la cible tactile.

Et ce que la mesure a corrigé chez **moi** : un détecteur de rouge qui confondait
orange et rouge, un test de « certifié » qui se déclenchait sur « certificat
Visale », un test de débordement qui comptait un défilement horizontal voulu.

---

## 5. Lot 0 — socle · **TERMINÉ**

Monorepo, base, briques transverses, API, front, CI, garde-fous. Détail dans
l'historique Git, commits `563c1a6` à `f9b62eb`.

**Reste deux briques sans consommateur avant le lot 1**, que je poserai en même
temps qu'elles :

- le **planificateur** des 22 tâches de §9.3, avec son verrou Redis ;
- le **worker média** : octets magiques, suppression EXIF, antivirus, variantes.

---

## 6. Les douze lots

Chaque lot suit le même gabarit — **données → service → API → interface →
tâches planifiées → tests** — et n'est terminé que si les onze cases de §12.2
sont cochées. Ci-dessous, ce qui est propre à chacun.

### Lot 1 — Accès et identité · 5–6 sem.

**Modules** `auth` · `users` · `onboarding` · `admin` (minimal)
**Écrans** P01 P02 P03 · O01 O02 O04 · K01 K02 K04 K08 · X04 · D01 D03 D08 D12 D15

Le chemin critique est l'OTP : indicatifs des pays actifs seulement, 6 chiffres,
10 minutes, 5 tentatives, 3 envois par numéro et par heure, 10 par IP, Turnstile
obligatoire avant tout envoi. Jeton d'accès 15 min portant `sub`, `level`,
`plan`, `status`, `sid` ; rafraîchissement 30 jours en cookie `SameSite=Strict`,
avec rotation et révocation de chaîne en cas de réutilisation.

Le mécanisme `level_refresh_required` → `401 TOKEN_STALE` → rejeu doit marcher
dès ce lot, sinon les niveaux du lot 5 seront faux.

Suppression de compte différée à 7 jours, avec exécution de tous les
gestionnaires dans une transaction unique. Le mécanisme se pose ici même s'il ne
supprime presque rien : chaque lot suivant vient y brancher le sien.

**Règles dures** numéro jamais renvoyé en clair · mineur → compte désactivé ·
compte équipe et compte membre hermétiques · toute action admin auditée
**Sortie** parcours critique 1 de §11.4 vert de bout en bout

### Lot 2 — Parcours · 7–9 sem.

**Modules** `journeys` · `messaging` (conversations de parcours seulement)
**Écrans** J01 J02 J05 J06 J07 J08 J10 J11 · O03 O05 · D06 D07

Le lot le plus lourd, et celui qui porte la valeur du produit. Quatre
sous-chantiers à ne pas mélanger :

1. **Modèles versionnés** — `DRAFT` / `PUBLISHED` / `ARCHIVED`, résolution à la
   création, migration manuelle qui préserve l'état des étapes de même
   définition.
2. **Rétro-planning** — `due_date = target_arrival_date − days_before_arrival`,
   jamais écrasée si `due_date_manual`, alerte d'incompatibilité sans blocage.
3. **Moteur d'étapes** — quatre états, aucun échec, réouverture autorisée.
4. **« Je suis bloqué »** — les quatre temps, et la règle dure : l'objet cible
   n'est créé qu'à l'appel explicite de publication.

Charger les données de `T3` : 30 définitions d'étapes, les 4 compositions, les
gabarits de blocage.

> **Inversion corrigée** : la création d'un parcours exige une `conversation` de
> type JOURNEY (module 08). Les trois tables de messagerie remontent donc ici,
> limitées à la discussion de parcours.

**Règles dures** publier une version ne modifie aucun parcours · aucun état
d'échec · l'objet cible n'est jamais créé sans appel explicite · un parcours en
pause n'est jamais public
**Sortie** parcours critique 2, moins la partie entraide

### Lot 3 — Fil et stories · 5–6 sem.

**Modules** `posts` (publications, réactions, commentaires, stories)
**Écrans** A01 A02 A13 A14 · J04 · K10

A01 est déjà transcodé : ce lot le **branche** sur l'API et retire
`demo-data.ts`. Le JSX ne bouge pas.

Les stories sont un sous-produit complet : trois types, 24 h, quatre tâches
planifiées (`story.expire` 5 min, `story.score_recompute` 15 min,
`story.purge_history`, expiration).

**Règles dures** aucun compteur de vues · une story ne contient ni lien, ni
numéro, ni email · expirée, elle n'est rendue qu'à son auteur et à ceux qui
l'ont enregistrée · le titre personnel d'un parcours n'apparaît jamais dans le fil

### Lot 4 — Entraide · 3–4 sem.

**Modules** `help`
**Écrans** H01 H02 H03 H04 · H09 H10 (maquettés, à ajouter à l'inventaire) · J03

Le plus petit lot, et celui qui referme la boucle : blocage → demande → réponse
→ « ça m'a aidé » → contact créé → réputation créditée → proposition de marquer
l'étape franchie.

**Règles dures** bandeau de non-paiement permanent, renvoyé par l'API ·
l'entraide n'est jamais derrière un paiement
**Sortie** parcours critiques 2 et 3. **Le produit devient testable dans une
ville** — premier jalon de lancement réel, avec le lot 5.

### Lot 5 — Confiance · 4–5 sem.

**Modules** `verification` · `moderation`
**Écrans** K03 K09 · X03 · D04 D05 D11

Didit en sessions hébergées, webhook signé, aucune donnée conservée hors statut
et `is_adult`. Pipeline complet : l'IA masque et met en file, un humain tranche.
File unique triée par priorité puis SLA — 4 h en priorité 1, 24 h sinon —,
désassignation après 2 h d'inaction.

Les règles locales synchrones et `redactForModeration` sont **déjà en place**
(lot 0) : les lots 3 et 4 ne publient donc pas sans filtre.

**Règles dures** l'IA ne suspend jamais, ne supprime jamais définitivement · le
texte envoyé à l'IA passe toujours par le masquage · aucune pièce d'identité
stockée
**Sortie** parcours critiques 4, 5 et 6

### Lot 6 — Guides · 4–5 sem.

**Modules** `guides`
**Écrans** A03 A04 A05 A06 · D09

Versions, votes d'utilité, propositions de mise à jour avec escalade à 14 jours,
fraîcheur recalculée chaque nuit, obsolescence à 3 signalements puis
dépublication à 30 jours, reprise par la communauté après 6 mois d'inactivité de
l'auteur.

Quatre tâches planifiées : `freshness_recompute`, `proposal_escalation`,
`outdated_unpublish`, `author_inactivity`.

**Règles dures** « certifié » rejeté dans les titres et libellés — **pas dans le
corps**, qui peut citer un document officiel · un guide dépublié depuis 30 jours
n'est plus lié depuis une étape · anonymisation à la suppression du compte, pas
suppression

### Lot 7 — Réseaux, parrainage, contacts, messagerie · 6–8 sem.

**Modules** `communities` · `mentorship` · `connections` · `messaging` (complet)
**Écrans** A07 A08 A09 A10 · H05 H06 H07 H08 · J09 · K05 · M01

Réseaux automatiques à l'activation d'une ville ou d'un pays ; réseaux d'intérêt
avec 5 invités exigés à la création et archivage à 60 jours. Parrainage borné à
90 jours et 2 filleuls, L2 pour devenir parrain mais demande ouverte dès L0.
Messagerie complète, temps réel par WebSocket.

Les parcours publics (J09) arrivent ici : progression seule, membres connectés,
jamais en pause, jamais indexés.

**Règles dures** le parrainage n'implique jamais d'argent · aucun compteur public
de contacts · un parcours public n'expose ni notes, ni checklist, ni équipe

### Lot 8 — Villes et agenda · 4–5 sem.

**Modules** `events` · `places` (activation de ville, carte)
**Écrans** A11 A12 · E01 E02 E03 E04

Carte à agrégats, fiche ville, événements, et la **présence effective** —
l'indicateur clé de la plateforme, le convertisseur en ligne → réel.

**Règles dures** aucune position individuelle ; jamais moins de 3 membres
affichés pour un filtre pays · adresse en texte libre, jamais géocodée

### Lot 9 — Services · 6–7 sem.

**Modules** `housing` · `jobs` · `pros`
**Écrans** S01 S02 S03 S04 S05 S06 S07 S08 S09 · D10

Le logement est la surface d'attaque principale des arnaques : publication
réservée au niveau L2, score de risque, file de modération dédiée. Annuaire pro
avec justificatif d'activité — stocké, accès équipe, jamais affiché — et
recommandations conditionnées à un contact réel.

**Règles dures** bandeau « aucun versement avant visite » renvoyé par l'API sur
chaque liste et chaque annonce · le justificatif n'est jamais affiché

### Lot 10 — Recherche et notifications · 3–4 sem.

**Modules** `search` · `notifications`
**Écrans** X01 X02 · K07

L'index et le noyau de notifications existent depuis le lot 0 : ce lot livre les
écrans, les filtres, le classement, les catégories, les préférences et le résumé
hebdomadaire.

**Règles dures** jamais un document d'un réseau dont on n'est pas membre, ni d'un
auteur bloqué dans un sens ou l'autre · **aucun email pour la catégorie SOCIAL**

### Lot 11 — Revenus · 4–5 sem.

**Modules** `billing` · `partners`
**Écrans** K06 · S10 · D13 D14

Premium à 4 €/mois, Stripe pour la carte, Mobile Money par périodes sans
récurrence avec 3 jours de grâce. Essai de 14 jours **à la première étape
franchie**, pas à l'inscription.

> **Décision D4 requise ici.** Interface déjà posée ; l'agrégateur reste à
> désigner.

**Règles dures** l'aide n'est jamais payante · un plan ne donne aucune priorité
d'affichage · aucun encart partenaire hors étape de parcours et pied de Logement
· aucune donnée de carte sur le serveur · aucune donnée personnelle dans un lien
d'affiliation

### Lot 12 — Pilotage · 2–3 sem.

**Modules** `analytics` · `admin` (tableaux de bord)
**Écrans** D02 D16

**Règle dure** aucune statistique de réussite ou d'échec exposée côté membres

---

## 7. Chiffrage

Le chiffrage initial — 58 à 74 semaines-personne — supposait un portage des
écrans à la main. Le transcodage change cette part : il reste le branchement, la
donnée et l'état, mais plus l'écriture de la forme.

| | Avant | Après |
|---|---|---|
| Interface (86 écrans × 2 tailles) | ~26 sem. | **~10 sem.** |
| Back-end, règles métier, tâches | ~32 sem. | ~32 sem. |
| Socle | 6 sem. | **fait** |
| **Total restant** | | **~42 à 52 sem.-personne** |

Hors relecture produit et hors contenu éditorial, qui sont un chantier parallèle
du porteur.

**Premier lancement possible en une ville** à la fin du lot 5 : environ **24 à
29 semaines-personne** de travail restant.

### Ce qui se parallélise

Les lots 1 à 5 sont séquentiels — ils construisent la colonne vertébrale, et le
lot 2 est le plus gros morceau du produit. À partir du lot 5, trois pistes
avancent séparément :

- **confiance et savoir** — lots 5 puis 6 ;
- **lien et local** — lots 7 puis 8 ;
- **services et revenus** — lots 9 puis 11.

Le lot 10 se branche quand les trois pistes ont produit du contenu à indexer. Le
lot 12 vient en dernier : il n'a de sens qu'avec des données réelles.

---

## 8. Ce dont j'aurai besoin, et quand

| Quand | Quoi | Sans quoi |
|---|---|---|
| **Maintenant** | Rien. Les lots 1 à 4 se construisent contre les doublures | — |
| **Lot 5** | Compte **Didit** (sandbox suffit) | La vérification d'identité reste fictive |
| **Lot 8** | La **ville pilote** à activer | Les 43 villes restent inactives |
| **Lot 11** | **D4** (agrégateur Mobile Money) et compte **Stripe** | Pas de facturation réelle |
| **Avant déploiement** | **D5** (hébergeur UE, gestionnaire de secrets) | Rien ne sort du local |
| **Avant lancement** | **Contenu éditorial** : CGU, confidentialité, pages de ressources, premiers guides | Les étapes affichent « guide à venir » et une ville vide ne retient personne |
| **En continu** | Tes retours sur le rendu, comme aujourd'hui | Je corrige ce que je mesure, pas ce que je ne vois pas |

---

## 9. Risques

| Risque | Mesure |
|---|---|
| **Le lot 2 dérape** — 30 routes, un moteur de versions, un rétro-planning, un flux en quatre temps : un tiers de la complexité | Le découper en quatre livraisons internes. Ne pas commencer le lot 3 avant que le parcours critique 2 passe |
| **Les 46 règles dures s'effritent** silencieusement sur douze lots | Quatre garde-fous automatisés, plus la case « test de chaque règle dure » dans la définition de terminé. Une règle sans test n'est pas une règle |
| **Une adaptation de cadre disparaît** à une régénération | Chacune est testée. C'est la raison d'être de `shell.spec.ts` |
| **Les maquettes et le code divergent** | Le transcodage supprime la question sur la forme. Les références visuelles Playwright couvrent le reste |
| **Le mono-pays devient du code en dur** | Aucun `if (country === 'BJ')`. Activer un pays est une écriture en back-office. Déjà vérifié : 17 pays chargés, 2 exposés |
| **Dette de traduction** | Lint i18n bloquant. Aucune chaîne en dur dans un composant |
| **L'agrégateur Mobile Money se révèle inadapté** au lot 11 | Faire un essai réel de bout en bout dès le lot 5, sans attendre |
| **Le contenu éditorial manque au lancement** | Chantier parallèle du porteur, à démarrer dès le lot 2 |

---

## 10. La suite immédiate

1. **Lot 1** — OTP, sessions, profil, onboarding. C'est le premier lot qui
   produit du fonctionnel visible, et il débloque tout le reste.
2. En même temps, les deux briques restantes du lot 0 : le planificateur et le
   worker média.
3. À la fin du lot 1, un membre peut s'inscrire par SMS, remplir son onboarding
   et arriver sur son profil. Pour de vrai.
