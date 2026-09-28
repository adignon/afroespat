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


---

## Le fil et le parrainage — et deux erreurs dans MON code du socle

### `post-types.ts` contredisait la spec, et c'était consultable

Ma table donnait à `INFO` la réaction `USEFUL`, l'action « Utile » et le compteur
« mentions utiles ». §2.1 dit `LIKE`, « J'ai vu », « N réactions ».

Ce n'était pas cosmétique : la règle dure §9 se LIT dans cette table, et un
service qui l'aurait suivie aurait **écrit `USEFUL` en base pour une publication
INFO** — un type de réaction que §2.1 réserve au vote d'une story `CONSEIL`.

Pire, trois sources donnaient trois vocabulaires : §2.1, ma table, et le
commentaire de l'enum `ReactionKind` dans `04-feed.prisma` (« Utile sur un
conseil, Je soutiens sur une question »). §2.1 tranche.

### La cascade de blocage, éprouvée par le chemin réel

Le test de cascade construit le **vrai** fichier d'abonnements, puis fait passer
l'événement par la boîte d'envoi — et il a aussi été éprouvé au `curl` avec un
worker réel : relais, BullMQ, Redis. Vérifié en base ensuite : parrainage `ENDED`
motif `BLOCKED`, compteur de filleuls remis à zéro, dossier de modération
priorité 2, contact retiré, `left_at` posé **des deux côtés** de la conversation.

C'est le niveau de preuve que je veux pour une règle dure qui traverse trois
modules.

---

## La suite d'intégration : trois défauts, et une cause qui n'en était pas une

474 tests partagent une base de données. Trois défauts distincts se présentaient
tous comme des **échecs de tests innocents**, et chacun a demandé d'être mesuré
plutôt que supposé.

### 1. Saturation des connexions

Chaque fichier tourne dans son propre processus et y construit son
`PrismaService`, donc son bassin — une vingtaine de connexions. PostgreSQL en
accepte cent. Au-delà de quatre ou cinq fichiers simultanés, les suivants
attendent une connexion qui ne vient pas.

### 2. Interférence de données entre fichiers

Plusieurs requêtes sont GLOBALES par nature : les « nouveaux arrivants » d'une
ville, la boîte d'envoi, la file de modération. Les membres et les dossiers qu'un
fichier crée apparaissent dans les résultats d'un autre.

Deux tests ont dû être rendus robustes — sans être affaiblis :

- la **pagination de la file de modération** parcourait vingt pages fixes. Le
  module emploi ouvre aussi des dossiers de type `JOB` : les cinq du test se
  retrouvaient au-delà. Le test parcourt maintenant jusqu'à les avoir tous
  trouvés ; la propriété éprouvée — aucune ligne répétée, toutes atteignables —
  est inchangée ;
- la **cascade de blocage** réclamait la boîte d'envoi partagée et se faisait
  voler ses événements. Elle vide maintenant la file par lots jusqu'au bout, en ne
  distribuant que les événements de ses propres membres — distribuer ceux des
  autres suites rejouerait des faits sur des membres supprimés entre-temps.

**Les deux suites sont donc SÉRIELLES** (`maxWorkers: 1`, `fileParallelism: false`).
Le coût est du temps de mur, assumé : un échec qu'on doit rejouer pour savoir s'il
est réel coûte bien plus cher. Pour paralléliser un jour, la voie est **une base
par fichier** — pas des assertions plus lâches, qui reviendraient à tester moins.

### 3. Ce qui n'était PAS un défaut du produit

Un test différent bloquait à 60 s à chaque exécution. J'ai vérifié
`pg_stat_activity` pendant les blocages : **aucun verrou, aucune requête active**.
Le processus attendait en JavaScript.

Deux causes, toutes deux d'outillage :

- **`await import()` DANS un test.** Trois fichiers en portaient, et vitest
  imputait au test la transcompilation de tout `@app/shared` — mesurée de moins
  d'une seconde à plus d'une minute selon la charge. Remontés en import statique,
  le coût retombe dans la phase de collecte, commune au fichier ;
- **réutilisation des processus entre fichiers.** `prepare` tombait de 62 s à
  2,6 s d'une exécution à l'autre, ce qui le trahissait : un processus réutilisé
  garde le tas et les modules du fichier précédent. `isolate: true` explicite, et
  le délai porté à 150 s pour couvrir la variance mesurée.

**Aucun code de produit n'était en cause.** C'est la conclusion qui importe, et
elle a demandé d'écarter méthodiquement trois hypothèses fausses — un verrou de
ligne, une saturation de bassin, un test lent.


---

## `@AllowSuspended()` — une sanction doit rester contestable

Deux règles se heurtaient, et c'est le refus qui gagnait :

- `00` §7.3 refuse **toute écriture** à un compte suspendu, et c'est juste : un
  membre sanctionné ne doit pas continuer à publier ;
- `13` §4.3 lui donne le droit de **contester** sa sanction — et contester est une
  écriture.

La contestation renvoyait donc `403 ACCOUNT_SUSPENDED`. **Une sanction sans
recours effectif n'est pas une sanction, c'est une exclusion.**

Le piège était double : la suspension révoque les sessions, le membre se
reconnecte, et c'est son jeton NEUF qui porte `SUSPENDED` — le refus n'apparaissait
qu'à ce moment-là, et jamais sur le jeton de la session en cours.

L'exemption est **nommée route par route**, et c'est la moitié qui compte autant
que l'autre : quatre tests éprouvent qu'un compte suspendu peut contester et lire
ses sanctions, et qu'il **ne peut toujours ni publier ni signaler**. Une exemption
large aurait rendu la sanction inopérante.

### Un angle mort découvert au passage

`appeal()` refuse en **404** une sanction sans `case_id`, la contestation
s'écrivant dans l'historique du dossier. Une sanction posée sans dossier ne serait
donc **pas contestable**, et le membre ne verrait qu'un « introuvable ».

Aucune route ne pose de sanction aujourd'hui (l'application d'équipe n'existe
pas), donc le cas ne peut pas encore se produire. À combler quand elle arrivera :
soit toute sanction porte un dossier, soit la contestation sait s'en passer.

---

## Ordonnanceur : deux mécanismes, et pourquoi aucun ne suffit seul

Les 27 tâches du §10 tournent sur **deux** mécanismes empilés, ce qui ressemble
d'abord à une redondance :

* **l'horloge** est une tâche répétable BullMQ (`repeat.pattern`, fuseau
  `Europe/Paris`) — elle décide *quand demander* ;
* **l'exécution** est protégée par un verrou Redis explicite (`SET NX PX` pour
  prendre, script Lua comparaison-puis-suppression pour rendre) — il décide *qui
  fait*.

Le verrou seul ne suffit pas : il n'a pas d'horloge, quelqu'un doit demander.
Et la tâche répétable seule ne suffit pas non plus, pour trois raisons qui se
produisent toutes en exploitation normale :

1. un travail **bloqué** (`stalled`) est repris par un autre ouvrier — BullMQ le
   rejoue, c'est son travail, mais la tâche s'exécuterait deux fois ;
2. un **rejeu après échec** redemande la même chose ;
3. un **déploiement progressif** fait cohabiter deux générations d'ouvriers, qui
   déclarent chacune les 27 tâches.

Preuve faite plutôt que déduite : Redis vidé, deux ouvriers réels
(`APP_ROLE=worker`) démarrés, chacun déclarant ses 27 tâches, puis **12 travaux
distincts** (`jobId` différents, la déduplication BullMQ ne peut donc rien)
déposés sur `community.member_count_recompute` — résultat **exactement 1
exécution** (`w1.log:1`, `w2.log:0`).

La durée du bail est `clamp(0,8 × période, 30 s, 12 h)` : gardée en cas de
succès (pour que la fenêtre suivante ne rejoue pas), rendue en cas d'échec (pour
qu'un autre ouvrier puisse reprendre tout de suite).

### La politique de reprise dépend de la cadence

En dessous d'un jour : **1 tentative**. La balayage suivant reposera la même
question dans une minute ou une heure ; réessayer, c'est faire deux fois le même
travail pour rien.

À partir d'un jour : **3 tentatives**. Parce que `sanctions.expire` ne fait pas
que nettoyer — elle **rend l'accès** à un compte suspendu. Un échec silencieux y
prolonge une sanction d'une journée entière, ce qui est une décision de
modération prise par une panne.

### Trois cadences corrigées contre le brief, en faveur des spécifications

L'agent a relevé trois écarts entre mon brief et les documents, et a suivi les
documents. C'est le bon arbitrage : le brief est un résumé, la spécification est
la source.

### Deux `'error'` sans écouteur, trouvés par ricochet

En vérifiant ses affirmations j'ai constaté que **ni** le `Worker` de
`event-consumer.service.ts` **ni** celui de `moderation.consumer.ts` n'avait
d'écouteur `'error'`. Sur un `EventEmitter` de Node, un `'error'` sans écouteur
devient une exception non rattrapée : **un hoquet Redis passager tuait le
processus**, donc tous les consommateurs d'un coup. Corrigé sur les deux.

### Neuf tâches déclarées mais non enregistrées

Neuf tâches du §10 n'ont pas encore de méthode de service. Elles ne sont **pas**
enregistrées : un gestionnaire qui ne fait rien est pire qu'une absence, parce
qu'il fait croire la chaîne branchée. Une en particulier mérite d'être nommée :

