import { ScreenFrames } from '@/screens/frames';
import { D05Desktop } from '@/screens/d05/desktop.generated';

/**
 * D05 — le dossier de modération. `/admin/moderation/:id` (13 §4.2, T5 D05).
 *
 * TROIS COLONNES, comme T5 les décrit : contenu (intégral, conversation jointe) ·
 * contexte (sanctions, dossiers, signalements avec motifs, verdict IA et
 * étiquettes) · actions.
 *
 * LE MOTIF DE 20 CARACTÈRES EST DESSINÉ, et c'est ce qui rend la règle de §4.2
 * visible : « une suspension ou un bannissement exige un motif d'au moins 20
 * caractères ». La maquette écrit le libellé « Motif · 20 caractères minimum » et
 * un compteur « 48 / 20 » à côté d'« Appliquer ». `e2e/administration.spec.ts`
 * mesure les deux.
 *
 * « Bannir · super-admin » porte son rôle dans son libellé — §4.2 : « `BAN_USER` —
 * `SUPER_ADMIN` seulement ». L'écran ne décide rien : c'est le garde de rôle côté
 * API qui tranche, et il existe déjà.
 *
 * LA CONVERSATION JOINTE est l'unique exception à la règle dure de 15 §3.1 (« ni
 * ne permet de lire une conversation privée hors d'un dossier de modération qui la
 * joint »). La maquette la dessine ici, et nulle part ailleurs — « Conversation
 * jointe (4 messages) ». C'est cohérent avec 13 §3 : « le signalement d'un message
 * privé joint la conversation au dossier ».
 *
 * Le paramètre d'URL n'est pas lu : la maquette dessine UN dossier, « #4812 », et
 * c'est lui le titre de la page. Rien n'est chargé, donc rien ne dépend de l'`id`.
 */
export default function Page() {
  return <ScreenFrames screen="D05" desktop={<D05Desktop />} />;
}
