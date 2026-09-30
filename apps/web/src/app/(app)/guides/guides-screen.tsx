'use client';

import { useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A03Desktop } from '@/screens/a03/desktop.generated';
import { A03Mobile } from '@/screens/a03/mobile.generated';
import {
  guideFilters,
  guideTabsFor,
  missing,
  panelGuides,
  rail,
  shortcuts,
  type A03Data,
} from '@/screens/a03/data';
import { useGuides } from '@/screens/guides/use-guides';

/**
 * A03 — Guides et Démarches, la liste. `/guides`
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/03 Accueil v2.dc.html` : les
 * styles en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * ── CE QUI VIENT DE L'API, ET CE QUI VIENT DE LA MAQUETTE ───────────────────
 *
 * Les CARTES viennent de `GET /guides` : titre, date de mise à jour, catégorie,
 * portée, auteur, compteur d'utilité, bandeau « À vérifier ». Le reste — le rail,
 * le panneau de section, les raccourcis, les trois menus de filtre et l'encart
 * « guides manquants » — est du dessin ou une donnée qu'aucune route ne donne.
 * Le détail est dans `screens/a03/data.ts`.
 *
 * L'ONGLET est un état de la page et non de l'URL : §2.3 en fait trois vues d'une
 * même liste, et la maquette les dessine comme des onglets, pas comme des pages.
 * `useSearchParams()` n'est donc pas employé — il forcerait le rendu client et a
 * déjà servi vide cinq pages de ce projet.
 *
 * ── CE QUI NE MARCHE PAS ENCORE, MESURÉ ─────────────────────────────────────
 *
 * Le changement d'onglet. Le cadre transcodé dessine les trois onglets en
 * `<span>` nus, sans gestionnaire : la maquette ne les marque pas comme
 * interactifs, et le transcodeur ne devine pas l'interaction. Cliquer
 * « À vérifier » ne déclenche donc aucun appel — vérifié dans un navigateur.
 *
 * L'état et l'appel SONT branchés et éprouvés derrière : `useGuides(tab)` refait
 * la requête avec `tab=review`, et l'API filtre correctement. Il ne manque que le
 * marqueur d'interaction dans la maquette, puis une régénération. Voir
 * `screens/a03/data.ts`. Remonté au rapport de lot.
 */
export function GuidesScreen() {
  const [tab, setTab] = useState(0);
  const { guides, chargement, echec } = useGuides(tab);

  /**
   * Pendant le chargement on garde les cartes précédentes plutôt que de vider la
   * liste : changer d'onglet ne doit pas faire clignoter la page. Au tout premier
   * chargement il n'y a rien à garder, et la liste est simplement vide.
   */
  const data: A03Data = {
    rail,
    panelGuides,
    shortcuts,
    guideTabs: guideTabsFor(tab, (_key, index) => setTab(index)),
    guideFilters,
    guides,
    missing,
  };

  return (
    <>
      {/*
        L'échec est annoncé AU-DESSUS de la liste, jamais à sa place : un guide
        publié est de la documentation, et la liste vide d'un onglet n'est pas la
        même chose qu'un serveur qui n'a pas répondu. Le message est celui du
        socle — `displayMessageFor` — et jamais celui du serveur sur un 429, qui
        dit « patientez un instant » pour une heure d'attente.
      */}
      {echec !== null && (
        <p
          role="alert"
          style={{
            margin: '12px 24px 0',
            padding: '12px 16px',
            borderRadius: '14px',
            background: echec.incident ? '#FDF0E7' : '#F2F5F4',
            color: echec.incident ? '#B4581F' : '#5D6B66',
            fontSize: '13px',
          }}
        >
          {echec.message}
        </p>
      )}
      <ScreenFrames
        screen="A03"
        desktop={<A03Desktop {...data} />}
        mobile={<A03Mobile {...data} />}
      />
      {/*
        Le chargement est annoncé aux lecteurs d'écran sans déplacer le dessin :
        la maquette ne dessine pas d'indicateur, et en inventer un serait
        redessiner. Le masquage est écrit ici plutôt qu'avec une classe utilitaire
        — le projet n'en a aucune, et en introduire une pour un seul écran
        créerait une convention que rien d'autre ne suit.
      */}
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {chargement ? 'Chargement des guides' : `${guides.length} guides`}
      </span>
    </>
  );
}
