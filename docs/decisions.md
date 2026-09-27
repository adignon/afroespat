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
| 2026-09-27 | **`auth_sessions` reçoit deux colonnes — `chain_id` et `token_generation` — et le jeton de rafraîchissement s'écrit `chaîne.génération.secret`** | `01` §2.1 exige la « révocation de la chaîne en cas de réutilisation », mais le schéma ne donne qu'un `refresh_token_hash` écrasé à chaque rotation : l'ancien jeton ne correspond alors plus à aucune ligne et son rejeu est indiscernable d'un jeton inconnu. **La détection ne se déclenchait donc jamais** — le rejeu répondait bien `SESSION_REVOKED`, mais pour la mauvaise raison, et la session restait ouverte. Le numéro de génération rend tout jeton antérieur reconnaissable, à n'importe quelle profondeur, sans conserver d'historique ni faire croître la table | Complète le schéma de `00` §6.3 sans nouvelle table : les 105 tables sont inchangées |
| 2026-09-27 | **Le rejeu révoque la CHAÎNE, pas toutes les sessions du membre** | `01` §2.1 dit « la chaîne ». C'est aussi plus juste : un appareil compromis ne doit pas déconnecter les deux autres, sur lesquels le membre est peut-être en train de lire la notification qui l'en avertit | Corrige une première implémentation qui révoquait tout |
| 2026-09-27 | **`otp_challenges` reçoit `phone_encrypted` et `country_id`** | Sans le numéro chiffré, la vérification ne peut pas créer `phone_numbers.phone_encrypted` : l'empreinte HMAC est irréversible par construction. Le compte se créait donc avec un tampon **vide**, et le membre n'aurait plus jamais pu voir son propre numéro masqué (règle dure §2.1). Sans `country_id`, le pays d'origine était deviné — la première implémentation prenait le premier pays actif au tri, pas celui que le membre avait choisi, alors que ce choix n'est modifiable qu'une fois (§2.7). Les deux colonnes sont purgées avec le défi à 24 h (§8.4) | Colonnes de détail, autorisées par `00` §6.3 |
| 2026-09-27 | **Le garde de capacités est GLOBAL et refuse par défaut** : une route qui ne déclare ni capacité ni `@PublicRead()` est rejetée | Un garde posé route par route ne protège que les routes auxquelles on a pensé. Le critère de suspension est la méthode HTTP (`GET`/`HEAD` passent) et non un champ ajouté à la matrice du §7.3, qui reste la seule source | — |
| 2026-09-27 | **La signature ET la vérification du jeton d'accès vivent dans un seul `TokenService`** | Les séparer — le service d'auth signe, le garde vérifie de son côté — garantit qu'un jour l'un des deux changera d'algorithme ou de tolérance sans l'autre. La comparaison de signature est à temps constant, et l'en-tête est vérifié au lieu d'être cru (sans quoi `alg: none` passerait) | — |
| 2026-09-27 | **`apps/api` charge lui-même le `.env` de la racine, hors production** | Le script `dev` du paquet ne chargeait rien : le serveur ne démarrait que lancé depuis la racine, et l'échec se présentait comme une configuration invalide. En production rien n'est chargé — les variables viennent de l'orchestrateur, et un `.env` oublié sur le serveur ne doit pas les remplacer en silence | — |
| 2026-09-27 | **Le jeton de rafraîchissement part en cookie `httpOnly`, jamais dans le corps JSON** | §4.1 le demande (« Corps : cookie ») et `main.ts` l'annonçait déjà dans un commentaire — le code, lui, le rendait en JSON. C'est la seule différence qui compte en cas de XSS : un jeton rendu en JSON finit dans un stockage lisible par JavaScript. Chemin restreint à `/v1/auth`, `sameSite: strict`, `secure` hors développement | Corrige une première implémentation par corps de requête |
| 2026-09-27 | **`POST /auth/otp/verify` renvoie le membre complet**, comme §4.1 l'exige | Sans lui, le front devrait enchaîner sur `GET /me` avant de savoir s'il affiche l'onboarding ou l'accueil, et ce second aller-retour se verrait à l'écran | Corrige un premier choix qui masquait `userId` par excès de prudence |
| 2026-09-27 | **`users.onboarding_step` est STOCKÉ**, pas déduit du profil | §5 le demande nommément (« colonne ajoutée », 0–6, « pour reprendre là où le membre s'est arrêté »). Cinq des six écrans sont passables : un profil vide ne distingue pas celui qui a sauté l'écran de celui qui ne l'a pas vu. L'avancement ne RECULE jamais, sinon un retour en arrière pour corriger une réponse ferait refaire tout le chemin | Corrige un commentaire de `@app/shared` qui affirmait l'inverse |
| 2026-09-27 | **Le pays du NUMÉRO et le pays d'ORIGINE sont dissociés** | La création de compte prenait le pays du numéro comme pays d'origine : un membre déjà installé en France, avec un numéro français, héritait de la France — un pays `DESTINATION` (02 §2.1), donc sans réseau automatique ni modèle de parcours, et figé puisque §2.7 n'accorde qu'une modification. La création pose désormais une valeur PROVISOIRE non figée, et l'écran 3 de l'onboarding fait choisir | — |
| 2026-09-27 | **`PATCH /me` refuse un pays `DESTINATION` comme pays d'origine** | Le contrôle ne portait que sur `is_active`, et la France est active. Trouvé en exerçant l'API, pas en relisant le code | — |
| 2026-09-27 | **`user.handle_changed` n'est PAS émis** | §7 du module 01 ne le liste pas, donc aucun consommateur ne l'attend. Le journal d'audit suffit ; un type d'événement sans lecteur crée une file que personne ne vide. En revanche les sept événements du §7 qui manquaient au catalogue ont été ajoutés | — |
| 2026-09-27 | **Le champ modifié est journalisé, jamais sa valeur** | Le journal d'audit est conservé cinq ans (§8.4) : c'est une cible, et il ne doit pas devenir l'endroit où les noms et numéros finissent en clair. `metadata` ne porte que les NOMS des champs touchés | — |
| 2026-09-27 | **Les identifiants consommés par un cadre sont DÉDUITS du dialecte `{{ … }}` de la maquette**, plus écrits à la main | La liste manuelle d'A01 aurait dû être maintenue pour huit écrans de plus. Première tentative de déduction faite sur le JSX produit : elle rendait ZÉRO donnée, parce que les boucles y sont enveloppées de parenthèses (`{(rail ?? []).map(`) et que les objets de style ressemblent à des expressions. Le HTML source, lui, marque les données sans ambiguïté | Remplace la liste en dur du générateur |
| 2026-09-27 | **Le repère `main` est posé par le générateur DANS le cadre, pas par le conteneur de mise en page** | Posé d'abord dans `ScreenFrames`, il enveloppait le `<main>` que la maquette du fil écrit déjà autour de sa colonne centrale : deux `main` imbriqués, invalides, et les tests de largeur du fil mesuraient soudain le conteneur. Le générateur ne l'ajoute donc que si la maquette n'en a pas, en `display: contents` pour ne pas toucher la mise en page | — |
| 2026-09-27 | **Le premier `<h2>` d'un cadre devient `<h1>`** | La maquette écrit ses titres d'écran en `<h2>` — plusieurs par page de documentation, où un `h1` n'aurait pas de sens. Dans l'application chaque cadre EST une page. Aucun effet visuel : taille, graisse et `margin: 0` sont tous en ligne. Le générateur avertit quand un cadre n'a pas de `<h2>` à promouvoir | — |
| 2026-09-27 | **Les interrupteurs dessinés reçoivent `role`, `aria-checked` et leur nom**, par une table indexée sur le nom du gestionnaire | La maquette DESSINE ses interrupteurs : un `<button>` contenant une pastille positionnée. axe le signalait en `critical` (`button-name`), à raison — c'est l'interrupteur qui décide si le membre reçoit des demandes d'aide. Les libellés sont recopiés du texte visible, et le générateur REFUSE de produire si ce texte disparaît de la maquette | — |
| 2026-09-27 | **La cible de l'interrupteur passe à 44 px sans que la piste peinte change d'un pixel** | `T1` §2.3 demande 44 px, la maquette dessine 48 × 28. `padding: 8px 0` en `content-box` porte la boîte à 44 px, `background-clip: content-box` ne peint que les 28 px du milieu, et le curseur suit du même décalage (3 px → 11 px). Un test e2e mesure les DEUX — cible ≥ 44, piste exactement 48 × 28 — pour qu'une « correction » par grossissement de la piste soit refusée | Premier cas d'adaptation de cible tactile sur un écran transcodé ; le précédent vivait dans `packages/ui` |
| 2026-09-27 | **L'exemption WCAG 2.5.8 se mesure sur la PREMIÈRE LIGNE d'un lien, pas sur sa boîte englobante** | « politique de confidentialité » passe à la ligne dans la phrase de consentement : sa boîte fait alors 36 px, près de trois interlignes, et le lien se faisait prendre pour un bouton trop petit. `getClientRects()` rend une boîte par ligne | Corrige la règle posée précédemment dans `responsive.spec.ts` |
| 2026-09-27 | **O05 est un composant SERVEUR qui reçoit `searchParams`**, et non un composant client avec `useSearchParams()` | Ce crochet force un rendu côté client et fait ÉCHOUER `next build` sans frontière `Suspense`. Le serveur de développement l'accepte sans rien dire : le défaut n'apparaît qu'à la compilation de production | — |
| 2026-09-27 | **La limite d'ENVOI d'OTP renvoie `RATE_LIMITED`, pas `OTP_ATTEMPTS_EXCEEDED`** | §4.1 attribue le premier à l'envoi et le second à la vérification. Les confondre faisait lire au membre « Trop de tentatives. **Demandez un nouveau code.** » au moment précis où on venait de lui refuser un nouveau code. Vu à l'écran pendant un test de bout en bout, pas en relisant le tableau | Corrige le code choisi lors de l'écriture du service |
| 2026-09-27 | **La boucle locale échappe à la limite par IP, hors production seulement** | En développement tout part de `127.0.0.1` : dix envois par heure et par IP épuisent le quota en quelques essais et rendent l'inscription intestable — le serveur refuse pour une raison juste, mais sans rapport avec ce qu'on éprouve. La limite par NUMÉRO reste appliquée, c'est celle qui protège un membre du harcèlement. En production la fonction rend toujours `false` | — |
| 2026-09-27 | **Les constantes partagées entre serveur et client ne vivent PAS dans un module `'use client'`** | Un composant serveur qui importe une valeur d'un tel module n'obtient pas l'objet mais une référence client : la recherche du motif de reprise rendait `undefined`, sans message, et le membre était renvoyé à l'écran du numéro sans explication — exactement le défaut qu'on venait de corriger. `resume.ts` est donc un module neutre | — |
| 2026-09-27 | **Le motif de renvoi voyage dans l'URL, pas dans l'état React** | Posé dans l'état puis suivi d'un `router.push`, il était effacé par le remontage du composant. Ce sont des CODES, pas des messages : l'URL est publique, et un motif inconnu est ignoré plutôt qu'affiché | — |
| 2026-09-27 | **La bannière d'erreur porte `data-flow-error` en plus de `role="alert"`** | Next pose son propre annonceur de route avec `role="alert"`, vide au chargement. Trois tests échouaient dessus en accusant l'application : le sélecteur était trop large. L'attribut ne change rien à ce que le membre entend | — |
| 2026-09-27 | **Les champs et boutons dessinés sont convertis par le générateur**, sur la foi du texte visible | La maquette dessine ses saisies en `<div>` portant un exemple (« 97 12 34 42 ») et ses boutons sans comportement. Le `<div>` devient un `<input>` avec les mêmes styles en ligne, et l'exemple devient le `placeholder` — ce qu'il était déjà. Les tables sont indexées sur ce texte visible, donc vérifiables ; s'il change, le générateur ne trouve plus le champ | — |
| 2026-09-27 | **Le code OTP se saisit dans UN champ masqué, pas dans six** | Six `<input>` paraissent plus fidèles à l'image, mais ils cassent le collage du code et l'autoremplissage depuis le SMS (`autocomplete="one-time-code"`) — les deux seules choses dont un membre a besoin ici. Les six cases de la maquette restent l'AFFICHAGE, alimentées par l'état | — |
| 2026-09-27 | **La vérification part au sixième chiffre, sans bouton** | C'est ce que montre la maquette de P02, qui n'en dessine aucun. Un garde empêche de la lancer deux fois : un rendu de plus la relancerait sur un défi déjà consommé, et le membre lirait « ce code n'est pas le bon » alors qu'il l'était |  — |
| 2026-09-27 | **`ScreenActions` est OBLIGATOIRE, sans valeur de repli** | Un `() => {}` par défaut donnerait des boutons silencieusement morts — le pire des défauts, puisque l'écran a l'air de fonctionner. Rendre le type obligatoire a fait échouer la compilation sur les sept pages, ce qui était le but | — |
| 2026-09-27 | **`http://localhost:3100` est une origine CORS acceptée hors production** | Les tests de bout en bout y servent la compilation de production. Sans elle, le navigateur rejette chaque réponse alors que le serveur répond 200, et l'inscription échoue sans qu'aucun journal ne l'explique. En production la liste reste à deux entrées | — |
| 2026-09-27 | **Le pseudo provisoire prend l'identifiant ENTIER, pas ses 14 premiers caractères** | Un UUID v7 commence par 48 bits d'horodatage, soit douze caractères hexadécimaux : deux comptes créés dans la même milliseconde recevaient le même pseudo, et la création échouait sur la contrainte d'unicité — un 500 pour le membre. Le commentaire affirmait pourtant « unique par construction ». Trouvé quand deux tests ont inscrit deux membres en parallèle | Corrige l'implémentation initiale de `createAccount` |
| 2026-09-27 | **Les sélecteurs dessinés reçoivent un menu NATIF transparent** | La maquette dessine un sélecteur avec chevron mais ne montre qu'un pays. Un menu natif posé par-dessus ne dessine aucune liste, ne choisit aucune présentation, et donne un contrôle réel au clavier comme au pouce. Le drapeau béninois se cache dès que le pays choisi n'est plus le sien : l'afficher à côté d'un « +33 » serait un défaut visible, en inventer d'autres serait dessiner à la place du porteur | Répond à la question laissée ouverte sur le sélecteur de pays |
| 2026-09-27 | **La France n'est PAS proposée comme pays d'origine** | Elle est `DESTINATION` (02 §2.1) et l'API la refuse : la proposer serait offrir un choix qui échoue | — |
| 2026-09-27 | **Les pastilles et les lignes de résultat deviennent des `<button>`** | La maquette les dessine en `<span>` et `<div>` tout en leur donnant un fond « actif » : ce sont donc des choix. Ni atteignables au clavier ni annoncés comme actionnables, un membre au lecteur d'écran ne pouvait pas remplir son profil. `aria-pressed` pour les pastilles — c'est ce qu'un lecteur d'écran annonce le plus clairement pour une bascule | La maquette emploie pourtant `<button>` pour les cartes de O01 : l'incohérence est la sienne, on tranche pour le bouton |
| 2026-09-27 | **La recherche de ville ignore accents et casse** | Comparer sans normaliser fait échouer « segou » sur « Ségou » : un échec que le membre lit comme « ma ville n'existe pas ». `activeOnly=false` est également indispensable — 02 §2.2 rend une ville inactive sélectionnable à l'inscription, et au lancement aucune ne l'est | — |
| 2026-09-27 | **Les accents du pseudo sont TRANSLITTÉRÉS, pas supprimés** | Les retirer faisait de « Aïcha Sègbédji » un `achasgbdji` méconnaissable : le membre voit son nom se désagréger sous ses doigts. Le séparateur final n'est coupé qu'à l'ENVOI : l'enlever à la frappe rendrait « jean-baptiste » impossible à taper | — |
| 2026-09-27 | **Le pays d'origine n'est envoyé que s'il a CHANGÉ** | §2.7 ne permet qu'une modification. La consommer pour confirmer une valeur déjà posée priverait le membre de sa seule correction | — |
| 2026-09-27 | **Les motifs du générateur excluent `<`, pas `}`** | Le style d'une pastille contient un gabarit — `` border: `1px solid ${s.bd}` `` — donc des accolades : une classe qui les exclut s'arrête dessus. Mais `[\s\S]*?`, même paresseux, TRAVERSE les balises : le motif partait d'un `<span` bien plus haut et engloutissait la flèche de retour et les six segments de progression. Un attribut `style` ne contient jamais de `<` | Le JSX produit ne compilait plus, ce qui fut une chance : un motif trop large qui compile est bien plus difficile à voir |
| 2026-09-27 | **Chaque adaptation du générateur est BORNÉE à ses écrans, et signale ses échecs** | La loupe de la recherche de ville a le même tracé que celle du fil : sans borne, la barre de recherche de A01 devenait un champ « Votre ville ». Et une adaptation attendue qui ne s'applique pas est désormais un avertissement — sans quoi un champ reste muet dans un écran qui compile parfaitement | — |
| 2026-09-27 | **La case de consentement est DÉCOCHÉE par défaut**, contre ce que la maquette dessine | Ce n'est pas une divergence de forme mais de droit : une case pré-cochée n'est pas un consentement valide, et la preuve RGPD enregistrée ne vaudrait rien. L'état coché que montre la maquette est une illustration | Premier cas où l'on s'écarte sciemment de l'état dessiné |
| 2026-09-27 | **`acceptTerms: true` est AJOUTÉ au corps de `POST /auth/otp/request`**, que §4.1 ne prévoit pas | Vérifier la case seulement côté écran laisserait créer un compte par appel direct, dont la ligne de consentement dirait « accordé » sans que personne n'ait rien accepté. Une preuve fausse est pire qu'une preuve absente. `z.literal(true)` et non `boolean` : `false` doit être un refus, pas une valeur acceptée qu'on oublierait de tester | Écart assumé au corps décrit par §4.1, imposé par §5 |
| 2026-09-27 | **Le consentement porte l'IP du DÉFI, pas celle de la vérification** | La preuve doit dire quand et d'où l'acceptation a eu lieu — c'est au moment où la case est cochée, pas quelques secondes plus tard à la saisie du code | — |
| 2026-09-27 | **`static_pages` est amorcée avec des gabarits en version `0`** | Le contenu des CGU et de la confidentialité est éditorial et attend le porteur. Sans document publié, un consentement ne référencerait rien : le service refuse alors de l'enregistrer. Le gabarit n'est pas un pis-aller — §2.10 prévoit qu'« une nouvelle version redemande le consentement », donc les membres qui acceptent la version 0 seront resollicités dès le vrai texte en version 1. Le seed ne met à jour ni le corps ni la version, pour ne pas ramener tout le monde à 0 | — |
| 2026-09-27 | **Un retrait de consentement s'AJOUTE, il n'écrase pas** | `consents` n'a ni `updated_at` ni suppression : l'historique EST la preuve. L'état courant est la DERNIÈRE ligne par type, jamais le nombre de lignes accordées — qui donnerait un consentement encore valide après sa révocation | — |
| 2026-09-27 | **La version annoncée par le client est VÉRIFIÉE, pas crue** | Un consentement enregistré sur une version qui n'a jamais existé a l'air valide. Le service renvoie `CONFLICT` avec la version attendue, pour que le front recharge | — |
| 2026-09-27 | **Un consentement REFUSÉ n'est pas marqué périmé à chaque publication** | `outdated` ne concerne qu'un consentement accordé sur une version dépassée. Un refus reste à demander, mais pour la bonne raison — et le distinguer évite de traiter un refus comme un oubli | — |

---

## Travail en parallèle — ce qui a été mis en place

| | |
|---|---|
| **Pourquoi** | Douze lots séquentiels ne se terminent pas. Les modules de contenu sont largement indépendants : ils lisent `users` et les référentiels, écrivent leurs propres tables, et communiquent par événements |
| **La brique préalable** | `VisibilityService` — presque tous consomment `user.blocked`. Sans elle, chaque module aurait inventé sa règle de visibilité |
| **Isolation** | Un worktree git par agent (pas de conflit de fichiers) et **une base PostgreSQL par agent** (`app_a1` à `app_a4`, migrées et amorcées). Sans bases séparées, leurs tests d'intégration se piétineraient |
| **Ports** | 3011 à 3014 — le 3001 reste au tronc commun |
| **Interdits aux agents** | `packages/db/prisma/schema/**` (les 106 tables sont figées), `docs/PLAN.md`, `docs/decisions.md`, les autres modules. Ils peuvent toucher `app.module.ts` et l'index de `@app/shared` : les conflits y sont de deux lignes |
| **La limite réelle** | La machine. Quatre agents suffisent à faire passer la suite e2e de 40 s à 4 min, et à produire des échecs qui disparaissent en exécution isolée. Au-delà, on ne mesurerait plus rien de fiable |
| **Ce que ça ne remplace pas** | La relecture. Le code qui revient doit être éprouvé avant d'être fusionné : un agent qui livre du code compilable et testé n'a pas pour autant exercé son module comme je l'aurais fait |

---

## Ce qui attend une décision du porteur

| Sujet | Pourquoi ça bloque | Ce qui est fait en attendant |
|---|---|---|
| **Le sélecteur de pays de P01** | La maquette dessine un sélecteur avec chevron, mais montre un seul pays : le drapeau est un dégradé tricolore béninois et l'indicatif « +229 » est un texte littéral. Un choix multi-pays demande des drapeaux et une présentation de liste que la maquette ne fournit pas — les inventer serait réécrire le design | L'indicatif est celui de la maquette (`BJ`). Un membre déjà installé en France, avec un numéro français, ne peut donc pas encore s'inscrire par l'interface — alors que **l'API le gère** (le pays du numéro et le pays d'origine y sont dissociés) |
| **La phrase manquante sur O03 mobile** | §5 pose une règle dure : « le parcours n'est jamais imposé ». Le cadre mobile offre bien le choix mais n'écrit pas la conséquence | Un test fixe l'état des lieux : texte exigé sur ordinateur, absence assertée sur mobile |
| **La ligne « disponible pour aider » absente de O04 mobile** | Réservée à l'ordinateur, ou oubli ? | Un test compte l'interrupteur dans les deux cadres (1 et 0) |

