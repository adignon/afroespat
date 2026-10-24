import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calendarResponseSchema,
  communitiesResponseSchema,
  eventCardSchema,
  eventDetailResponseSchema,
  eventsResponseSchema,
  organizerAttendeesResponseSchema,
  publicAttendeesResponseSchema,
} from '../index.js';

/**
 * ─── LES SCHÉMAS DE L'AGENDA, ÉPROUVÉS SUR DES CHARGES RÉELLES ──────────────
 *
 * Les dix fixtures de ce fichier ont été RELEVÉES OCTET POUR OCTET sur l'API qui
 * tourne (port 3192, base du dépôt), avec quatre membres créés pour l'occasion et
 * portés à L1 par le webhook KYC fictif — `event.attend` l'exige (L1 depuis la
 * décision du porteur du 2026-10-24) ; `event.create` demande L2 aujourd'hui. Scénario joué : un événement avec capacité, lieu et description, deux
 * RSVP (`GOING`, `MAYBE`), un second événement SANS capacité, description ni lieu,
 * un réseau et un événement qui lui est réservé, puis une présence cochée.
 *
 * AUCUN CHAMP N'EST DÉDUIT DU CODE D'UN SERVICE. La raison est écrite dans
 * `compte-responses.test.ts` et elle a déjà coûté un écran : `GET /me/blocks`
 * rendait une liste NUE dans le service, et c'est le contrôleur qui l'enveloppait.
 *
 * ── CE QUE CHAQUE CAS AFFIRME ───────────────────────────────────────────────
 *
 * Deux choses, et la seconde compte autant que la première :
 *   1. le schéma ACCEPTE la charge réelle — sans quoi l'écran ne s'affiche pas ;
 *   2. il REFUSE une charge amputée d'un champ que l'écran LIT — sans quoi il ne
 *      protège de rien et laisserait passer un `undefined` jusqu'au JSX.
 *
 * ── LA PRÉSENCE : UNE RÈGLE DURE, DEVENUE STRUCTURELLE ──────────────────────
 *
 * §5 garde `userId` et `checkedIn` pour l'organisateur. Un schéma unique à champs
 * facultatifs aurait accepté une vue publique qui les porterait : les deux
 * derniers cas de ce fichier vérifient que la forme publique les REFUSE.
 */

const FIXTURES = join(import.meta.dirname, 'fixtures');

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8'));

const objet = (valeur: unknown): Record<string, unknown> =>
  structuredClone(valeur) as Record<string, unknown>;

/**
 * Les six routes que les quatre écrans de l'agenda lisent.
 *
 * `ampute` nomme le chemin d'un champ que l'ÉCRAN affiche : le retirer doit faire
 * refuser la charge. Sans cette colonne, le fichier ne prouverait que la moitié
 * facile — un schéma qui n'exigerait plus rien accepterait toujours la vraie
 * réponse et passerait ces cas sans protéger personne.
 */
const ROUTES = [
  {
    nom: 'agenda_calendrier',
    route: 'GET /events/calendar',
    schema: calendarResponseSchema,
    // Le point terre cuite du calendrier vertical se dessine sur `attending`.
    ampute: ['items', 0, 'attending'],
  },
  {
    nom: 'agenda_jour',
    route: 'GET /events?date= (membre)',
    schema: eventsResponseSchema,
    // Le compteur de participants de chaque carte (§3.5).
    ampute: ['items', 0, 'attendeeCount'],
  },
  {
    nom: 'agenda_jour_visiteur',
    route: 'GET /events?date= (visiteur, @PublicRead)',
    schema: eventsResponseSchema,
    ampute: ['items', 0, 'localDate'],
  },
  {
    nom: 'agenda_evenement',
    route: 'GET /events/:id (organisateur)',
    schema: eventDetailResponseSchema,
    // Les avatars des participants : E02 les empile et compte le reste.
    ampute: ['attendees'],
  },
  {
    nom: 'agenda_evenement_participant',
    route: 'GET /events/:id (participant)',
    schema: eventDetailResponseSchema,
    // `myStatus` décide lequel des trois boutons de RSVP est actif.
    ampute: ['myStatus'],
  },
  {
    nom: 'agenda_presents_coches',
    route: 'GET /events/:id/attendees (organisateur)',
    schema: organizerAttendeesResponseSchema,
    // `checkedIn` est CE QUI DÉCIDE la case cochée de E04 (§3.3).
    ampute: ['items', 0, 'checkedIn'],
  },
  {
    nom: 'agenda_presents_coches_participant',
    route: 'GET /events/:id/attendees (participant)',
    schema: publicAttendeesResponseSchema,
    ampute: ['meta'],
  },
  /**
   * `GET /communities` n'est pas une route de l'agenda, et elle est pourtant dans
   * ce tableau : c'est E02 qui l'appelle, pour NOMMER le réseau d'un événement
   * réservé — l'événement ne porte qu'un `communityId`. Un schéma qu'un écran
   * emploie sans l'avoir éprouvé sur une charge réelle est exactement ce qui a
   * coûté un écran sur `GET /me/blocks`.
   */
  {
    nom: 'agenda_reseaux',
    route: 'GET /communities (mes réseaux)',
    schema: communitiesResponseSchema,
    ampute: ['mine'],
  },
] as const;

