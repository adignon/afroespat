import { StoryEcran } from '../../../stories/[id]/story-ecran';
import { FenetrePleine } from '../../fenetre-pleine';

/**
 * A13 EN FENÊTRE — `/stories/:id` ouvert depuis le ruban ou le fil.
 *
 * Le porteur : « Le display des stories une fois créées doivent s'afficher comme
 * sur l'écran A13. » C'est le MÊME composant que la page entière ; il n'y a donc
 * aucune seconde manière d'afficher une story, et aucune ne peut diverger.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <FenetrePleine>
      <StoryEcran storyId={id} enFenetre />
    </FenetrePleine>
  );
}
