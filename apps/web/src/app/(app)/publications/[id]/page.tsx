import { PublicationEcran } from './publication-ecran';

/**
 * A02 — une publication et son fil de réponses. `/publications/:id`
 *
 * Composant SERVEUR, qui ne fait qu'attendre le paramètre de route : sous Next 15,
 * `params` est une promesse. L'écran lui-même est client, parce qu'il appelle
 * l'API avec le jeton que le socle garde en mémoire.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicationEcran postId={id} />;
}