---

## Écarts de maquette relevés en transcodant le lot 1

| Écart | Où | Constat |
|---|---|---|
| Le cadre mobile de O03 porte la case « créer le parcours » mais AUCUNE phrase expliquant la conséquence. Le cadre ordinateur l'écrit (« Aucun parcours ne sera créé… ») | `01 Accès et Onboarding.dc.html`, O03 390 px | §5 pose une règle dure : « le parcours n'est jamais imposé ». Le choix est bien offert, mais le membre sur mobile ne lit pas ce qui va se passer. **Un test e2e fixe l'état des lieux** — texte exigé sur ordinateur, absence assertée sur mobile — pour que l'ajout de la phrase fasse échouer le test plutôt que de passer inaperçu |
| Le cadre mobile de O04 ne dessine pas la ligne « je suis disponible pour aider » | `01 Accès et Onboarding.dc.html`, O04 390 px | Constaté par un test qui compte l'interrupteur dans les deux cadres (1 et 0). À trancher par le porteur : la disponibilité est-elle réservée à l'ordinateur, ou est-ce un oubli ? |
| O05 n'a pas de cadre mobile : deux variantes de 700 px | `01 Accès et Onboarding.dc.html`, O05 | Le cadre unique s'étire, sans bascule au seuil de 1024 px |
| A01 et la variante « Ressources » de P03 n'ont aucun `<h2>` à promouvoir en `<h1>` | `03 Accueil v2.dc.html`, `01 Accès et Onboarding.dc.html` P03 | Le générateur l'avertit à chaque exécution. À traiter avec ces écrans |

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


