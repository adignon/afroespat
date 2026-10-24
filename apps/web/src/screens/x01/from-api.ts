import { SEARCH_MIN_QUERY_LENGTH } from '@app/shared';
import type {
  GroupedSearchResponse,
  SearchSubjectType,
  SuggestResponse,
  TypedSearchResponse,
} from '@app/shared';
import { MOT_PLURIEL, MOT_SINGULIER, ORDRE_TYPES, TRACE } from '@/lib/recherche/types';
import type {
  EtatVideRecherche,
  FiltreRecherche,
  ResultatRecherche,
  SuggestionRecherche,
} from './data';

/**
 * ─── CE QUE X01 FAIT DES RÉPONSES DU SERVEUR ────────────────────────────────
 *
 * Ces quatre fonctions sont PURES : elles reçoivent ce que `@app/shared` a validé
 * et rendent ce que les cadres consomment. Aucun `fetch`, aucun jeton, aucun
 * schéma — `screens/messages/appels.ts` les appelle après avoir fait les appels.
 *
 * ── POURQUOI ELLES SONT ICI ET PLUS LÀ-BAS ────────────────────────────────
 *
 * Elles vivaient dans `appels.ts`, qui est marqué `'use client'` et importe le
 * socle d'appel. Les éprouver demandait donc de monter le socle dans jsdom pour
 * vérifier une table de couleurs. Sorties ici, elles s'éprouvent sur une charge
 * réelle et à vide, ce qui est la convention des autres écrans (`from-api.ts`).
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA COLONNE DE FILTRES — LES MOTS DE LA MAQUETTE, LES COMPTES DU SERVEUR    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La recherche ne marche pas bien. Regarde l'URL, est-ce qui est
 * sur la page ? » MESURÉ sur `/recherche?q=simple` : « Tout · 24 », « Guides · 5 »
 * et quatre cartes sur Visale. Ce sont les valeurs DESSINÉES — la réponse de
 * `GET /search` était demandée puis jetée. Puis : « il faut que la left side bar
 * contienne plutôt les filtres […] avec le nombre matché dans ces catégories ».
 *
 * ── L'ORDRE EST FIXE, ET PAS CELUI DU SERVEUR ─────────────────────────────
 *
 * Le serveur ordonne les groupes par pertinence : l'ordre CHANGE d'une requête à
 * l'autre. Une colonne de navigation qui se réordonne à chaque frappe est
 * inutilisable — on perd le filtre qu'on visait. `ORDRE_TYPES` fixe donc l'ordre,
 * et seuls les comptes bougent.
 *
 * LES TYPES SANS RÉSULTAT SONT MONTRÉS À ZÉRO plutôt que cachés, pour la même
 * raison : une liste qui change de longueur se relit à chaque fois. Ils ne sont
 * pas cliquables — un filtre qui mène à une page vide est un piège, pas un choix.
 */
