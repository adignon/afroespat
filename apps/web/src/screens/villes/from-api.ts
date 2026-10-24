import {
  CITY_COUNT_PRIVACY_THRESHOLD,
  type CityMapResponse,
  type CityProfileResponse,
  type CityTipView,
  type MembersResponse,
} from '@app/shared';
import { initials, tint } from '../reseaux/chrome';
import type {
  ArrivantVivant,
  BarrePays,
  BudgetVivant,
  EnteteVivant,
  EvenementVille,
  LieuVivant,
  MembreVivant,
  PointCarte,
  TemoignageVivant,
  TipVivant,
} from './data';
import { TYPES_FR, abbrMois, numeroJour, heure } from '../agenda/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ DE LA RÉPONSE DE L'API AUX PRISES DES CADRES — FONCTIONS PURES              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Aucune de ces fonctions ne fait d'appel : elles reçoivent la réponse DÉJÀ
 * validée par son schéma partagé (`cityProfileResponseSchema`…) et rendent ce que
 * les cadres de la maquette lisent. C'est ce qui permet de les éprouver sans
 * réseau (`from-api.test.ts`), et de relire d'un seul coup d'œil ce que l'écran
 * affiche de chaque champ.
 *
 * LE SEUIL DE CONFIDENTIALITÉ N'EST PAS RECALCULÉ ICI (09 §2.1) : un compteur
 * sous le seuil arrive en `count: null`, et l'écran écrit « moins de 3 » — le
 * nombre vient de `CITY_COUNT_PRIVACY_THRESHOLD`, jamais d'un 3 recopié. Deux
 * implémentations de la même règle divergent, et celle-ci protège des personnes.
 */

const fr = new Intl.NumberFormat('fr-FR');

