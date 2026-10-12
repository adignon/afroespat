import type { Prisma } from '@app/db';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QU'UN LECTEUR VOIT D'UN FIL DE COMMENTAIRES — UN SEUL CRITÈRE          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `comments` est POLYMORPHE (04 §2.5) : publications, sujets, guides,
 * événements. La LISTE d'un fil vit dans `FeedService.commentPage`, mais le
 * COMPTEUR affiché à côté du mot « COMMENTAIRES » est rendu par le module du
 * contenu — `GET /guides/:slug` pour un guide.
 *
 * LES DEUX DOIVENT LIRE LA MÊME CHOSE. Un compteur qui ne compte pas ce que la
 * liste affiche est un mensonge à l'écran : « 12 commentaires », puis un fil qui
 * en montre neuf, et un membre qui cherche les trois autres. Le critère est donc
 * ici, dans un seul endroit, plutôt que recopié dans chaque module qui compte.
 *
 * ── LES QUATRE CONDITIONS, ET D'OÙ ELLES VIENNENT ─────────────────────────
 *
 *   · `deletedAt: null` et `status: 'PUBLISHED'` — un commentaire supprimé ou
 *     retenu par la modération n'est ni listé ni compté TEL QUEL. Depuis ce lot,
 *     celui que la MODÉRATION a masqué laisse un emplacement : voir
 *     `commentModeratedWhere` plus bas, qui est l'autre moitié du critère ;
 *   · l'auteur n'est pas SÉPARÉ du lecteur (08 §4, dans les deux sens : bloquer
 *     et être bloqué donnent le même silence) ;
 *   · l'auteur est vivant et son compte est `ACTIVE` ou `SUSPENDED` — un compte
 *     supprimé emporte ses commentaires hors des fils.
 *
 * `notIn` SEUL sur `authorUserId`, et c'est un CONSTAT et non un choix : la forme
 * tolérante au NULL — `OR: [{ authorUserId: null }, { authorUserId: { notIn } }]`
 * — est REFUSÉE par les types générés, parce que `comments.author_user_id` est
 * NOT NULL. 04 §8 demande pourtant de l'annuler à la suppression d'un compte
 * (« conservés, anonymisés, `author_user_id = null` ») : la règle est aujourd'hui
 * inapplicable, et le jour où la colonne deviendra nullable, c'est ICI qu'il
 * faudra repasser — sinon un lecteur avec UN seul blocage perdra tous les
 * commentaires anonymisés, sans que rien ne l'explique.
 *
 * ── POURQUOI UNE FONCTION PURE, ET PAS UN SERVICE ─────────────────────────
 *
 * Elle prend les identifiants séparés DÉJÀ RÉSOLUS (`VisibilityService.
 * separatedFrom`) au lieu d'aller les chercher : l'appelant les a souvent déjà
 * en main pour sa propre requête, et une seconde lecture des blocages par
 * compteur ferait payer deux fois la même table. Elle reste donc testable sans
 * base, et sans injection.
 */
