'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FEED_LIMITS, POLL_OPTIONS_MAX, PostType as POST_TYPES } from '@app/shared';
import { useGuides } from '@/screens/guides/use-guides';
import { useRechercheGuides } from '@/screens/guides/use-recherche-guides';
import { guidesLiablesDe } from '@/screens/guides/from-api';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError } from '@/lib/api/index';
import { createPost, uploadPostImage } from './api';
import { accueilData } from './props';
import { draftTypesFor } from './data';
import type { AccueilData } from './data';
import type { A01SData } from '../a01/data';
import type { A01GData } from '../a01g/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « LA PAGE DE PUBLICATION SUR MOBILE N'EST PAS DYNAMIQUE, PAS D'INPUT »     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui. MESURÉ sur `/publications/nouvelle` à 390 px :
 * ZÉRO `<input>`, ZÉRO `<textarea>`, UN seul bouton — et tout le corps était
 * l'exemple de la maquette, servi à qui n'avait rien écrit : « On organise un
 * repas partagé… », « Photo 1 », « Samedi 22 mars », « Repas pas cher à Lyon ».
 *
 * La page montait `accueilData()`, la fabrique de DÉMONSTRATION.
 *
 * ── POURQUOI UN ÉTAT ICI, ET NON CELUI DE `/accueil` ──────────────────────
 *
 * Le composeur du fil vit dans `(app)/accueil/page.tsx`, mêlé à son fil, à ses
 * six fenêtres et à mille quatre cents lignes. L'en extraire proprement est un
 * lot à part entière, et le faire à moitié casserait la page la plus visitée du
 * produit. Cet écran tient donc SON brouillon — c'est d'ailleurs ce qu'il est :
 * une page de création qu'on ouvre, qu'on remplit et qu'on quitte.
 *
 * Les APPELS, eux, sont les mêmes : `createPost` et `uploadPostImage`, de
 * `screens/accueil/api.ts`. Aucune règle n'est recopiée.
 *
 * ── LE SONDAGE ET LES GUIDES LIÉS SONT LÀ AUSSI ───────────────────────────
 *
 * Le porteur : « Sondage et guides liés : sur mobile ça ne marche pas aussi. »
 * Les deux fenêtres (A01S, A01G) sont maintenant montées par cette page, avec
 * leur état ici. Les bornes et les listes viennent des mêmes sources que sur le
 * fil — `POLL_OPTIONS_MAX` de `@app/shared`, `useGuides` et
 * `useRechercheGuides` du module Guides — et rien n'est recopié.
 */
