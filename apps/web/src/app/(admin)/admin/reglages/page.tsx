import { ScreenFrames } from '@/screens/frames';
import { D15Desktop } from '@/screens/d15/desktop.generated';

/**
 * D15 — réglages d'équipe. `/admin/reglages` (15 §4.3, §4.4, §2.2, §2.3).
 *
 * Quatre onglets : Feature flags · Paramètres système · Équipe · Journal d'audit.
 *
 * LE JOURNAL D'AUDIT EST LA CONTREPARTIE VISIBLE DE LA RÈGLE DURE §2.3 : « toute
 * écriture depuis l'application admin passe par `AuditService.record()` avant
 * validation de la transaction ». La maquette le dessine avec ses colonnes DATE,
 * ACTEUR, ACTION, CIBLE, ses quatre filtres (acteur, action, cible, période) et
 * son export — c'est-à-dire tout ce que §2.3 exige. Les trois lignes montrées sont
 * d'ailleurs trois écritures des autres écrans de ce lot : un retrait de contenu
 * (#4812, D05), une activation de ville (Nantes, D08) et une modification de flag
 * (stories_v2, ici même). La boucle se referme à l'écran.
 *
 * §2.3 ajoute « aucune suppression possible ; rétention 5 ans » : la maquette ne
 * dessine aucun bouton de suppression dans ce journal, et il n'y en a donc aucun.
 */
export default function Page() {
  return <ScreenFrames screen="D15" desktop={<D15Desktop />} />;
}