export function commentVisibilityWhere(
  separated: readonly string[],
): Prisma.CommentWhereInput[] {
  return [{ deletedAt: null }, { status: 'PUBLISHED' }, ...authorWhere(separated)];
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUI DEVIENT UN EMPLACEMENT « RETIRÉ », ET CE QUI RESTE SANS TRACE       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « fais le reste aussi » — la troisième carte de la colonne
 * « ÉTATS » de A01C (`docs/template/03 Accueil v2.dc.html`, ligne 283) dessine un
 * bloc gris : « Ce commentaire a été retiré par la modération. »
 *
 * C'EST UN CHANGEMENT DE PRODUIT, et il faut le dire : jusqu'ici un commentaire
 * retiré disparaissait sans trace ; désormais le lecteur voit qu'il y avait
 * quelque chose là. Le périmètre de ce que ça révèle est donc tracé ICI, dans la
 * requête, et non dans l'écran — un écran qui filtrerait aurait déjà reçu ce
 * qu'il ne doit pas montrer.
 *
 * ── UNE SEULE SIGNATURE, ET ELLE EST MESURÉE ────────────────────────────────
 *
 * `status: 'HIDDEN'` AVEC `deletedAt: null`. Ce n'est pas un choix de confort :
 * c'est l'empreinte EXACTE que `moderation.hide` laisse, relevée dans
 * `FeedService.handleContentHidden` (l'abonné à `moderation.content_hidden`) —
 * `comment.updateMany({ data: { status: 'HIDDEN' } })`, et rien d'autre. Les trois autres façons de disparaître ont une
 * empreinte DIFFÉRENTE, et chacune reste invisible pour une raison propre :
 *
 *   · LA SUPPRESSION PAR L'AUTEUR écrit `deletedAt` ET `status: 'REMOVED'`
 *     (`FeedService.deleteComment`). Elle ne laisse PAS d'emplacement : la seule
 *     phrase que la maquette dessine dit « retiré par la modération », et
 *     l'afficher sur une retractation affirmerait une sanction qui n'a pas eu
 *     lieu. Un membre qui retire son mot demande qu'il disparaisse, pas qu'un
 *     rectangle gris annonce qu'il a parlé ;
 *   · LE COMPTE SUPPRIMÉ (`author.deletedAt`) relève de l'effacement de §8.
 *     Semer des emplacements sur tout le fil en défairait la moitié ;
 *   · LE BLOCAGE est une RÈGLE DURE (08 §4 : « 404 et jamais 403 », « révéler
 *     qu'un contenu existe mais est inaccessible en dit déjà trop »). C'est le
 *     cas le plus dangereux des trois, parce qu'il est RÉVERSIBLE et CIBLÉ : deux
 *     lecteurs du même fil verraient un nombre d'emplacements différent, et celui
 *     qui en voit un de plus saurait qu'une personne existe et le bloque. Le fil
 *     deviendrait un détecteur de blocage. `authorWhere` est donc appliqué ICI
 *     AUSSI, à l'identique — c'est la raison d'être du partage.
 *
 * ⚠ `status: 'REMOVED'` SANS `deletedAt` N'EST ATTEINT PAR AUCUN CHEMIN
 * AUJOURD'HUI, et n'est donc pas couvert : aucun service n'écrit cette
 * combinaison (vérifié, les trois seules écritures de `comments.status` sont
 * `createComment`, `deleteComment` et `handleContentHidden`). Le jour où un
 * outil d'équipe retirerait un commentaire autrement, il ne laisserait pas
 * d'emplacement et il faudra repasser ici — plutôt que d'élargir maintenant à une
 * forme que personne ne produit, ce qui rendrait le critère impossible à relire.
 */
export function commentModeratedWhere(
  separated: readonly string[],
): Prisma.CommentWhereInput[] {
  return [{ deletedAt: null }, { status: 'HIDDEN' }, ...authorWhere(separated)];
}

/**
 * TOUT CE QUI OCCUPE UNE LIGNE DU FIL : les commentaires lisibles, PLUS les
 * emplacements retirés.
 *
 * C'est la clause de la LISTE et celle du COMPTEUR, et c'est exactement pourquoi
 * elle existe sous ce nom : un emplacement est une ligne rendue, donc il compte.
 * « 3 COMMENTAIRES » au-dessus de quatre lignes est le mensonge que ce fichier
 * existe pour empêcher, et il n'a pas moins de valeur quand la quatrième ligne est
 * grise. Même raisonnement que `chargerH02` côté écran, qui compte les réponses
 * d'une demande d'entraide sur la LONGUEUR DE LA LISTE RENDUE et jamais sur le
 * compteur dénormalisé.
 *
 * Elle n'est PAS l'union naïve des deux fonctions ci-dessus : `AND`-er deux
 * listes de clauses donnerait `status = PUBLISHED AND status = HIDDEN`,
 * c'est-à-dire la liste vide. Le `in` est donc écrit ici, une fois.
 */
export function commentRowWhere(separated: readonly string[]): Prisma.CommentWhereInput[] {
  return [
    { deletedAt: null },
    { status: { in: ['PUBLISHED' as const, 'HIDDEN' as const] } },
    ...authorWhere(separated),
  ];
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA CLAUSE DU COMPTEUR — EXACTEMENT LES LIGNES QUE LA LISTE REND            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `commentRowWhere` dit ce qui est LISIBLE OU RETIRÉ ; elle ne dit pas ce qui est
 * RENDU, et la différence est une ligne du fil : une RÉPONSE dont la racine
 * n'apparaît pas n'est jamais affichée. `FeedService.commentPage` ne va chercher
 * les réponses que sous les racines qu'il a retenues — c'est structurel, pas une
 * option — donc une réponse orpheline n'atteint aucun écran.
 *
 * Le compteur, lui, n'a pas de racines sous la main : il compte à plat, les deux
 * profondeurs ensemble (voir `GuidesService.countComments`, qui écrit pourquoi).
 * Sans cette clause il comptait donc des lignes que personne ne voit, et c'était
 * déjà vrai AVANT les emplacements : une réponse sous une racine supprimée, ou
 * sous une racine dont l'auteur est bloqué, était comptée et jamais montrée.
 * MESURÉ comme un écart latent ; ce lot le ferme parce qu'il l'aurait élargi.
 *
 * ── DEUX CAS, ET LA RAISON DE CHACUN ────────────────────────────────────────
 *
 *   · `parentCommentId: null` — une RACINE compte toujours, lisible ou retirée.
 *     L'emplacement gris occupe une ligne ; le compteur doit la compter, sinon
 *     « 3 COMMENTAIRES » coifferait quatre lignes, ce qui est le mensonge exact
 *     que ce fichier existe pour empêcher ;
 *   · sinon, la racine doit passer `commentVisibilityWhere` — PUBLISHED, auteur
 *     vivant et non séparé. Une racine RETIRÉE ne suffit pas : ses réponses
 *     restent invisibles, parce qu'une réponse paraphrase souvent ce qu'elle
 *     répond et qu'elle laisserait reconstituer par déduction le texte que le
 *     retrait a ôté (voir `FeedService.commentPage`).
 */
export function commentCountWhere(separated: readonly string[]): Prisma.CommentWhereInput[] {
  return [
    ...commentRowWhere(separated),
    {
      OR: [
        { parentCommentId: null },
        { parentComment: { AND: commentVisibilityWhere(separated) } },
      ],
    },
  ];
}

/**
 * Les deux conditions qui portent sur L'AUTEUR, partagées par les trois clauses.
 *
 * Les recopier aurait été le défaut à ne pas commettre : la condition de blocage
 * doit valoir pour l'emplacement comme pour le commentaire, et un jour où l'une
 * des copies aurait été mise à jour sans l'autre, les emplacements auraient fui.
 */
function authorWhere(separated: readonly string[]): Prisma.CommentWhereInput[] {
  return [
    ...(separated.length === 0 ? [] : [{ authorUserId: { notIn: [...separated] } }]),
    { author: { deletedAt: null, status: { in: ['ACTIVE' as const, 'SUSPENDED' as const] } } },
  ];
}
