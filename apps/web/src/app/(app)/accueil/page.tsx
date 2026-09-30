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
import {
  mBottom,
  mTabs,
  panelFil,
  postTypesFor,
  shortcuts,
  storyFiltersFor,
  rail,
  thread,
  shareContactsFor,
  shareButtonFor,
  shareNets,
  shareOut,
  SHARE_SELECTION_DEFAULT,
} from '@/screens/a01/data';
import { useFil } from '@/screens/accueil/use-fil';

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
type OpenModal = 'A01C' | 'A01P' | null;

export default function FeedPage() {
  const [storyFilter, setStoryFilter] = useState(-1);
  const [postType, setPostType] = useState(0);
  const [open, setOpen] = useState<OpenModal>(null);
  const [shareSel, setShareSel] = useState<readonly number[]>(SHARE_SELECTION_DEFAULT);

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
   * CE QUI RESTE À FAIRE, ET QUI EST UNE LIMITE RÉELLE : toutes les publications
   * partagent encore la même fenêtre de commentaires. Le transcodeur ne pose pas
   * l'identifiant de la publication sur le déclencheur, donc cet écouteur ne peut
   * pas savoir LAQUELLE a été cliquée. Y remédier demande une adaptation du
   * générateur (poser `data-post-index` dans la boucle), pas un changement ici —
   * et surtout pas une modification du JSX généré, que la prochaine régénération
   * effacerait. Remonté au rapport de lot.
   */
  const onOpen = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest('[data-modal-open]');
    if (trigger === null) return;
    const which = trigger.getAttribute('data-modal-open');
    if (which === 'A01C' || which === 'A01P') setOpen(which);
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
    /**
     * Le fil de commentaires de la fenêtre A01C reste celui de la maquette, et il
     * faut le dire franchement plutôt que de le masquer : faute d'identifiant de
     * publication sur le déclencheur (voir `onOpen`), on ne peut pas encore
     * appeler `GET /comments?subjectType=POST&subjectId=…` pour la BONNE
     * publication. `threadFrom` est écrit, éprouvé et prêt dans `from-api.ts` ; il
     * lui manque l'identifiant, pas la donnée.
     */
    thread,
    shareContacts: shareContactsFor(shareSel, toggleContact),
    shareNets,
    shareOut,
    ...shareButtonFor(shareSel.length),

    // ── Donnée : l'API ──
    feedPosts: fil.feedPosts,
    stories: fil.stories,
    events: fil.events,
    arrivals: fil.arrivals,
    online: fil.online,
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
        desktop={<A01CDesktop {...data} />}
        mobile={<A01CMobile {...data} />}
      />
      <Modal
        open={open === 'A01P'}
        onClose={close}
        titleId="a01p-titre"
        name="A01P"
        desktop={<A01PDesktop {...data} />}
        mobile={<A01PMobile {...data} />}
      />
    </div>
  );
}
