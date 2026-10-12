import type { BandeauEntraide } from '../entraide/data';

/**
 * H01 — le fil d'entraide (`/entraide`).
 *
 * `ville` est le NOM de la ville du membre, et il ne vient pas de `GET /me` :
 * celui-ci ne rend qu'un `cityId`. Voir `../entraide/appels.ts` pour le chemin
 * réellement emprunté, et l'écart qu'il signale.
 */
export interface H01Data extends BandeauEntraide {
  readonly ville: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES DEMANDES — ELLES ÉTAIENT TROIS CARTES ÉCRITES EN DUR                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Corrige l'entraide. »
   *
   * MESURÉ : zéro boucle dans les deux cadres de H01. « Accompagner un RDV
   * préfecture jeudi », « Un lit et une table pour l'installation »,
   * « Covoiturage Lyon → Grenoble samedi » étaient le dessin de la maquette,
   * servi à tout le monde — le même défaut que les contacts de K05.
   *
   * De `GET /help`, qui rendait déjà tout ce que la carte montre.
   */
  readonly demandes?: readonly LigneDemande[];
  /** Les six filtres de type — `helpListQuerySchema.type` les accepte. */
  readonly typesDemande?: readonly FiltreTypeDemande[];
  /**
   * Les cinq pastilles de PORTÉE de la rangée défilante du cadre de 390 px. Voir
   * `PorteeFil` pour les deux natures qu'elles mêlent, et pourquoi.
   *
   * Le cadre de 1440 px ne les dessine PAS : il dessine les mêmes entrées dans
   * son panneau de gauche, en liens, et ils marchaient déjà. Une donnée bornée à
   * un cadre n'est pas une anomalie ici — c'est la planche qui en décide.
   */
  readonly portees?: readonly PorteeFil[];
  /**
   * L'état vide, quand il y en a un — `null` dès qu'une carte s'affiche. Les
   * DEUX cadres le portent : le porteur veut chaque correction sur les deux
   * planches.
   */
  readonly vide?: EtatVide | null;
}

/**
 * Une demande du fil, dans l'une des TROIS variantes que la maquette dessine.
 *
 * Ce qui change de couleur est une donnée, ce qui apparaît ou disparaît est un
 * booléen : la carte ordinaire, celle issue d'un parcours (fond crème, trait
 * terre cuite, pastille et ligne d'étape en plus) et la résolue (grisée, sans
 * bouton, avec l'encart « ça m'a aidé »).
 */
export interface LigneDemande {
  readonly fond: string;
  readonly trait: string;
  readonly deParcours: boolean;
  readonly categorie: string;
  readonly categorieFond: string;
  readonly categorieEncre: string;
  /** « Résolue » — vide tant que la demande est ouverte. */
  readonly etat: string;
  readonly delai: string;
  /** « Étape 7 · Logement » — vide hors parcours. */
  readonly etape: string;
  readonly titre: string;
  readonly titreCouleur: string;
  readonly extrait: string;
  readonly href: string;
  /** Le pied — auteur et « Répondre » — ne se dessine que sur une demande ouverte. */
  readonly ouverte: boolean;
  readonly auteur: string;
  readonly auteurInitiales: string;
  readonly auteurFond: string;
  readonly auteurPhase: string;
  readonly reponses: string;
  readonly boutonFond: string;
  /** L'encart vert d'une demande close. Vide tant qu'elle est ouverte. */
  readonly resolution: string;
}

