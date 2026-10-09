'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LevelRequiredDetailsParsed } from '@app/shared';
import { Modal } from '@/components/modal';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';
import { ScreenFrames } from '@/screens/frames';
import { MODALES, VOLETS_BLOCAGE, type NomModale, type ParcoursData } from './data';
import { useParcoursApi, type ContexteParcours } from './use-parcours-api';

export type { ContexteParcours };

/**
 * La coquille commune aux douze écrans du module Parcours.
 *
 * Elle ne dessine RIEN : tout le pixel vient des composants transcodés. Elle
 * apporte les deux choses qu'une image ne peut pas contenir — la bascule
 * ordinateur/mobile au seuil de 1024 px (§10.1) et l'ouverture des fenêtres.
 *
 * L'OUVERTURE EST DÉLÉGUÉE, comme la fermeture l'est dans `Modal`, et pour la
 * même raison : le bouton « Je suis bloqué·e » est enfoui au milieu de la carte
 * de l'étape en cours, et lui passer un `onClick` demanderait de modifier le JSX
 * transcodé — donc de renoncer à ce qui fait la valeur du transcodage. Le
 * transcodeur pose `data-modal-open` sur les déclencheurs ; un seul écouteur
 * suffit ici.
 *
 * Conséquence à connaître, la même que pour le fil : sur J01, les DEUX boutons
 * « Je suis bloqué·e » — celui du panneau et celui de l'étape en cours —
 * ouvrent la même feuille, sur la même étape. La maquette ne fournit qu'un jeu
 * de textes pré-remplis, et en inventer un par étape serait inventer de la
 * donnée. À brancher sur `POST /journeys/:id/steps/:stepId/blocker` au lot 3.
 *
 * LA COQUILLE NE TIENT AUCUN ÉTAT : c'est la page qui appelle `useParcours()`.
 * Une coquille qui l'aurait tenu aurait dû rendre `fermer` à la page pour que
 * J03 puisse recâbler « Annuler » — un aller-retour qui se paie toujours en
 * abstraction qui fuit.
 */

/** Une fenêtre que l'écran sait ouvrir : ses deux formes, telles que transcodées. */
export type PlancheModale = {
  /** Absent quand la maquette ne dessine pas de fenêtre — voir `Modal`. */
  readonly desktop?: ReactNode;
  readonly mobile: ReactNode;
  /** Cette forme n'existe qu'en mobile : sur grand écran l'état est ailleurs. */
  readonly mobileOnly?: boolean;
  /**
   * Le volet courant, pour une fenêtre qui en a plusieurs (J03).
   *
   * À partir de 1, le panneau joue `moments.panelAdvance` au lieu de rejouer son
   * ouverture : la feuille AVANCE d'un cran. Sans cela, chaque « Suivant »
   * refaisait remonter toute la feuille depuis le bas — le membre voyait une
   * nouvelle feuille au lieu de la même, un cran plus loin.
   */
  readonly phase?: number;
};

export function EcranParcours({
  screen,
  desktop,
  mobile,
  ouverte,
  onOuvrir,
  onFermer,
  modales,
  erreur = null,
  niveauRequis = null,
  oublierNiveauRequis,
}: {
  readonly screen: string;
  readonly desktop: ReactNode;
  /** Absent quand la maquette ne donne pas de cadre mobile pour cet écran. */
  readonly mobile?: ReactNode;
  readonly ouverte: NomModale | null;
  readonly onOuvrir: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly onFermer: () => void;
  /**
   * Les fenêtres de cet écran. Une fenêtre déclarée ici mais dont AUCUN bouton
   * ne porte le `data-modal-open` correspondant ne s'ouvrira jamais : le journal
   * de `node tools/generate-screens.mjs` le signale cadre par cadre.
   */
  readonly modales?: Partial<Record<NomModale, PlancheModale>>;
  /**
   * LE RETOUR DES APPELS, rendu ICI plutôt que dans chaque page.
   *
   * Douze écrans du module partagent les mêmes gestes (§3.5, §3.6) donc les mêmes
   * refus. Laisser chaque page écrire son affichage aurait donné douze variantes
   * du même message — c'est l'argument que `displayMessageFor` porte déjà dans le
   * socle, appliqué un cran plus haut.
   *
   * La bannière et l'invitation sont DEUX choses : 00 §7.3 exige une invitation à
   * monter de niveau, « jamais une simple erreur ».
   */
  readonly erreur?: string | null;
  readonly niveauRequis?: LevelRequiredDetailsParsed | null;
  readonly oublierNiveauRequis?: () => void;
}) {
  return (
    <div onClick={onOuvrir}>
      <ScreenFrames
        screen={screen}
        desktop={desktop}
        {...(mobile === undefined ? {} : { mobile })}
      />
      {Object.entries(modales ?? {}).map(([nom, planche]) => (
        <Modal
          key={nom}
          open={ouverte === nom}
          onClose={onFermer}
          titleId={MODALES[nom as NomModale].titleId}
          name={nom}
          {...(planche.desktop === undefined ? {} : { desktop: planche.desktop })}
          {...(planche.mobileOnly === undefined ? {} : { mobileOnly: planche.mobileOnly })}
          {...(planche.phase === undefined ? {} : { phase: planche.phase })}
          mobile={planche.mobile}
        />
      ))}
      <FlowError message={erreur} />
      <LevelInvitation details={niveauRequis} onClose={oublierNiveauRequis ?? (() => undefined)} />
    </div>
  );
}

