import { MesStories } from '@/components/mes-stories';

/**
 * « Mes stories » — l'historique de 30 jours (04 §2.6, `GET /me/stories`).
 * `/stories/mes-stories`
 *
 * AJOUT hors maquette : la route existait depuis le premier lot et son appel
 * (`fetchMyStories`) n'était employé par aucun écran. Le segment statique prime sur
 * `stories/[id]`, donc `mes-stories` n'est jamais lu comme un identifiant de story.
 */
export default function Page() {
  return <MesStories />;
}