**`city.member_count_recompute`.** `CitiesService` *lit* `cities.member_count`
(la carte, l'activation d'une ville autour de 20 membres) et **personne ne
l'écrit** — vérifié : les seules écritures de `memberCount` du dépôt portent sur
`communities`. L'ouverture des villes dépend donc aujourd'hui d'un compteur qui
reste à zéro. À combler avant toute mise en service.

### Angle mort d'observabilité, accepté

La ligne « créneau déjà pris, on passe » est en niveau `debug`, que
`apps/worker/src/main.ts` exclut : les **sauts** sont invisibles, les
**exécutions** sont tracées. Acceptable pour l'instant — on voit ce qui se fait,
pas ce qui ne se fait pas.

---

## Modules 03 (parcours) et 15 (équipe) — ce qui attend un arbitrage

### Une dépendance à trancher : argon2id absent du verrou

`00` §8.3 et `15` §2.1 nomment **argon2id** pour les mots de passe d'équipe.
Aucun paquet argon2 n'est dans le `pnpm-lock.yaml`, et l'environnement s'installe
en `--frozen-lockfile` : l'ajouter n'était pas à la main de l'agent.

Repli livré : **scrypt** (N=2¹⁷, r=8, p=1), la seule fonction à coût mémoire de
`node:crypto`. Le condensé stocké porte son nom et ses paramètres
(`scrypt$N$r$p$sel$condensé`) et `needsRehash()` fait la bascule à la connexion
suivante — donc adopter argon2id plus tard n'invalidera **aucun** mot de passe.
C'est le bon repli, mais c'est une décision de dépendance, pas un détail.

### Le départ d'un modérateur n'a pas de solution technique

Vérifié en base, pas déduit : `delete from staff_users` d'un compte ayant agi en
modération échoue —
`ERROR: table moderation_actions est en ajout seul : UPDATE interdit`. Les
tables qui bloquent sont `moderation_actions`, `sanctions` et `announcements`
(`Restrict`) ; un compte qui n'a écrit que dans `audit_logs` **est** supprimable.

`DELETE /staff/:id` répond donc `409` explicite plutôt qu'un 404 de routeur, et
`isActive=false` coupe les sessions à l'instant. Reste la vraie question, qui
n'est pas technique : **que fait-on du nom et de l'email d'un modérateur parti**,
entre son droit RGPD et l'obligation de tracer qui a sanctionné qui ?

### Un bannissement n'est pas lisible dans `users`

`UserStatus` n'a pas de `BANNED` ; `13` §4.2 écrit `DEACTIVATED`. Un banni est
donc indistinguable d'un membre qui s'est simplement désactivé — et
`POST /users/:id/reactivate`, ouverte au MODERATOR, **débannissait** en silence,
contournant une décision réservée au SUPER_ADMIN. Colmaté par la lecture d'une
`sanctions` `type='BAN'` non levée (mutation → le test tombe), mais le colmatage
ne remplace pas la valeur d'enum manquante.

### `member_notes` : refus délibéré de contourner

§3.2 veut des notes internes sur un membre. La table n'existe pas. Les écrire
dans `audit_logs` les rendrait **ineffaçables**, alors que §11 exige leur
suppression quand le membre est supprimé : ce serait fabriquer une obligation
RGPD intenable. Non livré, et c'est le bon choix.

### Colonnes annoncées, absentes, et contournées sans migration

`staff_users.{failed_attempts,locked_until,totp_enrolled_at,created_by_staff_id}`,
`staff_sessions.last_seen_at`, `pro_profiles.{approved_at,approved_by_staff_id,rejection_reason}`,
`metric_snapshots`, `journeys.{last_viewed_at,migrated_from_version_id}`,
`journey_steps.deleted_at`, `guides.quotable`, `city_tips.quotable`.

Contournements notables : le verrouillage après 5 échecs est **compté dans
`audit_logs`**, ce qui est durable et inter-instances — meilleur que deux
colonnes ; l'historique des décisions pro y est **complet**, pas seulement la
dernière. Deux conséquences en revanche :
`journey_steps.deleted_at` manquant rend la suppression d'étape **physique** là
où §3.2 demande un effacement logique ; et `metric_snapshots` absente bloque les
trois tableaux de bord du §5.

### `JourneyMemberStatus` n'a pas de `DECLINED`

Un refus d'invitation est enregistré en `REMOVED`, donc **indistinguable d'une
exclusion**. Un membre qui décline poliment apparaît comme ayant été retiré.

### Le seed des modèles de parcours n'existe pas

0 ligne dans `journey_templates` / `step_definitions`. Le module 03 est complet
et `GET /journey-templates` renvoie une liste **vide** : la fonctionnalité est
livrée sans son contenu. T3 partie A est donc bloquante pour la mise en service,
pas optionnelle.

### Deux points de matrice à confirmer

1. §2.2 donne la validation des fiches pro à SUPER_ADMIN / CONTENT_ADMIN /
   **SUPPORT** mais **pas** à MODERATOR — alors que la file de modération est à
   MODERATOR. Un modérateur ne peut donc pas trancher une fiche pro signalée
   dans sa propre file. Implémenté tel quel ; c'est peut-être voulu.
2. §3.1 fait chercher un membre « par … email ». **`users` n'a pas de colonne
   email** — les membres s'authentifient par OTP téléphone. Livré : handle, nom
   d'affichage, empreinte HMAC du numéro.

### Une règle tenue par la base, qu'il faudra ne pas oublier

Deux index uniques partiels (`journey_template_versions_one_published_generic`
et `…_per_country`), posés par migration et **absents des fichiers
`schema/*.prisma`**, rendent impossible de publier une v2 avant d'archiver la v1.
La future route `POST /versions/:id/publish` doit donc archiver et publier **dans
la même transaction**, sinon elle échouera en production. Trouvé parce qu'un test
a levé `P2002`, pas par lecture.

---

## Modules 11 (recherche) et 12 (notifications)

### `jobId` BullMQ : aucun push ni aucun email ne partait jamais

Le défaut le plus coûteux de tout le lot, et il était **invisible en test**.

BullMQ refuse un `jobId` contenant « : » — **sauf** s'il compte exactement trois
segments, une compatibilité laissée aux anciens travaux répétables que son propre
code marque « TODO ». Mesuré contre un vrai Redis :

```
push:abc          → REFUSÉ  « Custom Id cannot contain : »
email:abc         → REFUSÉ
analyze:POST:abc  → ACCEPTÉ   ← trois segments, donc toléré
a:b:c:d           → REFUSÉ
push-abc          → ACCEPTÉ
```

`push:<uuid>` et `email:<uuid>` en comptaient deux : la mise en file levait,
l'erreur était journalisée, et la ligne `outbound_messages` restait
**éternellement en `QUEUED`**. La doublure de file des tests est en mémoire et
n'a pas cette contrainte — seul le lancement du worker l'a révélé.

Et le pire n'était pas la ligne fautive : `analyze:<type>:<id>` de la modération
fonctionnait **par accident**, en tombant juste sur les trois segments tolérés.
Un segment ajouté ou retiré aurait arrêté toute l'analyse de modération, en
silence. Corriger la ligne fautive et laisser la ligne chanceuse, c'était garder
la mine et retirer le panneau : d'où `queue/job-id.ts`, un seul constructeur qui
lève à l'écriture du code plutôt qu'à la mise en file, et un test qui interdit au
dépôt entier de reconstruire un `jobId` littéral à la main.

### Deux angles morts de MES outils, trouvés en les éprouvant

1. **`git ls-files` ne liste que les fichiers SUIVIS.** Les deux contrôles ne
   voyaient donc aucun fichier neuf — précisément ceux qui ont le plus de chances
   de porter le défaut. Constaté en réintroduisant le bogue du `jobId` dans un
   module pas encore commité : le contrôle restait **vert**. Corrigé par
   `--cached --others --exclude-standard` dans les deux.
2. **Le contrôle des diffusions lisait ses propres commentaires.** Un commentaire
   qui explique le motif le contient forcément, et l'outil signalait sa propre
   documentation. Il signalait aussi deux conditions **exclusives** sur la même
   valeur (`s === 'A'` puis `s === 'B'`), qui ne peuvent pas s'écraser.

Un garde-fou qui crie à tort finit ignoré, et c'est alors qu'il cesse d'attraper
le vrai. Les deux corrections sont donc verrouillées par un `--self-test` de
9 cas — ce que l'outil doit dire **et** ce qu'il doit taire, y compris le trou
qu'il ne bouche pas (le cas de l'entraide, clé venue d'un appel). Sa portée est
désormais vérifiée par la machine, non affirmée dans un commentaire.

### Trois autres défauts que l'exercice a révélés

* **Un membre BANNI d'un réseau lisait ses sujets par la RECHERCHE.**
  `community_members` porte aussi `PENDING`, `INVITED`, `BANNED` ; la lecture
  d'appartenance ne filtrait pas `status: 'ACTIVE'`. La règle dure 07 §2.1 était
  contournée par une porte que personne ne regarde. Vérifié moi-même par
  mutation : le filtre retiré, le test tombe en nommant le document rendu.
* **`users.display_name` vaut `''` juste après l'inscription** — pas `null`,
  donc aucun `??` ne l'attrape. Le titre produit était « ␣a répondu à votre
  demande ».
