import { SEARCH_MAX_QUERY_LENGTH } from '@app/shared';
import { EcranRecherche } from '@/screens/messages/ecran-donnees';

/**
 * X01 — Recherche (`/recherche`, 11 §4, T5 §10).
 *
 * Transcodé de `docs/template/09 Messages et transverse.dc.html`.
 *
 * Composant SERVEUR : il reçoit `searchParams` en propriété et n'emploie donc pas
 * `useSearchParams()`, qui forcerait un rendu client et servirait un HTML vide. Il
 * se contente de RENDRE la coquille cliente — il n'appelle aucune de ses fonctions,
 * pour la raison écrite dans `screens/messages/feuilles.ts`.
 *
 * BRANCHÉ SUR `GET /search` ET `GET /search/suggest` (11 §3). La requête vient de
 * `?q=`, parce que la maquette dessine un CHAMP et non un formulaire branché : le
 * rendre actif demanderait de modifier le JSX transcodé. L'URL le rend atteignable
 * et éprouvable sans ajouter un pixel.
 *
 * LA REQUÊTE EST BORNÉE AVANT D'ÊTRE ENVOYÉE, et la borne est PARTAGÉE :
 * `SEARCH_MAX_QUERY_LENGTH` vient de `@app/shared`, là où le schéma de requête du
 * serveur la lit aussi. Un `120` écrit ici deviendrait faux au premier ajustement —
 * quatre bornes recopiées à la main l'ont déjà fait dans ce dépôt — et le symptôme
 * serait un `400` que l'écran afficherait comme une panne. Le seuil des suggestions
 * (`SUGGEST_MIN_QUERY_LENGTH`) est lu de la même façon, dans `chargerX01`.
 *
 * LA PLANCHE D'ORDINATEUR MONTRE LES SUGGESTIONS DÉPLIÉES — 11 §2.3, « suggestions
 * dès 3 caractères ». Ce n'est pas un état à part : la maquette les dessine DANS le
 * cadre, en carte positionnée par-dessus la page, et elles sont LIÉES.
 *
 * ⚠ LE CADRE MOBILE N'A TOUJOURS PAS DE TITRE. La maquette n'y écrit que la requête,
 * dans le champ de recherche ; elle est désormais liée, mais la PROMOUVOIR en `<h1>`
 * resterait un titre inventé — ce qui a coûté A01. Le générateur le signale à chaque
 * exécution. Consigné au rapport.
 *
 * LES FILTRES SONT DANS LA COLONNE DE GAUCHE, et c'est une demande du porteur :
 * « Lorsqu'on est sur la page du search, il faut que la left side bar contienne
 * plutôt les filtres (guide, actualité, événement, etc.) avec le nombre matché. »
 * La colonne portait jusque-là le menu « ACCUEIL » de la maquette — six entrées
 * mortes sur une page de recherche. Elles reviennent au SURVOL DU RAIL, l'autre
 * moitié de la même demande. `?type=` porte le filtre retenu.
 *
 * ⚠ LES SOUS-LIGNES DES CARTES RESTENT NON LIÉES — « 84 utiles », « 14 réponses »,
 * « Ouverte · Lyon 7e », « 620 € » n'ont AUCUNE source dans `SearchHit`. La carte
 * affiche l'extrait que le serveur rend. Le détail est dans `screens/x01/data.ts`.
 *
 * L'ÉTAT VIDE — « Aucun résultat. Posez la question à la communauté ? » (11 §2.4) —
 * est dessiné par la maquette en COMPOSANT, dans une carte « ÉTATS » posée à côté
 * des planches, sans écran autour. Il n'est donc pas monté ici : il n'y a pas de
 * cadre à extraire, et lui en fabriquer un reviendrait à dessiner l'écran manquant.
 * `meta.zeroResult` porte pourtant déjà sa phrase et son bouton, côté API.
 */
export default async function SearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const brut = params['q'];
  // L'URL est publique : un `q` répété arrive en tableau, et une requête trop longue
  // serait refusée par le serveur. On borne ici plutôt que d'afficher un `400`.
  const requete = typeof brut === 'string' ? brut.slice(0, SEARCH_MAX_QUERY_LENGTH) : '';

  /**
   * LE TYPE N'EST PAS VALIDÉ ICI, mais dans `chargerX01`.
   *
   * Ce n'est pas un report de travail : le schéma qui tranche est
   * `searchSubjectTypeSchema`, celui-là même que le serveur emploie, et il est lu
   * là où la requête se compose. Le valider deux fois ferait deux endroits à
   * changer le jour où un dixième type apparaît.
   */
  const typeBrut = params['type'];
  const type = typeof typeBrut === 'string' ? typeBrut : null;

  return <EcranRecherche requete={requete} type={type} />;
}
