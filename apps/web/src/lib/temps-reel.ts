import { io, type Socket } from 'socket.io-client';
import { REALTIME_TYPING_CLIENT_EVENT, type RealtimeEventName } from '@app/shared';
import { API_BASE } from '@/lib/api/base';
import { bearerHeader, hasAccessToken, isSessionDead } from '@/lib/api/session';
import { resumeSession } from '@/lib/api/member';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE CLIENT TEMPS RÉEL — UNE SEULE CONNEXION PAR ONGLET (08 §7.3, T4 §7)      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La passerelle `/ws` existait côté API et le navigateur n'avait AUCUN client : un
 * message n'apparaissait qu'au rechargement. Ce module est ce client.
 *
 * ── UN SEUL SOCKET, ET QUI S'ÉTEINT TOUT SEUL ───────────────────────────────
 *
 * Plusieurs composants veulent les mêmes événements (la barre haute, la liste de
 * conversations, le fil ouvert). Chacun s'abonne par `ecouter()` ; la connexion
 * s'ouvre au premier abonné et se ferme quand le dernier part, après un court
 * délai : React en mode strict monte, démonte, remonte, et une connexion ouverte
 * puis fermée à chaque rendu de développement serait du bruit.
 *
 * ── LE JETON ────────────────────────────────────────────────────────────────
 *
 * Le jeton d'accès vit en mémoire (`api/session.ts`, qui n'offre que
 * `bearerHeader()`). Il est lu AU MOMENT de chaque connexion, jamais copié :
 * `auth` est une fonction que socket.io réévalue à chaque tentative. Il dure
 * quinze minutes et la passerelle revérifie les sockets ouverts chaque minute —
 * donc elle COUPE, avec `refused` { code }, un socket dont le jeton a vécu. Le
 * client reprend alors la session (`resumeSession`, la MÊME promesse partagée que
 * le reste du front, donc aucune rotation de plus) et se reconnecte. `TOKEN_STALE`
 * (niveau modifié) suit le même chemin ; `UNAUTHENTICATED` après une reprise
 * ratée arrête les essais — le repli en polling prend le relais.
 *
 * ── CE QUI N'EST JAMAIS FAIT ICI ────────────────────────────────────────────
 *
 * Aucune donnée n'est lue dans les charges : elles disent « il y a du nouveau »
 * (un identifiant, un compteur), pas ce qu'est ce nouveau. Les écrans relisent par
 * l'API, qui applique les mêmes contrôles qu'ailleurs.
 */

type Ecouteur = (payload: unknown) => void;

/** L'événement interne émis à chaque (re)connexion : « relisez, vous avez pu manquer des choses ». */
export const RESYNCHRONISER = 'resync';
export type EvenementClient = RealtimeEventName | typeof RESYNCHRONISER;

const ecouteurs = new Map<EvenementClient, Set<Ecouteur>>();
const ecouteursEtat = new Set<(connecte: boolean) => void>();
let socket: Socket | null = null;
let abonnes = 0;
let arret: ReturnType<typeof setTimeout> | null = null;
let connecte = false;
/** Évite deux reprises de session simultanées lors d'un refus en rafale. */
let reprise: Promise<boolean> | null = null;
let echecsDeSuite = 0;
const ECHECS_MAX = 3;

function origineDeLApi(): string {
  return API_BASE.replace(/\/v\d+$/, '');
}

function jeton(): string | null {
  const entete = bearerHeader();
  const brut = entete?.['authorization'];
  return brut === undefined ? null : brut.replace(/^Bearer\s+/i, '');
}

function emettreEtat(valeur: boolean): void {
  if (connecte === valeur) return;
  connecte = valeur;
  ecouteursEtat.forEach((e) => {
    e(valeur);
  });
}

function diffuser(evenement: EvenementClient, payload: unknown): void {
  ecouteurs.get(evenement)?.forEach((e) => {
    try {
      e(payload);
    } catch {
      // Un écouteur fautif ne doit pas priver les autres de leur événement.
    }
  });
}

async function reprendre(): Promise<boolean> {
  reprise ??= resumeSession().finally(() => {
    reprise = null;
  });
  return reprise;
}