* **`@@unique` sur une colonne NULLABLE** dans `search_zero_results` : Postgres
  traite deux `NULL` comme distincts, donc un `upsert` aurait inséré une ligne
  par appel, toutes à `count: 1`, et l'agrégat produit aurait été faux **sans
  rien signaler**.

### Deux contournements qui coûtent une garantie

* **`notifications.group_key` n'existe pas** (annoncée par §3). Le regroupement
  se fait donc par fenêtre SQL + `pg_advisory_xact_lock`, et non par la fenêtre
  Redis du §2.3 — d'où une file `notifications` **sans producteur**, écart assumé.
* **`search_documents.author_user_id` n'existe pas.** La règle dure « auteur
  bloqué » ne peut pas être tenue en SQL : filtre applicatif avec sur-cueillette,
  et les compteurs par type deviennent **bornés** au lieu d'exacts.
* **`users.email` n'existe pas** : aucun canal email réel. Le port
  `NoEmailAddressPort` dit la vérité — `has()` rend `false`, donc aucun email
  n'est décidé, ce qui est exactement ce que §3 prescrit. Le jour où la colonne
  arrive, un seul fournisseur change.

---

## La limite de débit : un décorateur qui ne limitait rien

`@RateLimit(n)` posait sa métadonnée, émettait `x-rate-limit` dans l'OpenAPI, et
**personne ne la lisait**. Une seule occurrence de `app:rateLimit` dans tout le
dépôt : sa propre déclaration. **Quinze contrôleurs** déclaraient une limite qui
n'existait pas, dont les routes d'OTP — celles qui envoient un SMS, donc qui
coûtent de l'argent à chaque appel. L'OpenAPI annonçait la protection, ce qui est
pire qu'une absence : on ne cherche pas ce qu'on croit avoir.

Trouvé par un `grep`, en vérifiant le rapport d'un agent. Rien ne pouvait le
révéler autrement : **un décorateur muet ne casse aucun test**, et il n'y en avait
aucun.

### Rendre la limite effective a révélé que son unité était fausse

Le décorateur ne savait dire que « par minute ». Or les spécifications chiffrent
souvent l'heure :

* 01 §2 : « **10 par IP et par heure** » pour l'envoi d'un code ;
* 01 §4.4 : « `PATCH /me` **20/h** ».

Ces deux routes portaient `@RateLimit(10)` et `@RateLimit(20)` — soit **soixante
fois plus permissif que la règle**, avec le bon chiffre en commentaire juste
au-dessus. Tant que le décorateur ne limitait rien, l'écart ne coûtait rien.
`RateLimit(count, period)` accepte donc `'minute' | 'hour'`, et les deux routes
sont corrigées.

La **journée** n'est volontairement pas proposée. Les quotas journaliers des
specs (« 30 publications/jour », « 3 stories/jour », « 10 contacts/jour ») sont
des règles métier : elles doivent survivre à un redémarrage de Redis, être
lisibles par le membre, et compter des **objets créés** — pas des requêtes reçues.
Elles appartiennent au service, qui compte des lignes en base. Une limite de débit
protège la minute et l'heure ; au-delà, c'est un quota, et ce n'est pas la même
chose.

### Trois budgets qui s'additionnent

120 requêtes/min et 30 écritures/min par membre (§5.5), plus celui de la route.
Le premier dépassé refuse, et **tous sont incrémentés de toute façon** : sinon une
rafale refusée par la route échapperait au plafond global.

L'identité est le membre, puis le compte d'équipe, puis l'IP. L'IP en dernier
parce qu'elle est partagée — un foyer, un NAT d'opérateur — mais c'est la seule
identité disponible sur la connexion, qui est précisément la route à protéger.
Conséquence assumée : deux membres du même foyer se partagent le budget de l'OTP.

Le garde est le **troisième** garde global, et l'ordre est nécessaire : il lui faut
`request.auth` (posé par `AuthGuard`) et `request.staff` (posé par `StaffGuard`).
Placé avant eux, il ne verrait que des adresses.

### Fenêtre fixe, et panne Redis qui laisse passer

Fenêtre fixe, pas glissante : elle autorise une pointe à cheval sur deux fenêtres,
mais une fenêtre glissante demande un horodatage par requête, donc une structure
par identité que rien n'expire toute seule. §5.5 raisonne « par minute » ; la
fenêtre fixe dit exactement cela. L'incrément et l'expiration sont posés par un
**seul script Lua** : en deux allers-retours, un processus qui meurt entre les deux
laisse une clé SANS expiration, et l'identité est bloquée pour toujours.

En cas de panne Redis, **on laisse passer**. Refuser ferait d'un hoquet Redis une
panne totale de l'API, alors que cette limite protège d'un abus et d'un coût, pas
d'une faille. L'échec est journalisé en `error`.

### Le test qui compte, et la classe de défaut

Le test central appelle `otp/request` avec un numéro **différent** à chaque fois :
la limite par numéro que le service applique déjà ne se déclenche pas, et il ne
reste debout que la limite par IP — exactement la protection qui manquait, et la
seule qui arrête quelqu'un qui essaie des numéros en série à nos frais. Avant le
garde, les onze appels passaient et onze SMS partaient.

Trois mutations, chacune tue son test : le garde qui ne refuse jamais (le bogue
d'origine) en tue quatre, la période ignorée tue l'assertion sur `Retry-After`,
et l'identité retombée sur l'IP tue « le budget est porté par le membre ».

Enfin, `metadata-consumed.test.ts` attaque la **classe** de défaut plutôt que ce
cas : pour chaque clé de métadonnée déclarée dans `common/`, il exige qu'au moins
un garde, intercepteur ou filtre la lise. Vérifié en coupant le lien : il nomme la
clé orpheline. Sa portée est honnête — il voit qu'une clé est LUE, pas qu'elle est
correctement appliquée. Contre cela, la défense reste le test de comportement et
sa mutation. Les deux sont nécessaires : celui-ci attrape l'oubli complet, l'autre
l'erreur d'application.

---

## `cities.member_count` : un tri par un critère mort

02 §2.2, mot pour mot : « Recalculé chaque nuit : membres actifs avec `city_id` =
cette ville. Utilisé par la carte. » **Personne ne l'écrivait.** Vérifié plutôt
que supposé : les seules écritures de `memberCount` du dépôt portaient sur
`communities`. Le compteur valait donc zéro pour toutes les villes, depuis
toujours — et le commentaire de `map()` affirmait déjà un recalcul nocturne.

Trois lectures en dépendaient, et la plus insidieuse n'est pas celle qu'on
attend :

1. **le TRI de la carte.** `orderBy: [{ memberCount: 'desc' }, { name: 'asc' }]`
   — les villes les plus peuplées d'abord. Avec un compteur uniformément nul, le
   premier critère ne départage rien et la carte sortait dans l'ordre
   **alphabétique**. Aucune erreur, aucun test rouge : une liste triée par un
   critère mort reste une liste triée. C'est la classe de défaut la plus difficile
   à voir, parce que le résultat *a l'air* correct.
2. le compteur rendu par la carte et par la fiche de ville — « 0 membre » partout.
3. le nombre que l'**équipe** regarde pour activer une ville.

### Une correction à ma propre note

J'avais écrit plus haut que « l'activation d'une ville autour de 20 membres »
dépendait de ce compteur, comme s'il s'agissait d'un seuil automatique. §2.2 dit
autre chose : une ville « passe active quand l'**équipe** le décide, en général à
20 membres ». C'est un jugement humain nourri par ce chiffre, pas une bascule.
Le chiffre étant faux, la décision l'était aussi — mais rien ne s'ouvrait ni ne se
fermait tout seul.

### La définition doit coïncider, pas seulement être juste

Le recalcul emploie exactement la définition que `countsByCity` et
`breakdownByCountry` emploient déjà : membre `ACTIVE`, non supprimé, rattaché à la
ville. Un test le verrouille explicitement, et c'est le plus important du fichier :
`map()` sans filtre rend `member_count`, avec un filtre de pays il **recalcule en
direct**. Si les deux chemins divergeaient, le même écran afficherait deux nombres
selon qu'un filtre est actif — et on attribuerait l'incohérence à un cache.

Trois mutations, chacune tue son test : le filtre `ACTIVE` retiré, le filtre
`deleted_at` retiré, et l'écriture rendue inconditionnelle (qui ne tue que
l'idempotence — la bonne portée).

## Six tâches enregistrées, quatre encore orphelines

Les modules qui manquaient sont arrivés : `city.member_count_recompute` (02),
`notifications.quiet_hours_flush`, `notifications.weekly_digest`,
`notifications.purge`, `push.cleanup` (12) et `staff.session_cleanup` (15). 27 → 33.

**Les cadences viennent de la documentation des méthodes, pas de leur nom.** Une
surprend, et c'est la bonne : `notifications.weekly_digest` tourne **chaque
heure**. §2.6 dit « lundi 8 h par fuseau » et §6 « exécutions horaires avec filtre
de fuseau » ; seule la seconde lecture est réalisable, et c'est celle que la
méthode implémente — elle choisit ses destinataires selon *leur* fuseau. La poser
le lundi à 8 h heure de Paris n'aurait servi qu'un seul fuseau, et le nom de la
tâche aurait suffi à le faire croire correct.

Restent quatre tâches sans méthode de service (`user.phase_progression`,
`account.deletion_execute`, `bookmark.state_refresh`, `retention.purge`,
`billing.expiry_reminders`), plus trois du module 03 qui est livré mais n'expose
pas de point d'entrée pour elles. Elles ne sont pas enregistrées : un gestionnaire
vide ferait affirmer au journal de démarrage qu'elles tournent.

À noter : `notifications.purge` couvre la conservation de 90 jours du module 12,
**pas** la rétention transverse du §9.3, qui porte sur d'autres tables.

## Un test qui passait selon la charge de la machine

Deux tests de hachage de mot de passe d'équipe échouaient à 5 002 ms — un
dépassement de délai, pas une assertion fausse. `hashStaffPassword` emploie scrypt
à N=2¹⁷ : la fonction est **lente par dessein**, c'est exactement ce qu'on lui
demande. Un hachage coûte près de deux secondes, et ces tests en enchaînent deux
ou trois.

Ils sont donc arrivés verts d'un worktree peu chargé et ont rougi ici sans qu'une
ligne ait changé. Le délai est aligné sur le **coût des paramètres**, pas
l'inverse : on n'abaisse pas N pour faire passer un test, on dit au test combien
coûte la sécurité choisie. Un test qui dépend de la charge apprend à ignorer le
rouge, ce qui coûte plus cher que le test ne rapporte.

---

## Seed des modèles de parcours (T3 partie A) — et ce qu'il refuse de faire

30 définitions d'étapes, 4 types, 6 versions publiées (générique × 4 + déclinaisons
Bénin de STUDIES et WORK), 68 étapes composées, 57 dépendances. Idempotent :
second passage, « inchangée » six fois, identifiants compris.
`GET /journey-templates` ne renvoie plus une liste vide — le module 03 a enfin son
contenu.

