import { ScreenFrames } from '@/screens/frames';
import { D09Desktop } from '@/screens/d09/desktop.generated';

/**
 * D09 — les guides côté équipe. `/admin/guides` (T5 D09).
 *
 * Trois onglets : propositions escaladées (avant / après, Accepter / Refuser),
 * signalés obsolètes (avec le délai avant dépublication), et Tous.
 *
 * L'AVANT / APRÈS est dessiné mot à mot par la maquette — « dès l'obtention du
 * VLS-TS » devient « dès la validation du VLS-TS sur l'ANEF », la partie retirée
 * barrée et la partie ajoutée soulignée. C'est le cœur de l'écran, et il est
 * transcrit tel quel.
 *
 * Le délai avant dépublication (« dépublication dans 6 jours ») est ce qui rend
 * « Forcer la publication » et « Retour arrière » compréhensibles : la décision a
 * une échéance. Aucun des six boutons n'est branché.
 */
export default function Page() {
  return <ScreenFrames screen="D09" desktop={<D09Desktop />} />;
}
