# Design system

> Référence unique pour les maquettes (Claude Design, Stitch) et le code (`packages/ui`). Quand ce document et une maquette divergent, ce document gagne.

---

## 1. Principe

Familier comme un réseau social, **plus calme**. Les membres sont souvent en situation de stress administratif : l'interface rassure, elle ne stimule pas. Codes empruntés (fil, cartes, avatars, réactions) pour supprimer la friction ; mécanique différente (publications typées, états, réputation d'utilité).

---

## 2. Jetons

### 2.1 Couleurs

| Jeton | Valeur | Usage exclusif |
|---|---|---|
| `primary` | `#16785E` | Actions principales, éléments actifs, badge de vérification, liens |
| `primary-strong` | `#0F5C48` | Rail de navigation, survol des actions, titres de section |
| `primary-soft` | `#E3F0EB` | Fond des pastilles actives, encarts d'information, fond d'étape franchie |
| `primary-alt` | `#2FA37D` | Accents légers, domaine `.com`, point de présence en ligne |
| **`journey`** | `#E0733A` | **Réservé** : étape en cours, jalon, échéance, barre de progression de parcours, badge Premium, compteur d'entraide non lue |
| `journey-soft` | `#FBE3D4` | Fond des pastilles terre cuite, encart « Alerte vigilance », bandeau de sécurité |
| `journey-strong` | `#B4581F` | Texte terre cuite sur fond clair |
| `link` | `#4B3FA8` | Liens de référence dans les contenus techniques (viewer) uniquement |
| `bg` | `#F2F4F3` | Fond de page |
| `surface` | `#FFFFFF` | Cartes, panneaux |
| `border` | `#E0E5E3` | Toutes les bordures, 1 px |
| `text` | `#16211D` | Texte principal |
| `text-muted` | `#5D6B66` | Texte secondaire, métadonnées |
| `text-subtle` | `#8A958F` | Libellés de section, horodatage |
| `success` | `#1F7A55` | État résolu, présent, validé |
| `neutral-state` | `#8A958F` | Étape en pause, archivé |

**Interdits :** tout rouge ; toute couleur hors de cette table ; le terre cuite hors des usages listés. Un lint sur les classes Tailwind bloque `journey-*` hors des composants autorisés (`JourneyProgress`, `StepCurrentCard`, `MilestoneBadge`, `DeadlineLabel`, `PremiumBadge`, `SafetyBanner`, `ScamAlert`).

**Mode sombre :** V1 en clair uniquement. Les jetons sont définis en variables CSS pour permettre un thème sombre plus tard sans toucher aux composants.

### 2.2 Typographie

| Rôle | Police | Taille | Graisse |
|---|---|---|---|
| Titre de page | Plus Jakarta Sans | 25–30 px | 800 |
| Titre de carte | Plus Jakarta Sans | 15–17 px | 700 |
| Corps | Plus Jakarta Sans | 14–15 px | 400 |
| Métadonnées | Plus Jakarta Sans | 12–12,5 px | 500 |
| Libellé de section | Plus Jakarta Sans | 11 px, majuscules, interlettrage 0,8 px | 700 |
| Pastille | Plus Jakarta Sans | 10,5–11 px, majuscules | 700 |
| Identifiants (handle, code) | Police système monospace | 12–13 px | 600 |

Interligne 1,45 pour le corps, 1,2 pour les titres. Pas de serif en V1 dans l'application (réservé au wordmark si retenu).

### 2.3 Espacement et formes

| Jeton | Valeur |
|---|---|
| Unité | 4 px |
| Padding de carte | 16–18 px |
| Espacement entre cartes | 14 px |
| Rayon boutons et pastilles | 10 px (pastilles : pleines, 11 px) |
| Rayon cartes | 14 px |
| Rayon grandes cartes et modales | 16 px |
| Avatar | cercle ; 24 / 30 / 34 / 40 / 44 px |
| Bordure | 1 px `border` ; **jamais d'ombre portée**, sauf carte en cours de déplacement et carte sélectionnée (viewer) |
| Cible tactile | 44 × 44 px minimum |

### 2.4 Icônes

Lucide, trait 1,7 px, 18–22 px. **Aucun emoji dans l'interface** (le contenu des membres peut en contenir). Les types de publication sont des pastilles texte, pas des icônes.

---

## 3. Navigation

### 3.1 Ordinateur (≥ 1024 px)

| Zone | Largeur | Contenu |
|---|---|---|
| Rail | 76 px, fixe, fond `primary-strong` | Logo · Accueil · Parcours · Entraide · Services · Agenda · (bas) réglages. Icône 22 px + libellé 9,5 px. Actif : pastille claire arrondie 13 px |
| Panneau | 264 px, fond `surface`, bordure droite | Titre de section (17–21 px), items 44 px (icône 20 px + libellé 14,5 px), badge compteur terre cuite, dépliable pour Réseaux, carte du parcours en bas du panneau Accueil |
| Barre haute | 62 px | Recherche arrondie 20 px · Créer (+) · Messages · Notifications · Avatar |
| Contenu | max 660 px | |
| Colonne droite | 300 px, masquée < 1280 px | |

