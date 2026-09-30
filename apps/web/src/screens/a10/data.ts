/**
 * Les PRISES de l'écran A10 — « créer un réseau d'intérêt ».
 *
 * Déclarées et non déduites d'un exemple : voir l'en-tête de `a07/data.ts`.
 *
 * ── LES DEUX PORTES DE CET ÉCRAN, ET AUCUNE N'EST GARDÉE PAR LE FRONT ──────
 *
 * Créer un réseau franchit deux refus possibles, et l'écran ne DEVANCE ni l'un
 * ni l'autre :
 *
 *   1. LE NIVEAU. `community.create` est L1. On ne lit pas le niveau pour griser
 *      le bouton — un niveau lu une fois et gardé, c'est la faille de quinze
 *      minutes rejouée dans le front. On TENTE, et le serveur répond, mesuré :
 *
 *        403 LEVEL_REQUIRED · requiredLevel "L1" · currentLevel "L0"
 *                           · labelFr "créer un réseau"
 *
 *      C'est de quoi afficher l'INVITATION à monter de niveau que §7.3 exige —
 *      une invitation, jamais une erreur sèche.
 *
 *   2. LE SEUIL DE LA VILLE. `creationGate` arrive dans `GET /communities` et
 *      porte `canCreate`, `required`, `current`, `cityName`. Il est RECALCULÉ à
 *      chaque appel côté serveur, donc il ne périme pas ; il sert à écrire la
 *      phrase entière — « Les réseaux d'intérêt ouvrent à partir de 50 membres à
 *      Lyon (34 aujourd'hui) » — et non à autoriser. Le service revérifie le
 *      seuil à la création, sinon un appel direct suffirait à le contourner.
 *
 * LA RÈGLE DES CINQ INVITATIONS, elle, est dans le SCHÉMA PARTAGÉ
 * (`COMMUNITY_MIN_INVITES`). Le compteur « 3 sur 5 » de cet écran lit la même
 * constante que l'API refuse : c'est ce qui empêche l'écran d'autoriser quatre
 * invités là où le serveur en exige cinq.
 */
export { I, panel, panelReseaux, rail } from '../reseaux/chrome';
import { panel, panelReseaux, rail } from '../reseaux/chrome';

/**
 * Une ligne de la liste d'invitation.
 *
 * `handle` n'est jamais dessiné : c'est pourtant lui que `POST /communities`
 * attend — `inviteHandles` est une liste de HANDLES, pas d'identifiants. Il
 * voyage donc avec la ligne, faute de quoi il faudrait le retrouver par le nom
 * affiché, qui n'est pas unique.
 *
 * `invited` pilote les trois prises de bouton ensemble. Elles sont posées par le
 * convertisseur plutôt que calculées dans le JSX, parce que le JSX transcodé ne
 * décide de rien.
 */
export interface InviteeView {
  readonly i: string;
  readonly name: string;
  readonly sub: string;
  readonly bg: string;
  readonly invited: boolean;
  readonly btn: string;
  readonly btnBg: string;
  readonly btnFg: string;
  readonly handle: string;
}

/**
 * Les trois visibilités de §7.
 *
 * « Sur invitation » est INVISIBLE dans Découvrir — la maquette l'écrit, et
 * c'est la règle du dossier, pas un détail d'affichage : le service l'exclut du
 * `WHERE` de la découverte. Le libellé dit donc une conséquence réelle.
 */
export const visibilityFor = (active: number) =>
  [
    { t: 'Public', s: 'Tout membre peut voir et rejoindre.', v: 'PUBLIC' as const },
    {
      t: 'Sur demande',
      s: 'Les membres demandent à rejoindre, vous acceptez.',
      v: 'ON_REQUEST' as const,
    },
    {
      t: 'Sur invitation',
      s: 'Invisible dans Découvrir. Accès par invitation seulement.',
      v: 'INVITE_ONLY' as const,
    },
  ].map((x, i) => {
    const on = i === active;
    return {
      t: x.t,
      s: x.s,
      v: x.v,
      on,
      bg: on ? '#EFF7F3' : '#fff',
      bd: on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
      radio: on ? '6px solid #16785E' : '1.5px solid #CBD5D1',
    };
  });

export const visibility = visibilityFor(0);

export const invitees: readonly InviteeView[] = [];

export interface A10Data {
  rail: typeof rail;
  shortcuts: readonly { name: string; sub: string; i: string; bg: string }[];
  panelReseaux: ReturnType<typeof panel>;
  visibility: ReturnType<typeof visibilityFor>;
  invitees: readonly InviteeView[];
}

export const shortcuts: readonly { name: string; sub: string; i: string; bg: string }[] = [];

export const a10Fallback: A10Data = { rail, shortcuts, panelReseaux, visibility, invitees };
