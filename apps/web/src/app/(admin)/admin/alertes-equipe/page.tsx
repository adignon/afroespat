import { ScreenFrames } from '@/screens/frames';
import { D17Desktop } from '@/screens/d17/desktop.generated';

/**
 * D17 — Les alertes d'équipe (13 §4.4, 15 §2.1) : délai de modération et verrouillages de compte, avec
 * « Marquer lu ». AJOUT hors maquette : le châssis est celui de D04, le contenu est le composant
 * `ContenuAlertesEquipe` (adaptation `administration-vivante`).
 */
export default function Page() {
  return <ScreenFrames screen="D17" desktop={<D17Desktop />} />;
}