async function ouvrir(): Promise<void> {
  if (socket !== null || typeof window === 'undefined') return;
  if (!hasAccessToken()) {
    if (isSessionDead() || !(await reprendre())) return;
  }
  if (socket !== null || abonnes === 0) return;

  const s = io(origineDeLApi(), {
    path: '/ws',
    transports: ['websocket', 'polling'],
    // Réévalué à CHAQUE tentative : un jeton rafraîchi entre deux est repris.
    auth: (rappel) => {
      rappel({ token: jeton() ?? '' });
    },
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 15_000,
  });
  socket = s;

  /**
   * DÉFAUT CORRIGÉ (révélé par la batterie e2e) : le compteur d'échecs était remis à
   * zéro à `connect`, c'est-à-dire à la POIGNÉE DE MAIN. Or la passerelle accepte la
   * poignée de main puis chasse le client si le jeton est refusé (`io server
   * disconnect`) : chaque tour remettait le compteur à zéro, et la boucle
   * « refus → /auth/refresh → connect → refus » tournait sans fin — MESURÉ : 530
   * `POST /auth/refresh` en huit secondes, sur une route limitée à 30. Le compteur
   * ne retombe désormais qu'à `ready`, quand le jeton est vraiment ADMIS.
   */
  // La passerelle dit « ready » une fois le jeton ADMIS : c'est là que le temps
  // réel est vraiment disponible, pas à la poignée de main.
  s.on('ready', () => {
    echecsDeSuite = 0;
    emettreEtat(true);
    diffuser(RESYNCHRONISER, null);
  });
  s.on('disconnect', (raison) => {
    emettreEtat(false);
    // Fermeture voulue par le serveur (jeton vieilli, niveau changé) : socket.io ne
    // retente pas de lui-même dans ce cas. On reprend la session puis on rouvre.
    if (raison === 'io server disconnect') void rouvrirApresRefus();
  });
  s.on('refused', () => {
    emettreEtat(false);
  });
  s.on('connect_error', () => {
    emettreEtat(false);
  });
  for (const nom of ['message.new', 'message.read', 'conversation.updated', 'notification.new', 'conversation.typing'] as const) {
    s.on(nom, (payload: unknown) => {
      diffuser(nom, payload);
    });
  }
}

async function rouvrirApresRefus(): Promise<void> {
  const s = socket;
  if (s === null || abonnes === 0) return;
  echecsDeSuite += 1;
  // Trois refus de suite après une reprise réussie : le serveur ne veut plus de nous
  // (compte suspendu, par exemple). On s'arrête ; le polling reste le filet.
  if (echecsDeSuite > ECHECS_MAX) return;
  const ok = await reprendre();
  if (!ok || socket !== s || abonnes === 0) return;
  s.connect();
}

function fermer(): void {
  socket?.removeAllListeners();
  socket?.close();
  socket = null;
  emettreEtat(false);
}

/**
 * S'abonne à un événement. Renvoie la fonction qui se désabonne.
 *
 * La première inscription ouvre la connexion ; la dernière désinscription la
 * ferme, avec un sursis.
 */
export function ecouter(evenement: EvenementClient, rappel: Ecouteur): () => void {
  let liste = ecouteurs.get(evenement);
  if (liste === undefined) {
    liste = new Set();
    ecouteurs.set(evenement, liste);
  }
  liste.add(rappel);

  abonnes += 1;
  if (arret !== null) {
    clearTimeout(arret);
    arret = null;
  }
  void ouvrir();

  return () => {
    liste.delete(rappel);
    abonnes -= 1;
    if (abonnes <= 0) {
      abonnes = 0;
      arret = setTimeout(() => {
        arret = null;
        if (abonnes === 0) fermer();
      }, 1_500);
    }
  };
}

/** Suit l'état de la connexion (vrai quand la passerelle a admis le jeton). */
export function suivreConnexion(rappel: (connecte: boolean) => void): () => void {
  ecouteursEtat.add(rappel);
  return () => {
    ecouteursEtat.delete(rappel);
  };
}

export function estConnecte(): boolean {
  return connecte;
}

/**
 * « Je suis en train d'écrire » — au plus une émission par intervalle, la
 * passerelle en refuse davantage de toute façon. Sans effet hors connexion : une
 * frappe n'est jamais rejouée, elle est éphémère par construction.
 */
export function signalerFrappe(conversationId: string): void {
  if (socket === null || !connecte) return;
  socket.emit(REALTIME_TYPING_CLIENT_EVENT, { conversationId });
}

/** Pour les épreuves : oublie tout. */
export function reinitialiserTempsReel(): void {
  ecouteurs.clear();
  ecouteursEtat.clear();
  abonnes = 0;
  fermer();
}
