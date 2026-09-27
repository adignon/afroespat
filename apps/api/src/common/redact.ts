/**
 * Masquage des données personnelles avant analyse par l'IA — 13-moderation.md §2.
 *
 * RÈGLE DURE : « Le texte envoyé à l'API IA est toujours passé par
 * redactForModeration. Un test vérifie qu'un numéro de téléphone et un email ne
 * quittent pas le serveur. »
 *
 * Trois catégories sont masquées (§8.2) : numéros de téléphone, adresses email,
 * noms propres détectés. Remplacés par `[TEL]`, `[EMAIL]`, `[NOM]`.
 *
 * Le masquage est volontairement AGRESSIF : un faux positif dégrade un peu la
 * qualité de l'analyse, un faux négatif envoie la donnée d'un membre à un
 * sous-traitant hors UE. Le déséquilibre entre les deux coûts dicte le réglage.
 *
 * `ai_moderation_checks.redacted` garde la trace du passage. Le texte masqué
 * lui-même n'est jamais stocké.
 */

/** Numéros internationaux et nationaux, avec séparateurs variés. */
const PHONE_PATTERNS: RegExp[] = [
  // International : +229 97 00 00 42, +33 6 12 34 56 78, +1-555-0100
  /\+\d{1,4}[\s.\-–—]?(?:\(?\d{1,4}\)?[\s.\-–—]?){2,6}\d{2,4}/g,
  // National groupé par deux : 06 12 34 56 78, 0612345678
  /\b0\d(?:[\s.\-–—]?\d{2}){4}\b/g,
  // Suites longues de chiffres, séparateurs compris : attrape ce qui précède rate
  /\b\d[\d\s.\-–—]{7,18}\d\b/g,
];

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Identifiants de messagerie : un numéro masqué ne sert à rien si le pseudo
 * WhatsApp ou Telegram passe juste à côté.
 */
const HANDLE_PATTERN = /(?:@[A-Za-z0-9_]{3,32}\b)|(?:\b(?:wa\.me|t\.me|m\.me)\/\S+)/g;

/** URLs : une arnaque passe souvent par un lien plutôt que par un numéro. */
const URL_PATTERN = /\bhttps?:\/\/\S+|\bwww\.\S+/g;

/**
 * Mots outils français qui commencent souvent une phrase et seraient pris pour
 * des noms propres. Sans cette liste, la moitié des débuts de phrase part en
 * `[NOM]` et l'analyse perd son sens.
 */
const FRENCH_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'ce', 'cette', 'ces', 'mon', 'ma', 'mes',
  'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'lui', 'y', 'en',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'si', 'que', 'qui', 'quoi', 'dont', 'où',
  'pour', 'par', 'avec', 'sans', 'sous', 'sur', 'dans', 'chez', 'vers', 'depuis', 'pendant',
  'avant', 'après', 'entre', 'jusqu', 'contre', 'selon',
  'bonjour', 'bonsoir', 'merci', 'salut', 'svp', 'stp',
  'oui', 'non', 'peut', 'être', 'avoir', 'faire', 'aller', 'voir', 'savoir', 'pouvoir',
  'est', 'sont', 'était', 'ai', 'as', 'a', 'ont', 'avez', 'avons',
  'quand', 'comment', 'pourquoi', 'combien',
  'aujourd', 'hier', 'demain', 'maintenant',
  'cordialement', 'bien',
]);

/**
 * Termes du domaine à NE PAS masquer : ce sont des institutions et des
 * démarches, pas des personnes. Les masquer viderait le texte de ce qui permet
 * justement à l'IA de juger s'il s'agit d'une arnaque.
 */
const DOMAIN_TERMS = new Set([
  'france', 'bénin', 'benin', 'togo', 'sénégal', 'senegal', 'cameroun', 'mali', 'niger',
  'burkina', 'guinée', 'guinee', 'gabon', 'congo', 'madagascar', 'maroc', 'algérie', 'tunisie',
  'paris', 'lyon', 'marseille', 'lille', 'bordeaux', 'toulouse', 'nantes', 'strasbourg',
  'montpellier', 'rennes', 'grenoble', 'nice',
  'ofii', 'caf', 'cpam', 'préfecture', 'prefecture', 'sous-préfecture', 'mairie',
  'campus', 'visale', 'crous', 'urssaf', 'ameli', 'sécurité', 'securite',
  'visa', 'titre', 'séjour', 'sejour', 'récépissé', 'recepisse', 'passeport',
  'euros', 'euro', 'fcfa', 'xof',
  'whatsapp', 'telegram', 'facebook', 'instagram',
  'janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'aout',
  'septembre', 'octobre', 'novembre', 'décembre', 'decembre',
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
]);

export interface RedactionResult {
  readonly text: string;
  /** Ce qui a été trouvé, pour la trace — jamais les valeurs elles-mêmes. */
  readonly counts: { phones: number; emails: number; names: number; handles: number; urls: number };
}

/**
 * Masque le texte. Retourne le texte masqué et un décompte par catégorie.
 *
 * L'ordre compte : les emails d'abord, sinon leur partie numérique serait prise
 * pour un numéro de téléphone et le masquage produirait `[TEL]@domaine.fr`.
 */
export function redactForModeration(input: string): RedactionResult {
  let text = input;
  const counts = { phones: 0, emails: 0, names: 0, handles: 0, urls: 0 };

  text = text.replace(EMAIL_PATTERN, () => {
    counts.emails += 1;
    return '[EMAIL]';
  });

  text = text.replace(URL_PATTERN, () => {
    counts.urls += 1;
    return '[LIEN]';
  });

  text = text.replace(HANDLE_PATTERN, () => {
    counts.handles += 1;
    return '[CONTACT]';
  });

  for (const pattern of PHONE_PATTERNS) {
    text = text.replace(pattern, () => {
      counts.phones += 1;
      return '[TEL]';
    });
  }

  // Noms propres : un mot capitalisé hors début de phrase, qui n'est ni un mot
  // outil ni un terme du domaine. Heuristique, donc imparfaite — assumée.
  text = text.replace(/(^|[^.!?]\s+)([A-ZÀ-Þ][a-zà-ÿ'’-]{2,})/gu, (match, prefix: string, word: string) => {
    const lower = word.toLowerCase();
    if (FRENCH_STOPWORDS.has(lower) || DOMAIN_TERMS.has(lower)) return match;
    counts.names += 1;
    return `${prefix}[NOM]`;
  });

  return { text, counts };
}

/**
 * Garde-fou de dernier recours, appelé juste avant l'envoi réseau.
 *
 * Si un numéro ou un email survit au masquage, on N'ENVOIE PAS : mieux vaut un
 * contenu non analysé — il part alors en file de modération humaine — qu'une
 * donnée personnelle transmise à un sous-traitant hors UE.
 */
export function assertRedacted(text: string): void {
  const leaks: string[] = [];
  if (EMAIL_PATTERN.test(text)) leaks.push('email');
  EMAIL_PATTERN.lastIndex = 0;

  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(text)) leaks.push('téléphone');
    pattern.lastIndex = 0;
  }

  if (leaks.length > 0) {
    throw new Error(
      `Masquage incomplet : ${[...new Set(leaks)].join(', ')} encore présent. ` +
        'Le texte n’est pas envoyé (règle dure 13 §2).',
    );
  }
}