**Interdit :** barre d'icônes horizontale en haut pour la navigation principale.

### 3.2 Mobile (< 1024 px)

Barre d'onglets basse 5 entrées (Accueil · Parcours · Entraide · Services · Compte), 48 px de haut + zone sûre, icône 21 px + libellé 10,5 px. Le panneau de section devient une barre d'onglets horizontale défilante sous le titre de page. Colonne droite intégrée en fin de page.

---

## 4. Composants

Chaque composant a une entrée dans `packages/ui` avec ses variantes et ses états. Liste V1 :

### 4.1 Navigation
`IconRail`, `SectionPanel`, `PanelItem`, `TopBar`, `MobileTabBar`, `JourneyPanelCard` (titre = nom du parcours, barre, étape, lien ; variante « créer »).

### 4.2 Contenu
- `PostCard` — avatar, nom + `VerifiedBadge`, `TypePill`, ligne de contexte, corps, `PostMedia`, `StepDoneInset` (jalon), compteur au vocabulaire du type, `ActionBar` (réaction du type · Commenter · Partager). États : normal, masqué (auteur), supprimé.
- `Composer` — chips de type, champ, images, Publier. Variante grisée L0 avec `LevelUpPrompt`.
- `MilestoneStrip` — vignettes persistantes, première = « Partager un jalon ». Jamais d'anneau dégradé.
- `CommentThread` — une profondeur.
- `GuideCard`, `GuideBanner` (à vérifier / signalé / maintenu par la communauté), `ProposalDiff` (avant/après).
- `HelpRequestCard` — pastilles, `FromJourneyPill` (bordure terre cuite), état résolu (fond `bg`, `ResolvedInset`).
- `TopicCard`, `PinnedTopic`, `PollCard`, `AlbumGrid`.
- `EventCard` (bloc de date), `RsvpButtons`, `CheckInButton`.
- `ListingCard` (photo, kind, prix, titre, auteur), `SafetyBanner` (terre cuite doux, permanent), `ProCard`, `FeaturedTag`.
- `MemberCard`, `MentorCard`, `MutualConnections`.

### 4.3 Parcours
`JourneyHeader` (titre, `StatusPill`, sous-titre, `JourneyProgress`), `Timeline`, `StepDone` (point plein `success`), `StepCurrentCard` (anneau terre cuite 5 px + carte bordure `#E9BC9B` : titre, EN COURS, `DeadlineLabel`, description, `LinkTile` ×2, `AvatarStack` + texte, bouton `BlockedButton` terre cuite), `StepUpcoming` (point creux, texte `text-muted`), `CollapsedDoneSteps` (« N étapes franchies »), `ChecklistItem`, `BlockerSheet` (3 volets), `ShareMilestoneSheet`, `SimilarJourneyCard`.

### 4.4 Transverses
`Button` (primary / secondary / journey / ghost / danger-neutral — pas de rouge), `Pill` (type, état, niveau), `VerifiedBadge` (L1 coche verte, L2 coche + point), `LevelUpPrompt`, `PlanLimitPrompt`, `PartnerSlot` (bordure pointillée, mention Partenaire, lien transparence), `ScamAlert`, `EmptyState` (illustration typographique, pas d'image générique), `Skeleton`, `Toast`, `Sheet` (feuille du bas sur mobile, modale centrée sur ordinateur), `Avatar`, `AvatarStack`, `DateBlock`, `SearchField`, `FilterChips`, `Tabs`, `Pagination` (bouton « Charger plus », pas de numéros).

---

## 5. États obligatoires

Tout écran de liste ou de détail implémente : **chargement** (squelettes, jamais de spinner central), **vide** (message + action), **erreur** (message + réessayer), **succès**, **permission insuffisante** (`LevelUpPrompt` ou `PlanLimitPrompt`, jamais une simple erreur), **hors ligne** (bandeau, contenu en cache si disponible).

---

## 6. Règles d'écriture visuelle

- Une seule action primaire par écran.
- Les pastilles d'état (`Ouverte`, `Résolue`, `En cours`, `En pause`) sont toujours texte + fond, jamais couleur seule.
- La date de dernière mise à jour d'un guide a la même taille que son titre de carte.
- Les compteurs suivent le vocabulaire du type (félicitations, mentions utiles, réponses).
- Photos réelles d'événements ou aucune image ; pas d'illustration générique de « diversité ».
- Contraste AA minimum ; focus visible 2 px `primary` ; tout élément interactif nommé.
