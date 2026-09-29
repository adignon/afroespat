import { ScreenFrames } from '@/screens/frames';
import { D04Desktop } from '@/screens/d04/desktop.generated';

/**
 * D04 — la file de modération. `/admin/moderation` (13 §4.1, T5 D04).
 *
 * « Une file unique, triée par priorité puis `sla_due_at` » (§4.1), et la
 * maquette la dessine exactement ainsi : colonnes PRIO, SUJET, AUTEUR, SOURCE,
 * SIGN., ASSIGNÉ, SLA, et un « Prendre » par ligne. Le SLA est affiché avec son
 * état — « dépassé », « 2 h », « 3 h », « 9 h », « 20 h » — ce que §4.1 impose
 * (`sla_due_at = created_at + 24 h`, 4 h en priorité 1).
 *
 * La SOURCE est celle des trois origines de §2 et §3 : « Signalement », « IA »,
 * « Règle prix ». Elle importe : §2 est une règle dure — « l'IA ne suspend jamais
 * un compte et ne supprime jamais définitivement un contenu. Elle masque et met en
 * file ; un humain tranche. » La file est l'endroit où cette règle devient
 * visible, et l'écran ne fait rien d'autre que la montrer.
 *
 * « Prendre » est dessiné en `<span>` par la maquette et n'est pas branché :
 * prendre un dossier écrit `assigned_staff_id`, donc une ligne d'audit (15 §2.3,
 * règle dure). Ce lot ne branche aucune route.
 */
export default function Page() {
  return <ScreenFrames screen="D04" desktop={<D04Desktop />} />;
}
