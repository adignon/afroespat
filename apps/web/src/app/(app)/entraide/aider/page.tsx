import { ScreenFrames } from '@/screens/frames';
import { H04Desktop } from '@/screens/h04/desktop.generated';
import { H04Mobile } from '@/screens/h04/mobile.generated';

/**
 * H04 — Vous pouvez aider (`/entraide/aider`, 06 §2.6 et §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`.
 *
 * LE TRI EST CELUI DE LA SPEC : « échéance proche d'abord » (06 §2.6), et la
 * maquette l'écrit sous son numéro de planche — « tri par échéance ». Aucun plan
 * d'abonnement n'y donne de priorité d'affichage, ce qu'exige 14 §2 et que le
 * module `help` respecte côté serveur : aucune de ses routes ne lit `users.plan`.
 */
export default function CanHelpPage() {
  return <ScreenFrames screen="H04" desktop={<H04Desktop />} mobile={<H04Mobile />} />;
}
