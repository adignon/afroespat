import { ScreenFrames } from '@/screens/frames';
import { S06Desktop } from '@/screens/s06/desktop.generated';
import { S06Mobile } from '@/screens/s06/mobile.generated';

/**
 * S06 — Annuaire professionnel, la liste (`/services/annuaire`, 10 §4.2).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé et la raison pour laquelle cette page n'a
 * pas d'état.
 *
 * 10 §4.2 : « Les fiches PRO/PRO_PLUS obtiennent un emplacement mis en avant
 * CLAIREMENT SIGNALÉ (“Fiche mise en avant”) : au plus 2 fiches mises en avant en
 * tête, puis le classement naturel. » La maquette écrit la mention en toutes
 * lettres au-dessus des deux premières fiches, et la troisième n'en a pas. Les
 * deux moitiés de la règle — la mention et la borne de deux — sont donc
 * vérifiables à l'écran, et `e2e/services.spec.ts` les fige.
 */
export default function AnnuaireListePage() {
  return <ScreenFrames screen="S06" desktop={<S06Desktop />} mobile={<S06Mobile />} />;
}
