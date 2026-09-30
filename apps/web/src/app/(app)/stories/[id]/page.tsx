import { StoryEcran } from './story-ecran';

/**
 * A13 — une story en lecture plein écran. `/stories/:id`
 *
 * Composant SERVEUR, qui n'attend que le paramètre de route : sous Next 15,
 * `params` est une promesse. La lecture elle-même est cliente — elle porte le jeton
 * que le socle garde en mémoire, et `GET /stories/:id` MARQUE LA STORY VUE, donc
 * elle ne doit pas partir au rendu du serveur pour un visiteur qui n'a rien ouvert.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoryEcran storyId={id} />;
}