### Mon brief était faux, et l'agent a suivi la spec

Je lui avais demandé d'« activer les villes que la spec désigne comme actives au
lancement ». **La spec n'en désigne aucune.** T3 B.2 : « toutes inactives au
lancement sauf la ville pilote », « la ville pilote est activée à la main le jour
du lancement » — et la ville pilote **n'est nommée nulle part** dans les 22
fichiers. 02 §2.2 fixe le critère : décision d'équipe, « en général à 20 membres ».

Un seed qui active une ville prendrait donc une décision produit à la place du
porteur. L'agent a livré à la place un interrupteur explicite, hors défaut, refusé
en production (`SEED_PILOT_CITY_SLUG=lyon`), avec une limite documentée : cette
activation rend la ville visible mais **ne crée pas son réseau CITY**, parce que
la spec passe par l'événement `city.activated` et que le seed n'a pas de boîte
d'envoi.

C'est le bon arbitrage, et il met au jour un blocage plus sérieux (voir plus bas).

### Le test de rétro-planning était TAUTOLOGIQUE — chez l'agent aussi

Sa première version calculait l'échéance attendue **à partir de la donnée qu'elle
testait**, relue en base :

```ts
const offset = step.templateStep?.daysBeforeArrival;
expect(ISO_DATE(step.dueDate)).toBe(minusDays(arrival, offset as number));
```

La mutation `240 → 200` passait : **cinq tests verts sur une donnée fausse**. Le
test se comparait à lui-même. Corrigé en recopiant la table de T3 A.2 **à la
main** dans le test et en retirant `daysBeforeArrival` du `select`, pour qu'on ne
puisse pas y revenir par inadvertance.

Vérifié moi-même plutôt que sur parole : le `select` ne porte plus la colonne, et
j'ai rejoué la mutation de bout en bout — donnée modifiée, seed rechargé (« STUDIES
republiée »), le test **tombe**. Puis restauré et rechargé. J'ai aussi confronté
quatre valeurs de la table recopiée à T3 A.2 : `CHOOSE_PROGRAM` 240,
`OFII_VALIDATION` −30, `CAF` −45, `RESIDENCE_PERMIT` −270 — conformes. Le risque
s'était déplacé de « le test ne prouve rien » vers « la table recopiée est
fausse », et il fallait aller y regarder.

C'est le troisième agent sur cinq à découvrir ce défaut chez lui. La leçon est
générale : **un test qui lit la valeur attendue dans la source qu'il vérifie ne
vérifie rien**, et seule la mutation le révèle.

### Une mutation de DONNÉES ne se voit qu'après purge

Retirer les déclinaisons Bénin du seed n'a d'abord fait tomber aucun test : le seed
**n'archive jamais une version qu'il ne décrit plus**. C'est voulu — une version
publiée peut porter des parcours, et `journeys.template_version_id` est en
`Restrict` — mais ce n'était pas énoncé. Conséquence d'exploitation à connaître :
**retirer une déclinaison du fichier de données ne la retire pas de la base**, il
faut la désactiver en back-office.

### Trois contradictions arbitrées

1. **STUDIES « 12 étapes » puis 15 listées** (le document le reconnaît) → la liste.
2. **CAF dépend de « 8 **ou** HOUSING_AFTER »** — une disjonction que
   `step_dependencies` ne peut pas représenter, la table étant conjonctive. Pire :
   `HOUSING_AFTER` n'est pas composée par STUDIES v1, donc la seconde branche n'a
   **littéralement pas de cible** (la clé étrangère pointe les `template_steps` de
   la même version). → une seule dépendance. Rien d'inventé.
3. **SETTLEMENT position 1 : « REGULARIZATION ou STATUS_CHANGE ou RENEWAL, le
   membre choisit à la création »** — impossible : `@@unique(version, position)`
   interdit trois alternatives sur une position, et `createJourneySchema` est
   `.strict()` **sans paramètre de variante**. → REGULARIZATION seule ; les deux
   autres restent en bibliothèque.

### Trois manques qui bloquent la mise en service

1. **Tout le CRUD `/v1/admin/ref/*` de 02 §4.2 est absent** —
   `POST /cities/:id/activate`, `/countries/:id/activate`, `/cities/:id/merge`,
   `/cities/import`, et les CRUD des cinq référentiels. Sans la route
   d'activation, **il n'existe aucun chemin correct pour ouvrir la ville pilote** :
   celui qui crée le réseau CITY et y inscrit les membres déjà rattachés. C'est le
   premier geste du jour du lancement, et il n'a pas de bouton.
2. **`languages` n'a pas de colonne `is_active`**, alors que 02 §2.3 l'exige pour
   « langues, compétences **et** métiers ». `skills` et `professions` l'ont. Une
   langue ne peut donc pas être retirée des propositions.
3. **`step_dependencies` n'est lu ni écrit par aucun code applicatif** (zéro
   occurrence dans `apps/api` et `packages/shared`). Les 57 lignes posées sont de
   la donnée sans consommateur : l'alerte d'incompatibilité d'échéances de 03 §2.3
   n'existe pas. Elles sont posées quand même — A.2 les prescrit, et le jour où
   l'alerte arrive, elle trouvera la donnée.

### Ce que le seed refuse d'écrire, et pourquoi c'est juste

* **T3 partie C (paramètres système) — non amorcée.** `SETTINGS_REGISTRY` porte
  déjà toutes ces valeurs comme **défauts de code**, et `GET /admin/settings` rend
  les clés jamais écrites avec `isDefault: true`. Les écrire ferait apparaître 34
  réglages comme surchargés à la main alors que personne ne les a touchés, et
  créerait une seconde source de vérité pour chaque seuil. Pire : la moitié des
  clés de T3 ne correspond pas aux noms lus par le code (`handle.reserved` contre
  `reserved_handles`, `community.interest_threshold_members` contre
  `community_city_threshold`) — on aurait amorcé des clés que personne ne lit.
* **`step_definitions.description` — nulle pour les 30.** T3 A.1 n'en donne aucune.
  Rédiger des descriptions de démarches administratives créerait une autorité
  concurrente des guides communautaires, ce que T3 A.3 interdit explicitement
  (« les montants et délais ne sont pas inscrits en dur : ils renvoient aux guides
  communautaires, seuls à être mis à jour »). **Texte éditorial à écrire par le
  porteur.** Les seules descriptions présentes sont les trois surcharges Bénin que
  la spec prescrit nommément — sans montant ni délai, verrouillé par une regex et
  une mutation.
* **`blocker_template` et `risk_message` — nuls.** T3 A.1 en donne 4 par cible et
  1 message, pas 30 de chaque. Ils vivent dans `@app/shared` et le service y
  retombe ; les recopier trente fois créerait une duplication qui dériverait au
  premier ajustement de texte.

### Résidu de mon propre exercice

Rejouer la mutation de bout en bout a laissé **4 versions `ARCHIVED`** dans la base
de développement (deux passages × deux déclinaisons de STUDIES). C'est exactement
ce que fait le chemin de republication, la règle « une seule publiée par (type,
pays) » tient, et les données courantes sont justes. Noté plutôt que nettoyé : une
suppression serait une opération destructive pour un résidu inoffensif.

---

## Lot 11 — revenus (`billing`, `partners`)

### MON BRIEF ÉTAIT PLUS STRICT QUE LA SPEC, et l'agent l'a dit

