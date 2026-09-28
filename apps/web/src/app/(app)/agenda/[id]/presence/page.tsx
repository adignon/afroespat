import { ScreenFrames } from '@/screens/frames';
import { E04Desktop } from '@/screens/e04/desktop.generated';
import { E04Mobile } from '@/screens/e04/mobile.generated';

/**
 * E04 — Présence, vue organisateur (`/agenda/:id/presence`, 09 §3.3).
 *
 * Transcodé de `docs/template/07 Agenda.dc.html`.
 *
 * Le cadre mobile titre « Présence · 18 / 23 » : le compteur est DANS le titre, faute
 * de place pour le sous-titre que l'ordinateur affiche à côté. Le titre déclaré le
 * reprend tel quel plutôt que de le raccourcir.
 *
 * Les cases « Présent·e » sont dessinées, pas cochables — voir H03 pour la raison.
 * C'est cette donnée qui alimentera l'indicateur clé du projet (09 §3.3) et la règle
 * « EVENT_ORGANIZED seulement avec au moins 3 présents cochés ».
 */
export default function EventAttendancePage() {
  return <ScreenFrames screen="E04" desktop={<E04Desktop />} mobile={<E04Mobile />} />;
}
