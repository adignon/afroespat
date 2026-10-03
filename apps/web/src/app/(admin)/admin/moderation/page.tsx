'use client';

import { chargerD04 } from '@/screens/administration/appels';
import { EcranDonneesEquipe } from '@/screens/administration/ecran-donnees';
import { SQUELETTE_D04 } from '@/screens/administration/data';
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
 * règle dure). Aucune écriture n'est branchée dans ce module.
 *
 * ─── UN SEUL NOMBRE EST LIÉ, ET LA FILE RESTE DESSINÉE ───────────────────────
 *
 * « 46 dossiers ouverts » vient de `GET /admin/moderation/stats` : la somme de
 * `openByPriority`, relevée à 1 847. C'est la bonne source, et pas la mesure du
 * tableau de bord (`moderation.cases_by_status/OPEN`, 1 811) : les deux sont
 * justes et ne comptent pas la même chose — 36 dossiers sont `IN_REVIEW`, et ils
 * sont bien dans la file.
 *
 * LE TABLEAU, LUI, N'EST PAS LIÉ, parce que `GET /admin/moderation/cases` sert
 * TROIS de ses sept colonnes. Les quatre qui manquent sont celles qui nomment des
 * gens et des choses : l'EXTRAIT du contenu (la route rend `subjectId`, pas le
 * texte), l'AUTEUR (`subjectAuthorUserId`, un UUID relevé `null`), le NOMBRE DE
 * SIGNALEMENTS (seulement dans le détail, donc un appel par ligne) et l'ASSIGNÉ
 * (`assignedStaffId`, un UUID).
 *
 * Lier les trois servies ferait répéter les quatre littéraux de la première ligne
 * de la maquette sur TOUTES les lignes : chaque dossier de la file s'afficherait
 * comme « Joël K. · Vends attestation d'hébergement · 5 signalements », à côté
 * d'une priorité et d'un SLA bien réels. Un tableau dont trois colonnes vivent et
 * quatre mentent est pire que le tableau figé — le figé se reconnaît, l'autre non.
 * Remonté : il manque les NOMS et l'EXTRAIT à la ligne de file.
 */
export default function Page() {
  return (
    <EcranDonneesEquipe charger={chargerD04} squelette={SQUELETTE_D04}>
      {(donnees) => <ScreenFrames screen="D04" desktop={<D04Desktop {...donnees} />} />}
    </EcranDonneesEquipe>
  );
}
