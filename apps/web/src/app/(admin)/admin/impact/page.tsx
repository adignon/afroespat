import { ScreenFrames } from '@/screens/frames';
import { D16Desktop } from '@/screens/d16/desktop.generated';

/**
 * D16 — le rapport d'impact. `/admin/impact` (15 §5.3, T5 D16).
 *
 * TRANSCODÉ, PAS BRANCHÉ — même raison que D02 : §6 ajoute `metric_snapshots`,
 * qui manque au schéma. L'aperçu paginé (1/4, 2/4, 3/4) montre les chiffres de la
 * maquette, pas une mesure ; `/impact?quarter` et `/impact/export` (§7) attendent
 * le lot qui branchera.
 *
 * « TOUTES LES DONNÉES SONT AGRÉGÉES, JAMAIS NOMINATIVES » (§5.3). La maquette s'y
 * tient : 5 820 membres accompagnés, 214 parcours aboutis, une répartition par
 * pays. Les deux témoignages sont signés d'un prénom et d'une ville — ce que §5.3
 * autorise explicitement, « témoignages (extraits de guides ou de tips avec accord
 * de l'auteur — case “autoriser la citation” sur le contenu) », et que §6 porte en
 * donnée (`guides.quotable`, `city_tips.quotable`). C'est le seul endroit du
 * rapport où un individu apparaît, et il y apparaît avec son accord.
 */
export default function Page() {
  return <ScreenFrames screen="D16" desktop={<D16Desktop />} />;
}