---

## Écarts relevés en implémentant entraide et guides

Deux agents ont livré ces modules ; ces constats viennent de leur travail, vérifiés ensuite.

### Colonnes annoncées par les specs et ABSENTES du schéma figé

Aucune migration n'a été faite : le modèle des 106 tables est le contrat.

| Colonne annoncée | Spec | Conséquence acceptée |
|---|---|---|
| `help_requests.reopened_at`, `archived_at` | 06 §3, « Ajoutée » | La fenêtre de 7 jours se calcule sur `resolved_at` ; une archive n'est pas datée, et deux réouvertures sont indiscernables |
| `guides.published_at` | 05 §3 | L'onglet « Récents » trie sur `last_content_update_at` : proche, mais une correction acceptée refait remonter le guide |
| `guides.view_count` | 05 §3 | La tâche `guide.view_count_flush` (§7) est **inapplicable** |
| `guides.source_journey_id` | 05 §3 | Le lien entre un parcours et le guide qu'il a produit n'est pas tracé |
| `guide_versions.revert_of_version_id` | 05 §3 | Un retour arrière se note dans `summary` (« Retour à la version N ») |
| `help_requests.origin_story_id` | 06 §2.8 exige « marquée Depuis une story » | Non implémenté : rien ne permet de le marquer |
| `help_responses.moderation_status` | 06 §2.7 veut masquer « toute réponse » | D'où un refus à la publication plutôt qu'un masquage après coup |