Je lui avais écrit que « un plan ne donne aucune priorité d'affichage : aucun tri,
aucun boost, **nulle part** ». La règle dure du §2 est plus étroite : elle interdit
la priorité « dans l'affichage de **l'entraide, du parrainage et des guides** ». Et
§3 accorde explicitement au Premium un « profil mis en avant dans l'annuaire des
membres », au Pro une « fiche mise en avant dans sa ville ».

L'agent a donc verrouillé les trois surfaces que la spec nomme — statiquement
*et* fonctionnellement, mutations comprises — et **n'a pas** verrouillé les deux
annuaires. C'est le bon arbitrage : ma formulation aurait interdit une
fonctionnalité que la spec vend.

**À trancher :** veut-on la version stricte (aucune mise en avant payante nulle
part) ou celle de la spec ? Les deux sont défendables, et la seconde est ce qui
est livré.

### Trois façons de verrouiller une règle tenue par l'ABSENCE de code

C'est la question que je lui avais posée — « aucun encart partenaire hors étape de
parcours » est tenue par le fait que rien n'appelle `PartnersService`, et une
absence ne lève jamais. Ses trois procédés, tous éprouvés par mutation :

1. **une liste fermée que le test COMPTE.** `PLACEMENT_SECTIONS` vaut exactement
   `['HOUSING']` ; y ajouter `'FEED'` fait tomber trois tests.
2. **un test statique qui lit la source**, commentaires retirés — sans quoi la
   phrase « ce fichier ne lit jamais `users.plan` » se signalerait elle-même. Sur
   des fichiers **nommés**, parce que la spec les nomme.
3. **un test sur le SCHÉMA plutôt que sur le code**, pour les données de carte :
   une donnée qu'aucune colonne ne peut accueillir ne fuira pas, quel que soit le
   code écrit demain. Ajouter une colonne `card_last4` au schéma fait tomber le
   test.

Le troisième est le plus solide des trois, et c'est celui auquel je n'avais pas
pensé.

### Un test creux, encore — quatrième agent sur six

La mutation « `deleteMany` sur `journeys` dans `endTrials` » **passait** : le
membre de la fixture n'avait aucun parcours, donc zéro avant et zéro après. Le
test affirmait « la dégradation ne supprime aucun parcours » en ne prouvant rien.
Corrigé : la fixture crée un vrai parcours (modèle, version, étapes) et vérifie
qu'il survit **intact** — `deletedAt` nul, statut `ACTIVE` — pas seulement qu'il
existe.

### Deux pièges de colonne nullable, rencontrés dans les deux sens

* `expireSubscriptions` doit exclure les essais (`provider_ref LIKE 'trial-%'`).
  Écrit `{ not: { startsWith } }`, un abonnement **payé** dont `provider_ref` est
  NULL n'aurait **jamais expiré** — `NULL NOT LIKE …` est NULL, donc faux.
* Le filtrage pays des encarts : `(origin_country_id IS NULL OR = $1)` avec `$1` à
  NULL — un membre sans pays d'origine — aurait écarté **aussi** les placements
  génériques, c'est-à-dire le cas courant.

### Un index unique qui ne protège rien

`partner_placements` porte
`UNIQUE (step_definition_id, origin_country_id, destination_country_id)`. En
PostgreSQL, `NULLS DISTINCT` est le défaut : **deux placements génériques sur la
même étape entrent en base**, et le générique est précisément le cas courant. Le
conflit est donc appliqué dans le service sous verrou consultatif, et un test
écrit *directement en base* démontre la faille. Correctif propre :
`NULLS NOT DISTINCT` (PG 15+) ou un index partiel sur `COALESCE`. **Non migré.**

### `@SignedWebhook()` — une décision à valider

Un webhook est une écriture **sans membre**. Aucune capacité de la matrice §7.3
ne lui va, et le test de couverture exige un `x-capability` sur toute route non-GET.
D'où une sentinelle, sur le modèle de `none:public-read` :
`x-capability: none:signed-webhook`. **L'autorisation est la signature**, et le
garde d'authentification n'a pas été modifié.

Sans secret configuré, `UnconfiguredWebhookVerifier` **refuse tout** et le
journalise. C'est le bon défaut : un `{ ok: true }` « en attendant » aurait fait
de `/v1/webhooks/stripe` une activation de Premium ouverte à qui connaît l'URL.

`main.ts` reçoit `rawBody: true` — une signature porte sur des **octets**, et
recalculer `JSON.stringify(req.body)` donne un ordre de clés différent de celui du
fournisseur, donc une vérification toujours fausse, qu'on finit par désactiver.

### Six colonnes annoncées par §6 qui n'existent pas

`subscriptions.{is_trial,trial_ends_at,grace_until,period}`,
`payments.exchange_rate`, `partners.transparency_text`,
`users.hide_partners_override`. Contournements notables :

* un **essai** est une ligne d'abonnement dont `provider_ref` commence par
  `trial-`, et son `provider` vaut `MOBILE_MONEY` — pis-aller assumé, l'enum n'ayant
  pas « aucun ». MOBILE_MONEY plutôt que STRIPE parce qu'aucun chemin de code
  n'appelle un fournisseur pour ce canal : un essai marqué STRIPE aurait fini par
  déclencher une annulation chez Stripe avec une référence inventée. **Effet de
  bord à connaître :** les essais apparaissent dans
  `GET /admin/billing/subscriptions?provider=MOBILE_MONEY`, d'où un filtre
  `trialsOnly` pour les isoler ;
* la **période** (mensuel/annuel) n'est pas mirrorée localement : à l'activation
  elle est **déduite du montant** (rapport ×10, donc sans ambiguïté sauf si le prix
  change entre le paiement et le webhook) ;
* `payments.exchange_rate` est inutile : la parité EUR/XOF est **fixe** (655,957),
  donc une constante, pas une donnée.

### Une obligation comptable impossible en base

§11 exige des lignes de paiement « conservées anonymisées (obligation comptable) »
et des factures gardées dix ans. `subscriptions.user_id` et `payments.user_id` sont
**NOT NULL en CASCADE** : la ligne disparaît avec le membre. La suppression fait la
seule chose possible — couper l'abonnement chez le fournisseur avant. La
conservation comptable demande le stockage séparé que §11 prévoit par ailleurs.

### `users.plan` est écrit dans la transaction, pas par l'événement

Écart assumé avec le §9 (« consommateur : users (plan) ») : passer par l'outbox
laissait environ une seconde où l'abonnement est `ACTIVE` et le plan encore `FREE`
— un membre qui vient de payer se faisait refuser son second parcours.
`recomputeUserPlan` **recalcule** depuis les abonnements plutôt que de poser une
valeur, donc reste idempotent et rejouable.

### `level_refresh_required` n'est écrit ni lu par personne

Aucune implémentation de `TOKEN_STALE` dans le garde. L'agent a donc **renoncé** à
le poser lors d'un changement de plan : ce serait un câblage mort. Conséquence à
connaître : le `plan` du jeton peut être périmé jusqu'à quinze minutes. **Les
quotas ne sont pas touchés** — les quatre modules qui en lisent un lisent
`users.plan` en base, mis à jour dans la même transaction. C'est un trou du
module 01, et il reste ouvert.

---

## Les modales du fil — « fenêtre sur web, feuille sur mobile »

C'est la maquette elle-même qui l'écrit, sous chacune de ses quatre planches
(A01C commentaires, A01P partage, A01G lier un guide, A01S créer un sondage). Et
elle **dessine les deux formes** : fenêtre centrée de 720 px sur ordinateur,
feuille du bas avec sa poignée sur mobile. Il n'y avait donc rien à inventer —
seulement à transcoder, puis à brancher ce qu'une image ne peut pas contenir.

### Ce que le transcodeur a appris à faire

Quatre adaptations, et **aucune** ne touche au dessin :

1. **le fond fantôme tombe.** La maquette esquisse l'écran sous-jacent à
   `opacity:.5` pour que la planche se lise seule ; dans l'application, ce qu'il y
   a derrière est le vrai écran. Deux des huit cadres n'en ont pas, donc l'absence
   est licite : c'est le COMPTE qui est rapporté, jamais une exception.
2. **`position: absolute` → `fixed`, sur les enfants DIRECTS seulement.** Dans la
   maquette le voile et le panneau se calent sur le cadre de 1440 px ; dans
   l'application une modale couvre la fenêtre. Le panneau contient des dizaines de
   `position: absolute` internes qui sont du design et ne doivent pas bouger — un
   remplacement par expression régulière sur tout le fragment les aurait tous
   touchés, et le décalage ne se serait vu qu'à l'œil.
3. **le voile et le panneau sont MARQUÉS** (`data-modal-overlay`,
   `data-modal-panel`). Le composant a besoin de savoir lequel est lequel : un clic
   sur le voile ferme, un clic dans le panneau non. Le lui faire deviner dans le
   DOM — « le dernier enfant », « celui qui a un fond blanc » — serait une règle
   fragile écrite loin de la maquette.
4. **les fermetures deviennent de vrais boutons.** La croix sur ordinateur, la
   poignée sur mobile. La maquette les dessine en `<span>`, comme tous ses
   contrôles ; sans promotion, la seule façon de fermer serait Échap et le voile,
   et aucun des deux n'est atteignable au clavier depuis l'intérieur du panneau.

### Trois défauts que ce chantier a révélés, et qui auraient été livrés

