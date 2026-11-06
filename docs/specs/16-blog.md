# 16 — Blog (proposition, non implémentée)

> **Statut : PROPOSITION À ARBITRER.** La maquette `docs/template/Blog.dc.html` n'est pas implémentée et ce document ne change aucun code. Il analyse la maquette, propose un modèle, une API, des routes et un éditeur, et **isole les décisions que le porteur doit trancher** (repérées par **[DÉCISION Bn]**, récapitulées au §12).
> Dépend de : `00`, `01` (consentements), `05` (guides — le blog ne les remplace pas), `13` (modération), `15` (administration), `11-12` (notifications, e-mail).

---

## 1. Ce que dessine la maquette

Un fichier, une page vivante à routage par ancre (`#/`, `#/categorie/:cat`, `#/article/:id`, `#/auteur/:id`), trois vues et deux fenêtres.

| Vue / bloc | Contenu |
|---|---|
| **En-tête** | Logo, navigation par catégorie (5 entrées visibles ≥ 1 180 px : Tous, Témoignages, Démarches, Logement, Communauté), champ de recherche, bouton d'inscription. Barre de progression de lecture sous l'en-tête d'un article. |
| **Liste** (`/`, `/categorie/:cat`) | Titre + sous-titre (« Histoires et conseils pour bien s'installer »), **puces de catégorie avec compteur**, champ de recherche (« N résultats pour « … » », bouton d'effacement), **article à la une** (sans recherche), grille de cartes (6 puis « Voir plus · N restants »), **encart « Les plus lus »** (4, rang 01–04), **inscription à la newsletter**, état vide, pied de page avec catégories. |
| **Article** (`/article/:id`) | Catégorie (lien), titre, extrait, **auteur** (photo, nom, rôle, lien vers sa page), date, temps de lecture, image de couverture avec **crédit photo**, introduction, **sections** (`h`, `p`, option `quote` + `quoteBy`, option `cta` = bouton vers une page produit), **sommaire** (3+ entrées, section active surlignée au défilement), **partage** (4 cibles + copie du lien avec toast), **étiquettes**, **« Utile » + compteur**, **commentaires** (liste + compteur ; écrire demande un compte), **bloc auteur** (bio), **articles liés** (3, même catégorie d'abord), **newsletter**. |
| **Auteur** (`/auteur/:id`) | Photo, nom, rôle, bio, nombre d'articles, total des « utile », grille de ses articles. |
| **Fenêtre d'inscription** | E-mail + envoi (le produit s'inscrit par téléphone : à remplacer par le renvoi vers `/connexion`, comme sur la landing). |
| **Newsletter** | Champ e-mail, validation de forme, trois états : repos, erreur (« adresse invalide »), confirmé. |

### 1.1 Éléments dynamiques (ce qui doit venir de la base)

Catégories (libellé, couleurs de pastille) · articles (titre, extrait, intro, sections structurées, image + crédit, date, temps de lecture, étiquettes, « à la une ») · auteurs (nom, rôle, photo, bio) · compteurs « utile » et commentaires · classement « les plus lus » · articles liés · recherche plein texte · pagination « Voir plus » · inscription newsletter.

### 1.2 Ce que la maquette contient et qu'il ne faut PAS reprendre

- **Des personnes et des chiffres inventés** (« Amina Diallo », « 38 membres », « plus de 400 guides », « 214 utiles ») : la règle du produit est qu'aucun chiffre ni aucune personne n'est affiché s'il n'est pas vrai (voir la landing). Toute donnée vient de la base ; un compteur sous seuil disparaît.
- **Un auteur « Rédaction Diasporyplus »** : voir **[DÉCISION B1]**.
- **Des photos Unsplash en lien externe** : la politique de sécurité n'autorise aucune image externe (voir `tools/fetch-landing-images.mjs`). Les couvertures sont des médias hébergés (§3).
- **Le routage par ancre** (`#/article/…`) : remplacé par de vraies routes indexables (§5).

---

## 2. Cadre produit et décisions amont

**[DÉCISION B1 — Qui écrit ?]** `05 §1` pose : « **Aucune rédaction interne** : l'équipe modère, elle n'écrit pas. » La maquette montre pourtant un auteur « Rédaction ». Trois options :