**La limite « 3 guides publiés par jour » est comptée dans `audit_logs`** — seule trace horodatée d'une publication en l'absence de `published_at`. La table étant en ajout seul, le compteur n'est pas effaçable, ce qui est plutôt un avantage.

### Deux énumérations qui ne coïncident pas

`user_profiles.help_types` est `HelpType` (PAPERWORK · HOUSING · JOB · WELCOME · OTHER, module 01) ; `help_requests.type` est `HelpType2` (PAPERWORK · SERVICE · RIDE · MATERIAL · OTHER). Or `HOUSING` et `JOB` sont précisément ce que 06 §2.1 renvoie vers Services, et `SERVICE`/`RIDE`/`MATERIAL` n'ont aucun équivalent déclarable au profil.

Une correspondance explicite a été posée (`WELCOME → SERVICE, RIDE, MATERIAL`). **Elle demande l'arbitrage du porteur** : le ciblage « Vous pouvez aider » en dépend entièrement.

### §8 de 05 partiellement impossible

`guide_revision_proposals.proposer_user_id`, `guide_contributors.user_id` et `guide_outdated_flags.user_id` sont **NOT NULL avec `onDelete: Cascade`**. « Propositions acceptées conservées avec `proposer_user_id = null` », « ligne `guide_contributors` conservée anonymisée » et « signalements conservés anonymisés » ne peuvent pas être tenus : soit la ligne part en cascade, soit elle garde son `user_id`. Seuls `guides.author_user_id` et `guide_versions.created_by_user_id` sont nullables — eux sont bien anonymisés.