/**
 * L'état d'un écran Parcours : la fenêtre ouverte, et le volet de J03.
 *
 * LE NOM LU DANS L'ATTRIBUT EST VÉRIFIÉ contre la table. Sans cette garde, une
 * faute de frappe dans une déclaration d'écran donnerait un bouton qui n'ouvre
 * rien, en silence, et qui aurait pourtant l'air branché — le générateur, lui,
 * ne voit que la maquette et ne peut pas savoir ce que la page attend.
 *
 * LE VOLET REVIENT À UN, à la fermeture ET à l'ouverture. Ce n'est pas du
 * confort : rouvrir la feuille directement sur l'aperçu, à un clic de
 * « Publier », contredirait §3.5 — « flux en quatre temps, sans jamais publier
 * automatiquement ». Le membre doit relire son texte et rechoisir sa portée.
 *
 * LES DEUX REMISES À ZÉRO SE COUVRENT L'UNE L'AUTRE, et c'est la mutation qui
 * l'a montré : retirer l'une OU l'autre laisse le test passer, parce que la
 * seconde suffit. Il a fallu les retirer TOUTES LES DEUX pour le faire tomber.
 * Elles restent, parce que la propriété — « une feuille rouverte commence au
 * premier volet » — vaut mieux qu'une seule ligne bien placée, et que le jour où
 * une fenêtre s'ouvrira autrement qu'au clic, celle de l'ouverture ne s'appliquera
 * plus. Le test mesure la PROPRIÉTÉ, pas la ligne.
 */
/**
 * ─── LES SEPT DESTINATIONS DU PANNEAU « MON PARCOURS » ──────────────────────
 *
 * Elles sont les routes de `app/(app)/parcours/[id]/`, et la maquette dit
 * elle-même laquelle va avec quelle entrée : elle PEINT l'entrée qui désigne la
 * planche ouverte (relevé cadre par cadre dans
 * `tools/screens/04-parcours.mjs`). Aucune n'est déduite d'un libellé.
 *
 * ── LE SEGMENT EST LU BRUT, ET PAS PAR `useContexteParcours` ────────────────
 *
 * `useContexteParcours` filtre l'identifiant sur `UUID` — il le doit, puisqu'il
 * sert à APPELER l'API, et `/parcours/1` est l'URL des planches d'illustration.
 * La NAVIGATION, elle, n'appelle rien : `/parcours/1/equipe` est une route
 * parfaitement servie, et c'est précisément celle où l'on vérifie que le panneau
 * clique. Filtrer ici rendrait les sept entrées inertes sur la démonstration,
 * donc intestables — et muettes pour le porteur qui ouvre le produit.
 *
 * SANS SEGMENT, RIEN NE BOUGE. Sur `/parcours`, `/parcours/nouveau` et
 * `/parcours/publics`, la maquette ne peint AUCUNE entrée : il n'y a pas de
 * parcours courant. Ces trois planches ne reçoivent donc pas ces liens du tout
 * (voir la déclaration) ; le garde ci-dessous est la ceinture qui rend la
 * fonction sûre si une quatrième page les demandait un jour.
 */
function usePanneauParcours() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const id = typeof params.id === 'string' && params.id !== '' ? params.id : null;

  return useMemo(() => {
    const aller = (suffixe: string) => () => {
      if (id === null) return;
      router.push(`/parcours/${id}${suffixe}`);
    };
    return {
      onPanneauVue: aller(''),
      onPanneauEtape: aller('/etapes'),
      onPanneauDiscussion: aller('/discussion'),
      onPanneauEquipe: aller('/equipe'),
      onPanneauDocuments: aller('/documents'),
      onPanneauHistorique: aller('/historique'),
      onPanneauReglages: aller('/reglages'),
    };
  }, [id, router]);
}

