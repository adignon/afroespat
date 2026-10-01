import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calendarResponseSchema,
  eventDetailResponseSchema,
  mySubscriptionResponseSchema,
  organizerAttendeesResponseSchema,
  publicAttendeesResponseSchema,
} from '@app/shared';
import {
  construireBande,
  construireChoix,
  construireFeuille,
  construireFiche,
  construirePanneau,
  construirePresence,
  heure,
  jourCivilDe,
  semaineIso,
} from './data';

/**
 * ─── LES RÈGLES DE L'AGENDA, ÉPROUVÉES SANS NAVIGATEUR ──────────────────────
 *
 * Ces tests portent sur les CONSTRUCTEURS de `data.ts` — des fonctions pures, de
 * la charge de l'API vers ce que les cadres transcodés lisent. C'est là que vivent
 * les décisions de cet écran, donc c'est là qu'on peut les éprouver sans monter
 * une page.
 *
 * LES CHARGES SONT LES VRAIES, relevées sur l'API qui tourne et figées dans
 * `packages/shared/src/__tests__/fixtures/agenda_*.json`. Un objet écrit à la main
 * ici décrirait ce que je crois que l'API envoie ; la fixture décrit ce qu'elle
 * envoie — et elle est VALIDÉE par le schéma avant d'entrer dans le constructeur,
 * exactement comme le socle le fait à l'exécution.
 *
 * ── LA RÈGLE DURE QUE CE FICHIER GARDE ──────────────────────────────────────
 *
 * La case « Présent·e » se décide sur `checkedIn`, ET SUR RIEN D'AUTRE. Un test de
 * ce périmètre avait déjà été écrit sur le champ voisin — il croyait éprouver le
 * RSVP et lisait `checked_in` — et la mutation l'a montré. Les deux cas « le
 * statut change, la case ne bouge pas » et « la présence change, la case suit »
 * sont donc écrits en regard l'un de l'autre : ensemble, ils ne peuvent pas être
 * satisfaits par un code qui confondrait les deux champs.
 */

