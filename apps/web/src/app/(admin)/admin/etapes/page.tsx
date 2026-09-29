import { ScreenFrames } from '@/screens/frames';
import { D07Desktop } from '@/screens/d07/desktop.generated';

/**
 * D07 — la bibliothèque d'étapes. `/admin/etapes` (T5 D07, 15 §5.2).
 *
 * Le tableau des 84 définitions et l'éditeur de `LOG-01` dans le même cadre.
 *
 * LES STATISTIQUES OBSERVÉES sont celles de 15 §5.2 — « délais réels par étape :
 * médiane … proposés comme `default_duration_days` à la prochaine version » et
 * « étapes bloquantes … suggère `is_risky` ». La maquette les affiche (4,6 sem. de
 * délai médian, 21 % de taux de blocage) avec le bouton « Appliquer comme durée
 * indicative ». Elles viennent de `/stats/steps` et `/stats/blockers` (15 §7),
 * routes que ce lot ne branche pas.
 *
 * RÈGLE DURE (§5.2) : « aucune statistique n'affiche un taux de réussite ou
 * d'échec côté membres. Ces données restent dans l'admin. » C'est précisément
 * pourquoi ce taux de blocage est dessiné ICI et n'apparaît sur aucun écran de
 * `(app)`.
 */
export default function Page() {
  return <ScreenFrames screen="D07" desktop={<D07Desktop />} />;
}
