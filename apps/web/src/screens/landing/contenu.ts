/**
 * Le TEXTE de la page d'accueil que la maquette écrit en dur (rubriques, étapes, questions) et les petites fonctions
 * pures qui mettent en forme ce que l'API rend. Aucune donnée de membre ici : les chiffres, les événements, les
 * villes et les citations viennent de `GET /public/landing` (voir `data.ts`).
 */

export interface Categorie {
  readonly t: string;
  readonly color: string;
  readonly bg: string;
  readonly d: string;
  readonly offset: string;
}

export const CATEGORIES: readonly Categorie[] = [
  { t: 'Logement', color: '#16785E', bg: '#E3F0EB', d: 'M4 11 12 4l8 7v9H4z', offset: '0px' },
  { t: 'Études', color: '#E0733A', bg: '#FBE3D4', d: 'M2 9 12 4l10 5-10 5zM6 11v5c3 2 9 2 12 0v-5', offset: '12px' },
  { t: 'Travail', color: '#0F5C48', bg: '#E8EEEC', d: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', offset: '0px' },
  { t: 'Démarches et titres', color: '#B4581F', bg: '#FBE3D4', d: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5', offset: '12px' },
  { t: 'Santé', color: '#2FA37D', bg: '#E3F0EB', d: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', offset: '0px' },
  { t: 'Famille', color: '#E0733A', bg: '#FBE3D4', d: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5', offset: '12px' },
  { t: 'Produits du pays', color: '#16785E', bg: '#E3F0EB', d: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2', offset: '0px' },
];

export const POINTS_PARCOURS = [
  { t: 'Des échéances réalistes', s: 'Calculées à rebours depuis votre date d’arrivée, avec des rappels.', d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { t: 'Les bons guides au bon moment', s: 'Chaque étape propose les guides et annonces utiles de votre ville.', d: 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z' },
  { t: 'Un bouton « Je suis bloqué·e »', s: 'Votre équipe et la communauté sont prévenues, sans rien publier sans votre accord.', d: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
] as const;

/** Les trois étapes de « Comment ça marche » ; `wide` décide de leur disposition (voir `data.ts`). */
export const ETAPES = [
  { t: 'Créez votre parcours', p: 'Études, travail, famille : vos étapes, vos échéances, les guides utiles au bon moment.', cta: 'Commencer', d: 'M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10', bg: '#E3F0EB', fg: '#16785E' },
  { t: 'Trouvez votre communauté', p: 'Réseaux par pays et par ville, fil d’entraide, rencontres près de chez vous.', cta: 'Explorer les réseaux', d: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5', bg: '#FBE3D4', fg: '#E0733A' },
  { t: 'Aidez le suivant', p: 'Une fois installé·e, devenez parrain, écrivez un guide ou partagez votre budget réel.', cta: 'Devenir parrain', d: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', bg: '#E8EEEC', fg: '#0F5C48' },
] as const;

/** Tout est gratuit : la question de la gratuité ne parle plus de « Premium ». */
export const QUESTIONS: readonly (readonly [string, string])[] = [
  ['L’inscription est-elle vraiment gratuite ?', 'Oui. Le parcours, le fil, les réseaux, l’entraide et les guides sont gratuits.'],
  ['Puis-je m’inscrire avant mon départ ?', 'C’est même conseillé : la plupart des membres créent leur parcours depuis leur pays, quelques mois avant l’arrivée, pour préparer visa, logement et banque.'],
  ['Qui écrit les guides ?', 'Des membres installés. Chaque guide peut être corrigé par la communauté, et les auteurs sont prévenus quand une règle change.'],
  ['Comment fonctionne le parrainage ?', 'Vous demandez un parrain dans votre ville. Un membre vérifié vous accompagne pendant vos premiers mois, à votre rythme.'],
  ['Mes informations sont-elles visibles ?', 'Votre parcours est privé par défaut. Vous choisissez ce que vous partagez, et vous pouvez tout masquer à tout moment.'],
];

/** Le libellé du type d'événement (l'étiquette de la carte). */
const TYPES_EVENEMENT: Readonly<Record<string, string>> = {
  PICNIC: 'Pique-nique',
  SPORT: 'Sport',
  CV_WORKSHOP: 'Atelier CV',
  COOKING: 'Cuisine',
  NETWORKING: 'Réseautage',
  OUTING: 'Sortie',
  CONFERENCE: 'Conférence',
  OTHER: 'Rencontre',
};
export const libelleTypeEvenement = (type: string): string => TYPES_EVENEMENT[type] ?? 'Rencontre';

const CATEGORIES_GUIDE: Readonly<Record<string, string>> = {
  PRE_DEPARTURE: 'Avant le départ',
  ARRIVAL: 'Arrivée',
  HOUSING: 'Logement',
  DAILY_LIFE: 'Vie quotidienne',
  WORK_STUDIES: 'Travail et études',
  SCAM_ALERTS: 'Alertes arnaques',
};
export const libelleCategorieGuide = (c: string): string => CATEGORIES_GUIDE[c] ?? 'Guide';

/** « jeu. 6 nov. · 18 h 30 », à l'heure de Paris. */
export function dateEvenement(iso: string): string {
  const d = new Date(iso);
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(d);
  const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    .format(d)
    .replace(':', ' h ');
  return `${jour} · ${heure}`;
}

/** « 12 mars 2026 », à l'heure de Paris. */
export const dateLongue = (iso: string): string =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso));

const PALETTE = ['#16785E', '#E0733A', '#0F5C48', '#B4581F', '#2FA37D'] as const;

/** Un rond d'initiales, en image intégrée : aucune photo de personne n'est inventée ni empruntée. */
export function avatarInitiales(nom: string, indice = 0): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const initiales = (mots.length > 1 ? `${mots[0]?.charAt(0) ?? ''}${mots[mots.length - 1]?.charAt(0) ?? ''}` : (mots[0] ?? '?').slice(0, 2)).toUpperCase();
  const fond = PALETTE[Math.abs(indice) % PALETTE.length] ?? '#16785E';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${fond}"/><text x="48" y="48" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="38" font-weight="700" fill="#fff">${initiales}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Un fond dégradé pour une couverture sans photo. */
export function couverture(indice = 0): string {
  const a = PALETTE[Math.abs(indice) % PALETTE.length] ?? '#16785E';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#16211D"/></linearGradient></defs><rect width="1200" height="480" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Le visuel de repli d'une ville sans photo : un dégradé vert sombre teinté d'après son identifiant (stable d'un rendu à
 * l'autre, identique côté serveur et côté navigateur), des collines discrètes et son monogramme. Un SVG, sans requête.
 */
export function visuelVille(slug: string, nom: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % 360;
  const teinte = 140 + (h % 70); // vert → bleu-vert : reste dans la charte
  const lettre = (nom.trim().charAt(0) || '?').toUpperCase().replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="625" viewBox="0 0 1000 625" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${String(teinte)},55%,30%)"/><stop offset="1" stop-color="#16211D"/></linearGradient></defs><rect width="1000" height="625" fill="url(#g)"/><path d="M0 470 Q250 380 500 450 T1000 420 V625 H0Z" fill="#fff" fill-opacity=".07"/><path d="M0 540 Q300 470 600 530 T1000 510 V625 H0Z" fill="#fff" fill-opacity=".08"/><text x="500" y="270" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="220" font-weight="800" fill="#fff" fill-opacity=".22">${lettre}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Un guide en Markdown → des sections `{ h, p }` pour la lecture libre. Pas de rendu riche : du texte, lisible. */
export function sectionsDeMarkdown(body: string): { h: string; p: string }[] {
  const nettoyer = (t: string): string =>
    t
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|\*|_|`)/g, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .trim();
  const sections: { h: string; p: string }[] = [];
  let titre = '';
  let paragraphe: string[] = [];
  const clore = () => {
    const p = nettoyer(paragraphe.join('\n'));
    if (titre !== '' || p !== '') sections.push({ h: titre, p });
    paragraphe = [];
  };
  for (const ligne of body.split(/\r?\n/)) {
    const m = /^#{1,3}\s+(.*)$/.exec(ligne);
    if (m !== null) {
      clore();
      titre = nettoyer(m[1] ?? '');
    } else {
      paragraphe.push(ligne);
    }
  }
  clore();
  return sections.filter((s) => s.h !== '' || s.p !== '');
}

/** Le temps de lecture, à 200 mots par minute, au moins une minute. */
export const minutesDeLecture = (body: string): number => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