const FIXTURES = join(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8'));

const feuilleOrganisateur = () =>
  organizerAttendeesResponseSchema.parse(charge('agenda_presents_coches'));
const feuillePublique = () =>
  publicAttendeesResponseSchema.parse(charge('agenda_presents_coches_participant'));
const fiche = () => eventDetailResponseSchema.parse(charge('agenda_evenement'));
const calendrier = () => calendarResponseSchema.parse(charge('agenda_calendrier'));
const abonnement = () => mySubscriptionResponseSchema.parse(charge('agenda_abonnement'));

describe('la feuille de présence (E04) se décide sur `checkedIn`', () => {
  it('la charge relevée donne une case cochée, une case vide, et aucun compte inventé', () => {
    const lue = construireFeuille(feuilleOrganisateur());
    expect(lue.participants.map((p) => [p.nom, p.coche, p.vide])).toEqual([
      ['Organisatrice Éprouvée', false, true],
      ['Participant Éprouvé', true, false],
      ['Hésitant Éprouvé', false, true],
    ]);
    // `meta.checkedIn` est la source du compteur : 1 présent sur 3 inscrits.
    expect(lue.presents).toBe(1);
    expect(lue.inscrits).toBe(3);
    expect(lue.compteur).toBe(true);
  });

  /**
   * LE CAS QUI TUE LE TEST CREUX : on change le STATUT de RSVP, et rien ne doit
   * bouger. Un constructeur qui lirait `status` au lieu de `checkedIn` ferait
   * passer le premier test de ce fichier — les deux champs sont corrélés dans la
   * charge réelle — et échouerait ici.
   */
  it('changer le statut de RSVP ne change AUCUNE case', () => {
    const avant = construireFeuille(feuilleOrganisateur()).participants.map((p) => p.coche);

    const charge2 = feuilleOrganisateur();
    const mute = {
      ...charge2,
      items: charge2.items.map((p) => ({
        ...p,
        status: p.status === 'GOING' ? ('MAYBE' as const) : ('GOING' as const),
      })),
    };
    expect(construireFeuille(mute).participants.map((p) => p.coche)).toEqual(avant);
  });

  it('changer `checkedIn` change la case — et c’est le seul champ qui le fait', () => {
    const charge2 = feuilleOrganisateur();
    const mute = {
      ...charge2,
      items: charge2.items.map((p) => ({ ...p, checkedIn: true })),
    };
    const lue = construireFeuille(mute);
    expect(lue.participants.every((p) => p.coche)).toBe(true);
    expect(lue.participants.some((p) => p.vide)).toBe(false);
  });

  /**
   * §3.3 : `POST /check-in` n'accepte que GOING, MAYBE et WAITLIST. Une ligne
   * `DECLINED` serait donc une case que personne ne peut cocher, et elle
   * gonflerait « sur N inscrits » d'un membre qui a dit non.
   */
  it('un membre qui a DÉCLINÉ ne figure pas dans la feuille, et ne compte pas', () => {
    const charge2 = feuilleOrganisateur();
    const avecRefus = {
      ...charge2,
      items: [
        ...charge2.items,
        {
          userId: '01a0f4e3-0000-7000-bfed-973540d2dccd',
          handle: 'refus-eprouve',
          displayName: 'Refus Éprouvé',
          avatarUrl: null,
          status: 'DECLINED' as const,
          checkedIn: false,
        },
      ],
    };
    const lue = construireFeuille(avecRefus);
    expect(lue.inscrits).toBe(3);
    expect(lue.participants.map((p) => p.nom)).not.toContain('Refus Éprouvé');
  });

  /**
   * §5 : la vue publique ne porte NI `userId` NI `checkedIn`. L'écran ne doit donc
   * afficher AUCUNE case — ni cochée, ni vide — et le compteur doit disparaître
   * plutôt que d'annoncer zéro présent, ce que le serveur n'a jamais dit.
   */
  it('sans la feuille de l’organisateur, aucune case n’est dessinée et le compteur disparaît', () => {
    const lue = construireFeuille(feuillePublique());
    expect(lue.participants.length).toBe(2);
    expect(lue.participants.some((p) => p.coche || p.vide)).toBe(false);
    expect(lue.compteur).toBe(false);
    expect(lue.presents).toBe(0);
  });
});

describe('les trois boutons de RSVP (E02)', () => {
  const ACTIF = '#16785E';

  it('GOING active « Je viens »', () => {
    expect(construireChoix('GOING').vient.fond).toBe(ACTIF);
    expect(construireChoix('GOING').refuse.fond).not.toBe(ACTIF);
  });

  /**
   * `WAITLIST` EST LA RÉPONSE DU MEMBRE, basculée par le serveur faute de place
   * (§3.2 : « Si `capacity` atteinte : WAITLIST »). Afficher « Je ne viens pas »
   * dans ce cas dirait l'inverse de ce que le membre a demandé.
   */
  it('WAITLIST active « Je viens », pas « Je ne viens pas »', () => {
    const choix = construireChoix('WAITLIST');
    expect(choix.vient.fond).toBe(ACTIF);
    expect(choix.refuse.fond).not.toBe(ACTIF);
    expect(choix.peutEtre.fond).not.toBe(ACTIF);
  });

  it('sans réponse, aucun bouton n’est actif', () => {
    const choix = construireChoix(null);
    expect([choix.vient.fond, choix.peutEtre.fond, choix.refuse.fond]).not.toContain(ACTIF);
  });

  it('DECLINED active « Je ne viens pas », et lui seul', () => {
    const choix = construireChoix('DECLINED');
    expect(choix.refuse.fond).toBe(ACTIF);
    expect(choix.vient.fond).not.toBe(ACTIF);
  });
});

describe('le fuseau de la VILLE, jamais celui du navigateur (§3.5)', () => {
  /**
   * La charge relevée porte `startsAt: 2026-10-02T10:00:00.000Z` et
   * `timeZone: Europe/Paris`. L'heure affichée doit être 12 h — celle de Lyon — et
   * non 10 h, celle d'UTC. Ce test tomberait sur un code qui formate dans le
   * fuseau local, ce qui est le défaut que §3.5 nomme.
   */
  it('un événement de 10 h UTC à Lyon s’affiche à 12 h', () => {
    const detail = fiche();
    expect(detail.startsAt).toBe('2026-10-02T10:00:00.000Z');
    expect(heure(detail.startsAt, detail.timeZone)).toBe('12 h');
    expect(heure(detail.startsAt, 'UTC')).toBe('10 h');
  });

  it('le jour civil d’un instant dépend du fuseau demandé', () => {
    // 2026-10-02T23:30Z : déjà le 3 à Paris, encore le 2 en UTC.
    const minuitMoinsLe = new Date('2026-10-02T23:30:00.000Z');
    expect(jourCivilDe(minuitMoinsLe, 'Europe/Paris')).toBe('2026-10-03');
    expect(jourCivilDe(minuitMoinsLe, 'UTC')).toBe('2026-10-02');
  });

  it('la fenêtre de « Je suis là » est bornée par les heures de l’événement', () => {
    const presence = construirePresence(fiche());
    expect(presence).toEqual({ debut: '12 h', fin: '16 h' });
  });

  /**
   * §3.3 : « actif de H−0 à H+6 ». Sans heure de fin, la borne haute est donc
   * `SELF_CHECKIN_WINDOW_MS` — la constante de `packages/shared`, pas un 6 écrit
   * ici : si la spec change, c'est la constante partagée qui bouge.
   */
  it('sans heure de fin, la fenêtre va jusqu’à H+6 (constante partagée)', () => {
    const detail = { ...fiche(), endsAt: null };
    expect(construirePresence(detail)).toEqual({ debut: '12 h', fin: '18 h' });
  });
});

describe('le panneau et son calendrier vertical (§3.5)', () => {
  it('le point est terre cuite quand j’y participe, vert quand c’est près de moi, absent sinon', () => {
    const panneau = construirePanneau(calendrier(), abonnement(), '2026-10-02', '2026-10-02');
    const jours = panneau.semaines.flatMap((s) => s.jours);

    // La charge relevée : le 2 octobre porte 6 événements dont 1 où je participe.
    const leDeux = jours.find((j) => j.numero === '2' && j.titre !== '');
    expect(leDeux?.point).toBe('#E0733A');

    const vide = jours.find((j) => j.titre === '');
    expect(vide?.point).toBeNull();
    expect(vide?.opacite).toBe('.45');
  });

  it('le jour sélectionné porte le fond et la graisse de la maquette', () => {
    const panneau = construirePanneau(calendrier(), abonnement(), '2026-10-02', '2026-10-02');
    const jours = panneau.semaines.flatMap((s) => s.jours);
    const choisis = jours.filter((j) => j.fond === '#E3F0EB');
    expect(choisis.length).toBe(1);
    expect(choisis[0]?.couleur).toBe('#0F5C48');
    expect(choisis[0]?.poids).toBe('700');
  });

  /**
   * « 14 événements CE MOIS-CI » : les jours des semaines débordantes ne doivent
   * pas être comptés, sinon le nombre dirait le mois ET ses bords.
   */
  it('le total du mois ne compte que les jours du mois', () => {
    const cal = calendrier();
    const horsMois = {
      ...cal,
      items: [...cal.items, { date: '2026-11-02', total: 99, attending: 0, firstTitle: 'Hors mois' }],
    };
    const avec = construirePanneau(horsMois, abonnement(), '2026-10-02', '2026-10-02');
    const sans = construirePanneau(cal, abonnement(), '2026-10-02', '2026-10-02');
    expect(avec.totalMois).toBe(sans.totalMois);
  });

  it('le quota vient de `usage.items`, et « illimité » remplace une limite nulle', () => {
    const abo = abonnement();
    const panneau = construirePanneau(calendrier(), abo, '2026-10-02', '2026-10-02');
    expect(panneau.quota).toMatchObject({ utilise: 1, plafond: '1' });
    // §4.5 : `limit` nul veut dire illimité — l'écran ne montre jamais « sur null ».
    const premium = {
      ...abo,
      usage: {
        ...abo.usage,
        items: abo.usage.items.map((i) =>
          i.metric === 'EVENTS_CREATED' ? { ...i, limit: null } : i,
        ),
      },
    };
    expect(
      construirePanneau(calendrier(), premium, '2026-10-02', '2026-10-02').quota.plafond,
    ).toBe('illimité');
  });

  it('les semaines sont celles de la maquette : ISO, et deux remplissages d’intitulé', () => {
    /**
     * LES SEMAINES SONT CELLES DE LA NORME, PAS CELLES DE LA MAQUETTE.
     *
     * La maquette intitule « SEMAINE 38 » un groupe qui va de lundi 16 à dimanche
     * 22 septembre et met un SAMEDI 21 dedans — or le 21 septembre 2026 est un
     * lundi. Son calendrier est une fiction cohérente avec elle-même, pas avec
     * 2026 : ce sont donc les semaines ISO réelles qui sont vérifiées ici.
     *
     * La première version de `semaineIso` rendait 38 pour le lundi 21 — soit la
     * semaine précédente. Un intitulé faux ne décale rien à l'écran, donc aucun
     * test de forme ne l'aurait vu.
     */
    expect(semaineIso('2026-09-21')).toBe(39);
    expect(semaineIso('2026-09-20')).toBe(38);
    expect(semaineIso('2026-01-01')).toBe(1);
    // 2026-12-31 est un jeudi : il appartient encore à la semaine 53 de 2026.
    expect(semaineIso('2026-12-31')).toBe(53);

    const panneau = construirePanneau(calendrier(), abonnement(), '2026-10-02', '2026-10-02');
    expect(panneau.semaines[0]?.marge).toBe('6px 10px');
    expect(panneau.semaines[1]?.marge).toBe('10px 10px 6px');
    // Un jour par ligne, aucune perte : la grille rendue est celle du serveur.
    expect(panneau.semaines.flatMap((s) => s.jours).length).toBe(calendrier().items.length);
  });

  it('la bande du mobile montre sept jours, le jour choisi en troisième', () => {
    const bande = construireBande(calendrier(), '2026-10-05');
    expect(bande.length).toBe(7);
    expect(bande[2]?.numero).toBe('5');
    expect(bande[2]?.fond).toBe('#16785E');
    // Un jour vide garde son point, en transparent : c'est le dessin de la maquette.
    expect(bande.every((j) => j.point !== null)).toBe(true);
  });
});

describe('la fiche d’un événement (E02)', () => {
  it('une capacité absente fait disparaître « sur N places » au lieu d’écrire « sur null »', () => {
    const sansCapacite = { ...fiche(), capacity: null };
    expect(construireFiche(sansCapacite, new Map()).places).toBeNull();
    expect(construireFiche(fiche(), new Map()).places).toBe(40);
  });

  it('sans nom de lieu, c’est la ville qui s’affiche — aucune ligne vide, aucun « null »', () => {
    const sansLieu = { ...fiche(), venueName: null };
    const construite = construireFiche(sansLieu, new Map());
    expect(construite.lieu).toBe('Lyon');
    expect(construite.lieuCourt).toBe('Lyon');
    // Aucun « null » AFFICHÉ : les nuls qui restent (réseau, reste, places) sont
    // ceux qui font DISPARAÎTRE un élément, et ils sont éprouvés à côté.
    for (const texte of [construite.lieu, construite.lieuCourt, construite.adresse, construite.quand]) {
      expect(texte).not.toMatch(/null|undefined|NaN/);
      expect(texte.length).toBeGreaterThan(0);
    }
  });

  /**
   * RÈGLE DURE §10 : un événement réservé n'est visible que par les membres actifs
   * de son réseau. Le NOM, lui, ne vient pas de l'événement — qui ne porte qu'un
   * `communityId` — mais de `GET /communities`. Sans correspondance, la pastille
   * disparaît : on n'affiche pas un UUID à un membre.
   */
  it('le réseau n’est nommé que si je le connais, et jamais par son identifiant', () => {
    const reserve = { ...fiche(), communityId: '01a0f4e3-81a9-7000-8d47-89b731907acb' };
    expect(construireFiche(reserve, new Map()).reseau).toBeNull();
    expect(
      construireFiche(reserve, new Map([['01a0f4e3-81a9-7000-8d47-89b731907acb', 'Béninois en France']]))
        .reseau,
    ).toBe('Béninois en France');
  });

  it('les avatars s’arrêtent à trois, et le reste est compté', () => {
    const foule = {
      ...fiche(),
      attendeeCount: 27,
      attendees: Array.from({ length: 10 }, (_, i) => ({
        handle: `membre-${i}`,
        displayName: `Membre ${i}`,
        avatarUrl: null,
      })),
    };
    const construite = construireFiche(foule, new Map());
    expect(construite.avatars.length).toBe(3);
    expect(construite.reste).toBe(24);
    // Trois participants exactement : plus rien à compter, le rond gris disparaît.
    const juste = { ...foule, attendeeCount: 3, attendees: foule.attendees.slice(0, 3) };
    expect(construireFiche(juste, new Map()).reste).toBeNull();
  });
});
