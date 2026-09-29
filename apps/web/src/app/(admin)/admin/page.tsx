import { ScreenFrames } from '@/screens/frames';
import { D02Desktop } from '@/screens/d02/desktop.generated';

/**
 * D02 — le tableau de bord d'équipe. `/admin` (15 §5.1, T5 D02).
 *
 * TRANSCODÉ, PAS BRANCHÉ — et c'est une limite du back-end, pas un raccourci.
 * 15 §6 ajoute la table `metric_snapshots` (« historique des indicateurs pour
 * les courbes ») ; elle manque au schéma, et la tâche `metrics.refresh` (§10)
 * n'existe donc pas non plus. Les chiffres affichés sont ceux que la maquette
 * dessine — 5 820 inscrits, 27,4 % à l'indicateur clé — et aucun n'est une mesure.
 *
 * L'INDICATEUR CLÉ est le seul de §5.1 que la spec met en gras : « % des membres
 * d'une ville ayant été cochés présents à au moins un événement dans les 90
 * jours », objectif 30 %. La maquette le met en tête, avec son objectif et sa
 * répartition par ville. L'écran le respecte parce qu'il ne fait que le
 * transcrire.
 *
 * CETTE PAGE N'A PAS DE `<h1>`, et c'est la maquette qui en décide : le seul
 * endroit où « Tableau de bord » est écrit dans ce cadre, c'est l'entrée ACTIVE
 * du menu latéral. Promouvoir un élément de `<nav>` en titre de page dirait que
 * la page parle de son menu ; écrire un titre masqué serait rédiger un texte
 * d'interface absent de la maquette. Le manque est signalé à chaque
 * régénération et consigné dans le rapport.
 */
export default function Page() {
  return <ScreenFrames screen="D02" desktop={<D02Desktop />} />;
}