export function useParcours(
  ouverteInitiale: NomModale | null = null,
  contexte: ContexteParcours = {},
) {
  const [ouverte, setOuverte] = useState<NomModale | null>(ouverteInitiale);
  const [volet, setVolet] = useState(0);
  const api = useParcoursApi(contexte);
  const panneau = usePanneauParcours();

  const onOuvrir = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      const cible = event.target;
      if (!(cible instanceof Element)) return;
      const bouton = cible.closest('[data-modal-open]');
      if (bouton === null) return;
      const nom = bouton.getAttribute('data-modal-open');
      if (nom !== null && nom in MODALES) {
        setOuverte(nom as NomModale);
        setVolet(0);
        /**
         * OUVRIR « JE SUIS BLOQUÉ·E » CRÉE LE BROUILLON (§3.5, premier temps).
         *
         * C'est le flux du dossier, pas une optimisation : la route
         * `POST /journeys/:id/steps/:stepId/blocker` « crée le BROUILLON et rend
         * le texte pré-rempli ». Elle ne publie rien — la seule route qui promeut
         * est `POST /blockers/:id/publish`, et ce lot ne l'appelle pas.
         *
         * Le brouillon sert à ce que « Annuler » ait quelque chose à annuler :
         * §3.5 veut un brouillon `CANCELLED`, et sans création il n'y aurait rien
         * en base à passer dans cet état — « Annuler » n'aurait été qu'une
         * fermeture de fenêtre déguisée en décision.
         */
        if (nom === 'J03') api.ouvrirBlocage();
      }
    },
    [api],
  );

  const onFermer = useCallback((): void => {
    setOuverte(null);
    setVolet(0);
  }, []);

  const suivant = useCallback((): void => {
    setVolet((n) => Math.min(n + 1, VOLETS_BLOCAGE - 1));
  }, []);
  const precedent = useCallback((): void => setVolet((n) => Math.max(n - 1, 0)), []);

  /**
   * « ANNULER » ET « PLUS TARD » SONT LE MÊME BOUTON POUR LE GÉNÉRATEUR, ET DEUX
   * DÉCISIONS DIFFÉRENTES POUR LE MEMBRE.
   *
   * Le transcodeur écrit `onClick={onCancel}` sur les deux : « Annuler » de J03 et
   * « Plus tard » de J04. Un seul nom, donc, pour deux routes :
   *
   *   · J03 → `POST /blockers/:id/cancel` : le brouillon passe en `CANCELLED`
   *     (§3.5). Le membre a renoncé à demander de l'aide ;
   *   · J04 → `POST /journeys/:id/steps/:stepId/dismiss-share` : le partage n'est
   *     PLUS JAMAIS reproposé pour cette étape (§3.6). Ce n'est pas un report.
   *
   * On dispatche donc sur la fenêtre OUVERTE. Le faire dans les planches aurait
   * demandé deux `ParcoursData` distincts par écran — et le générateur n'écrirait
   * toujours qu'un seul nom.
   *
   * La fenêtre se ferme DANS TOUS LES CAS, même si l'appel échoue. Le membre a
   * cliqué « Plus tard » : laisser la feuille ouverte parce que le serveur n'a pas
   * répondu lui redemanderait une décision qu'il vient de prendre. C'est le même
   * arbitrage que `logout()` dans le socle, et pour la même raison.
   */
  const onCancel = useCallback((): void => {
    if (ouverte === 'J03') api.annulerBlocage();
    else if (ouverte === 'J04') api.declinerPartage();
    onFermer();
  }, [api, onFermer, ouverte]);

  /**
   * Ce que les composants transcodés reçoivent.
   *
   * `busy` n'est plus une constante : il suit les appels réellement en vol, et le
   * générateur écrit `disabled={busy}` sur les boutons qu'il reconnaît. Un double
   * clic sur « Continuer » de J02 créerait sinon deux parcours — dont le second
   * serait refusé par `PLAN_LIMIT_REACHED`, ce qui ressemblerait à un bogue.
   *
   * `onContinue` est celui de J02 « Régulariser » (§3.1) : il crée le parcours
   * « Régulariser ma situation » et mène au parcours créé. Il reste inerte sur les
   * écrans qui ne passent pas de contexte de création — il n'y aurait alors aucun
   * modèle à créer, et deviner lequel serait pire que ne rien faire.
   */
  const data: ParcoursData = {
    busy: api.busy,
    onContinue: api.creer,
    onNext: suivant,
    onBack: precedent,
    onCancel,
    ...panneau,
  };

  return {
    ouverte,
    onOuvrir,
    onFermer,
    volet,
    data,
    /** Le refus à afficher, ou `null`. Décidé sur `error.code` (§5.2). */
    erreur: api.erreur,
    /** §7.3 — l'invitation à monter de niveau, ou `null`. Jamais une erreur. */
    niveauRequis: api.niveauRequis,
    oublierNiveauRequis: api.oublierNiveauRequis,
  };
}