export interface FiltreTypeDemande {
  /** `'*'` pour « Tout », sinon un `HelpRequestType`. */
  readonly cle: string;
  readonly libelle: string;
  readonly fond: string;
  readonly texte: string;
  readonly bord: string;
  readonly actif: boolean;
  readonly onChoisir: () => void;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UN FILTRE QUI NE FILTRE RIEN DOIT S'ÉTEINDRE, PAS RESTER ALLUMÉ          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ au schéma, pas supposé : `helpCanHelpQuerySchema` n'accepte que
   * `limit` et `radiusKm`. `GET /help/can-help` N'A PAS de paramètre `type` —
   * sa liste est calculée depuis les types d'aide déclarés au profil et les
   * étapes franchies, pas interrogée par type.
   *
   * Dès que la portée « Vous pouvez aider » est choisie, cette rangée ne peut
   * donc plus rien filtrer. Trois sorties étaient possibles, et le choix est
   * écrit en entier dans `filtresType` : elle est ÉTEINTE — `desactive: true`,
   * aucune pastille allumée — et ni masquée ni appliquée sur la page reçue.
   */
  readonly desactive: boolean;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ LA PORTÉE DU FIL — CINQ PASTILLES QUI NE RÉPONDAIENT À RIEN              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, devant la rangée défilante du cadre de 390 px : « Intègre donc. »
 *
 * MESURÉ avant : les cinq pastilles — « Toutes · N », « Vous pouvez aider · N »,
 * « Mes demandes », « Mes réponses », « Parrainage » — étaient des `<span>`
 * statiques. Les deux COMPTEURS, eux, étaient déjà réels (`meta.open` de
 * `GET /help` et la longueur de `GET /help/can-help`) : c'était le CLIC qui
 * n'existait pas. Un nombre juste sous un contrôle mort est le pire des deux
 * états — il donne à croire que la pastille fonctionne.
 *
 * ── DEUX NATURES DE PASTILLE, ET UN SEUL DESSIN ──────────────────────────────
 *
 * La maquette les dessine toutes les cinq à l'identique, et elles ne font pas la
 * même chose :
 *
 *   · « Toutes » et « Vous pouvez aider » changent LA LISTE SANS QUITTER LA PAGE.
 *     Ce sont deux ROUTES D'API différentes — `GET /help` et `GET /help/can-help` —
 *     pas deux tris d'une même réponse. Elles portent donc une PRISE
 *     (`onChoisir`), et leur état se dit par `aria-pressed` : c'est une bascule,
 *     et un `<button>` est la seule balise qui puisse l'annoncer ;
 *   · « Mes demandes », « Mes réponses » et « Parrainage » sont des ADRESSES —
 *     exactement les trois que le panneau de gauche du cadre de 1440 px porte
 *     déjà en liens qui marchent (`/entraide/mes-demandes`,
 *     `/entraide/mes-reponses`, `/parrainage`). Elles portent donc un `href`, et
 *     un `<a>` : un bouton qui appellerait `router.push` perdrait le clic milieu,
 *     l'ouverture dans un onglet et l'aperçu de la destination.
 *
 * `href: null` EST LE DISCRIMINANT, et c'est un choix de TYPE, pas de style : le
 * cadre généré écrit `p.href === null ? <button …> : <a …>`, et TypeScript ne
 * laisse lire `onChoisir` que dans la branche où il existe. Un booléen
 * `estUnLien` n'aurait rien garanti — on pourrait oublier le `href`.
 */
interface PorteeCommune {
  /** `toutes` · `aider` · `mes-demandes` · `mes-reponses` · `parrainage`. */
  readonly cle: string;
  /** « Toutes · 41 » : le compteur est DANS le libellé, comme la maquette l'écrit. */
  readonly libelle: string;
  readonly fond: string;
  readonly texte: string;
  readonly bord: string;
  readonly actif: boolean;
}

/** Une pastille qui change la liste sur place. */
export interface PorteeBasculee extends PorteeCommune {
  readonly href: null;
  readonly onChoisir: () => void;
}

/** Une pastille qui mène ailleurs. */
export interface PorteeLiee extends PorteeCommune {
  readonly href: string;
  readonly onChoisir: null;
}

export type PorteeFil = PorteeBasculee | PorteeLiee;

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAT VIDE — ET SURTOUT CELUI QUI N'EST PAS « IL N'Y A RIEN À FAIRE »   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * `GET /help/can-help` rend une liste VIDE avec `meta.reason = 'NO_CRITERIA'`
 * quand le membre n'a déclaré AUCUN type d'aide à son profil et franchi AUCUNE
 * étape. Le service dit pourquoi il ne replie pas sur « toutes les demandes » :
 * « Renvoyer "toutes les demandes" serait la pire réponse — l'encadré perdrait
 * son sens et son taux de réponse. » Il a raison, et la conséquence à l'écran
 * est un fil vide pour une raison qui n'est PAS « il n'y a rien à faire » mais
 * « nous ne savons pas encore ce que vous savez faire ».
 *
 * Laisser un fil vide inexpliqué devant ce membre lui apprend exactement le
 * contraire de ce qu'il faut faire : il conclurait que la ville est calme, et
 * n'irait jamais remplir son profil.
 *
 * ── LE DESSIN EST CELUI DE LA MAQUETTE, PAS UN ÉTAT INVENTÉ ─────────────────
 *
 * `docs/template/05 Entraide.dc.html` dessine un état VIDE, dans la colonne
 * « ÉTATS » que H01 range à côté de ses deux cadres : un titre de 14 px en 700,
 * une phrase de 12,5 px en `#5D6B66`, et une pastille verte `#16785E`. Trois
 * champs, donc, et PAS un de plus — c'est ce que la planche dessine, et la
 * pastille devient un vrai lien (la maquette l'écrit en `<div>`, comme elle
 * écrivait les sept entrées du panneau).
 *
 * Les TEXTES, eux, sont composés dans `entraide/appels.ts` : la maquette n'écrit
 * qu'un des quatre cas (« Aucune demande ouverte à Lyon »), et les trois autres
 * se déduisent de la portée et de `meta.reason`. C'est une DONNÉE, pas du dessin
 * ajouté — voir l'en-tête de `videDuFil`.
 */
export interface EtatVide {
  readonly titre: string;
  readonly phrase: string;
  /** Le libellé de la pastille verte. */
  readonly lien: string;
  readonly href: string;
}
