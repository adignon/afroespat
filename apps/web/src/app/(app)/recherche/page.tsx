import { SEARCH_MAX_QUERY_LENGTH } from '@app/shared';
import { EcranRecherche } from '@/screens/messages/ecran-donnees';
import { filtresDeLUrl } from '@/screens/x01/filtres';

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
 * LE CADRE MOBILE PORTE UN <h1> MASQUÉ À L'ŒIL (« Résultats pour « … » », `MV_X01_H1_MOBILE`) :
 * un titre VISIBLE y serait inventé, une page sans titre est muette pour un lecteur
 * d'écran. Les filtres ville, rayon, pays, période, état sont de vrais contrôles
 * (`?ville=&rayon=&pays=&periode=&etat=`, lus par `x01/filtres.ts`).
 *
 * LES FILTRES SONT DANS LA COLONNE DE GAUCHE, et c'est une demande du porteur :
 * « Lorsqu'on est sur la page du search, il faut que la left side bar contienne
 * plutôt les filtres (guide, actualité, événement, etc.) avec le nombre matché. »
 * La colonne portait jusque-là le menu « ACCUEIL » de la maquette — six entrées
 * mortes sur une page de recherche. Elles reviennent au SURVOL DU RAIL, l'autre
 * moitié de la même demande. `?type=` porte le filtre retenu.
 *
 * LES SOUS-LIGNES DES CARTES SONT LIÉES : le serveur compose `SearchHit.subline`
 * (« 84 utiles », « 14 réponses · Ouverte · Lyon », « 620 € · Lyon »). Sur zéro
 * résultat, `POST /search/zero` part une fois par requête ; « Poser la question »
 * mène au composeur d'entraide PRÉ-REMPLI (`?titre=`, lu par `FormulaireDemande`). Les recherches récentes vivent dans le navigateur (`localStorage`,
 * sous `try/catch`). */
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

  /**
   * LES FILTRES (ville, rayon, pays, période, état) viennent aussi de l'URL, validés
   * par les schémas partagés du serveur : une valeur forgée est ignorée plutôt
   * qu'envoyée pour y prendre un `400`.
   */
  const filtres = filtresDeLUrl(params);

  return <EcranRecherche requete={requete} type={type} filtres={filtres} />;
}