### Imprécisions tranchées, à confirmer

| Point | Spec | Tranché |
|---|---|---|
| « OPEN sans réponse depuis 45 jours » | 06 §2.2 | Depuis la DERNIÈRE réponse, à défaut la création — sinon une demande vivante depuis deux mois serait archivée en pleine discussion |
| Table de fraîcheur aux bornes recouvrantes (« 12–24 », « > 24 ») | 05 §2.3 | Bornes strictes : 24 mois pile → 0,4 ; 25 → 0,2 |
| « FLAGGED depuis plus de 30 jours » sans colonne de date | 05 §2.6 vs §9 | `unpublish_deadline_at <= now`, que §2.6 fixe justement à `now + 30 j` |
| Retrait d'un signalement d'obsolescence | 05 §4 déclare la route, §2.6 est muet | Repasser sous le seuil rend le guide à `PUBLISHED` — sinon la route ne sert à rien face à un signalement posé par erreur |
| Proposition sur un guide « maintenu par la communauté » | 05 §2.4 | `ESCALATED` dès la création : aucun créateur, souvent anonymisé, ne doit décider |
| Signaler son PROPRE guide | 05, non traité | Refusé : l'auteur a une voie d'édition directe |
| Capacité du signalement d'obsolescence | absente de 00 §7.3 | `guide.propose_revision` (L1) et non `content.read` (L0) : trois signalements dépublient, l'ouvrir à L0 offrirait un moyen bon marché de faire tomber un guide |
| Capacités de clôture d'une demande d'aide | absentes de 00 §7.3 | `help.ask`, faute de mieux. Aucune capacité n'a été inventée |
| Où vit le corps d'un brouillon de guide | 05 §2.1 vs §3 | La version 1 est écrite dès la création et modifiée sur place tant que le guide est DRAFT. Sinon un brouillon n'existe nulle part, ou l'auto-enregistrement produit une version par frappe |

### Corrections apportées à mes propres consignes

- J'avais indiqué à l'agent guides que « une seule version PUBLISHED par (modèle, pays) » concernait les guides. **C'est faux** : l'index unique partiel de `20260927050000` porte sur `journey_template_versions` (03 §2.2). La seule contrainte guides de cette migration est `guides_country_scope`.
- `help_request.created` figurait au catalogue d'événements sans consommateur : c'était une invention. 06 §6 dit `help_request.published`. Le doublon est retiré.


---

## Le trou le plus important du socle : rien ne consomme les événements

Relevé en implémentant les réseaux, vérifié : **aucun `Worker` BullMQ n'est
instancié nulle part.** `OutboxRelayService` dépose bien les travaux dans les
files, et personne ne les retire. Toute l'architecture d'événements écrit sans
que rien ne lise.

Conséquence pratique : **aucune règle qui passe par un événement ne fonctionne
aujourd'hui**, dans aucun module. Les modules livrés émettent correctement — c'est
la moitié du contrat — mais la moitié « consommateur » n'existe pas. Le module
réseaux a contourné en écrivant l'adhésion automatique comme un **recalcul
idempotent** appelé à la lecture (`syncAutoMemberships`), ce qui marche et se
rebranchera sur l'événement sans réécriture.

C'est désormais la pièce la plus rentable du socle : elle débloque d'un coup les
notifications, l'indexation de recherche, la réputation, les compteurs
dénormalisés et les cascades de blocage et de suppression.

