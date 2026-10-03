'use client';

import { useCallback, useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { Modal } from '@/components/modal';
import { A01Desktop } from '@/screens/a01/desktop.generated';
import { A01Mobile } from '@/screens/a01/mobile.generated';
import { A01CDesktop } from '@/screens/a01c/desktop.generated';
import { A01CMobile } from '@/screens/a01c/mobile.generated';
import { A01PDesktop } from '@/screens/a01p/desktop.generated';
import { A01PMobile } from '@/screens/a01p/mobile.generated';
import { A01GDesktop } from '@/screens/a01g/desktop.generated';
import { A01GMobile } from '@/screens/a01g/mobile.generated';
import {
  mBottom,
  mTabs,
  panelFil,
  postTypesFor,
  shortcuts,
  storyFiltersFor,
  rail,
} from '@/screens/a01/data';
import { shareContactsDe, shareButtonFor, shareNets, shareOut } from '@/screens/a01p/data';
import { useGuides } from '@/screens/guides/use-guides';
import { guidesLiablesDe } from '@/screens/guides/from-api';
import { useFil } from '@/screens/accueil/use-fil';
import { threadFrom } from '@/screens/accueil/from-api';
import { usePublication } from '@/screens/publication/use-publication';

/**
 * A01 — Fil d'actualité, et les deux fenêtres qu'il ouvre. BRANCHÉ SUR L'API.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/03 Accueil v2.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit — et c'est
 * ce lot qui le vérifie plutôt que de le promettre : `node tools/generate-screens.mjs`
 * laisse les 250 cadres sans une ligne de dérive.
 *
 * ── CE QUI A CHANGÉ AU LOT 3 ────────────────────────────────────────────────
 *
 * `feedPosts`, `stories`, `events`, `arrivals`, `online` ne viennent plus de
 * `screens/a01/data.ts` : ils viennent de l'API, par `useFil`. Ce qui reste importé
 * de `data.ts` est le DESSIN que la maquette calcule — le rail, le panneau, les
 * raccourcis, les filtres, les onglets mobiles — et il n'a aucune raison de venir
 * du serveur.
 *
 * Ce qui a DISPARU de l'écran est aussi important que ce qui est arrivé : les cinq
 * publications d'exemple (« Aïcha Diop », « On organise un repas partagé… ») étaient
 * servies dans le HTML comme si elles étaient réelles. Elles ne le sont plus.
 *
 * ── RESPONSIVE ──────────────────────────────────────────────────────────────
 *
 * Inchangé : deux cadres, bascule au seuil de 1024 px de §10.1. Le panneau de
 * gauche, la colonne de contexte et l'en-tête de recherche restent à l'écran
 * pendant que le fil défile — c'est la CSS transcodée (`position: sticky`) qui le
 * tient, pas du code d'ici, et `e2e/shell.spec.ts` le garde. Rien dans ce
 * branchement n'ajoute de conteneur entre eux : un `overflow` ou un `transform`
 * intercalé suffirait à casser `sticky` sans qu'aucun type ne s'en plaigne.
 */

/** Les fenêtres que ce fil sait ouvrir. Les déclencheurs sont marqués par le transcodeur. */
type OpenModal = 'A01C' | 'A01P' | 'A01G' | null;

export default function FeedPage() {
  const [storyFilter, setStoryFilter] = useState(-1);
  const [postType, setPostType] = useState(0);
  const [open, setOpen] = useState<OpenModal>(null);
  /** La publication dont la fenêtre parle. `null` = aucune, donc aucun fil servi. */
  const [sujet, setSujet] = useState<string | null>(null);
  /**
   * AUCUN CONTACT PRÉ-COCHÉ.
   *
   * La maquette en coche deux (`SHARE_SELECTION_DEFAULT`, les rangs 0 et 2) parce
   * qu'une planche doit montrer l'état sélectionné. Avec de VRAIS contacts, deux
   * cases cochées d'avance désigneraient deux personnes que le membre n'a pas
   * choisies. On part donc de rien — et le bouton dit alors « Choisissez un
   * contact », qui est exactement l'état que la maquette dessine pour zéro.
   */
  const [shareSel, setShareSel] = useState<readonly number[]>([]);

  const fil = useFil(storyFilter, postType);

  const toggleContact = useCallback((index: number): void => {
    setShareSel((current) =>
      current.includes(index) ? current.filter((x) => x !== index) : [...current, index],
    );
  }, []);

  /**
   * L'ouverture est DÉLÉGUÉE, comme la fermeture.
   *
   * Le bouton « Commenter » est enfoui dans une boucle sur les publications, et
   * « Partager » à côté. Leur passer un `onClick` demanderait de faire voyager deux
   * fonctions à travers le JSX transcodé — donc de le modifier, donc de renoncer à
   * ce qui fait la valeur du transcodage. Le transcodeur pose `data-modal-open` sur
   * les deux, et un seul écouteur ici suffit.
   *
   * ── LA FENÊTRE SAIT MAINTENANT DE QUELLE PUBLICATION ELLE PARLE ──────────
   *
   * Ce n'était pas le cas, et c'était un vrai défaut : le nom de la fenêtre était
   * le seul renseignement porté par le déclencheur, donc les cinq publications du
   * fil ouvraient LE MÊME fil de commentaires — celui d'aucune d'entre elles.
   *
   * La correction est dans le GÉNÉRATEUR (`markTriggers`, et la déclaration
   * `subject: 'p.postId'` dans `tools/screens/03-accueil.mjs`), qui pose désormais
   * `data-modal-subject={p.postId}` À CÔTÉ du nom de la fenêtre. L'expression est
   * évaluée DANS la boucle, donc une valeur par carte, et `closest()` la relit ici.
   *
   * Elle n'est surtout PAS dans le JSX généré : la régénération l'effacerait.
   */
  const onOpen = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    /**
     * DEUX FAÇONS D'ÊTRE UN DÉCLENCHEUR, et la seconde n'est pas un raccourci.
     *
     * `data-modal-open` est posé par le GÉNÉRATEUR (`markTriggers`) sur les
     * déclencheurs déclarés — c'est le cas de « Commenter » et « Partager », qui
     * vivent dans la boucle des publications.
     *
     * L'icône livre du composeur, elle, n'est PAS déclarée : la maquette la dessine
     * en `<span title="Lier un guide">` avec `cursor:pointer`, et la déclarer
     * demanderait au générateur de la promouvoir en `<button>` — donc de modifier
     * les deux cadres de A01, ce qui sort du branchement de données et croise le lot
     * de navigation en cours. On s'accroche donc à l'attribut que la MAQUETTE écrit
     * déjà, sans toucher au JSX transcodé.
     *
     * LIMITE ASSUMÉE ET REMONTÉE : un `<span>` n'est pas atteignable au clavier. Ce
     * déclencheur est à la souris et au doigt seulement, jusqu'à ce que le lot de
     * navigation le promeuve en `<button>` — c'est là que ce travail appartient, et
     * `markTriggers` sait déjà le faire (`label` donne le nom accessible).
     */
    const trigger = target.closest('[data-modal-open], [title="Lier un guide"]');
    if (trigger === null) return;
    const which =
      trigger.getAttribute('data-modal-open') ??
      (trigger.getAttribute('title') === 'Lier un guide' ? 'A01G' : null);
    if (which !== 'A01C' && which !== 'A01P' && which !== 'A01G') return;
    /**
     * `getAttribute` rend `null` quand l'attribut manque — ce qui arrive pour un
     * déclencheur hors boucle, ou pour une carte sans identifiant. On ouvre alors
     * la fenêtre SANS sujet plutôt que sur le sujet précédent : une fenêtre vide se
     * voit, un fil de commentaires qui n'est pas le bon ne se voit pas.
     */
    setSujet(trigger.getAttribute('data-modal-subject'));
    setOpen(which);
  }, []);

  const close = useCallback((): void => setOpen(null), []);

  const data = {
    // ── Dessin : la maquette, inchangée ──
    rail,
    panelFil,
    shortcuts,
    storyFilters: storyFiltersFor(storyFilter, setStoryFilter),
    postTypes: postTypesFor(postType, setPostType),
    mTabs,
    mBottom,
    // ── Donnée : l'API ──
    feedPosts: fil.feedPosts,
    stories: fil.stories,
    events: fil.events,
    arrivals: fil.arrivals,
    online: fil.online,
  };

  /**
   * LE FIL DE COMMENTAIRES DE LA FENÊTRE, POUR LA PUBLICATION CLIQUÉE.
   *
   * `avecPublication: false` : la carte est déjà à l'écran derrière la fenêtre, et
   * recharger `GET /posts/:id` pour l'afficher une seconde fois serait un appel de
   * plus pour rien. On ne demande que `GET /comments?subjectType=POST&subjectId=…`.
   *
   * Le crochet part dès que `sujet` change, y compris quand il repasse à `null` —
   * il rend alors une liste vide, ce qui est exactement ce qu'on veut : la fenêtre
   * ne garde pas le fil de la publication précédente.
   */
  const commentaires = usePublication(sujet, false);
  const thread = commentaires.fil === null ? [] : threadFrom(commentaires.fil.items);

  /**
   * LA FENÊTRE « PARTAGER ».
   *
   * Les contacts proposés sont RÉELS : ce sont les contacts en ligne que
   * `GET /feed/sidebar` calcule (`last_seen_at` < 10 min, §2.7), et non cinq
   * initiales d'exemple.
   *
   * Ce qui n'est PAS branché, et qui ne peut pas l'être : L'ENVOI. Il n'existe
   * aucune route de partage — ni `POST /posts/:id/share`, ni compteur de partages
   * sur `postCardSchema`. Le bouton « Envoyer à N contacts » n'a donc rien à
   * appeler. C'est remonté au rapport de lot, pas comblé ici.
   *
   * `shareNets` reste du dessin : la seule source possible est le module
   * `communities`, qui n'a pas de schéma de réponse dans `packages/shared`.
   */
  const partage = {
    shareContacts: shareContactsDe(fil.online, shareSel, toggleContact),
    shareNets,
    shareOut,
    ...shareButtonFor(shareSel.length),
  };

  /**
   * LA FENÊTRE « LIER UN GUIDE ».
   *
   * Les RÉSULTATS sont de vrais guides — `GET /guides`, par `useGuides` — et la
   * requête ne part QUE lorsque la fenêtre s'ouvre (`actif`), parce qu'un panneau
   * que le membre n'ouvre pas n'a aucune raison de coûter un appel à chaque
   * affichage du fil.
   *
   * Les SUGGÉRÉS arrivent VIDES, et c'est mesuré, pas oublié : aucune route ne rend
   * des guides « suggérés pour cette publication ». Les remplir des mêmes cartes
   * que les résultats afficherait chaque guide deux fois, dont une sous une pastille
   * « Suggéré » que rien ne justifie. Une section vide sous son titre se voit ; une
   * fausse suggestion, non. REMONTÉ au rapport de lot.
   *
   * Ce qui n'est PAS branché non plus, et ne peut pas l'être : L'ENVOI. La sélection
   * ne va nulle part — `createPostSchema` est `.strict()` et n'a pas de `guideIds`,
   * donc `POST /posts` refuserait un guide lié. Les cases à cocher et « Lier 2
   * guides » restent du dessin.
   */
  const guides = useGuides(0, open === 'A01G');
  const lierGuide = {
    guidesSuggeres: [],
    guidesTrouves: guides.page === null ? [] : guidesLiablesDe(guides.page),
  };

  return (
    <div onClick={onOpen}>
      <ScreenFrames
        screen="A01"
        desktop={<A01Desktop {...data} />}
        mobile={<A01Mobile {...data} />}
      />
      <Modal
        open={open === 'A01C'}
        onClose={close}
        titleId="a01c-titre"
        name="A01C"
        desktop={<A01CDesktop thread={thread} />}
        mobile={<A01CMobile thread={thread} />}
      />
      <Modal
        open={open === 'A01P'}
        onClose={close}
        titleId="a01p-titre"
        name="A01P"
        desktop={<A01PDesktop {...partage} />}
        mobile={<A01PMobile {...partage} />}
      />
      <Modal
        open={open === 'A01G'}
        onClose={close}
        titleId="a01g-titre"
        name="A01G"
        desktop={<A01GDesktop {...lierGuide} />}
        mobile={<A01GMobile {...lierGuide} />}
      />
    </div>
  );
}
