'use client';

import { useState } from 'react';
import { A01Desktop } from '@/screens/a01/desktop.generated';
import { A01Mobile } from '@/screens/a01/mobile.generated';
import {
  arrivals, events, feedPosts, mBottom, mTabs, online, panelFil,
  postTypesFor, shortcuts, storiesFor, storyFiltersFor, rail,
} from '@/screens/a01/data';

/**
 * A01 — Fil d'actualité.
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
 * Seul l'état s'écrit ici — filtre de stories et type de publication — parce
 * que la maquette le calcule dans son `renderVals()`, pas dans son HTML.
 */
export default function FeedPage() {
  const [storyFilter, setStoryFilter] = useState(-1);
  const [postType, setPostType] = useState(0);

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
  };

  return (
    <div data-screen="A01" style={{ background: '#F6F8F7', minHeight: '100vh' }}>
      {/* Le cadre de la maquette est figé ; ici il est fluide. C'est la seule
          liberté prise sur la forme, et elle est nécessaire : un écran bloqué
          à 1440 px ne serait pas responsive. */}
      {/* Les deux cadres sont rendus, l'un masqué par CSS. Next rend côté
          serveur : il ne connaît pas la largeur de la fenêtre, et choisir en
          JavaScript provoquerait un saut visible à l'hydratation. */}
      <div data-frame="desktop" className="hidden min-h-screen lg:flex" style={{ position: 'relative' }}>
        <A01Desktop {...data} />
      </div>
      <div data-frame="mobile" className="flex min-h-screen flex-col lg:hidden" style={{ position: 'relative' }}>
        <A01Mobile {...data} />
      </div>
    </div>
  );
}