export function filtresDe(
  groupes: GroupedSearchResponse | null,
  q: string,
  actif: SearchSubjectType | null,
): readonly FiltreRecherche[] {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA COLONNE NE DISPARAÎT PLUS QUAND LA REQUÊTE EST TROP COURTE           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, sur `/recherche?q=s` : « caractère n'affiche même pas les filtres,
   * pourquoi ça ? Pourtant c'est une recherche. »
   *
   * MESURÉ : la carte « FILTRES » était VIDE — son titre, et rien dessous. Cette
   * fonction rendait `[]` dès que le serveur n'avait pas répondu, et une requête
   * d'une lettre ne l'atteint pas (il en exige deux).
   *
   * C'ÉTAIT UNE CONFUSION ENTRE DEUX CHOSES : les COMPTES viennent du serveur, la
   * LISTE DES TYPES n'en vient pas. Les neuf types sont une constante du produit —
   * `ORDRE_TYPES` — et ils existent avant toute requête. Masquer la colonne faisait
   * disparaître la seule navigation de la page au moment précis où le membre ne
   * trouve pas ce qu'il cherche.
   *
   * Sans réponse du serveur, les comptes valent donc zéro et AUCUN filtre n'est
   * cliquable : on affiche ce qu'on sait — la liste — et on n'affirme pas ce qu'on
   * ignore.
   */
  const comptes = new Map<string, number>((groupes?.items ?? []).map((g) => [g.type, g.count]));
  const total = (groupes?.items ?? []).reduce((somme, g) => somme + g.count, 0);
  const base = `/recherche?q=${encodeURIComponent(q)}`;

  /**
   * LES DEUX APPARENCES, relevées sur les planches et non choisies.
   *
   * La LIGNE de colonne : `#E3F0EB / #0F5C48 / 700` au repos actif,
   * `transparent / #16211D / 500` sinon — c'est ce que les 315 entrées de menu du
   * dépôt peignent, mesuré.
   *
   * La PASTILLE du cadre mobile : `#16785E / #fff` bordée de la même couleur quand
   * elle est retenue, `#fff / #16211D` bordée de `#E6EBE9` sinon — c'est ce que la
   * planche X01 dessine pour « Tout » et pour les trois autres.
   */
  const peint = (active: boolean) =>
    active
      ? {
          fond: '#E3F0EB',
          encre: '#0F5C48',
          poids: '700',
          piluleFond: '#16785E',
          piluleEncre: '#fff',
          piluleBordure: '1px solid #16785E',
        }
      : {
          fond: 'transparent',
          encre: '#16211D',
          poids: '500',
          piluleFond: '#fff',
          piluleEncre: '#16211D',
          piluleBordure: '1px solid #E6EBE9',
        };

  return [
    /**
     * « TOUT » N'EST PAS UN GROUPE : le serveur n'en rend pas. C'est la SOMME des
     * comptes, et c'est elle que la planche dessinait en tête — « Tout · 24 »
     * valait exactement la somme de ses exemples.
     */
    {
      libelle: 'Tout',
      compte: total,
      href: base,
      active: actif === null,
      trace: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
      ...peint(actif === null),
    },
    ...ORDRE_TYPES.map((t) => {
      const compte = comptes.get(t) ?? 0;
      const apparence = peint(actif === t);
      return {
        libelle: MOT_PLURIEL[t],
        compte,
        href: compte === 0 ? base : `${base}&type=${t}`,
        active: actif === t,
        trace: TRACE[t],
        ...apparence,
        /**
         * UN FILTRE À ZÉRO EST ATTÉNUÉ. Le porteur, devant dix filtres à zéro :
         * « on peut pas cliquer ? » Non, et c'est voulu — il mènerait à une page
         * vide — mais rien ne le disait : il était peint comme ses voisins.
         * `#8A958F` est le gris que les planches emploient pour tout texte
         * secondaire ; on ne choisit pas une couleur, on en reprend une.
         */
        ...(compte === 0 && actif !== t ? { encre: '#8A958F' } : {}),
      };
    }),
  ];
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LA PAGE DIT QUAND ELLE NE MONTRE RIEN                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Trois situations, et il faut les distinguer — les confondre, c'est ce que la
 * page faisait en n'affichant RIEN dans les trois cas :
 *
 *   1. LA REQUÊTE EST TROP COURTE. `GET /search` exige deux caractères
 *      (`SEARCH_MIN_QUERY_LENGTH`) et refuse en dessous. Le serveur n'a donc rien
 *      dit, et il n'y a rien à rapporter de sa part : la carte explique la borne.
 *      ⚠ Cette phrase est ÉCRITE, pas dessinée — voir `EtatVideRecherche` ;
 *   2. LE SERVEUR A CHERCHÉ ET N'A RIEN TROUVÉ, et la requête porte des termes
 *      utiles : `meta.zeroResult` arrive avec sa proposition et son bouton (§2.4).
 *      Ce sont SES mots, pas les nôtres — `SEARCH_ZERO_PROMPT_FR` vit dans
 *      `@app/shared` précisément pour que les deux côtés disent la même chose ;
 *   3. LE SERVEUR A CHERCHÉ, N'A RIEN TROUVÉ, ET SE TAIT. C'est le cas d'une
 *      requête sans terme utile (« de la ») : §2.4 refuse de l'enregistrer, donc
 *      il ne rend pas `zeroResult`. La carte garde son titre et perd son bouton —
 *      proposer de « poser la question » quand on ne sait pas laquelle serait
 *      proposer un formulaire vide.
 *
 * ── LE TITRE EST DÉCOUPÉ DE LA PHRASE DU SERVEUR ──────────────────────────
 *
 * La planche dessine DEUX lignes — « Aucun résultat » en gras, puis « Posez la
 * question à la communauté ? » en gris. Le serveur, lui, rend UNE phrase :
 * « Aucun résultat. Posez la question à la communauté ? ». On la coupe au premier
 * point pour remplir les deux lignes dessinées, et on garde la phrase entière en
 * titre si elle n'en porte pas. C'est de la mise en forme d'un texte du serveur,
 * et non un texte recomposé ici : changer la phrase côté API change les deux
 * lignes.
 */
/** `/entraide/nouveau`, avec la question cherchée en `?titre=` quand il y en a une. */
export function adresseDemande(titre: string): string {
  const t = titre.trim();
  return t === '' ? '/entraide/nouveau' : `/entraide/nouveau?titre=${encodeURIComponent(t)}`;
}

export function videDe(
  groupes: GroupedSearchResponse | null,
  q: string,
  resultats: readonly ResultatRecherche[],
): EtatVideRecherche | null {
  if (resultats.length > 0) return null;

  if (groupes === null) {
    return {
      titre: 'Aucun résultat',
      invite:
        q.trim() === ''
          ? 'Tapez ce que vous cherchez dans le champ ci-dessus.'
          : `Tapez au moins ${String(SEARCH_MIN_QUERY_LENGTH)} caractères pour lancer la recherche.`,
      bouton: '',
      href: '',
    };
  }

  const prompt = groupes.meta.zeroResult?.prompt ?? '';
  const point = prompt.indexOf('. ');
  const titre = prompt === '' ? 'Aucun résultat' : point === -1 ? prompt : prompt.slice(0, point);
  const invite = prompt === '' || point === -1 ? '' : prompt.slice(point + 2);

  return {
    titre,
    invite,
    /**
     * LE LIBELLÉ DU BOUTON VIENT DU SERVEUR, lui aussi. `SEARCH_ZERO_CTA_FR` est
     * exporté par `@app/shared` et il aurait fait l'affaire — mais c'est l'API qui
     * remplit `cta`, et lire la constante plutôt que la réponse rouvrirait
     * exactement l'écart que `@app/shared` existe pour fermer le jour où le serveur
     * décidera d'un autre mot selon le contexte.
     */
    bouton: groupes.meta.zeroResult?.cta ?? '',
    /**
     * LE BOUTON MÈNE AU COMPOSEUR D'ENTRAIDE, PRÉ-REMPLI (lot F2).
     *
     * §4 : « pré-remplit le composeur d'entraide ». Le serveur rend `helpTitle`
     * pour cela, et le composeur (`FormulaireDemande`) lit maintenant `?titre=` :
     * la question cherchée devient le titre de la demande, que le membre complète.
     * Sans `helpTitle`, l'adresse reste nue — jamais un `?titre=` vide.
     */
    href: adresseDemande(groupes.meta.zeroResult?.helpTitle ?? ''),
  };
}

/**
 * LES RÉSULTATS DE LA FORME GROUPÉE — l'onglet « Tout ».
 *
 * LES GROUPES SONT APLATIS, dans l'ordre que le serveur a choisi. La planche
 * dessine quatre cartes à la suite, pas quatre colonnes : c'est une liste.
 */
export function cartesGroupees(groupes: GroupedSearchResponse | null): readonly ResultatRecherche[] {
  if (groupes === null) return [];
  return groupes.items.flatMap((g) => g.items.map((hit) => carteDe(hit, g.type)));
}

/** LES RÉSULTATS DE LA FORME PLATE — un seul type, la liste complète. */
export function cartesPlates(
  plats: TypedSearchResponse,
  type: SearchSubjectType | null,
): readonly ResultatRecherche[] {
  return plats.items.map((hit) => carteDe(hit, type ?? hit.subjectType));
}

/**
 * UNE CARTE, depuis un résultat.
 *
 * L'EXTRAIT, ET NON LA SOUS-LIGNE DESSINÉE. La maquette écrit « Mis à jour le
 * 12 mars · 84 utiles », « 14 réponses », « 620 € » : aucun de ces champs n'existe
 * sur `SearchHit`. On affiche ce que le serveur rend vraiment.
 *
 * `url` VIENT DU SERVEUR et n'est pas composée ici : quatre des neuf types ne
 * s'ouvrent pas par leur identifiant, et les résoudre côté front demanderait de
 * connaître neuf règles de routage et trois référentiels. Voir `destinations` dans
 * `search.service.ts`.
 */
function carteDe(
  hit: { id: string; title: string; excerpt: string; url: string | null; subline: string | null },
  type: string,
): ResultatRecherche {
  return {
    id: hit.id,
    pastille: MOT_SINGULIER[type as SearchSubjectType] ?? type,
    titre: hit.title,
    extrait: hit.excerpt,
    trace: TRACE[type as SearchSubjectType] ?? TRACE.TOPIC,
    url: hit.url,
    sousLigne: hit.subline,
  };
}

/**
 * LE SURLIGNAGE D'UNE SUGGESTION, découpé comme la maquette le dessine.
 *
 * La maquette écrit `<strong>vis</strong>ale étudiant` : la part SAISIE en gras,
 * puis la suite. Le découpage se fait sur la longueur de la requête, et seulement
 * quand la suggestion COMMENCE vraiment par elle — comparaison insensible à la
 * casse, parce que le serveur normalise la requête et pas le titre. Une suggestion
 * qui ne commence pas par la requête (le serveur cherche aussi au milieu des mots)
 * n'a pas de préfixe à mettre en gras, et lui en inventer un surlignerait les
 * mauvais caractères.
 *
 * `vers` : l'adresse que le serveur compose, ou la page de résultats sur ce titre
 * quand il rend `null` — la source a disparu entre l'indexation et la lecture.
 */
export function suggestionsDe(
  items: SuggestResponse['items'],
  requete: string,
): readonly SuggestionRecherche[] {
  return items.map((s) => decouperSuggestion(s.title, requete, s.url));
}

function decouperSuggestion(titre: string, requete: string, url: string | null): SuggestionRecherche {
  const vers = url ?? `/recherche?q=${encodeURIComponent(titre)}`;
  if (!titre.toLocaleLowerCase('fr').startsWith(requete.toLocaleLowerCase('fr'))) {
    return { prefixe: '', suite: titre, vers };
  }
  return { prefixe: titre.slice(0, requete.length), suite: titre.slice(requete.length), vers };
}

