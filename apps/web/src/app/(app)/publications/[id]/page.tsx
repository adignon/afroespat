'use client';

import { useCallback, useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A02Desktop } from '@/screens/a02/desktop.generated';
import { A02Mobile } from '@/screens/a02/mobile.generated';
import { accueilData } from '@/screens/accueil/props';
import type { GuideVote } from '@/screens/accueil/data';

/**
 * A02 — une publication et ses réponses. `/publications/:id`
 *
 * LE SEUL COMPORTEMENT de cet écran est le vote sur les guides rattachés. La
 * maquette le calcule dans son `renderVals()` (`this.state.gv`), donc il s'écrit
 * ici : le membre dit si le rattachement automatique est utile, et c'est ce retour
 * qui corrige les suggestions.
 *
 * PAS DE TITRE DE PAGE, et c'est un manque de la MAQUETTE, pas du transcodage : ce
 * cadre ne dessine aucun titre, son contenu étant la publication elle-même. Le
 * générateur le signale à chaque exécution (« aucun <h2> à promouvoir en <h1> »).
 * En inventer un — « Publication de Fatou Ndiaye » — serait exactement la faute que
 * l'en-tête de `tools/dc-to-jsx.mjs` raconte.
 */
export default function PublicationPage() {
  const [votes, setVotes] = useState<Readonly<Record<number, GuideVote>>>({});

  const onGuideVote = useCallback((index: number, vote: 'up' | 'down'): void => {
    setVotes((current) => ({ ...current, [index]: vote }));
  }, []);

  const data = accueilData({ guideVotes: votes, onGuideVote });

  return (
    <ScreenFrames screen="A02" desktop={<A02Desktop {...data} />} mobile={<A02Mobile {...data} />} />
  );
}