/** Retire le champ désigné par un chemin, sur une copie. */
function sans(valeur: unknown, chemin: readonly (string | number)[]): unknown {
  const copie = structuredClone(valeur) as Record<string, unknown>;
  let parent: Record<string, unknown> = copie;
  for (const cle of chemin.slice(0, -1)) {
    parent = parent[cle as string] as Record<string, unknown>;
  }
  delete parent[chemin[chemin.length - 1] as string];
  return copie;
}

describe('les schémas de l’agenda acceptent les charges RÉELLES de l’API', () => {
  for (const { nom, route, schema } of ROUTES) {
    it(`${route} — la charge relevée est acceptée`, () => {
      const resultat = schema.safeParse(charge(nom));
      const detail = resultat.success
        ? ''
        : JSON.stringify(resultat.error.issues.slice(0, 4), null, 2);
      expect(resultat.success, `${route} refuse sa propre réponse :\n${detail}`).toBe(true);
    });
  }

  for (const { nom, route, schema, ampute } of ROUTES) {
    it(`${route} — une charge privée de « ${ampute.join('.')} » est REFUSÉE`, () => {
      expect(
        schema.safeParse(sans(charge(nom), ampute)).success,
        `${route} accepte une réponse sans « ${ampute.join('.')} » : le schéma ne protège rien`,
      ).toBe(false);
    });
  }
});

/**
 * ─── CE QUE LES CHARGES RELEVÉES ONT APPRIS ─────────────────────────────────
 *
 * Quatre faits de ces réponses ne se lisent dans aucun service, et chacun aurait
 * produit un schéma faux s'il avait été déduit du code.
 */
describe('ce que les charges relevées ont appris', () => {
  it('`GET /events/:id/attendees` OMET `userId` et `checkedIn` au non-organisateur — il ne les met pas à `null`', () => {
    const publique = objet(charge('agenda_presents_coches_participant'));
    const ligne = objet((publique['items'] as unknown[])[0]);
    expect(Object.keys(ligne)).toEqual(['handle', 'displayName', 'avatarUrl', 'status']);
    /**
     * Un `.nullable()` aurait donc refusé la vraie réponse de TOUT
     * non-organisateur : c'est le piège que seule une charge relevée montre, et il
     * a déjà coûté trois onglets sur quatre dans un lot précédent.
     */
    expect(publicAttendeesResponseSchema.safeParse(publique).success).toBe(true);
  });

  it('`GET /events` n’a PAS de `meta` : un `meta` exigé aurait refusé la seule liste paginée de l’agenda', () => {
    const liste = objet(charge('agenda_jour'));
    expect(Object.keys(liste)).toEqual(['items', 'nextCursor']);
    expect(eventsResponseSchema.safeParse(liste).success).toBe(true);
  });

  it('`checkedInCount` est `null` pour un participant, et un nombre pour l’organisateur', () => {
    const participant = objet(charge('agenda_evenement_participant'));
    const organisateur = objet(charge('agenda_evenement_commence'));
    expect(participant['checkedInCount']).toBeNull();
    expect(organisateur['checkedInCount']).toBe(1);
    // Présent et nul : donc `.nullable()`, jamais `.optional()`.
    expect('checkedInCount' in participant).toBe(true);
  });

  /**
   * RÈGLE DURE §10 : un événement réservé à un réseau n'est renvoyé qu'à ses
   * membres actifs. La RÉPONSE, elle, ne nomme PAS le réseau : elle porte un
   * `communityId` et rien d'autre. C'est l'écart qui oblige E02 à appeler
   * `GET /communities`, et il est consigné ici plutôt que deviné.
   */
  it('un événement réservé porte un `communityId` — et aucun nom de réseau', () => {
    const reserve = objet(charge('agenda_evenement_reseau'));
    expect(typeof reserve['communityId']).toBe('string');
    expect(eventCardSchema.safeParse(reserve).success).toBe(true);
    for (const cle of Object.keys(reserve)) {
      expect(cle, 'la réponse ne doit pas nommer le réseau').not.toMatch(/community(Name|Slug)/);
    }
    // Et le nom se trouve dans `mine` de `GET /communities` : c'est le seul chemin.
    const reseaux = objet(charge('agenda_reseaux'));
    const noms = (reseaux['mine'] as { id: string; name: string }[]).map((r) => r.id);
    expect(noms).toContain(reserve['communityId']);
  });

  it('un événement sans capacité, sans description et sans lieu rend `null` — et le schéma l’accepte', () => {
    const liste = objet(charge('agenda_jour'));
    const nu = (liste['items'] as Record<string, unknown>[]).find(
      (e) => e['capacity'] === null,
    );
    expect(nu, 'la liste relevée ne contient aucun événement sans capacité').toBeDefined();
    expect(nu?.['description']).toBeNull();
    expect(nu?.['venueName']).toBeNull();
    expect(nu?.['endsAt']).toBeNull();
    expect(eventCardSchema.safeParse(nu).success).toBe(true);
  });
});

