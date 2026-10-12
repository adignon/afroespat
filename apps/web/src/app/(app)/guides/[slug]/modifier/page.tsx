import { EditeurGuideEcran } from '@/screens/guides/editeur-guide-ecran';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A05 — REPRENDRE UN GUIDE DÉJÀ ÉCRIT. `/guides/:slug/modifier`              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * CE QUI MANQUAIT, mesuré avant ce lot : les boutons « Modifier » de la vue auteur
 * étaient inertes (`auteurdesktop` : « Modifier le guide » sans geste ;
 * `auteurmobile` : « Modifier » sans geste), et `find` sur `app/(app)/guides` ne
 * donnait que `nouveau`, `[slug]`, `[slug]/propositions`, `[slug]/corriger` et
 * `[slug]/p/[pageSlug]`. Un auteur ne pouvait donc JAMAIS reprendre ce qu'il avait
 * écrit. C'est cette adresse-là qui manquait.
 *
 * ── POURQUOI `modifier` ET POURQUOI ICI ─────────────────────────────────────
 *
 * Le dépôt emploie des segments FRANÇAIS sous `[slug]` : `corriger` et
 * `propositions` sont déjà là, et `modifier` leur est cohérent.
 *
 * ⚠ AUCUNE COLLISION AVEC `p/[pageSlug]`, et ce n'était pas acquis : les deux sont
 * des enfants de `[slug]`. `modifier` est un segment LITTÉRAL, `p` en est un autre,
 * et le routeur d'App Router fait toujours passer un segment statique avant un
 * segment dynamique — `p/[pageSlug]` ne peut donc pas capter `/modifier`, qui
 * n'est de toute façon pas sous `p/`. Vérifié aussi au navigateur : la page d'une
 * page de guide (`/guides/<guide>/p/<page>`) répond toujours.
 *
 * ── LE MÊME ÉCRAN QUE `/guides/nouveau`, PAS UNE COPIE ──────────────────────
 *
 * `EditeurGuideEcran` est monté par les DEUX adresses. Ce qui change est le MODE,
 * et il ne change que trois choses dans le crochet : la lecture initiale
 * (`GET /guides/:slug/editor`), le verrou du titre d'un guide publié (§2.1 fige le
 * slug) et le libellé du bouton d'action (« Enregistrer » plutôt que « Publier »,
 * parce que `publish` refuse un guide déjà paru).
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/guides/[slug]/page.tsx` :
 * lire l'URL en propriété plutôt qu'avec `useSearchParams()`, qui force le rendu
 * client — cinq pages de ce projet ont déjà été servies VIDES pour cette raison.
 *
 * ⚠ CETTE PAGE N'AUTORISE RIEN. Elle n'a aucun moyen de savoir qui est l'auteur,
 * et elle ne cherche pas à le savoir : `GET /guides/:slug/editor` est sous
 * `guide.write` (N2) et `loadOwned` refuse — 404 sur un brouillon d'autrui,
 * `NOT_AUTHOR` sur un guide public d'autrui. Le front PRÉVIENT, il n'autorise pas.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EditeurGuideEcran mode={{ kind: 'modifier', slug }} />;
}