1. **Éditorial d'équipe** (recommandé si le blog sert l'acquisition/SEO) : l'équipe peut publier des articles signés « DiasporyPlus ». C'est une **exception explicite** à `05 §1`, limitée au blog (les guides restent écrits par les membres). Il faut alors le dire dans les CGU / mentions légales (éditeur de publication, LCEN).
2. **Blog de membres seulement** : les articles sont des **témoignages et conseils de membres** (invités, relus par l'équipe). Aucune exception à `05`. Charge de modération plus lourde, rythme moins prévisible.
3. **Mixte** : articles de membres (option 2) + quelques articles d'équipe marqués comme tels.

La suite suppose l'option 3 (la plus souple) ; le modèle (`author_kind`) permet les trois.

**[DÉCISION B2 — Pourquoi un blog ?]** Acquisition (SEO, partage) → il faut des pages publiques indexables, un sitemap, des données structurées. Rétention → la newsletter. Le blog n'est pas la fonction « guides » (communautaire, versionnée, vérifiée) : il ne doit pas la concurrencer. Règle proposée : un article **renvoie** vers les guides concernés et n'en reprend pas le contenu.

**[DÉCISION B3 — Témoignages]** Un article de type « témoignage » cite un membre : mêmes conditions que `13.3` (consentement `quotable` du membre, retrait possible, relecture). Le retrait d'une citation dépublie ou anonymise le passage.

---

## 3. Modèle de données proposé

> Préfixe `blog_`. Toutes les tables suivent le socle commun (`id` UUID, `created_at`, `updated_at`, `deleted_at`).

| Table | Colonnes principales | Notes |
|---|---|---|
| `blog_categories` | `slug` (unique), `name`, `description`, `sort_order`, `tone` (clé de palette), `is_active` | Remplace la table `CATS` en dur. Gérée depuis l'admin (référentiel). |
| `blog_authors` | `slug` (unique), `kind` (`MEMBER` \| `TEAM`), `user_id` (nul si `TEAM`), `display_name`, `role_label`, `bio`, `avatar_asset_id` | **[B4]** Un auteur-membre pointe vers `users` (nom public = `short_name` ; anonymisé à la suppression du compte, comme les guides). Un auteur d'équipe est un profil éditorial sans compte. |
| `blog_posts` | `slug` (unique, jamais modifié après publication), `category_id`, `author_id`, `title`, `excerpt`, `intro`, `cover_asset_id`, `cover_alt`, `cover_credit`, `cover_credit_url`, `status` (`DRAFT` \| `IN_REVIEW` \| `SCHEDULED` \| `PUBLISHED` \| `ARCHIVED`), `published_at`, `scheduled_for`, `featured_at` (nul = pas à la une), `reading_minutes` (calculé), `seo_title`, `seo_description`, `og_asset_id`, `helpful_count`, `comment_count`, `view_count` | `reading_minutes` calculé à 200 mots/min, comme les guides. Une seule publication « à la une » à la fois. |
| `blog_post_sections` | `post_id`, `position`, `kind` (`TEXT` \| `QUOTE` \| `CTA` \| `IMAGE`), `heading`, `body` (Markdown restreint), `quote_by`, `cta_label`, `cta_target` (chemin interne uniquement), `image_asset_id`, `image_alt` | Reprend la structure `{h, p, quote, quoteBy, cta}` de la maquette. Le sommaire se déduit des `heading`. |
| `blog_tags`, `blog_post_tags` | `slug`, `name` ; table de liaison | Étiquettes libres, normalisées (minuscules, sans accents pour le slug). |
| `blog_post_revisions` | `post_id`, `version`, `snapshot` (JSON), `edited_by_staff_id`/`edited_by_user_id`, `changelog` | Historique des modifications ; la page publique porte « Mis à jour le … ». |
| `blog_post_votes` | `post_id`, `user_id`, unique | « Utile » (un par membre), même mécanique que `guide_votes`. |
| `blog_comments` | `post_id`, `author_user_id`, `parent_id`, `body`, `status` | **[B5]** Voir §8. Réutiliser le moteur de commentaires de `04` si possible plutôt qu'une table dédiée. |
| `newsletter_subscriptions` | `email` (normalisé, unique), `user_id` (nul si visiteur), `status` (`PENDING` \| `CONFIRMED` \| `UNSUBSCRIBED`), `consent_text_version`, `consented_at`, `confirmed_at`, `ip_hash`, `source`, `unsubscribe_token` | Double opt-in (§9). **[B6]** Ce n'est pas propre au blog : la table est transverse. |

Médias : nouveau `MediaKind` `BLOG` (couverture, image de section), même pipeline que `GUIDE` (octets magiques, EXIF retiré, antivirus, variantes). **Les couvertures sont hébergées**, jamais liées depuis un domaine tiers. Le texte alternatif est **obligatoire** pour toute image non décorative.

Règle dure reprise : aucun contenu de santé individuelle, aucune donnée personnelle de tiers dans un article (modération §7).

---

## 4. API

### 4.1 Publique (sans compte, `@PublicRead`, limitée par IP)

| Route | Rôle |
|---|---|
| `GET /public/blog` | Liste paginée par curseur : `?category=`, `?tag=`, `?author=`, `?q=` (≥ 2 caractères), `?cursor=`. Rend aussi `featured`, `categories` (avec compteurs), `popular` (4, fenêtre 30 jours). |
| `GET /public/blog/posts/:slug` | Article publié : sections, auteur, étiquettes, `related` (3), compteurs, `publishedAt`, `updatedAt`. 404 si non publié (jamais d'indice d'existence). |
| `GET /public/blog/authors/:slug` | Auteur + ses articles + totaux (« utile » sous seuil : nul). |
| `GET /public/blog/categories` | Catégories actives et compteurs. |
| `GET /public/blog/sitemap` | `{slug, updatedAt}` de tous les articles publiés, des catégories et des auteurs (consommé par `app/sitemap.ts`). |
| `POST /public/newsletter/subscribe` | Voir §9. Réponse **identique** que l'adresse existe déjà ou non (pas d'énumération). |
| `GET /public/newsletter/confirm?token=` · `POST /public/newsletter/unsubscribe` | Confirmation et désinscription (aussi par lien dans chaque envoi). |