/**
 * ─── `.strict()` : CE QUE LA FRONTIÈRE REFUSE ───────────────────────────────
 *
 * Chacun de ces cas greffe un champ qui FERAIT FUIR quelque chose, et vérifie que
 * la réponse est refusée. Sans `.strict()`, zod dépouillerait en silence : la
 * donnée aurait transité, l'écran ne l'afficherait pas, et tout le monde
 * conclurait que la règle est tenue.
 */
describe('`.strict()` — un champ greffé sur une réponse de l’agenda est REFUSÉ', () => {
  const carte = () => objet((objet(charge('agenda_jour'))['items'] as unknown[])[0]);

  it('une latitude greffée sur un événement est refusée (règle dure §10 : jamais géocodé)', () => {
    expect(eventCardSchema.safeParse(carte()).success).toBe(true);
    expect(
      eventCardSchema.safeParse({ ...carte(), latitude: 45.75 }).success,
      'une latitude est acceptée : l’adresse de §3.1 aurait été géocodée en silence',
    ).toBe(false);
    expect(
      eventCardSchema.safeParse({ ...carte(), city: { ...carte()['city'] as object, latitude: 45.75 } })
        .success,
      'une latitude dans la ville est acceptée : le rayon du serveur aurait fui jusqu’à l’écran',
    ).toBe(false);
  });

  it('un compteur de vues greffé sur un événement est refusé (00 §49)', () => {
    expect(eventCardSchema.safeParse({ ...carte(), viewCount: 412 }).success).toBe(false);
  });

  /**
   * LA RÈGLE DURE DE CE PÉRIMÈTRE : la liste des présents n'expose pas ce que §5
   * garde privé. Les deux cas ci-dessous sont la raison d'être des DEUX schémas.
   */
  it('un `userId` greffé sur la vue PUBLIQUE des participants est REFUSÉ', () => {
    const publique = objet(charge('agenda_presents_coches_participant'));
    const items = publique['items'] as Record<string, unknown>[];
    const fuite = {
      ...publique,
      items: [{ ...items[0], userId: '01a0f4e3-7fe7-7000-bfed-973540d2dccd' }, ...items.slice(1)],
    };
    expect(
      publicAttendeesResponseSchema.safeParse(fuite).success,
      'l’identifiant d’un participant est accepté hors de la feuille de l’organisateur : ' +
        'il aurait transité vers n’importe quel membre ouvrant la page',
    ).toBe(false);
  });

  it('un `checkedIn` greffé sur la vue PUBLIQUE des participants est REFUSÉ', () => {
    const publique = objet(charge('agenda_presents_coches_participant'));
    const items = publique['items'] as Record<string, unknown>[];
    const fuite = { ...publique, items: [{ ...items[0], checkedIn: true }, ...items.slice(1)] };
    expect(
      publicAttendeesResponseSchema.safeParse(fuite).success,
      'la présence physique d’un membre est accepté hors de la feuille de l’organisateur',
    ).toBe(false);
  });

  it('un `phone` greffé sur un participant est refusé (01 §2.1 : aucun numéro en clair)', () => {
    const feuille = objet(charge('agenda_presents_coches'));
    const items = feuille['items'] as Record<string, unknown>[];
    const fuite = { ...feuille, items: [{ ...items[0], phone: '+22997000043' }, ...items.slice(1)] };
    expect(organizerAttendeesResponseSchema.safeParse(fuite).success).toBe(false);
  });

  /**
   * ET LA MOITIÉ QUI MANQUAIT : la feuille de l'organisateur ne doit pas être
   * acceptée par le contrat PUBLIC. Si elle l'était, choisir le mauvais schéma
   * n'aurait aucune conséquence visible, et le choix sur `isOrganizer` ne
   * garderait plus rien.
   */
  it('la feuille de l’ORGANISATEUR n’est pas acceptée par le contrat public', () => {
    expect(publicAttendeesResponseSchema.safeParse(charge('agenda_presents_coches')).success).toBe(
      false,
    );
    expect(
      organizerAttendeesResponseSchema.safeParse(charge('agenda_presents_coches_participant'))
        .success,
      'la vue publique passe pour une feuille d’organisateur : `userId` n’y serait plus exigé',
    ).toBe(false);
  });
});