À côté, deux manques du même ordre, déjà notés au plan : **aucun registre de
tâches planifiées** (`apps/api/src/queue` n'a pas de travaux répétables), alors
que trois modules ont livré leurs tâches sous forme de méthodes publiques testées
que personne n'appelle — `help.archive`, les cinq tâches des guides, les trois des
réseaux. Et **aucun registre de gestionnaires de suppression de compte**, alors
que deux modules ont écrit le leur.

### Un événement déclaré et jamais émis

`user.onboarded_location` figurait au catalogue depuis le lot 1 et **n'était émis
par personne**. Je l'avais pourtant annoncé comme existant au module réseaux, qui
a vérifié plutôt que de me croire. Il est maintenant émis à l'écran 3 de
l'onboarding, avec le pays et la ville dans sa charge, et un test le fixe.

`user.city_changed`, que 07 §6 déclare consommer, n'est même pas déclaré.

---

## Écarts relevés en implémentant les réseaux

### Colonnes annoncées par §3 et absentes du schéma figé

| Colonne | Conséquence |
|---|---|
| `community_members.muted` | **La sourdine du §2.5 est impossible.** Le champ est volontairement absent du schéma zod, pour que le contrat ne promette pas ce que la base ne sait pas stocker — `{"muted":true}` renvoie 400. §2.3 « notification à tous les membres non en sourdine » est donc inapplicable |
| `community_members.invited_by_user_id` | Invitations posées sans trace de l'invitant |
| `communities.warning_sent_at` | `archiveInactive()` identifie les réseaux à avertir à 45 jours et rend la liste, mais ne notifie pas : sans marqueur, l'avertissement repartirait quinze jours de suite |

### Imprécisions tranchées, à confirmer

| Point | Spec | Tranché |
|---|---|---|
| Définition d'« activité » d'un réseau | §2.2 (« publication, sujet, réponse, événement ») vs §6 (`community.activity` = tous les événements, y compris `member_joined`) | §2.2 retenu. Un réseau que des gens rejoignent sans jamais y parler est exactement ce que l'archivage vise. Annonces, sondages et albums comptent aussi |
| « 50 membres actifs » pour ouvrir la création | §2.2, non défini | Compté EN DIRECT, pas depuis `cities.member_count` recalculé chaque nuit : une porte qui s'ouvre à 50 ne peut pas avoir un jour de retard. Les deux valeurs divergeront |
| `muted` sur la route de modération | §4 met une préférence personnelle sur `PATCH …/members/:userId`, qui porte aussi `role` et `status` | Sans objet pour l'instant, la colonne n'existant pas. Mélange à revoir |
| Nommer un modérateur bénévole d'un réseau AUTO | §2.1 dit « nommés par l'équipe » | **Personne ne peut le faire aujourd'hui** : changer un rôle exige OWNER, et un réseau automatique n'en a pas. Il faudra la route admin du module 15 |
| Capacité « publier dans un réseau » | absente de 00 §7.3 | `post.create` (L1) réutilisée, §2.3 disant « L1 pour publier ». Un `community.publish` serait plus juste mais toucherait la matrice figée |
| « masquer une publication ou un sujet » | §2.4, sans route en §4 | `DELETE /topics/:id` ajoutée ; masquer une publication relève du module 04 |
| Quitter un réseau dont on est propriétaire | non traité | Refusé (`OWNER_MUST_TRANSFER`) : un réseau sans propriétaire n'a plus personne pour en répondre |
| Résultats d'un sondage non révélés | non traité | `voteCount: null` plutôt que la valeur : les renvoyer en demandant au front de ne pas les afficher revient à les publier |

### Un piège d'environnement à connaître

**`tsx` ne fait pas démarrer l'API** : l'injection de dépendances arrive
`undefined` — `Reflector` n'est pas injecté dans `AuthGuard` — et *toutes* les
routes rendent 500 sans que rien ne relie le symptôme à sa cause. Il faut
`node -r @swc-node/register`, ce que fait le script `dev`. C'est le même défaut de
métadonnées de décorateur que celui déjà consigné pour le lot 0, et il se
représente dès qu'on lance le serveur à la main.

Second piège : **`docker compose exec` ne fonctionne pas depuis un worktree** (le
nom de projet compose diffère). Il faut `docker exec -i afroespat-postgres-1`.


---

## Un piège JavaScript qui a frappé deux modules sur quatre

Le motif est partout dans le dépôt, et il est légitime :

```js
{ ...(a ? { x: 1 } : {}), ...(b ? { y: 2 } : {}) }
```

Il devient un bogue dès que deux diffusions posent la **même clé** : la seconde
écrase la première, sans erreur, sans avertissement de `tsc`, et sans que
`no-dupe-keys` d'ESLint ne voie quoi que ce soit — cette règle ne regarde que les
clés écrites littéralement.

Deux vrais défauts, dans deux modules écrits séparément par deux agents :

| Module | Clé | Conséquence |
|---|---|---|
| entraide | `author` | Le filtre de phase écrasait le filtre de visibilité : les comptes **désactivés et supprimés** revenaient dans la liste dès qu'on filtrait par phase |
| villes | `profile` | Un visiteur anonyme filtrant par statut d'occupation perdait `isPublic: true` : l'annuaire lui rendait des **profils privés** |

**Les deux ne se voient que sur la COMBINAISON de deux filtres.** Chacun pris
seul fonctionne parfaitement, ce qui explique qu'ils aient passé la relecture.
C'est la leçon la plus utile de cette série : *éprouver la combinaison, jamais
chaque filtre isolément*.

### Le garde-fou, et ce qu'il ne couvre pas

`tools/check-duplicate-spread-keys.mjs`, branché sur `pnpm guardrails`.

Il lit des **littéraux**. Il voit `...(cond ? { author: … } : {})` ; il ne voit
pas `...(await this.baseWhere(…))` — il ne peut pas savoir quelles clés une
fonction renvoie. Or c'est exactement la forme du bogue de l'entraide.

**Vérifié en réintroduisant les deux défauts : celui des villes est signalé,
celui de l'entraide ne l'est pas.** Un garde-fou dont on ne connaît pas la portée
donne une fausse assurance, et c'est pire que pas de garde-fou.

Ma première version comptait les clés à toutes les profondeurs : dix faux
positifs pour deux vrais défauts. Un contrôle qu'on apprend à ignorer ne sert
plus à rien — il ne retient donc que le premier niveau de chaque littéral.

---

## Écarts relevés en implémentant agenda et villes

### Routes NON livrées, délibérément

`PUT` / `DELETE /tips/:id/vote` : la table `city_tip_votes` de 09 §4 **n'existe
pas**. Sans elle, « un vote par membre » n'a aucun support et le tri « par
utilité » du §2.3 deviendrait un tri par acharnement. Livrer la route aurait été
livrer un mensonge.

### Colonnes annoncées et absentes, contournées sans migration

| Colonne | Contournement |
|---|---|
| `events.cancelled_at`, `cancel_reason` | Motif dans la charge de `event.cancelled` + audit ; la fenêtre des 7 jours s'appuie sur `updated_at` |
| `events.checked_in_count` | Compté à la requête |
| `event_attendees.waitlist_position` | Dérivée de `responded_at` — même ordre |
| `city_tips.venue_name`, `address_text` | Un commerce met nom et adresse dans le corps |
| `user_profiles.show_as_newcomer` | **Aucun retrait possible** des nouveaux arrivants. Le critère le plus protecteur disponible est appliqué : un profil non public reste caché hors connexion |
| `city_tip_votes` | Routes de vote non livrées, cf. ci-dessus |

### Imprécisions tranchées

| Point | Spec | Tranché |
|---|---|---|
| `EVENT_FULL` | §5 le liste comme erreur, annoté « → waitlist automatique » ; §3.2 dit « `WAITLIST` ». Les deux s'excluent | Le comportement, pas le code : la réponse porte `status: WAITLIST` + position. `EVENT_FULL` n'est pas déclaré — un code que rien ne lève finit par être attendu du front |
| Fenêtre de présence de l'organisateur | §3.3 dit « après le début », sans borne | « Tant que l'événement est `SCHEDULED` ». Bornée à l'horloge, elle se fermait avant que la tâche horaire ne passe l'événement à `DONE` : l'organisateur perdait ses présences, donc **l'indicateur clé du projet**, en silence |
| Sujet « démarches » des Guichets du jour | §2.3 ; `stories.category` est du texte libre | Comparaison sans casse ni accents sur le préfixe `demarche`. **À figer avec le module 04**, sinon les Guichets se videront au premier libellé différent |
| Fuseau d'une ville | §3.5 lit un événement « dans le fuseau de sa ville » ; ni `cities` ni `countries` n'en portent | Table de correspondance par pays. **Une colonne `cities.timezone` réglerait cela** le jour où un second pays de destination ouvre |
| Modération des événements | §3.1 dit « comme un post » ; `events` n'a pas de `moderation_status` | L'événement est émis pour que le pipeline s'y branche ; l'état n'est stockable nulle part |
| Frontière du mois pour le quota | §3.1 muette | `AAAA-MM` en UTC : un événement créé le 1er à 00 h 30 à Paris compte pour le mois précédent. À trancher si cela compte |
| « Note » d'un commerce | §2.3 la décrit, §4 ne l'ajoute pas | Aucune colonne, ni texte ni étoiles |

### Deux défauts de concurrence, trouvés en raisonnant sur l'écriture

- **Course sur le quota mensuel** : « vérifier puis écrire » est trivialement
  gagnable quand la limite vaut 1 — deux requêtes simultanées passaient toutes
  les deux. L'incrément vient d'abord (il pose un verrou de ligne), la
  vérification ensuite ; le dépassement lève, ce qui annule l'incrément avec la
  transaction.
- **Dernière place d'un événement** : `SELECT … FOR UPDATE` avant de décider
  `GOING` ou `WAITLIST`.

### Un détail de tri que personne ne voit venir

`ORDER BY profile.available_to_help DESC` met les **NULL d'abord** en PostgreSQL.
L'écran 5 de l'onboarding étant passable, les membres sans profil passaient donc
devant ceux qui se sont déclarés disponibles — l'inverse exact de ce que §2.2
demande.


---

## Le consommateur d'événements — le trou du socle, comblé

Ce qui manquait : aucun `Worker` BullMQ n'était instancié. Le relais déposait les
travaux dans la file `events` et personne ne les retirait. **Aucune règle qui
passe par un événement ne fonctionnait, dans aucun module.**

### Un ANNUAIRE, pas un aiguillage

`EventHandlerRegistry` : chaque module déclare ce qu'il écoute, le worker ne
connaît aucun module. Un `switch` dans le worker devrait importer les
vingt-quatre modules, et grossirait à chaque livraison.

Trois propriétés qu'un gestionnaire doit respecter, parce que la file les impose :

- **idempotent** — la livraison est « au moins une fois », il sera rejoué ;
- **indépendant** — l'échec de l'un ne doit pas priver les autres de leur travail ;
- **qui lève pour réessayer** — une erreur avalée fait disparaître le travail.

Les deux dernières se contredisent en apparence, et la résolution est le cœur du
registre : chaque gestionnaire est isolé dans son `try`, **et la distribution lève
à la fin** si l'un a échoué. Sans l'isolement, une anonymisation de guides
échouerait parce que l'entraide a eu un problème de base. Sans la levée finale,
BullMQ marquerait le travail terminé et le gestionnaire en échec ne serait jamais
rejoué. Deux tests tiennent les deux moitiés.

### Le câblage est dans UN fichier

`event-subscriptions.service.ts`. Les services métier restent ignorants de la
file : ils exposent des méthodes publiques et se construisent avec Prisma. Leurs
tests d'intégration n'ont donc besoin ni de Redis ni de BullMQ — la différence
entre une suite qui tourne en dix secondes et une qui demande un environnement.

Et on lit en un coup d'œil qui écoute quoi. Éparpillés dans vingt-quatre
`onModuleInit`, les abonnements deviennent invisibles : c'est précisément comment
`user.onboarded_location` a pu rester sans lecteur pendant tout un lot.

### Un bug d'ordre de démarrage, trouvé en lisant le journal du worker

`QueueModule` est global, donc son `onModuleInit` tourne **avant** celui des
providers du module racine — dont le câblage des abonnements. Le consommateur
démarrait sur un registre vide.

Ce n'était pas cosmétique : `dispatch` sort silencieusement quand personne
n'écoute, et **BullMQ marque alors le travail TERMINÉ**. Tout événement arrivé
dans cet intervalle était perdu, sans trace. Le consommateur démarre désormais
dans `onApplicationBootstrap`, qui ne se déclenche qu'après tous les
`onModuleInit`.

L'avertissement « aucun gestionnaire abonné » est donc devenu fiable — il l'était
faux avant, et un avertissement faux s'apprend à être ignoré.

### Vérifié de bout en bout, sans rien appeler à la main

Inscription par OTP → ville posée → écran 3 franchi → le worker crée les deux
adhésions (`ville-lyon`, `pays-bj`). Personne n'a appelé `syncAutoMemberships`.

### Ce qui manque encore du même ordre

- **Aucun registre de tâches planifiées.** `apps/api/src/queue` n'a pas de travaux
  répétables, alors que trois modules ont livré leurs tâches sous forme de méthodes
  publiques testées que personne n'appelle : `help.archive`, les cinq tâches des
  guides, les trois des réseaux, les quatre de l'agenda.
- **Aucun registre de gestionnaires de suppression de compte.** Deux modules ont
  écrit le leur, désormais branchés sur `user.deleted` — mais rien n'émet encore
  cet événement, la suppression de compte n'étant pas livrée.


---

## Trois défauts du SOCLE trouvés par les agents de la vague 2

Ils comptent plus que les modules eux-mêmes : ils étaient dans du code que tous
les modules emploient.

### `pnpm guardrails` ne lançait pas le garde-fou que je venais d'écrire

J'avais ajouté une clé `"guardrails"` en DOUBLON dans le `package.json` racine.
En JSON, la seconde gagne — silencieusement. Mon « garde-fous OK » du commit
précédent ne mesurait donc pas le contrôle des clés écrasées.

C'est la même famille de défaut que celui qu'il cherche à détecter : une clé qui
en écrase une autre sans que rien ne le dise.

### Le tuyau de validation perdait le message de tout `.refine()`

`ZodValidationPipe` ne transmettait que `issue.code`. Or un `.refine()` rend
TOUJOURS le code `custom`, qui ne dit rien : seul le message écrit par l'auteur du
schéma explique le refus.

Conséquence : le membre lisait « Certaines informations sont incomplètes ou mal
remplies » sur le refus qui a le plus besoin d'être expliqué — le mot « certifié »
dans une fiche professionnelle — et il ne pouvait que tâtonner. Trouvé au `curl`
en livrant l'annuaire pro, jamais en relisant.

Le correctif est PRÉCIS, et c'est ce qui compte : le message n'accompagne que les
refus `custom`. Pour les codes intégrés (`too_small`, `invalid_string`), il reste
exclu — il est en anglais, généré par zod, et le front a le code, qui lui suffit à
écrire sa propre phrase (§5.2). Quatre tests tiennent la distinction.

### Deux limites du socle, signalées et non corrigées

- **`buildPage` sans `sortOf` casse silencieusement la pagination** dès que le tri
  n'est pas l'identifiant : le curseur n'encode alors que l'`id`, et la page
  suivante repart d'un `id >`. Des lignes se répètent, donc d'autres se perdent.
  C'est un piège tendu à chaque module qui trie autrement. `cursor.ts` gagnerait à
  rendre `sortOf` obligatoire, ou à lever quand `orderBy` n'est pas `id`.
- **`audit_logs.target_id` est de type `Uuid`** : `AuditService.record()` ne peut
  donc pas cibler une table dont la clé primaire est une chaîne, comme
  `system_settings.key`. Or toute écriture d'administration doit laisser une trace.
  Contourné en passant la clé en métadonnées ; la vraie correction est d'élargir la
  colonne.

### Un droit refusé par le garde : contester une sanction

**Un membre suspendu ne peut pas contester sa sanction**, alors que 13 §4.3 lui en
donne le droit. Le garde global refuse toute écriture d'un compte `SUSPENDED`
(00 §7.3), et la contestation est une écriture. Démontré au `curl` avec un vrai
jeton : `403 ACCOUNT_SUSPENDED` sur la contestation, `200` sur la lecture des
sanctions.

Le piège est double : la suspension révoque les sessions, donc le membre se
reconnecte, et c'est son jeton NEUF qui porte `SUSPENDED` — le refus n'apparaît
qu'à ce moment-là.

La correction appartient au garde, pas au module : il faut un `@AllowSuspended()`
pour les rares routes qu'un compte suspendu doit pouvoir appeler. **Non corrigé à
ce stade**, et c'est un manque à combler avant tout lancement : une sanction sans
recours effectif n'est pas une sanction, c'est une exclusion.

---

## Écarts relevés en implémentant services et modération

### Deux capacités AJOUTÉES à la matrice du §7.3

`report.create` et `sanction.appeal`, toutes deux L0 et `planLimit: null`. La
matrice est une source unique, et l'étendre demande une justification :

- aucune capacité existante ne convenait — `comment.create` aurait MENTI dans
  l'invitation à monter de niveau que le front affiche sur `LEVEL_REQUIRED` ;
- **L0 est délibéré** : 13 §1 fait du pré-départ non vérifié la cible privilégiée
  des arnaques. Exiger L1 pour signaler fermerait l'alerte à ceux qui en ont le
  plus besoin.

### Ce que la modération NE fait pas, et pourquoi c'est juste

Le service n'écrit dans **aucune** table de contenu. Il ouvre des dossiers et émet
`moderation.content_hidden` ; chaque module de contenu applique l'effet sur sa
propre table en s'y abonnant. C'est ce qui lui évite de connaître les douze types
de sujet — et ce qui fait que masquer un guide relève des guides.

La seule exception est `users.status` et la révocation des sessions sur
suspension, que §4.2 exige mot pour mot.

### Trois lectures de spec tranchées, qui changent le comportement

| Point | Contradiction | Tranché |
|---|---|---|
| L'IA peut-elle empêcher une publication ? | §2.3 dit « masqué », §2.1 dit « non publié », §3 range les deux ensemble | **Seule une règle LOCALE empêche la publication.** L'IA masque après coup. C'est la seule lecture compatible avec une analyse asynchrone — et les guides bloquaient à tort sur un verdict IA |
| `SELF_HARM` avec une étiquette bloquante | §2 dit « aucune autre action automatique » | **`SELF_HARM` domine, aucun masquage.** Un membre en détresse ne doit pas voir son appel disparaître. Testé avec `['SELF_HARM','SCAM']` à 0,97 |
| `HARASSMENT` | §2.3 ne le met pas dans la liste bloquante, §3 le range en priorité 2 | File humaine, contenu visible. Les guides le bloquaient, plus large que la spec |

### Une règle dure NON couverte, faute de table

**« Un numéro banni ne peut pas se réinscrire »** : `banned_phone_hashes` n'existe
pas dans le schéma figé, et aucun substitut n'est honnête. Le bannissement se
contente aujourd'hui de désactiver le compte et de révoquer les sessions. Un test
assertant l'absence de la table documente le trou.

### Deux tables en ajout seul ont un effet de bord non prévu

Le déclencheur d'ajout seul de `moderation_actions` refuse UPDATE et DELETE — y
compris **ceux que les cascades déclenchent**. Conséquences vérifiées en base :

- un `moderation_cases` porteur d'une action ne peut plus être supprimé ;
- **un `staff_users` qui a pris une action ne peut plus être supprimé non plus**,
  la cascade `SetNull` étant un UPDATE que le déclencheur refuse.

Le départ d'un modérateur est donc un problème produit non traité.

### Un calibrage à surveiller avant le lancement

Le score de risque du logement (10 §2.2) : un L2 fraîchement vérifié porte d'office
0,3 (« L2 depuis moins de 7 jours » + « première annonce »). **Un seul terme de la
liste ajoute 0,4 et atteint exactement le seuil de blocage.** Or « virement » et
« acompte » sont du vocabulaire locatif parfaitement normal.

Conséquence : la première annonce d'un nouvel arrivant qui décrit son mode de
paiement partira en file de modération. La règle est appliquée telle qu'écrite, et
les poids sont **déjà lus** depuis `system_settings['housing.risk_weights']` — le
réglage se fera sans déploiement.

### Une route NON livrée, et une conséquence à connaître

`POST /housing/:id/hide-from` : `hidden_from_user_ids` n'existe pas, et aucune
table ne peut porter un masquage local sans en faire un blocage global — ce que
§2.3 refuse. Une route qui accepterait l'appel sans rien masquer serait pire que
son absence.

Et surtout : **aucune fiche professionnelle ne peut passer en `APPROVED` par l'API
aujourd'hui**, la validation humaine appartenant à l'administration. L'annuaire
resterait donc vide en production.

### Un piège de regex qui vaut pour tout le dépôt

Une expression rationnelle portant le drapeau `g` et employée avec `test()`
conserve son `lastIndex` entre deux appels : **elle laisse passer un contenu sur
deux**. Sur des règles de sécurité, c'est une faille. `MODERATION_LOCAL_RULES`
n'en porte aucun, et un test vérifie que quatre appels de suite donnent le même
verdict.
