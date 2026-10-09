import type { SearchSubjectType } from '@app/shared';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES NEUF TYPES DE CONTENU — UN MOT, UN GLYPHE, UN SEUL ENDROIT             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `GET /search` rend neuf `subjectType`. Trois endroits les affichent désormais :
 * les cartes de résultat, les filtres de la colonne de gauche, et les suggestions
 * sous le champ de la barre haute. Recopier la table trois fois, c'est se garantir
 * qu'un jour « Emploi » sera « Offre » dans l'un des trois.
 *
 * ── CE QUE LE SERVEUR REND, ET POURQUOI ON NE L'AFFICHE PAS ────────────────
 *
 * Le serveur remplit `label` depuis `SEARCH_TYPE_LABELS_FR` : « Sujets de réseau »,
 * « Professionnels ». La maquette écrit « Sujets » et « Pros ». Changer le texte
 * affiché est une décision de produit, pas de transcodage : on garde les mots
 * DESSINÉS et on les associe par le TYPE, qui est stable.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES GLYPHES — FEATHER, ET LA LIMITE DE CETTE PHRASE                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « pour les icônes sur le projet utilise Feather icons ».
 *
 * MESURÉ avant : la maquette ne dessine que QUATRE tracés de résultat — guide,
 * sujet, entraide, logement. Les cinq autres types recevaient tous le même, celui
 * du sujet : une bulle de message pour un membre, pour une ville, pour un emploi,
 * pour un événement et pour une fiche pro. Cinq types portaient donc l'icône d'un
 * sixième, ce qui est pire qu'une icône absente.
 *
 * Les cinq manquants reçoivent ici leur glyphe de FEATHER — `user`, `map-pin`,
 * `briefcase`, `calendar`, `award` — transcrits en `path` pour tenir dans le même
 * `<svg>` que les quatre autres.
 *
 * ET LES QUATRE DESSINÉS NE SONT PAS TOUCHÉS. La consigne tenue depuis le début
 * est « n'écris pas, utilise directement la maquette » : remplacer un tracé que la
 * planche dessine, c'est redessiner la planche. Ils sont d'ailleurs déjà de cette
 * grammaire — boîte de 24, trait de 1,8, bouts arrondis. La règle appliquée est
 * donc : CE QUE LE PROJET AJOUTE EST EN FEATHER ; ce que la maquette dessine reste
 * dessiné. L'écart est remonté plutôt que tranché tout seul.
 */

/** Le mot d'une pastille de carte et d'un filtre : le type AU SINGULIER. */
export const MOT_SINGULIER: Record<SearchSubjectType, string> = {
  GUIDE: 'Guide',
  TOPIC: 'Sujet',
  HELP_REQUEST: 'Entraide',
  HOUSING: 'Logement',
  JOB: 'Emploi',
  EVENT: 'Événement',
  USER: 'Membre',
  CITY: 'Ville',
  PRO: 'Pro',
};

/** Le mot d'un filtre de colonne : le type AU PLURIEL, comme la planche l'écrit. */
export const MOT_PLURIEL: Record<SearchSubjectType, string> = {
  GUIDE: 'Guides',
  TOPIC: 'Sujets',
  HELP_REQUEST: 'Entraide',
  HOUSING: 'Logement',
  JOB: 'Emploi',
  EVENT: 'Événements',
  USER: 'Membres',
  CITY: 'Villes',
  PRO: 'Pros',
};

/** Les quatre tracés que la maquette dessine, et les cinq de Feather. */
export const TRACE: Record<SearchSubjectType, string> = {
  // ── Les quatre de la planche, verbatim ──────────────────────────────────
  GUIDE:
    'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  HELP_REQUEST: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  HOUSING: 'M4 20V8l8-4 8 4v12',
  TOPIC: 'M4 5h16v11H9l-5 4z',
  // ── Les cinq de Feather, qui portaient tous celui du sujet ──────────────
  /** Feather `user`. */
  USER: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  /** Feather `map-pin`. */
  CITY: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  /** Feather `briefcase`. */
  JOB: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  /** Feather `calendar`. */
  EVENT: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  /** Feather `award`. */
  PRO: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9 7 23l5-3 5 3-1.2-9.1',
};

/** L'ordre des filtres dans la colonne : celui de la planche, puis les ajouts. */
export const ORDRE_TYPES: readonly SearchSubjectType[] = [
  'GUIDE',
  'TOPIC',
  'HELP_REQUEST',
  'HOUSING',
  'JOB',
  'EVENT',
  'USER',
  'CITY',
  'PRO',
];