export function useComposeurMobile(): {
  readonly donnees: AccueilData;
  readonly fenetreSondage: A01SData;
  readonly fenetreGuides: A01GData;
  readonly fenetre: 'A01S' | 'A01G' | null;
  readonly setFenetre: (quoi: 'A01S' | 'A01G' | null) => void;
} {
  const router = useRouter();
  const [type, setType] = useState(3);
  const [texte, setTexte] = useState('');
  const [images, setImages] = useState<readonly { id: string; url: string }[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [fenetre, setFenetre] = useState<'A01S' | 'A01G' | null>(null);

  /**
   * LE SONDAGE EN DEUX ÉTATS, comme sur le fil : le BROUILLON qu'on remplit dans
   * la fenêtre, et le sondage VALIDÉ qui est attaché à la publication. Les
   * confondre voudrait dire qu'ouvrir la fenêtre et la fermer sans valider
   * attacherait un sondage vide.
   */
  const [brouillonSondage, setBrouillonSondage] = useState<{
    question: string;
    options: readonly string[];
    jours: number;
  }>({ question: '', options: ['', ''], jours: 3 });
  const [sondageMultiple, setSondageMultiple] = useState(false);
  /** Les deux défauts sont ceux du fil : résultats masqués avant vote, anonyme. */
  const [sondageApresVote, setSondageApresVote] = useState(true);
  const [sondageAnonyme, setSondageAnonyme] = useState(true);
  const [sondage, setSondage] = useState<{
    question: string;
    options: readonly string[];
    jours: number;
    multiple: boolean;
    apresVote: boolean;
    anonyme: boolean;
  } | null>(null);

  const [guideRecherche, setGuideRecherche] = useState('');
  const [guidesChoisis, setGuidesChoisis] = useState<readonly string[]>([]);
  const [guidesLies, setGuidesLies] = useState<readonly string[]>([]);
  const guides = useGuides(0, fenetre === 'A01G');
  const rechercheGuides = useRechercheGuides(guideRecherche);

  /**
   * LE TITRE D'UN GUIDE LIÉ vient de la liste que la fenêtre a chargée : la
   * sélection ne porte que des identifiants. Sans la liste, on écrit « Guide
   * lié » plutôt que l'identifiant, qui ne dirait rien.
   */
  const guidesParId = useMemo(() => {
    const table = new Map<string, string>();
    for (const g of guides.page?.items ?? []) table.set(g.id, g.title);
    return table;
  }, [guides.page]);

  const majBrouillon = useCallback(
    (patch: Partial<{ question: string; options: readonly string[]; jours: number }>): void => {
      setBrouillonSondage((courant) => ({ ...courant, ...patch }));
    },
    [],
  );

  const basculerGuide = useCallback((id: string): void => {
    setGuidesChoisis((courant) =>
      courant.includes(id) ? courant.filter((x) => x !== id) : [...courant, id],
    );
  }, []);

  const onAjouterImage = useCallback((): void => {
    const choix = document.createElement('input');
    choix.type = 'file';
    choix.accept = 'image/*';
    choix.multiple = true;
    choix.addEventListener('change', () => {
      const fichiers = [...(choix.files ?? [])].slice(0, FEED_LIMITS.postMediaMax);
      void (async () => {
        for (const fichier of fichiers) {
          try {
            const media = await uploadPostImage(fichier);
            setImages((courant) =>
              courant.length >= FEED_LIMITS.postMediaMax
                ? courant
                : [...courant, { id: media.id, url: media.url }],
            );
          } catch (cause) {
            notifyError(
              cause instanceof ApiError ? cause.displayMessage : 'L’image n’a pas pu être déposée.',
            );
          }
        }
      })();
    });
    choix.click();
  }, []);

  const onPublier = useCallback((): void => {
    const corps = texte.trim();
    if (corps === '' || envoi) return;
    setEnvoi(true);
    createPost({
      type: POST_TYPES[type] ?? 'DISCUSSION',
      body: corps,
      ...(images.length === 0 ? {} : { mediaIds: images.map((im) => im.id) }),
      /**
       * `closesAt` EST CALCULÉ À L'ENVOI, pas au moment où l'on choisit la
       * durée : « 3 jours » veut dire trois jours à partir de la publication, et
       * un composeur peut rester ouvert. Même règle que sur le fil.
       */
      ...(sondage === null
        ? {}
        : {
            poll: {
              question: sondage.question,
              options: [...sondage.options],
              isMultiple: sondage.multiple,
              resultsAfterVote: sondage.apresVote,
              isAnonymous: sondage.anonyme,
              closesAt: new Date(Date.now() + sondage.jours * 86_400_000),
            },
          }),
      ...(guidesLies.length === 0 ? {} : { guideIds: [...guidesLies] }),
    })
      .then(() => {
        notifySuccess('Publication envoyée.');
        router.push('/accueil');
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'La publication n’a pas pu partir.',
        );
      })
      .finally(() => {
        setEnvoi(false);
      });
  }, [envoi, guidesLies, images, router, sondage, texte, type]);

  /**
   * LE SOCLE RESTE `accueilData()` — le cadre lit aussi le rail, la barre basse
   * et les libellés que la maquette dessine, et aucun n'est du brouillon. On
   * n'écrase que ce qui est du composeur.
   */
  const donnees: AccueilData = {
    ...accueilData(),
    draftTypes: draftTypesFor(type, setType),
    brouillon: {
      texte,
      /**
       * LE CADRE DESSINE UN RECTANGLE HACHURÉ AVEC UN NOM, pas une image : la
       * miniature porte donc un LIBELLÉ, et « Photo 1 » devient « Photo 1 » du
       * brouillon réel — autant d'entrées que d'images déposées, ni plus ni
       * moins. C'est le compteur du pied qui lit cette longueur.
       */
      photos: images.map((_, rang) => `Photo ${String(rang + 1)}`),
      cible: 'Visible de tous',
    },
    composeurTexte: texte,
    onComposeurTexte: (event) => {
      setTexte(event.target.value);
    },
    onPublier,
    publierBloque: texte.trim() === '' || envoi,
    onAjouterImage,

    // ── La carte de sondage du composeur ──
    composeurSondage:
      sondage === null
        ? null
        : {
            question: sondage.question,
            options: sondage.options,
            /**
             * LA LIGNE DE RÉGLAGES EST COMPOSÉE, jamais l'exemple de la
             * maquette : elle dit ce que le sondage FERA.
             */
            meta: [
              sondage.jours === 1 ? '1 jour' : `${String(sondage.jours)} jours`,
              sondage.apresVote ? 'résultats après le vote' : 'résultats visibles',
              sondage.anonyme ? 'anonyme' : 'votes visibles',
            ].join(' · '),
            onModifier: () => {
              setFenetre('A01S');
            },
            onRetirer: () => {
              setSondage(null);
            },
          },
    composeurGuides: guidesLies.map((id) => ({
      titre: guidesParId.get(id) ?? 'Guide lié',
      retirer: `Retirer ${guidesParId.get(id) ?? 'ce guide'}`,
      onRetirer: () => {
        setGuidesLies((courant) => courant.filter((x) => x !== id));
        setGuidesChoisis((courant) => courant.filter((x) => x !== id));
      },
    })),
    composeurSondageCompte: sondage === null ? '0' : '1',
    composeurGuidesCompte: String(guidesLies.length),
  };

  /** Ce que la fenêtre « Créer un sondage » lit — et rien d'autre (`A01SData`). */
  const fenetreSondage: A01SData = {
    sondageQuestion: brouillonSondage.question,
    onSondageQuestion: (event: { target: { value: string } }) => {
      majBrouillon({ question: event.target.value });
    },
    sondageOptions: brouillonSondage.options.map((texteOption, i) => ({
      texte: texteOption,
      onTexte: (event: { target: { value: string } }): void => {
        majBrouillon({
          options: brouillonSondage.options.map((o, j) => (j === i ? event.target.value : o)),
        });
      },
      onRetirer: (): void => {
        majBrouillon({ options: brouillonSondage.options.filter((_, j) => j !== i) });
      },
      /** En dessous de deux réponses, ce n'est plus un sondage : la croix part. */
      retirable: brouillonSondage.options.length > 2,
    })),
    /**
     * LE PLAFOND EST CELUI DU SERVEUR (`POLL_OPTIONS_MAX`), pas celui que la
     * planche écrit (« 2 à 5 ») : c'est le serveur qui refuse. Écart REMONTÉ.
     */
    onAjouterOption: () => {
      majBrouillon({
        options:
          brouillonSondage.options.length >= POLL_OPTIONS_MAX
            ? brouillonSondage.options
            : [...brouillonSondage.options, ''],
      });
    },
    sondageDurees: [1, 3, 7, 14].map((jours) => ({
      label: jours === 1 ? '1 jour' : `${String(jours)} jours`,
      on: brouillonSondage.jours === jours,
      bg: brouillonSondage.jours === jours ? '#fff' : 'transparent',
      fg: brouillonSondage.jours === jours ? '#0F5C48' : '#5D6B66',
      onPick: (): void => {
        majBrouillon({ jours });
      },
    })),
    sondageMultiple,
    onSondageMultiple: () => {
      setSondageMultiple((v) => !v);
    },
    sondageApresVote,
    onSondageApresVote: () => {
      setSondageApresVote((v) => !v);
    },
    sondageAnonyme,
    onSondageAnonyme: () => {
      setSondageAnonyme((v) => !v);
    },
    sondageBloque:
      brouillonSondage.question.trim() === '' ||
      brouillonSondage.options.map((o) => o.trim()).filter((o) => o !== '').length < 2,
    onValiderSondage: () => {
      const question = brouillonSondage.question.trim();
      const reponses = brouillonSondage.options.map((o) => o.trim()).filter((o) => o !== '');
      if (question === '' || reponses.length < 2) return;
      setSondage({
        question,
        options: reponses,
        jours: brouillonSondage.jours,
        multiple: sondageMultiple,
        apresVote: sondageApresVote,
        anonyme: sondageAnonyme,
      });
      setFenetre(null);
      notifySuccess('Sondage ajouté à votre publication.');
    },
    onAnnulerSondage: () => {
      setFenetre(null);
    },
  };

  /** Ce que la fenêtre « Lier un guide » lit (`A01GData`). */
  const fenetreGuides: A01GData = {
    guideRecherche,
    onGuideRecherche: (event: { target: { value: string } }) => {
      setGuideRecherche(event.target.value);
    },
    guidesSuggeres: [],
    /**
     * LA RECHERCHE REMPLACE LA LISTE, elle ne s'y ajoute pas : mêler les deux
     * montrerait des guides qui ne répondent pas à ce qu'on vient de taper.
     * `resultats === null` veut dire « on ne cherche pas » — moins de deux
     * caractères, la borne du serveur.
     */
    guidesTrouves:
      rechercheGuides.resultats !== null
        ? rechercheGuides.resultats.map((g) => ({
            titre: g.titre,
            meta: g.meta,
            guideId: g.id,
            choisi: guidesChoisis.includes(g.id),
            onPick: (): void => {
              basculerGuide(g.id);
            },
          }))
        : guides.page === null
          ? []
          : guidesLiablesDe(guides.page, guidesChoisis, basculerGuide),
    lierBloque: guidesChoisis.length === 0,
    onLierGuides: () => {
      setGuidesLies(guidesChoisis);
      setFenetre(null);
      notifySuccess(
        `${String(guidesChoisis.length)} guide${guidesChoisis.length > 1 ? 's' : ''} lié${guidesChoisis.length > 1 ? 's' : ''} à votre publication.`,
      );
    },
    onAnnulerGuides: () => {
      setGuidesChoisis(guidesLies);
      setFenetre(null);
    },
  };

  return { donnees, fenetreSondage, fenetreGuides, fenetre, setFenetre };
}
