import {
  communitiesResponseSchema,
  eventsResponseSchema,
  mentorsResponseSchema,
  type EventCardResponse,
  type MentorCard,
  type MyCommunity,
  type PlacesCity,
} from '@app/shared';
import { fetchMe, listCities, memberApi } from '@/lib/api';

/**
 * L'ATTERRISSAGE « SANS PARCOURS » (O05) — LES DONNÉES RÉELLES, lot W1A phase 0.1.
 *
 * La planche dessinait « Bienvenue à Lyon », « Lyon et Rhône · 1 400 membres », trois
 * événements (« Apéro Diaspora et Étudiants », « Atelier CV et stage »…) et une
 * marraine suggérée (« Aïcha Diop ») — tout en dur, pour un membre qui vient de
 * s'inscrire à Évry, à Lille ou à Dijon. Le même défaut que « Mes études à Lyon » sur
 * l'autre variante, jamais corrigé de ce côté-ci.
 *
 * Quatre sources, toutes déjà servies :
 *   · la ville du membre : `GET /me` (identifiant) + `GET /places/cities` (nom, nombre
 *     de membres, réseau ouvert ou non) ;
 *   · son réseau : `GET /communities` (`mine`), pour savoir s'il l'a rejoint ;
 *   · les trois prochains événements de la ville : `GET /events?cityId=…&from=…` ;
 *   · un parrain suggéré : `GET /mentors?cityId=…`, le premier DISPONIBLE qui n'est
 *     pas le membre lui-même.
 *
 * CHAQUE SOURCE PEUT MANQUER sans faire tomber l'écran : pas d'événement = la carte le
 * dit, pas de parrain = la carte disparaît (une suggestion inventée serait pire que
 * rien), pas de réseau rejoint = la phrase n'affirme pas qu'il l'est.
 */

/** Le mois en trois lettres majuscules, comme la planche (« FÉV », « MAR »). */
const MOIS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'] as const;

export interface EvenementAtterrissage {
  readonly d: string;
  readonly m: string;
  readonly t: string;
  readonly s: string;
}

export interface ParrainSuggere {
  /** Le pseudo : la demande réelle se rédige sur la fiche du parrain (`/parrainage/:handle`). */
  readonly handle: string;
  readonly nom: string;
  readonly initiales: string;
  readonly detail: string;
}

export interface LieuAtterrissage {
  readonly ville: string;
  readonly initiales: string;
  readonly reseau: string;
  readonly membres: string;
  readonly evenements: readonly EvenementAtterrissage[];
  /** `null` quand aucun parrain disponible n'est suggérable : la carte est alors masquée. */
  readonly parrain: ParrainSuggere | null;
}

/** Avant le chargement : ni ville inventée ni liste, un état d'attente honnête. */
export const LIEU_INCONNU: LieuAtterrissage = {
  ville: '',
  initiales: '',
  reseau: '',
  membres: '',
  evenements: [],
  parrain: null,
};

const initialesDe = (nom: string): string =>
  nom
    .split(/[\s-]+/)
    .filter((m) => m !== '')
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join('');

/** « 24 FÉV · Berges du Rhône · 19h00 », à l'heure DE LA VILLE de l'événement. */
export function evenementDepuis(e: Pick<EventCardResponse, 'title' | 'venueName' | 'addressText' | 'startsAt' | 'timeZone' | 'localDate'>): EvenementAtterrissage {
  const [, mois, jour] = e.localDate.split('-');
  const heure = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: e.timeZone,
  })
    .format(new Date(e.startsAt))
    .replace(':', 'h');
  const lieu = e.venueName ?? e.addressText;
  return {
    d: jour ?? '',
    m: MOIS[Number(mois) - 1] ?? '',
    t: e.title,
    s: lieu === null || lieu === '' ? heure : `${lieu} · ${heure}`,
  };
}

export function parrainDepuis(m: MentorCard, ville: string): ParrainSuggere {
  return {
    handle: m.handle,
    nom: m.displayName,
    initiales: initialesDe(m.displayName),
    // Le genre n'est pas dans l'API, et le déduire d'un prénom est refusé (voir
    // `screens/entraide/appels.ts`) : « parrain·e », à la forme inclusive.
    detail: `Parrain·e suggéré·e · ${ville}`,
  };
}

export function membresDepuis(ville: Pick<PlacesCity, 'isActive' | 'memberCount'> | undefined, rejoint: boolean): string {
  const base =
    ville === undefined
      ? ''
      : ville.isActive
        ? `${String(ville.memberCount)} membre${ville.memberCount > 1 ? 's' : ''}`
        : 'Réseau bientôt ouvert';
  if (!rejoint) return base;
  return base === '' ? 'Vous avez rejoint ce réseau' : `${base} · vous avez rejoint ce réseau`;
}

/** La date du jour, civile, au format `YYYY-MM-DD` de l'agenda. */
const aujourdhui = (): string => new Date().toISOString().slice(0, 10);

/**
 * Charge tout l'atterrissage. Ne lève jamais pour une source secondaire : seule la
 * ville manquante rend `LIEU_INCONNU` (rien à montrer sans elle).
 */
export async function chargerAtterrissage(): Promise<LieuAtterrissage> {
  const me = await fetchMe();
  const cityId = me.user.cityId;
  if (cityId === null) return LIEU_INCONNU;

  const [villes, reseaux, evenements, parrains] = await Promise.all([
    listCities().catch(() => null),
    memberApi.get('/communities', communitiesResponseSchema).catch(() => null),
    memberApi
      .get(`/events?cityId=${cityId}&from=${aujourdhui()}&limit=3`, eventsResponseSchema)
      .catch(() => null),
    memberApi.get(`/mentors?cityId=${cityId}&limit=5`, mentorsResponseSchema).catch(() => null),
  ]);

  const ville = villes?.items.find((c) => c.id === cityId);
  const nomVille = ville?.name ?? '';
  const reseauRejoint: MyCommunity | undefined = reseaux?.mine.find(
    (c) => c.kind === 'CITY' && c.cityId === cityId,
  );
  const parrain = parrains?.items.find((p) => p.isAvailable && p.userId !== me.user.id);

  return {
    ville: nomVille,
    initiales: initialesDe(nomVille).slice(0, 2) || nomVille.slice(0, 2).toUpperCase(),
    reseau: reseauRejoint?.name ?? nomVille,
    membres: membresDepuis(ville, reseauRejoint !== undefined),
    evenements: (evenements?.items ?? []).slice(0, 3).map(evenementDepuis),
    parrain: parrain === undefined ? null : parrainDepuis(parrain, nomVille),
  };
}
