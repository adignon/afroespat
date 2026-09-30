import { notFound } from 'next/navigation';
import { ProfilMembreEcran } from './profil-membre-ecran';

/**
 * K02 — « Profil d'un membre » (`/@:handle`, T5 §9).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE SEGMENT S'APPELLE `[handle]` ET NON `@[handle]`.
 *
 * T5 donne la route `/@:handle`, et un dossier commençant par `@` est, dans
 * l'App Router de Next, un SLOT de route parallèle : il ne produit aucun segment
 * d'URL. `app/(app)/@handle/page.tsx` ne servirait donc jamais `/@fatou.n` — il
 * n'y a pas de dossier possible qui écrive un `@` littéral dans le chemin.
 *
 * Le segment dynamique porte donc l'arobase DANS SA VALEUR : `/@fatou.n` arrive
 * ici avec `handle === '@fatou.n'`. C'est la seule forme qui donne exactement
 * l'URL que T5 écrit.
 *
 * LE GARDE-FOU N'EST PAS UN ORNEMENT. Un segment dynamique à la racine capture
 * TOUT chemin d'un seul niveau : sans lui, `/nimportequoi` rendrait le profil de
 * Fatou au lieu d'une page 404, et le défaut serait invisible tant que personne
 * ne se trompe d'adresse. `notFound()` rend la 404 à tout ce qui ne commence pas
 * par `@`. Les routes statiques voisines — `/accueil`, `/compte/…`, `/parcours` —
 * restent prioritaires : Next les résout avant les segments dynamiques.
 *
 * LE SEGMENT ARRIVE PERCENT-ENCODÉ, et c'est le navigateur qui l'a montré.
 *
 * `/@fatou.n` donne `params.handle === '%40fatou.n'`, pas `'@fatou.n'` : Next ne
 * décode pas ce segment, parce que l'arobase est précisément le caractère qui
 * marque un slot de route parallèle dans sa convention de dossiers. Le garde-fou
 * écrit naïvement — `handle.startsWith('@')` — refusait donc TOUTES les adresses,
 * y compris les bonnes : la seule route de K02 rendait une 404, et rien dans le
 * code ne le laissait deviner. `curl -s … | wc -c` sur la réponse du serveur est
 * ce qui l'a dit.
 *
 * Le segment est donc DÉCODÉ avant d'être jugé, et la forme littérale reste
 * acceptée : une adresse tapée à la main, où le navigateur n'encode pas
 * l'arobase, doit marcher aussi. `decodeURIComponent` peut lever sur une séquence
 * `%` invalide — une URL malformée est une 404, pas une erreur 500.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Composant SERVEUR : les paramètres de route arrivent en propriété. Le pseudo est
 * maintenant PASSÉ À L'ÉCRAN, qui appelle `GET /users/{pseudo}` — la maquette
 * écrivait « Fatou Ndiaye » en clair, et ce littéral est devenu une interpolation
 * par une DÉCLARATION (`donnees`) dans `tools/screens/08-compte.mjs`, sans qu'une
 * ligne de la maquette ni du JSX transcodé ne bouge.
 */
function pseudo(segment: string): string | null {
  let decode: string;
  try {
    decode = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return decode.startsWith('@') && decode.length > 1 ? decode.slice(1) : null;
}

export default async function ProfilMembrePage({
  params,
}: {
  readonly params: Promise<{ readonly handle: string }>;
}) {
  const { handle } = await params;
  const nom = pseudo(handle);
  if (nom === null) notFound();

  return <ProfilMembreEcran pseudo={nom} />;
}