Seuils comme pour la landing : un compteur (« utile », commentaires, vues) sous un minimum n'est pas affiché. « Les plus lus » n'apparaît qu'à partir d'un nombre minimal d'articles.

### 4.2 Membre

`PUT /blog/posts/:id/helpful` (voter « utile », annulable) · `POST /blog/posts/:id/comments` (si commentaires retenus, §8) · `POST /blog/posts/:id/report` (signalement → file de modération `13`). Si l'option B1.2 ou B1.3 est retenue : `POST/PATCH /blog/my-posts` (brouillon de membre invité) et soumission à relecture.

### 4.3 Administration (`/admin/blog`, capacités `blog.read`, `blog.write`, `blog.publish`, `blog.moderate`)

CRUD des articles, catégories, auteurs, étiquettes ; actions `submit-for-review`, `publish`, `schedule`, `unpublish`, `archive`, `feature` ; liste des abonnés (lecture, export, suppression RGPD) ; envoi d'une édition de newsletter (§9). Toute écriture est tracée dans le journal d'audit d'administration (`15`), comme les autres contenus éditoriaux.

---

## 5. Routes web et rendu

| Route | Rendu | Notes |
|---|---|---|
| `/blog` | Serveur, `revalidate` 300 s | Liste + à la une + populaires. Pagination par paramètre (`?page=` ou curseur), **pas** de défilement infini seul (indexabilité). |
| `/blog/categorie/[slug]` | Serveur | Même vue filtrée ; titre et description propres. |
| `/blog/[slug]` | Serveur, `generateStaticParams` + `revalidate` | **Texte complet dans le premier HTML** (comme les pages légales). Sommaire, progression, partage = îlots clients. |
| `/blog/auteur/[slug]` | Serveur | |
| `/blog/recherche?q=` | Serveur, `noindex` | La recherche n'est pas indexée. |

Mise en page : les points de rupture se font **en CSS** (pas de `window.innerWidth` : voir la correction de la landing, lot F2). La maquette est transcodée par le générateur comme la landing (`tools/generate-blog.mjs`, adaptations déclarées une à une, échec si une cible disparaît), la donnée et le comportement vivant dans `screens/blog/data.ts`.

