import type { NotificationCategory } from '@app/shared';
import type { BarreHaute } from '../messages/data';

/**
 * Données de X02 — les notifications, page complète, panneau déroulant et mobile.
 *
 * ── CE FICHIER A CHANGÉ DE NATURE ───────────────────────────────────────────
 *
 * Les trois cadres de X02 recevaient `MessagesData`, c'est-à-dire
 * `Record<string, never>` : ils portaient une signature `(_props: …)`, et le
 * souligné disait que le paramètre n'était pas lu. La maquette
 * `09 Messages et transverse.dc.html` n'emploie pas le dialecte — zéro `{{ … }}`,
 * zéro `<sc-for>`, comptés — donc il n'existait aucune prise où brancher l'API.
 *
 * La prise est maintenant DÉCLARÉE, dans `tools/screens/09-messages.mjs` sous la
 * clé `donnees`, et le JSX transcodé n'a pas bougé d'une virgule : le générateur
 * produit des cadres qui lisent leurs propriétés. La FORME vient de la maquette ;
 * la DONNÉE et le COMPORTEMENT vivent ici et dans `screens/messages/appels.ts`.
 *
 * ── LA RÈGLE LA PLUS GRAVE DE CE MODULE PASSE PAR ICI ───────────────────────
 *
 * 12 §2.4, ET 08 §8.1 : « un push MESSAGE ne contient jamais le corps du
 * message ». Elle n'est PAS tenue par ce fichier — elle est tenue par
 * `notificationSchema` dans `packages/shared`, qui REFUSE une réponse où une
 * notification de catégorie `MESSAGE` porte un corps, et qui est `.strict()` pour
 * qu'un `preview` ou un `excerpt` greffé soit rejeté au lieu d'être dépouillé en
 * silence. Le détail et le pourquoi sont là-bas.
 *
 * Ce qu'il faut savoir ici : `corps` ci-dessous peut donc être vide, et il DOIT
 * pouvoir l'être. Une notification de message n'a pas de seconde ligne, et lui en
 * composer une — « Nouveau message », « Il vous a écrit » — reviendrait à écrire
 * côté front le texte que le serveur a délibérément laissé nul.
 */

/**
 * Une ligne de notification, prête à poser dans le gabarit de la maquette.
 *
 * TOUT EST DÉJÀ MIS EN FORME : la couleur, l'heure relative, le glyphe. Le cadre
 * transcodé ne décide rien — il n'a ni condition, ni calcul, ni horloge.
 *
 * `fond` et `fondIcone` SONT DES COULEURS DE LA MAQUETTE, relevées sur ses propres
 * planches : `#E3F0EB` sur `#fff` pour une ligne non lue, `#F6F8F7` sur `#F2F5F4`
 * pour une ligne lue. Aucune n'est assombrie — le garde-fou de contraste de ce
 * projet est tenu à 16/24 par décision du porteur, et retoucher un hexadécimal
 * arrête la génération.
 *
 * `glyphe` est le tracé `d` du `<path>` de la pastille, OU LA CHAÎNE VIDE. Le vide
 * n'est pas un oubli : la maquette dessine cinq glyphes pour quatorze catégories
 * (voir `GLYPHES_X02`), et une catégorie sans glyphe dessiné laisse la pastille
 * vide plutôt que d'emprunter celui d'une autre. Le manque se voit.
 */
export interface LigneNotification {
  readonly fond: string;
  readonly fondIcone: string;
  readonly glyphe: string;
  /** `title` de l'API — ce que la maquette met en gras. */
  readonly titre: string;
  /** `body` de l'API, précédé d'une espace, ou vide. JAMAIS un corps de message. */
  readonly corps: string;
  /** L'heure relative : « 5 min », « 1 h », « hier », « lun. ». */
  readonly quand: string;
  readonly nonLu: boolean;
}

/**
 * X02 — les trois planches lisent la même liste.
 *
 * `nonLusTotal` vient de `meta.unread` et N'EST AFFICHÉ NULLE PART : aucune des
 * trois planches ne dessine le compteur que 12 §2.7 demande (« cloche en barre
 * haute avec compteur de non-lus »). Il est néanmoins lu et validé, parce que le
 * jour où la maquette dessinera la pastille, la donnée sera là — et parce qu'une
 * réponse qui ne le porterait plus doit être refusée tout de suite. Signalé au
 * porteur plutôt que silencieusement ignoré.
 */
export interface X02Data {
  readonly moi: BarreHaute;
  readonly lignes: readonly LigneNotification[];
  readonly nonLusTotal: number;
}

/**
 * ─── LES CINQ GLYPHES QUE LA MAQUETTE DESSINE, ET LES NEUF QU'ELLE NE DESSINE PAS
 *
 * Chaque tracé est RELEVÉ sur la planche de X02, au caractère près, et aucun n'est
 * retouché. La maquette dessine cinq lignes — réactions, entraide, échéance de
 * parcours, événement, parrainage — donc cinq glyphes, pour les cinq catégories
 * qu'elles illustrent.
 *
 * `NOTIFICATION_CATEGORIES` en compte QUATORZE. Les neuf autres n'ont de glyphe
 * dans AUCUNE planche de ce produit, et cette table ne leur en invente pas : une
 * catégorie absente rend `undefined`, le chargeur en fait la chaîne vide, le
 * `<sc-if>` du gabarit ne pose aucun `<path>`, et la pastille reste VIDE.
 *
 * C'est délibéré, et c'est le moins mauvais des trois choix possibles :
 *   · recycler un glyphe voisin déciderait qu'une sanction de modération ressemble
 *     à un repas partagé ;
 *   · n'en poser aucun et laisser le gabarit figé donnerait le pouce des réactions
 *     à treize catégories sur quatorze ;
 *   · laisser la pastille vide ne dit rien de faux, et le manque SE VOIT — ce qui
 *     est exactement ce qu'il faut pour que le porteur le tranche.
 *
 * ⚠ VU À L'ÉCRAN : la ligne « Nouveau message de … » porte donc une pastille vide,
 * et cela RESSEMBLE à un défaut. C'est le manque, rendu visible. Il faut neuf
 * glyphes au porteur — `MESSAGE` en premier, puisque c'est la catégorie la plus
 * fréquente de ce module.
 *
 * ── POURQUOI CETTE TABLE EST ICI ET NON DANS `appels.ts` ───────────────────
 *
 * Parce qu'elle est une donnée de MAQUETTE, comme les deux pastilles de couleur de
 * K03 — et parce que `glyphes.test.ts` doit pouvoir la lire sans tirer le socle
 * d'appel avec elle. Un test qui importe `appels.ts` importe `@/lib/api`, que
 * vitest ne sait pas résoudre dans ce paquet ; la table n'a besoin de rien.
 */
export const GLYPHES_X02: Partial<Record<NotificationCategory, string>> = {
  SOCIAL: 'M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7',
  HELP: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  JOURNEY_DEADLINE: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  EVENT: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  MENTORSHIP:
    'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
};