* **L'adaptation « le contenu doit couler » est FAUSSE dans une modale.** Elle
  retire `flex: 1` et `min-height: 0` pour qu'une page défile — juste pour un écran
  plein, nuisible pour un panneau, qui est borné **par dessein** (`top: 40px;
  bottom: 40px`). Sans eux, le corps débordait du panneau et se dessinait
  par-dessus le voile : la modale paraissait cassée alors que le transcodage était
  fidèle. Les modales ont donc leur propre table d'adaptation, qui garde les bornes
  et fait défiler **dedans**.
* **Trois panneaux sur quatre se centrent sur les DEUX axes** (`translate(-50%,-50%)`),
  seul celui des commentaires sur un seul. Ma première image-clé écrivait
  `transform: translateY(8px) translateX(-50%)` — elle aurait écrasé le centrage
  pendant toute l'animation : trois panneaux partaient un demi-écran trop bas et
  sautaient en place à la fin. Corrigé en animant la propriété `translate`, qui se
  **compose** avec `transform` au lieu de le remplacer. L'animation n'a ainsi rien
  à savoir du centrage de chaque panneau.
* **La poignée de la feuille mesure 40 × 5 px** — une cible tactile de cinq pixels,
  et c'est le **seul** contrôle de la feuille mobile. La barre visible reste au
  pixel près ; la zone cliquable passe à 88 × 25 par du remplissage, avec
  `box-sizing: content-box` et `background-clip: content-box` pour que la pastille
  grise ne s'étale pas sur tout le remplissage.

### Un seul cadre rendu, contrairement aux écrans

`ScreenFrames` rend les deux cadres et en masque un, parce que Next rend côté
serveur et ignore la largeur de la fenêtre. Une modale **n'existe qu'après une
action**, donc jamais dans le rendu du serveur : choisir en JavaScript est ici sans
danger, et c'est nécessaire — les deux cadres portent le **même** identifiant de
titre (`a01c-titre`), et deux fois le même `id` rend `aria-labelledby` ambigu. La
boîte de dialogue aurait pris le nom du cadre masqué.

### Un titre promu en `<h2>`, pas en `<h1>`

Le `<h1>` appartient à l'écran qui est derrière, et il ne disparaît pas parce
qu'une fenêtre s'ouvre par-dessus. Ce qu'il faut, c'est un élément à désigner par
`aria-labelledby`. Les quatre titres sont **déclarés** dans le transcodeur, texte
visible compris : les quatre modales ne les dessinent pas de la même façon, et un
motif de style qui couvrirait les quatre attraperait aussi des sous-titres, en
silence. `margin: 0` est ajouté — un `<h2>` arrive avec des marges de navigateur
que le `<span>` n'avait pas, et changer la balise aurait déplacé le titre.

### Le mouvement consomme enfin `motion.js`

`packages/config/motion.js` existait depuis le lot 0 et **rien ne le lisait** — le
garde-fou `check-motion.mjs` annonçait « 0 durées vérifiées ». Il en vérifie
maintenant cinq. Les trois mouvements employés sont exactement ceux que le fichier
prévoit : `overlayIn` (180 ms linéaire, un fondu), `modalIn` (180 ms, huit pixels
de montée), `sheetIn` (220 ms, toute la hauteur). Le ciblage passe par les
attributs que le transcodeur pose, donc **rien n'est ajouté aux fichiers générés**.

### Ce qui reste, et qui est dit plutôt que fait

* **A01G et A01S sont transcodées mais inatteignables.** Ce sont des pièces jointes
  du composeur — lier un guide, créer un sondage — et les brancher demande l'état
  du brouillon, pas seulement un interrupteur d'ouverture.
* **Toutes les publications partagent la même fenêtre de commentaires.** La maquette
  ne fournit qu'un jeu de commentaires ; inventer un fil par publication serait
  inventer de la donnée. À brancher sur l'API au lot 3.
* **Le glissement vers le bas pour refermer la feuille** n'est pas fait. La poignée
  l'annonce visuellement ; elle est opérable au clic et au clavier, pas au geste.

---

## Reliquat du lot 1 — et la chaîne de défauts qu'il a dénouée

Cinq défauts qui s'enchaînent, et dont chacun rendait le suivant invisible. C'est
l'exercice de la séquence entière qui les a sortis, jamais la relecture.

### 1. Un membre s'inscrivant avec un numéro français restait bloqué en L1 À JAMAIS

`phone_numbers.is_destination` était câblé à **`false`** pour tous les comptes
créés. C'est la condition du niveau L2. Un membre qui s'inscrivait directement avec
un numéro français n'y accédait donc jamais — logement, parrainage et annuaire pro
fermés, **sans message**, et **sans recours** : §2.5 refuse d'ajouter un numéro déjà
lié à un compte, en l'occurrence le sien. Corrigé : la colonne est déduite du pays
du numéro.

### 2. `level_refresh_required` était écrit et lu par personne

Le drapeau était remis à zéro par `refresh()` et **aucun garde ne le lisait**. Un
membre passé L1 restait un quart d'heure sans pouvoir publier ; et surtout, un
membre **rétrogradé gardait un quart d'heure ses droits L1**.

C'est le même motif que `@RateLimit` : une métadonnée posée, jamais lue, et une
protection qu'on croit avoir. Deux occurrences en deux jours dans le même socle.

### 3. Le remède au n° 2 ouvrait lui-même une fenêtre

`/auth/refresh` remet le drapeau à `false` pour la session — et l'**ancien** jeton
d'accès, encore valide un quart d'heure, redevenait alors acceptable **avec son
ancien niveau**. Sur une rétrogradation L1 → L0, c'est une élévation de privilège
de quinze minutes **créée par la correction**.

Fermée par la comparaison `claims.level` ≠ base, gratuite puisque la session est
déjà lue. C'est le « second tour » que j'avais signalé dans le brief, et il
n'apparaît qu'en éprouvant la séquence complète : poser le drapeau, rafraîchir,
réessayer avec l'ancien jeton.

### 4. Un mineur annulait sa propre désactivation en deux écrans

Le webhook KYC désactive et révoque les sessions ; §2.8 promet « réactivation par
simple connexion OTP » ; le mineur relançait l'inscription, tombait sur son numéro
connu, et revenait. **Même faille pour un banni** — 13 §4.2 écrit
`status = DEACTIVATED` sur un bannissement, donc un banni est indistinguable d'un
désactivé si l'on ne regarde que `users.status`.

Fermé en lisant la seule source qui porte la distinction :
`kyc_verifications.is_adult = false` et une `sanctions type BAN` non levée.

### 5. La purge des comptes désactivés supprimait les bannis — et LIBÉRAIT leur numéro

La suppression vide `phone_numbers`, donc l'empreinte HMAC — **seule contrainte
d'unicité qui empêche la réinscription** — redevenait libre six mois après la
sanction. Vérifié en base : après purge d'un compte ordinaire,
`count(phone_numbers) = 0`.

### 6. `POST /auth/logout` ne tuait que le rafraîchissement

« Sessions révoquées immédiatement » (§2.8, 13 §4.2) voulait dire « dans un quart
d'heure » : un compte désactivé, suspendu ou en cours de suppression gardait tous
ses droits d'écriture le temps de son jeton d'accès. Corrigé — et la distinction
qui compte est que `revoked_at` est une preuve **positive** : l'absence de ligne
n'en est pas une.

### Un compte suspendu ne pouvait pas quitter la plateforme

§7.3 lui retire toute écriture, y compris `POST /me/deletion` — donc une
plateforme qui garde ses données contre sa volonté, ce qui n'est pas une sanction
mais une rétention (RGPD art. 17). `@AllowSuspended()` posé sur cette seule route,
et une règle vérifie que l'exemption **ne s'élargit pas**.

### `banned_phone_hashes` : exactement ce qui est couvert, et ce qui ne l'est pas

13 §4.2 exige la table mot pour mot. Elle n'est pas dans les 106. L'agent a
délimité la couverture réelle plutôt que de l'affirmer :

* **couvert** — tant que le compte banni existe, `phone_numbers.phone_hmac` reste
  pris ; une réinscription retombe sur le compte banni et est refusée ;
* **couvert** — la purge à six mois exclut les bannissements non levés, donc elle
  ne libère jamais le numéro d'un banni ;