/** « 480 € », « 1 050 € », « 12,50 € » — un montant en centimes, jamais en flottant stocké. */
export function euros(centimes: number): string {
  const entier = centimes % 100 === 0;
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: entier ? 0 : 2,
    maximumFractionDigits: entier ? 0 : 2,
  }).format(centimes / 100)} €`;
}

export const nombre = (n: number): string => fr.format(n);

/** « moins de 3 » : ce que l'écran dit d'un compteur masqué par le seuil. */
export const MOINS_DU_SEUIL = `moins de ${CITY_COUNT_PRIVACY_THRESHOLD}`;

const PHASE: Record<string, string> = {
  PRE_DEPARTURE: 'Prépare son départ',
  RECENT_ARRIVAL: 'Vient d’arriver',
  SETTLED: 'Installé·e',
};

export const profilDe = (handle: string | null): string | undefined =>
  handle === null ? undefined : `/@${handle}`;

// ─── A12 · l'en-tête ─────────────────────────────────────────────────────────

export function contributionsTotal(p: CityProfileResponse): number {
  const c = p.tipCounts;
  return c.TIP + c.SHOP + c.BUDGET + c.TESTIMONY;
}

const pluriel = (n: number, mot: string): string => `${nombre(n)} ${mot}${n > 1 ? 's' : ''}`;

export function enteteVille(p: CityProfileResponse): EnteteVivant {
  const total = contributionsTotal(p);
  const budgets = p.tipCounts.BUDGET;
  return {
    nom: p.city.name,
    region: p.city.region ?? 'France',
    membres: pluriel(p.city.memberCount, 'membre'),
    contributions: pluriel(total, 'contribution'),
    reseau: p.network === null ? '' : p.network.name,
    reseauHref: p.network === null ? null : `/reseaux/${p.network.slug}`,
    mediane: p.budgetMedianCents === null ? null : euros(p.budgetMedianCents),
    medianeSous: pluriel(budgets, 'contribution'),
  };
}

/** Les barres de pays : la largeur est relative au plus gros pays AFFICHÉ. */
export function barresPays(p: CityProfileResponse): BarrePays[] {
  const connus = p.city.byCountry.map((b) => b.count ?? 0);
  const max = Math.max(1, ...connus);
  return p.city.byCountry.map((b) => ({
    c: b.nameFr,
    // Un pays sous le seuil garde une barre MINIMALE : on montre qu'il y a quelqu'un,
    // sans dire combien (09 §2.1).
    w: b.count === null ? '6%' : `${Math.max(6, Math.round((b.count / max) * 100))}%`,
    n: b.count === null ? MOINS_DU_SEUIL : nombre(b.count),
  }));
}

// ─── A12 · colonne de droite ─────────────────────────────────────────────────

export function evenementsVille(p: CityProfileResponse): EvenementVille[] {
  return p.events.map((e) => ({
    d: numeroJour(e.localDate),
    m: abbrMois(e.localDate),
    t: e.title,
    s: [e.venueName ?? '', heure(e.startsAt, e.timeZone), TYPES_FR[e.type] ?? '']
      .filter((x) => x !== '')
      .join(' · '),
    href: `/agenda/${e.id}`,
  }));
}

/** « Arrivé·e il y a 3 jours » : en jours entiers, sans horloge fine. */
export function ilYA(iso: string, maintenant: number = Date.now()): string {
  const jours = Math.max(0, Math.floor((maintenant - new Date(iso).getTime()) / 86_400_000));
  if (jours === 0) return 'arrivé·e aujourd’hui';
  return jours === 1 ? 'arrivé·e hier' : `arrivé·e il y a ${jours} jours`;
}

export function arrivants(p: CityProfileResponse, maintenant: number = Date.now()): ArrivantVivant[] {
  return p.newcomers.map((n) => ({
    i: initials(n.displayName),
    name: n.displayName,
    sub: `${n.country.nameFr} · ${ilYA(n.arrivedAt, maintenant)}`,
    bg: tint(n.handle ?? n.displayName),
    ...(profilDe(n.handle) === undefined ? {} : { profil: profilDe(n.handle) as string }),
    handle: n.handle,
  }));
}

// ─── Les contributions ───────────────────────────────────────────────────────

const UTILE_VOTE = { bg: '#16785E', fg: '#fff' } as const;
const UTILE_REPOS = { bg: '#F2F5F4', fg: '#16211D' } as const;

function pied(t: CityTipView) {
  const nom = t.author?.displayName ?? 'Membre supprimé';
  const jeton = t.votedByMe ? UTILE_VOTE : UTILE_REPOS;
  return {
    id: t.id,
    votedByMe: t.votedByMe,
    mine: t.mine,
    i: initials(nom),
    bg: tint(t.author?.handle ?? nom),
    auteur: nom,
    sous: t.author === null ? 'Compte supprimé' : 'Membre',
    utileBg: jeton.bg,
    utileFg: jeton.fg,
    utiles: t.helpfulCount,
    ...(profilDe(t.author?.handle ?? null) === undefined
      ? {}
      : { profil: profilDe(t.author?.handle ?? null) as string }),
  };
}

/**
 * Un bon plan n'a ni titre ni catégorie dans le modèle (09 §2.3) : un TEXTE (≤ 500).
 * La maquette dessine un titre au-dessus : on prend la PREMIÈRE LIGNE comme titre
 * quand le contributeur en a écrit deux, et le texte n'a alors que la suite. Un
 * bon plan sur une seule ligne n'a que son texte — rien n'est inventé.
 */
export function titreEtSuite(corps: string): { titre: string; texte: string } {
  const lignes = corps.split('\n');
  const premiere = (lignes[0] ?? '').trim();
  const suite = lignes.slice(1).join('\n').trim();
  return suite === '' ? { titre: '', texte: premiere } : { titre: premiere, texte: suite };
}

export function bonsPlans(items: readonly CityTipView[]): TipVivant[] {
  return items.map((t) => {
    const { titre, texte } = titreEtSuite(t.body);
    return { ...pied(t), cat: 'Bon plan', titre, texte };
  });
}

export function lieux(items: readonly CityTipView[]): LieuVivant[] {
  return items.map((t) => ({
    ...pied(t),
    nom: t.venueName ?? 'Commerce',
    adresse: t.addressText ?? '',
    tags: [],
    texte: t.body,
  }));
}

export function temoignages(items: readonly CityTipView[]): TemoignageVivant[] {
  return items.map((t) => ({ ...pied(t), texte: t.body, parcours: '' }));
}

/** Les lignes de budget : le libellé est le corps, le montant vient de `amountCents`. */
export function budgetsVivants(items: readonly CityTipView[]): BudgetVivant[] {
  return items.map((t) => ({
    id: t.id,
    votedByMe: t.votedByMe,
    mine: t.mine,
    l: t.body,
    v: t.amountCents === null ? '—' : euros(t.amountCents),
    u: t.helpfulCount,
  }));
}

// ─── A11 ─────────────────────────────────────────────────────────────────────

export function pointsCarte(carte: CityMapResponse): PointCarte[] {
  return carte.items.map((v) => ({
    id: v.id,
    slug: v.slug,
    nom: v.name,
    region: v.region,
    latitude: v.latitude,
    longitude: v.longitude,
    compte: v.count,
    souslesSeuil: v.belowThreshold,
  }));
}

export function membresVivants(liste: MembersResponse): MembreVivant[] {
  return liste.items.map((m) => ({
    i: initials(m.displayName),
    name: m.displayName,
    sub: [PHASE[m.phase] ?? '', m.city?.name ?? m.country.nameFr].filter((x) => x !== '').join(' · '),
    bg: tint(m.handle ?? m.displayName),
    help: m.availableToHelp,
    skills: m.skills,
    ...(profilDe(m.handle) === undefined ? {} : { profil: profilDe(m.handle) as string }),
    handle: m.handle,
  }));
}
