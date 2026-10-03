'use client';

import { ScreenFrames } from '@/screens/frames';
import { A06Desktop } from '@/screens/a06/desktop.generated';
import { A06Mobile } from '@/screens/a06/mobile.generated';
import {
  guide as guideMaquette,
  panelGuides,
  propositionDepliee as deplieeMaquette,
  propositionRepliee as replieeMaquette,
  propositionsCompte as compteMaquette,
  rail,
  shortcuts,
  type A06Data,
  type PropositionEnTeteView,
} from '@/screens/a06/data';
import { propositionEnTeteDe, propositionsCompteDe } from '@/screens/guides/from-api';
import { useGuide } from '@/screens/guides/use-guides';

/**
 * A06 · planche 2 — « Propositions reçues » de l'auteur. BRANCHÉE SUR L'API.
 *
 * ── CE QUI MANQUAIT, ET CE QUE ÇA DONNAIT ───────────────────────────────────
 *
 * Cette page construisait `{ rail, panelGuides, shortcuts }` — la NAVIGATION, et
 * rien d'autre — là où `A06Data` déclare aussi le guide, les deux propositions et
 * les compteurs d'onglets. C'est l'un des deux `TS2739` du lot repris : les prises
 * avaient été déclarées dans `tools/screens/03-accueil.mjs`, l'appel qui les
 * alimente ne l'avait pas été. Le cadre lisait donc des propriétés que personne ne
 * lui passait.
 *
 * On ne retire pas les prises pour faire taire `tsc` : on complète l'appel.
 *
 * ── LA LIMITE STRUCTURELLE DE CETTE PLANCHE, QU'IL FAUT DIRE ────────────────
 *
 * La maquette dessine EXACTEMENT DEUX cartes, une dépliée et une repliée, en
 * balisage statique — ni `<sc-for>`, ni `<sc-if>`. Cet écran ne peut donc pas
 * représenter 0, 1, ni 3 propositions : il a deux emplacements, pas une liste.
 *
 * Conséquence tenue ici : un emplacement sans proposition reçoit un en-tête VIDE
 * (« Aucune proposition », pastille grise) et non les valeurs de la maquette. Un
 * dessin de maquette servi à la place d'une donnée absente aurait l'air branché
 * sans l'être — « Fatou Ndiaye · 11 j » s'afficherait sur un guide qui n'a reçu
 * aucune correction. REMONTÉ : il faut que la planche dise ce qui déplie une
 * carte, puis une boucle.
 *
 * ── CE QUI RESTE DESSINÉ, ET POURQUOI ───────────────────────────────────────
 *
 * Les blocs AVANT et APRÈS de la carte dépliée. La maquette y dessine un DIFF — le
 * mot retiré barré, les mots ajoutés surlignés — là où l'API rend deux chaînes
 * nues (`targetExcerpt`, `replacement`). Les lier mettrait le texte entier dans un
 * seul `<span>` et ferait DISPARAÎTRE la différence, c'est-à-dire la seule chose
 * que ces deux blocs montrent. Il faut un composant de différence, pas une prise.
 */

/**
 * L'emplacement sans proposition.
 *
 * La pastille grise et le `·` sont la convention que ce module tient déjà pour un
 * auteur anonymisé (`guideCardFrom`, §8) : une identité qui n'est pas là se dessine
 * en gris, elle ne s'emprunte pas à quelqu'un d'autre.
 */
const EMPLACEMENT_VIDE: PropositionEnTeteView = {
  i: '·',
  bg: '#8A958F',
  proposant: 'Aucune proposition',
  delai: '—',
  motif: '',
};

export function PropositionsScreen({ slug }: { readonly slug: string }) {
  const { detail, propositions, enTete } = useGuide(slug);

  /**
   * Avant la réponse, on garde le DESSIN de la maquette — le même choix que
   * `guide-screen.tsx` documente pour l'en-tête de A04 : un écran qui montre une
   * planche le temps d'un aller-retour vaut mieux qu'un écran vide qui clignote.
   *
   * Dès que la réponse est là, tout vient d'elle, y compris les emplacements vides.
   */
  const servi = detail !== null;
  const items = propositions?.items ?? [];

  const data: A06Data = {
    rail,
    panelGuides,
    shortcuts,
    /** Le guide dont on relit les propositions : son titre vient de `GET /guides/:slug`. */
    guide: servi && enTete !== null ? { title: enTete.title } : guideMaquette,
    propositionDepliee: servi
      ? (items[0] === undefined ? EMPLACEMENT_VIDE : propositionEnTeteDe(items[0]))
      : deplieeMaquette,
    propositionRepliee: servi
      ? (items[1] === undefined ? EMPLACEMENT_VIDE : propositionEnTeteDe(items[1]))
      : replieeMaquette,
    propositionsCompte: servi ? propositionsCompteDe(items) : compteMaquette,
  };

  return (
    <ScreenFrames screen="A06" desktop={<A06Desktop {...data} />} mobile={<A06Mobile {...data} />} />
  );
}
