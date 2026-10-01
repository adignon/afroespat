/**
 * Les formes PARTAGÉES des écrans H01 à H10, et ce que la maquette
 * `05 Entraide.dc.html` en dit.
 *
 * ── CE FICHIER A CHANGÉ DE NATURE, ET IL FAUT SAVOIR POURQUOI ───────────────
 *
 * Il disait, et c'était exact : « IL N'Y EN A AUCUNE — ce fichier existe pour le
 * dire, pas pour combler un vide ». `05 Entraide` n'emploie pas le dialecte des
 * maquettes `01` et `03` : son `renderVals()` rend `{}`, zéro `{{ … }}`, zéro
 * `<sc-for>`, comptés. Les vingt cadres recevaient donc `_props` — ils IGNORAIENT
 * leurs données, faute d'avoir où les mettre.
 *
 * Il annonçait la suite : « quand ces écrans seront branchés sur
 * `apps/api/src/modules/help`, c'est ici que les champs arriveront, et le JSX
 * transcodé n'aura pas à bouger ». C'est ce qui vient d'arriver, et le JSX n'a PAS
 * bougé : la prise a été DÉCLARÉE dans `tools/screens/05-entraide.mjs`, sous la
 * clé `donnees`, et le générateur a produit des cadres qui lisent leurs
 * propriétés.
 *
 * ── UN TYPE PAR ÉCRAN, ET CELUI-CI NE PORTE QUE LE PARTAGÉ ──────────────────
 *
 * `H01Data` … `H10Data` vivent dans le `data.ts` DE LEUR ÉCRAN
 * (`screens/h01/data.ts` …). Un type unique partagé par les dix obligerait chaque
 * page à fournir les champs de toutes les autres : H03, qui ne lit rien de plus
 * que son bandeau, devrait inventer des parrains et des réponses.
 *
 * Ce fichier porte donc les deux formes que les dix cadres d'ordinateur dessinent
 * VRAIMENT en commun — le bandeau de section et ses compteurs — et rien d'autre.
 *
 * ── CE QUE LA MAQUETTE DÉCIDE, ET QUE CE FICHIER NE DÉCIDE PAS ──────────────
 *
 * LES COULEURS QUI SONT DES DONNÉES viennent de la maquette, relevées sur ses
 * propres planches : les trois fonds d'avatar (`#0F5C48`, `#2FA37D`, `#E0733A`)
 * que H01 et H02 dessinent, et les deux pastilles de disponibilité de H06
 * (`#E3F0EB` sur `#0F5C48` pour « Disponible »). Aucune n'est assombrie — huit
 * paires de ce projet passent sous le seuil AA, et c'est une décision assumée du
 * porteur que le garde-fou de contraste tient à 16/24.
 */

/**
 * ─── LE BANDEAU DE SECTION — les dix planches d'ordinateur dessinent le même ──
 *
 * `entraides` est le nombre d'entraides validées, et c'est TOUT ce qu'il est : un
 * nombre affiché. Aucun des compteurs de ce bandeau ne sert à décider quoi que ce
 * soit, et le niveau de vérification n'y figure même pas — la règle du socle est
 * sans exception : on tente l'action, et c'est le serveur qui répond
 * `403 LEVEL_REQUIRED`.
 */
export interface Reputation {
  /** `stats.helpValidatedCount` — « 23 entraides validées ». */
  readonly entraides: number;
  /** `stats.guideHelpfulVotes` — « 4 guides utiles ». */
  readonly guides: number;
  /** `stats.mentorshipsCompleted` — « 2 parrainages ». */
  readonly parrainages: number;
  /** `stats.eventsOrganized` — « 6 événements ». */
  readonly evenements: number;
}

/** L'identité de la barre haute : un avatar de repli et un prénom. */
export interface MoiEntraide {
  readonly initiales: string;
  readonly prenom: string;
}

/**
 * Les trois pastilles de comptage du rail.
 *
 * Chacune disparaît à zéro (`<sc-if>` dans la déclaration d'écran) : un rond
 * orange vide se lit comme un défaut de chargement, pas comme « rien à voir ».
 */
export interface CompteursEntraide {
  /** `meta.open` de `GET /help` — les demandes ouvertes de la ville. */
  readonly ouvertes: number;
  /** Le nombre d'items de `GET /help/can-help`. */
  readonly pouvezAider: number;
  /** Parrainages en cours et demandes en attente, de `GET /me/mentorships`. */
  readonly parrainages: number;
  /** `meta.resolvedThisMonth` de `GET /help`. */
  readonly resoluesCeMois: number;
}

/** Ce que les dix cadres d'ordinateur lisent, sans exception. */
export interface BandeauEntraide {
  readonly moi: MoiEntraide;
  readonly reputation: Reputation;
  readonly compteurs: CompteursEntraide;
}

/**
 * Un membre tel que l'entraide le DESSINE : des initiales, un nom, une teinte.
 *
 * `fond` est une donnée et non une constante parce que la maquette en dessine
 * TROIS — n'en garder qu'une teindrait tous les membres de la même couleur, ce qui
 * est précisément l'inverse de ce à quoi sert un avatar de repli.
 */
export interface MembreDessine {
  readonly initiales: string;
  readonly nom: string;
  readonly fond: string;
  readonly phase: string;
  readonly ville: string;
}

/**
 * ─── CE QUI N'EST PAS LIÉ, ET POURQUOI ──────────────────────────────────────
 *
 * Les quatre LISTES de ce module — le fil (H01), les suggestions (H04), mes
 * demandes (H09), mes réponses (H10) — ne sont pas liées, et ce n'est pas un
 * renoncement : c'est ce que la maquette DESSINE qui l'interdit en l'état.
 *
 * Ses trois cartes de H01 ne sont pas la même carte avec d'autres textes. Elles
 * diffèrent par leur fond (`#fff`, `#FFFBF8`, `#F6F8F7`), par leur bordure
 * (`1px solid #E6EBE9` contre `1.5px solid #E0733A`), par la couleur de leur titre,
 * par la présence d'une pastille « Depuis un parcours » et d'une ligne d'étape, et
 * surtout par leur PIED : les deux premières portent une ligne d'auteur avec son
 * bouton « Répondre », la troisième porte à la place un bandeau de résolution
 * (« Sandra M. a été marquée « ça m'a aidé » — contact créé »).
 *
 * Une fabrique honnête de cette carte demanderait une dizaine de variantes sous
 * `<sc-if>`, et chacune devrait être relevée sur la planche plutôt que choisie.
 * C'est faisable et c'est le bon travail ; ce n'est pas un travail qu'on fait à
 * moitié, parce qu'une variante oubliée ne se voit pas — elle dessine simplement
 * la mauvaise carte pour une ligne sur trois.
 *
 * H05 porte en plus un obstacle propre : chaque carte de parrain contient une
 * LISTE de pastilles de types de parcours (deux pour Aïcha, une pour Ibrahim),
 * c'est-à-dire une boucle DANS une boucle. Le transcodeur sait émettre un
 * `<sc-for>` ; rien n'a été vérifié sur un `<sc-for>` imbriqué, et le vérifier
 * fait partie du même travail.
 *
 * Les quatre listes sont donc REMONTÉES, avec ce qu'il faut pour les faire : les
 * schémas de réponse existent, les fixtures sont relevées, les routes répondent.
 */