Accessibilité : `<main>`, une seule `<h1>` (le titre de l'article), sommaire en `<nav aria-label="Sommaire">`, barre de progression décorative (`aria-hidden`), boutons de partage nommés, toast en `role="status"`, focus visible, `alt` pertinents (couverture = `cover_alt`).

---

## 6. SEO

- **Métadonnées par page** : `title` (`seo_title` sinon titre), `description` (`seo_description` sinon extrait tronqué), `alternates.canonical`, Open Graph (`type: article`, `published_time`, `modified_time`, `authors`, `tags`, image `og_asset_id` sinon couverture), Twitter `summary_large_image`.
- **Données structurées** `Article`/`BlogPosting` (titre, image, dates, auteur `Person`/`Organization`, éditeur `Organization`) et `BreadcrumbList` ; `Blog` sur `/blog`.
- **Sitemap** : `app/sitemap.ts` ajoute `/blog`, chaque catégorie, chaque auteur et chaque article publié (`lastModified` = dernière révision). Un article dépublié sort du sitemap et répond 404 (ou 410 si **[B7]** le porteur préfère signaler une suppression définitive).
- **robots** : `/blog` est autorisé (aujourd'hui `robots.ts` n'autorise que `/` et `/p/`) ; `/blog/recherche` interdit.
- **Flux** : `/blog/feed.xml` (RSS) — facultatif.
- **Slug** : généré depuis le titre, unique, **jamais modifié** après publication ; changer un titre n'en change pas l'adresse.

---

## 7. Éditeur d'administration

Dans l'administration (groupe « Contenu »), un écran « Blog » :

1. **Liste** filtrable (statut, catégorie, auteur), recherche, compteurs, indicateur « à la une ».
2. **Éditeur** : titre, slug (lecture seule après publication), catégorie, auteur, extrait (≤ 200 car.), introduction, **sections** réordonnables (texte Markdown restreint / citation / appel à l'action vers un chemin interne / image avec alt obligatoire), étiquettes, couverture (téléversement + crédit + alt), champs SEO avec **aperçu** des résultats de recherche et du partage, calcul automatique du temps de lecture.
3. **Cycle** : brouillon → relecture → programmé / publié → archivé. Publication = vérifications bloquantes (alt de la couverture, extrait, catégorie, au moins une section, aucun lien externe non `rel="noopener noreferrer"`).
4. **Historique** des révisions et retour arrière.
5. États : chargement, vide (« Aucun article »), erreur (« Réessayer »), enregistrement automatique du brouillon avec indication « Enregistré à … ».

**[DÉCISION B8 — Éditeur]** Markdown restreint dans un champ texte (cohérent avec les guides, rapide à livrer) **ou** éditeur riche (WYSIWYG : plus confortable pour une rédaction non technique, mais plus de surface de sécurité et de dépendances). Recommandation : Markdown restreint + aperçu en direct pour la première version.

---

## 8. Commentaires

La maquette affiche un compteur et une liste, et demande un compte pour écrire.

**[DÉCISION B5 — Commentaires]** Trois options : (a) **aucun commentaire** sur le blog, les discussions restent dans le fil et l'entraide (le moins de modération, recommandé au lancement) ; (b) commentaires **réservés aux membres**, réutilisant le moteur de `04` (modération existante, signalement, blocage) ; (c) commentaires ouverts aux visiteurs (déconseillé : spam, RGPD, modération). Si (b) : lecture publique des commentaires approuvés, écriture connectée, capacité `comment.write`, limites de débit identiques aux commentaires de guide.

---

## 9. Newsletter

**[DÉCISION B6 — Newsletter]** À trancher : veut-on une newsletter, et à qui ?

- **Cible** : visiteurs (formulaire du blog et de la landing) et/ou membres (préférence dans `Compte > Notifications`). Un membre qui s'abonne ne crée pas de doublon : l'abonnement se rattache à son compte.
- **Conformité** : **double opt-in** (e-mail de confirmation), texte de consentement versionné et horodaté (preuve RGPD, comme `consents`), lien de désinscription dans chaque envoi, suppression complète sur demande, **aucun traceur** dans les e-mails. La case n'est **jamais** pré-cochée (voir la décision du 2026-09-27).
- **Envoi** : à décider entre (i) l'API d'e-mail transactionnel déjà branchée, avec une tâche d'envoi par lots et limitation de débit, ou (ii) un prestataire dédié (la liste reste chez nous, l'envoi chez eux). Recommandation : (i) tant que la liste reste petite.
- **Contenu** : édition manuelle depuis l'admin (sélection d'articles) ou digest automatique des derniers articles. Recommandation : manuel au départ.
- **États du formulaire** (déjà dessinés) : repos, erreur de forme, « Presque fini : confirmez votre adresse » (et non « Inscrit » avant confirmation), erreur réseau avec « Réessayer ».
- **Anti-abus** : limite de débit par IP et par adresse, Turnstile si l'envoi de confirmations est abusé (déjà présent dans le projet), réponse identique que l'adresse existe ou non.

