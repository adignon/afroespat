'use client';

import { useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A03Desktop } from '@/screens/a03/desktop.generated';
import { A03Mobile } from '@/screens/a03/mobile.generated';
import {
  guideTabsFor,
  panelGuides,
  rail,
  shortcuts,
  type A03Data,
} from '@/screens/a03/data';
import { useGuides } from '@/screens/guides/use-guides';
import { useGuidesManquants } from '@/screens/guides/use-guides-manquants';
import { useReferentielsGuides } from '@/screens/guides/use-referentiels';
import { CATEGORY_LABEL } from '@/screens/guides/from-api';
import type { FiltreGuide } from '@/screens/a03/data';

/**
 * A03 — Guides et Démarches, la liste. `/guides`
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/03 Accueil v2.dc.html` : les
 * styles en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * ── CE QUI VIENT DE L'API, ET CE QUI VIENT DE LA MAQUETTE ───────────────────
 *
 * Les CARTES viennent de `GET /guides` : titre, date de mise à jour, catégorie,
 * portée, auteur, compteur d'utilité, bandeau « À vérifier ». L'encart « GUIDES
 * MANQUANTS » vient de `GET /search/zero-results` — il affichait les quatre lignes
 * d'exemple de la maquette, et cet en-tête le rangeait avec le dessin : c'est ce
 * que ce lot corrige. Le reste — le rail, le panneau de section, les raccourcis et
 * les trois menus de filtre — est du dessin ou une donnée qu'aucune route ne donne.
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
  /**
   * ── LES TROIS FILTRES SONT UN ÉTAT DE PAGE ───────────────────────────────
   *
   * Le porteur : « rends aussi la page, les filtres etc. dynamique ».
   *
   * Ils partent dans la REQUÊTE et non sur la liste déjà reçue : `GET /guides`
   * est paginé, et filtrer localement donnerait « Logement » vide alors que le
   * guide existe, simplement parce qu'il est page deux.
   */
  const [categorie, setCategorie] = useState('');
  const [pays, setPays] = useState('');
  const [ville, setVille] = useState('');
  const { guides, chargement, echec } = useGuides(tab, true, {
    category: categorie,
    countryId: pays,
    cityId: ville,
  });

  const referentiels = useReferentielsGuides();

  /**
   * ── « GUIDES MANQUANTS » EST BRANCHÉ, ET IL NE L'ÉTAIT PAS ───────────────
   *
   * Le panneau affichait les quatre lignes d'exemple de la maquette. Il lit
   * maintenant `GET /search/zero-results` — voir `use-guides-manquants.ts`, qui
   * porte la fenêtre de quatre semaines et l'arbitrage de la ville.
   *
   * `?? []` : `null` veut dire « la réponse n'est pas encore là », et le panneau
   * se CACHE alors — même dessin que lorsque la liste revient vide. Un chiffre
   * faux affiché le temps d'un aller-retour serait lu, puis cru.
   */
  const manquants = useGuidesManquants();

  /**
   * LES TROIS PASTILLES, DANS L'ORDRE DE LA PLANCHE.
   *
   * Chacune garde SON LIBELLÉ — « Catégorie », « Pays », « Ville » — parce que
   * c'est ce que la maquette écrit : la pastille dit ce qu'elle filtre, pas ce
   * qui est retenu. La première option vide est le « tout », et elle porte le
   * même mot.
   */
  const filtres: readonly FiltreGuide[] = [
    {
      cle: 'category',
      libelle: 'Catégorie',
      valeur: categorie,
      options: [
        { valeur: '', libelle: 'Catégorie' },
        ...Object.entries(CATEGORY_LABEL).map(([valeur, libelle]) => ({ valeur, libelle })),
      ],
      onChoisir: (event) => {
        setCategorie(event.target.value);
      },
    },
    {
      cle: 'countryId',
      libelle: 'Pays',
      valeur: pays,
      options: [
        { valeur: '', libelle: 'Pays' },
        ...referentiels.pays.map((p) => ({ valeur: p.id, libelle: p.nameFr })),
      ],
      onChoisir: (event) => {
        setPays(event.target.value);
      },
    },
    {
      cle: 'cityId',
      libelle: 'Ville',
      valeur: ville,
      options: [
        { valeur: '', libelle: 'Ville' },
        ...referentiels.villes.map((v) => ({ valeur: v.id, libelle: v.name })),
      ],
      onChoisir: (event) => {
        setVille(event.target.value);
      },
    },
  ];

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
    guideFilters: filtres,
    guides,
    missing: manquants ?? [],
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
