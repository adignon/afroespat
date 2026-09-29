import { ScreenFrames } from '@/screens/frames';
import { D11Desktop } from '@/screens/d11/desktop.generated';

/**
 * D11 — les alertes arnaques. `/admin/alertes` (13 §5, T5 D11).
 *
 * L'éditeur (titre, texte, gravité, ciblage, expiration, dossier lié, épinglage)
 * et, à droite, l'APERÇU TEL QUE LE MEMBRE LE VERRA. Cet aperçu est ce qui rend
 * l'écran honnête : §5 dit qu'« une alerte épinglée apparaît dans la colonne
 * droite de l'accueil », et l'équipe voit ici ce qu'elle va y poser.
 *
 * Les trois gravités dessinées — Info, Vigilance, Urgente — n'emploient AUCUN
 * rouge, et c'est la règle dure de 00 §1.2 (T1 §2.1) : « aucun rouge dans
 * l'interface ». La maquette s'y tient jusque dans une alerte d'arnaque urgente ;
 * `packages/config/guardrails/check-colors.mjs` garde les jetons, le transcodage
 * garde le reste.
 */
export default function Page() {
  return <ScreenFrames screen="D11" desktop={<D11Desktop />} />;
}
