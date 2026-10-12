import { SignalementsScreen } from './signalements-screen';

/**
 * A06 · planche 2 EMPRUNTÉE — « Signalements “a changé” » de l'auteur.
 * `/guides/:slug/signalements`
 *
 * ── POURQUOI CETTE PAGE EXISTE ───────────────────────────────────────────────
 *
 * Le porteur, revenant sur son arbitrage de la veille : « Il faut faire ceci,
 * l'auteur doit voir les signalements "a changé". » Ce qui reste du précédent,
 * c'est l'ANONYMAT : `GET /guides/:id/outdated` ne rend que la date et le
 * commentaire, jamais le membre.
 *
 * ── LA MAQUETTE N'EN DESSINE AUCUNE, ET C'EST REMONTÉ ───────────────────────
 *
 * VÉRIFIÉ sur les octets de `docs/template/` : aucune `data-screen-label` ne nomme
 * une page de signalements. Les deux cadres viennent donc de la planche
 * « Propositions reçues » de A06 — même rôle, la page où l'AUTEUR relit ce que ses
 * lecteurs disent de son guide — lue une seconde fois et retournée par `donnees`.
 * Ce qui a été remplacé, et par quel dessin, est écrit une fois dans
 * `tools/screens/03-accueil.mjs`.
 *
 * Composant SERVEUR, pour la raison écrite dans `(app)/guides/[slug]/page.tsx` :
 * lire l'URL en propriété plutôt qu'avec `useSearchParams()`, qui force le rendu
 * client. LE SLUG EST PASSÉ AU COMPOSANT — sans lui, la page montrerait les
 * signalements d'un autre guide, ou aucun.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SignalementsScreen slug={slug} />;
}