* **NON couvert, et non couvrable sans migration** — si le compte banni est un jour
  **supprimé** (droit à l'effacement, ou la « suppression immédiate » de 15 §3.2),
  `phone_numbers` est vidée et l'empreinte redevient libre : le banni se réinscrit
  avec le même téléphone. Aucune table présente ne peut porter l'empreinte après
  l'effacement.

C'est un arbitrage **RGPD contre modération**, et il demande une décision : soit
`banned_phone_hashes`, soit une colonne `sanctions.phone_hmac`. En attendant, la
route « suppression immédiate » de 15 §3.2 n'est **pas livrée** — la livrer
créerait ce trou à la demande d'un opérateur.

### Deux contradictions tranchées, et une route délibérément absente

1. **`POST /me/deactivate` « confirmation par OTP »** contre l'enum figé :
   `otp_challenges.purpose` n'a **aucune valeur** pour une désactivation.
   Réemployer `DELETE_ACCOUNT` ferait qu'un code demandé « pour supprimer »
   désactive — exactement le brouillage que le contrôle du `purpose` existe pour
   empêcher. Arbitrage : **pas d'OTP sur la désactivation**, qui est entièrement
   réversible par une connexion ; la suppression, elle, l'exige.
2. **`DELETE /me/deletion`** contre « sessions révoquées immédiatement » : les deux
   ne peuvent être vraies ensemble — après la demande le membre n'a plus de session,
   donc la route est inatteignable, et s'il se reconnecte par OTP cette connexion a
   **déjà** annulé la demande. La route n'est **pas livrée**, et aucune méthode
   d'annulation morte n'existe : une route qui ne peut répondre que 401 ou 409 ferait
   croire au front qu'il tient un bouton « Annuler ».

### Deux fois la mutation lui a appris que son test ne prouvait rien

* la suite « approbation → `TOKEN_STALE` » restait verte quand on retirait le
  drapeau du garde, **parce que la comparaison de niveau la couvrait aussi**. Il a
  fallu un cas où jeton et base concordent et où seul le drapeau parle ;
* la prise d'idempotence de la suppression n'est pas exerçable en séquentiel — au
  second appel la sélection ne trouve plus rien. Il a fallu un test **concurrent**.

Et une leçon de méthode : l'annulation d'une demande est défendue par **deux**
couches ; casser une seule laisse l'autre attraper, donc la mutation ne mesurerait
que la redondance. Elle porte sur les deux.

### `@SignedWebhook` — deux agents, la même invention

Le lot 11 et le lot 1 ont proposé indépendamment le même décorateur, avec deux
formes : une sentinelle `none:signed-webhook`, ou `webhook:<fournisseur>`. Les deux
sont fusionnées, et c'est la seconde forme qui l'emporte pour la capacité : marquer
un webhook `none:public-read` satisferait le test de couverture **en mentant** sur
la nature de la route, et l'on chercherait ensuite pourquoi une « lecture
publique » accepte des POST. La métadonnée énumérable du lot 11 est gardée, pour
qu'on puisse compter ces routes sans lire les contrôleurs.

---

## Trois défauts de tests trouvés en fusionnant, et ce qu'ils enseignent

### 1. Mon garde-fou d'hier a attrapé la fusion d'aujourd'hui

`metadata-consumed.test.ts` — écrit le matin contre la classe de défaut de
`@RateLimit` — a signalé, dès la fusion suivante, une clé `app:signedWebhook`
posée par le décorateur de webhook et **lue par personne**. Deux agents l'avaient
proposée « pour pouvoir énumérer ces routes ».

Elle est retirée. Le `x-capability: webhook:<fournisseur>` fait déjà ce travail : il
est dans l'OpenAPI, il nomme le fournisseur, et le test de couverture l'énumère
désormais **dans une liste fermée** — une route de webhook de plus fait rougir le
test, donc oblige quelqu'un à venir dire pourquoi elle en est une. Deux marqueurs
pour un seul fait, c'est un fait qui finit par diverger.

### 2. Un test qui dépendait du VOLUME de données étrangères

Le test « la combinaison de deux filtres » de la file de modération lisait **une
seule page de 50**. La file est globale : le jour où la suite a dépassé cinquante
dossiers `GUIDE` non assignés — parce que d'autres modules en créent — il a rougi
sans qu'une ligne de code métier ait changé.

Et les **deux** directions étaient fausses, en sens contraire : le dossier attendu
pouvait manquer parce qu'il était en page 2 (échec à tort), et les dossiers
interdits pouvaient être absents pour la même raison — **succès à tort**, ce qui est
de loin le plus dangereux des deux.

Corrigé en parcourant tout l'ensemble filtré au curseur, et surtout en ajoutant
l'assertion qui ne dépend d'aucun volume : **aucune ligne rendue ne viole l'un des
deux filtres**.

### 3. Le même test était CREUX dans une dimension depuis le début

En le réécrivant, la mutation a montré que retirer le filtre « non assigné » le
laissait **vert**. La cause est instructive : la requête portait un troisième
filtre, `status: 'OPEN'`, et `assignCase` passe le dossier en `IN_REVIEW`. Le
dossier « bon type mais assigné » était donc écarté par le filtre de **statut**,
jamais par celui d'assignation.

Le test affirmait éprouver « non assigné × type » et n'éprouvait que
« statut × type ». Trois filtres pour deux règles, et c'est le troisième qui
répondait à la place du premier. Corrigé en n'employant **que** les deux filtres que
le test nomme ; les deux mutations le tuent maintenant, chacune en nommant le sien.

La leçon vaut au-delà de ce test : **un filtre de plus dans une requête de test est
un filtre qui peut répondre à la place de celui qu'on croit éprouver.**

### Et un aveu de méthode

J'ai commité le reliquat du lot 1 avec un test unitaire **rouge** : ma commande
enchaînait le commit sur un `grep` réussi, pas sur le code de sortie de la suite.
Le `grep` trouvait bien des lignes — dont celle de l'échec. Corrigé en séparant les
étapes et en lisant `$?`. C'est exactement le genre de raccourci qui fait dire
« tout est vert » sans que rien ne l'ait vérifié.

---

## Les modales éprouvées au navigateur, et ce que les mutations ont dit

14 tests Playwright sur les modales, et la suite complète du front à **103/103** —
sur une machine saine. Ce que les mutations ont appris :

| Mutation | Résultat |
|---|---|
| `aria-labelledby` retiré de `Modal` | **2 tests tombent** — le nom accessible et « Partager ouvre SA fenêtre » |
| piège au clavier désarmé | **1 tombe** — Tab sort du panneau |
| largeur du panneau 720 → 600 px | **1 tombe** — la géométrie mesure bien |
| `position: fixed` → `absolute` dans le fichier généré | **rien ne tombe** |

La dernière ligne est la plus instructive, et je l'ai écrite dans le transcodeur
plutôt que de la taire : l'enveloppe de `Modal` est déjà `position: fixed;
inset: 0`, donc un enfant `absolute` s'y cale et couvre exactement la même
surface. Mon commentaire affirmait que l'adaptation était *nécessaire* ; elle ne
l'est pas dans ce chemin-là. Elle reste, parce qu'elle rend le panneau juste même
rendu **sans** cette enveloppe — dans `ScreenFrames`, dont le conteneur est
`position: relative`, un panneau `absolute` serait enfermé dans le cadre. C'est
une ceinture en plus de la bretelle, et **aucun test ne distingue les deux
aujourd'hui**.

## Une dépendance implicite entre deux suites

Deux tests d'inscription échouaient sur
`locator.selectOption: Test timeout` — et le message de Playwright ne nommait pas
la cause. Le détail qui l'a donnée :

```
locator resolved to <select aria-label="Indicatif du pays"></select>
```

Le `<select>` est **vide**. Ses options viennent de `/places/countries`, donc de
l'API — que `playwright.config.ts` ne démarrait pas. La suite du front passait
donc sur les machines où une API de développement tournait déjà, et échouait
ailleurs sans dire pourquoi. Et comme le `<select>` est superposé en
`opacity: 0`, sans option il n'a aucune taille : Playwright dit « waiting for
element to be visible and enabled », ce qui envoie chercher un problème de CSS.

L'API est désormais **déclarée** dans `webServer`, aux côtés de Next. Vérifié :
API debout, les dix tests d'inscription passent en 2,1 s.

## Un rappel utile sur les échecs qui ne veulent rien dire

Une relance ultérieure a donné onze échecs éparpillés dans cinq fichiers sans
rapport — dont `ERR_NETWORK_IO_SUSPENDED` et treize dépassements de délai. La
cause n'était pas le code : `uptime` annonçait une **charge moyenne de 49** sur
une machine redémarrée trente minutes plus tôt, Docker Desktop encore en train de
s'initialiser. La même suite, même code, passait 103/103 une demi-heure avant.

C'est la troisième fois aujourd'hui qu'un rouge vient de la machine et non du
code (les deux autres : le hachage scrypt à 5 002 ms, et la file de modération
qui dépassait cinquante lignes). À chaque fois, la bonne question n'est pas
« qu'ai-je cassé » mais « qu'est-ce qui a changé **autour** ».

---

## DÉCISION DU PORTEUR — « un banni ne peut pas se réinscrire »

Tranchée le 28 septembre 2026, **contre l'état du schéma** : la table
`banned_phone_hashes` que 13 §4.2 exige mot pour mot n'existait pas, et le gel des
106 tables l'interdisait. Elle est migrée
(`20260928055334_banned_phone_hashes`), et la règle est désormais tenue.

### Ce qui manquait exactement, et rien d'autre

La règle tenait déjà à moitié, et il fallait délimiter laquelle :

* **le compte banni existe encore** → `phone_numbers.phone_hmac` est unique, une
  réinscription retombe sur lui, et `resumeAccount` refuse. Déjà couvert.
* **le compte banni est SUPPRIMÉ** — droit à l'effacement, ou la « suppression
  immédiate » de 15 §3.2 → la cascade vide `phone_numbers`, l'empreinte redevient
  libre, et le banni revient avec le même téléphone. **C'était le trou**, vérifié en
  base avant d'écrire quoi que ce soit.

### Une table sans aucune référence au membre

C'est ce qui lui permet de survivre à sa suppression, et c'est aussi ce qui la rend
défendable : elle ne contient rien qui désigne une personne, seulement une empreinte
à clé secrète qu'on ne peut pas inverser et qu'on ne peut interroger qu'en
connaissant déjà le numéro. **Un numéro entré à l'inscription est comparé, jamais
retrouvé.**

Ce que cela coûte, et qu'il faut assumer : une empreinte de numéro reste une donnée
personnelle pseudonymisée, conservée sans limite de durée pour empêcher le
contournement d'une sanction. C'est un intérêt légitime — la protection des autres
membres — et c'est ce que §11 demande (« un banni supprimé reste banni »).

### Il n'existait AUCUN chemin pour lever un bannissement

`liftedAt` n'était posé que par l'expiration automatique des suspensions, et
`ModerationActionType` n'a pas de valeur pour une levée. Une liste noire sans remède
serait indéfendable : d'où `POST /admin/users/:id/unban`, **SUPER_ADMIN seul** — 15
§2.2 réserve « bannir définitivement » au SUPER_ADMIN, et lever est la même décision
prise à l'envers ; un modérateur qui pourrait débannir contournerait le pouvoir qu'il
n'a pas.

Elle donne au passage son **producteur** à `moderation.user_reinstated`, que 13 §7
déclare et que les notifications consomment depuis le début sans que personne ne
l'émette.

La liste noire est vidée **par `sanction_id`**, et non par les numéros du membre :
c'est ce qui permet de lever un bannissement dont le compte a été supprimé, puisque
les lignes de `phone_numbers` ont disparu et que la liste noire, elle, ne porte
aucune référence.

### Le refus d'inscription dit la même chose que le refus de connexion

Même code, même message. Deux refus distincts diraient à qui tâtonne si le compte a
été supprimé ou non, et cela ne regarde personne.

### Trois mutations, trois maillons indépendants

| Mutation | Résultat |
|---|---|
| le bannissement n'écrit plus la liste noire | **3 tests tombent** |
| l'inscription ne consulte plus la liste noire | **1 tombe** — le cas du compte supprimé |
| la levée ne vide plus la liste noire | **1 tombe** |

Que M2 et M3 n'en tuent **qu'un chacune** est le point : l'écriture, la lecture et
l'effacement sont couverts séparément, donc aucun ne se cache derrière un autre.

### Deux défauts de mes propres tests, trouvés en les exécutant

1. **L'empreinte porte sur l'E.164.** Ma fixture stockait celle du format national
   (`06…` au lieu de `+336…`) : les deux hachages différaient, la liste noire ne
   correspondait jamais, et le test échouait **en accusant le code** alors que
   c'était lui qui mesurait la mauvaise chose. Toute fixture qui écrit un
   `phone_hmac` à la main doit passer par l'E.164 — le test d'administration a le
   même motif et ne s'en aperçoit pas, parce qu'il ne croise jamais le chemin d'OTP.
2. **Supprimer un dossier de modération est interdit.** La cascade atteint
   `moderation_actions`, en ajout seul, et le déclencheur refuse `DELETE`. Les six
   tests passaient et le FICHIER était rouge, sur une erreur levée dans le
   nettoyage — un cas où l'on cherche le défaut dans le code éprouvé.

### Un test qui a changé de sens

`moderation.int.test.ts` **affirmait que la table n'existait pas**, pour documenter
le trou. Il affirme maintenant qu'elle existe et que le bannissement l'alimente. Un
garde-fou qui signale un manque doit signaler aussi qu'il est comblé — sinon il
devient un mensonge au premier correctif.

---

## Villes du Bénin et du Togo, et le CRUD des référentiels (02 §4.2)

Deux demandes du porteur, tranchées le 28 septembre 2026.

### `kind` portait DEUX sens, et c'est ce qui a mordu

Ma première réponse à « intègre les villes du Togo et du Bénin » a été de passer ces
deux pays en `BOTH`, puisque 02 §2.2 écrit qu'« une ville appartient à un pays
`DESTINATION` ou `BOTH` ». **Six tests sont tombés, dans quatre fichiers**, et la
raison mérite d'être gardée :

`countries.kind` décide de deux choses à la fois —

* d'où viennent les membres, et où l'on modélise des villes ;
* quel numéro de téléphone prouve une **présence dans le pays de destination**, via
  `phone_numbers.is_destination`. C'est la condition du niveau **L2** (01 §2.5).

Passer le Bénin en `BOTH` faisait donc passer en L2 tout membre muni d'un numéro
béninois : logement, parrainage et annuaire pro ouverts à quelqu'un qui n'est pas
encore arrivé. La décision ne portait que sur les villes.

**On a donc relâché la règle des VILLES** — un pays `ORIGIN` peut avoir des villes —
**et laissé intacte celle qui décide d'un NIVEAU.** Deux règles distinctes valent
mieux qu'une colonne qui en porte deux. Ce qu'on perd : plus rien n'empêche de créer
une ville sous un pays où le produit n'ira jamais. C'est un contrôle de saisie, pas
une règle dure, et l'écran d'administration est le bon endroit pour le rendre.

### 22 villes, et une liste qui ne prétend pas être un annuaire

Douze chefs-lieux et grandes villes du Bénin (départements), dix du Togo (régions).
Coordonnées du centre-ville saisies à la main, comme §2.2 le prescrit — pas de
géocodage, aucune position individuelle n'est collectée. **La liste est celle des
villes principales**, et en ajouter une n'exige plus de toucher le fichier de
départ : c'est à cela que sert le CRUD livré avec elles. Une donnée de départ doit
démarrer le produit, pas prétendre le compléter.

### Le geste du jour du lancement a enfin un bouton

`POST /v1/admin/ref/cities/:id/activate` — c'était **le blocage le plus concret du
projet**. §2.2 dit qu'une ville « passe active quand l'équipe le décide » et qu'« à
l'activation : création du `community` CITY, les membres déjà rattachés y sont
inscrits par événement ». Aucune route ne le faisait, et le commentaire
d'`ensureAutoCommunity` le disait déjà : l'événement `city.activated` « que personne
n'émet encore ».

Trois effets, dans cet ordre, et l'ordre compte : le drapeau et sa trace dans une
transaction ; puis le réseau, parce qu'`ensureAutoCommunity` **lit**
`cities.is_active` et refuserait avant ; puis l'événement, dont le consommateur
inscrit les membres — ce qui peut concerner des centaines de personnes et n'a aucune
raison de tenir une transaction d'administration.

Éprouvé pour de vrai, sur l'API : sans session `401`, avec une session
`CONTENT_ADMIN` le Togo s'ouvre, son réseau de pays est créé, la trace et
l'événement sont écrits.

### Vingt routes, et ce qui est délibérément absent

CRUD des cinq référentiels, activation d'un pays et d'une ville, désactivation,
fusion, import CSV. Trois choix à connaître :

* **la fusion exige le SLUG tapé à la main.** Elle est irréversible (§2.2) ; un
  booléen `confirm: true` aurait la force d'un bouton, c'est-à-dire aucune. Taper le
  slug est la seule confirmation qu'on ne donne pas par réflexe.
* **l'import VALIDE sans écrire par défaut** (`apply: false`), et refuse ligne par
  ligne en disant pourquoi. Importer est le genre d'opération qu'on lance une fois
  sur un fichier qu'on n'a pas relu.
* **refermer une ville GARDE son réseau.** Une ville qu'on referme le temps de
  corriger ses données doit pouvoir rouvrir sans que ses membres aient perdu leurs
  sujets et leurs annonces.

`languages` n'a **pas** de colonne `is_active`, alors que §2.3 l'exige pour les trois
listes. La liste le DIT (`meta.deactivatable: false`) au lieu de faire semblant de
filtrer. Non migré.

### Trois tests qui épinglaient une DONNÉE au lieu d'une RÈGLE

C'est la leçon de cette séance, et elle s'est répétée trois fois :

1. « seuls les pays actifs sont exposés » affirmait « le Togo est chargé mais
   inactif : il ne doit pas sortir ». Il compare maintenant la liste exposée à celle
   des pays actifs **en base** — et vérifie qu'elle n'est pas vide, sans quoi
   l'égalité passerait pour la pire des raisons.
2. « refuse un indicatif de pays fermé » employait `TG` comme exemple de pays fermé.
   Il demande maintenant à la base lequel l'est.
3. **Mon propre test** a pollué la base : il prenait un pays inactif au hasard, le
   passait en `BOTH`, puis le restaurait en `'ORIGIN'` — une valeur **devinée**. Il
   est tombé sur le Togo et a écrasé le réglage du seed ; le test suivant échouait
   en accusant l'import. Une donnée de référence partagée se restaure à ce qu'elle
   **était**, jamais à ce qu'on croit qu'elle était.

Un test qui nomme une donnée pour illustrer une règle se casse à la première
décision produit — et l'on finit par le corriger sans le lire.

### Trois mutations

| Mutation | Résultat |
|---|---|
| l'activation ne crée plus le réseau | **2 tests tombent** |
| l'activation n'émet plus l'événement | **1 tombe** |
| l'inscription INSCRIT au lieu de RECALCULER | **1 tombe** — le rejeu |

La troisième est la plus utile : un consommateur d'événement est rejoué, et une
boucle d'inscriptions créerait un doublon au second passage. `syncAutoMemberships`
recalcule, donc il ne fait rien la seconde fois.