---

## 10. Auteurs

- **Page auteur** publique (nom public « Prénom N. » pour un membre, jamais d'e-mail ni de téléphone) ; photo hébergée, bio ≤ 400 caractères, rôle affiché (« Auteur de guides vérifiés · Paris » seulement si **vrai** et mesurable — jamais un titre décoratif).
- **Consentement** : un membre auteur accepte d'être nommé ; il peut retirer son nom (l'article reste, signé « Un membre », comme les guides d'un compte supprimé).
- **Suppression de compte** : ses articles sont anonymisés (bio et photo retirées), pas supprimés — mêmes règles que `05` pour les guides.
- **[DÉCISION B4]** Auteur d'équipe : un profil éditorial sans compte (option B1.1 ou B1.3) ou aucun.

---

## 11. États, erreurs, performances

| Situation | Comportement |
|---|---|
| Liste vide | « Aucun article pour le moment » + lien vers la landing ; pas de grille vide. |
| Recherche sans résultat | « Aucun résultat pour « … » » + effacement + suggestion des catégories. |
| Article inconnu / non publié | 404 réel (pas de page « bientôt »). |
| API indisponible | La page affiche un message et « Réessayer » ; jamais un « Chargement… » perpétuel (même règle que la landing). |
| Image absente | Fond neutre cohérent, aucune photo empruntée au hasard. |
| Newsletter | Quatre états (repos, erreur de forme, en attente de confirmation, erreur réseau). |

Performances : listes mises en cache 5 minutes côté serveur, images en `loading="lazy"` avec dimensions réservées (pas de saut de mise en page), `reading_minutes` et compteurs dénormalisés, index sur `(status, published_at desc)`, `(category_id, published_at desc)`, `slug`.

Tests à prévoir : règle « publié seulement » (jamais un brouillon dans l'API publique), slug immuable, seuils d'affichage, double opt-in (pas d'inscription sans confirmation, réponse identique pour une adresse connue), anonymisation d'un auteur supprimé, sitemap sans brouillon, métadonnées/JSON-LD par article, accessibilité des îlots clients.

---

## 12. Décisions que le porteur doit trancher

| # | Question | Recommandation |
|---|---|---|
| **B1** | Qui écrit : équipe (exception à `05 §1`), membres seulement, ou mixte ? | Mixte, avec la mention éditeur dans les mentions légales |
| **B2** | Objectif du blog (acquisition, rétention, les deux) et frontière avec les guides | Acquisition ; les articles renvoient aux guides, ne les copient pas |
| **B3** | Témoignages : consentement et retrait (aligné sur `13.3`) | Oui, mêmes règles |
| **B4** | Auteurs d'équipe sans compte autorisés ? | Oui si B1 = équipe/mixte |
| **B5** | Commentaires : aucun, membres, ou ouverts | Aucun au lancement |
| **B6** | Newsletter : oui/non, cible, prestataire d'envoi, fréquence | Oui, double opt-in, envoi manuel, e-mail transactionnel existant |
| **B7** | Article supprimé : 404 ou 410 | 404 (410 si suppression volontaire définitive) |
| **B8** | Éditeur : Markdown restreint ou riche | Markdown restreint + aperçu |
| **B9** | URL : `/blog` sous le domaine principal ou sous-domaine | Sous le domaine principal (cumule l'autorité SEO) |
| **B10** | Langues : français seul ou multilingue dès le départ | Français seul (la landing n'a qu'une langue) |
| **B11** | Publicité / liens affiliés / contenus sponsorisés dans le blog | Non au lancement ; si oui, mention « Sponsorisé » obligatoire (`14`) |

Aucune implémentation n'est lancée tant que **B1, B5 et B6** ne sont pas tranchées : ce sont elles qui conditionnent le modèle (auteurs, commentaires, table d'abonnés) et les obligations légales.
