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
  arrivals, events, feedPosts, mBottom, mTabs, online, panelFil,
  postTypesFor, shortcuts, storiesFor, storyFiltersFor, rail,
  thread, shareContactsFor, shareButtonFor, shareNets, shareOut,
  SHARE_SELECTION_DEFAULT,
} from '@/screens/a01/data';

/**
 * A01 — Fil d'actualité, et les deux fenêtres qu'il ouvre.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/03 Accueil v2.dc.html` : les
 * styles en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * RESPONSIVE : la maquette fournit DEUX designs pour cet écran — un cadre
 * ordinateur de 1440 px et un cadre mobile de 390 px. On bascule de l'un à
 * l'autre au seuil de 1024 px que fixe §10.1, plutôt que d'inventer un
 * comportement intermédiaire que le design n'a pas défini.
 *
 * Entre 1024 et 1920 px, le cadre ordinateur s'adapte seul : le panneau reste
 * à 400 px, la colonne de contexte à 300 px, et le contenu occupe le reste
 * jusqu'à sa borne de 660 px. Sous 1024, le cadre mobile s'étire de la même
 * façon depuis ses 390 px d'origine.
 *
 * Seul l'état s'écrit ici — filtre de stories, type de publication, fenêtre
 * ouverte, contacts choisis — parce que la maquette le calcule dans son
 * `renderVals()`, pas dans son HTML.
 */

/** Les fenêtres que ce fil sait ouvrir. Les déclencheurs sont marqués par le transcodeur. */
type OpenModal = 'A01C' | 'A01P' | null;

export default function FeedPage() {
  const [storyFilter, setStoryFilter] = useState(-1);
  const [postType, setPostType] = useState(0);
  const [open, setOpen] = useState<OpenModal>(null);
  const [shareSel, setShareSel] = useState<readonly number[]>(SHARE_SELECTION_DEFAULT);

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
   * Conséquence à connaître : toutes les publications partagent la même fenêtre.
   * Commenter la troisième publication ouvre le même fil de commentaires que la
   * première — la maquette ne fournit qu'un jeu de commentaires, et inventer un fil
   * par publication serait inventer de la donnée. À brancher sur l'API au lot 3.
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
    rail,
    panelFil,
    shortcuts,
    stories: storiesFor(storyFilter),
    storyFilters: storyFiltersFor(storyFilter, setStoryFilter),
    postTypes: postTypesFor(postType, setPostType),
    feedPosts,
    events,
    arrivals,
    online,
    mTabs,
    mBottom,
    thread,
    shareContacts: shareContactsFor(shareSel, toggleContact),
    shareNets,
    shareOut,
    ...shareButtonFor(shareSel.length),
  };

  return (
    <div onClick={onOpen}>
      <ScreenFrames screen="A01" desktop={<A01Desktop {...data} />} mobile={<A01Mobile {...data} />} />
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
