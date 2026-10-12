'use client';

import { useCallback, useMemo, useState } from 'react';
import { FEED_LIMITS, POLL_OPTIONS_MAX, type CreatePost } from '@app/shared';
import { notifySuccess } from '@/components/notifications';
import { useGuides } from '../guides/use-guides';
import { useRechercheGuides } from '../guides/use-recherche-guides';
import { guidesLiablesDe } from '../guides/from-api';
import type { A01SData } from '../a01/data';
import { libelleLierGuides, type A01GData } from '../a01g/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE SONDAGE ET LES GUIDES LIÉS D'UNE PUBLICATION — HORS DE L'ACCUEIL         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le publicateur des réseaux doit supporter les sondages et
 * guides. » Les deux icônes du composeur du réseau disaient « pas encore ici » :
 * les fenêtres A01S (« Créer un sondage ») et A01G (« Lier un guide ») n'avaient
 * d'état que dans la page de l'accueil.
 *
 * Ce crochet porte CET ÉTAT pour un autre composeur, et rend les prises EXACTES
 * des deux fenêtres (`A01SData`, `A01GData`) : le réseau monte les MÊMES cadres
 * générés que l'accueil, sans rien redessiner. Ses règles sont celles de
 * l'accueil, mot pour mot — question et deux réponses au moins, au plus
 * `POLL_OPTIONS_MAX` réponses, quatre durées (1, 3, 7, 14 jours), trois réglages,
 * au plus `FEED_LIMITS.postGuidesMax` guides, la recherche qui REMPLACE la liste.
 *
 * ⚠ L'ACCUEIL N'EST PAS ENCORE PASSÉ SUR CE CROCHET. Sa page porte aussi
 * l'édition d'une publication existante (le sondage et les guides y écrivent
 * dans un autre brouillon), et la déplacer ici est un lot à part, qu'on n'a pas
 * voulu mêler à celui du réseau. REMONTÉ : deux copies d'une même règle, à
 * réunir.
 *
 * `piece` est ce qui part avec la publication (`poll`, `guideIds` de
 * `createPostSchema`) ; `closesAt` est calculé À L'ENVOI, comme sur l'accueil,
 * pour qu'une fenêtre restée ouverte une heure ne raccourcisse pas le sondage.
 */
export type FenetrePiece = 'A01S' | 'A01G' | null;

interface SondageRetenu {
  readonly question: string;
  readonly options: readonly string[];
  readonly jours: number;
  readonly multiple: boolean;
  readonly apresVote: boolean;
  readonly anonyme: boolean;
}

export interface SondageGuidesEtat {
  readonly fenetre: FenetrePiece;
  readonly ouvrirSondage: () => void;
  readonly ouvrirGuides: () => void;
  readonly fermer: () => void;
  readonly sondageFenetre: A01SData;
  readonly guidesFenetre: A01GData;
  /** Ce qu'ajouter au corps de `createPost` — vide quand rien n'est joint. */
  readonly piece: () => Pick<CreatePost, 'poll' | 'guideIds'>;
  /** « sondage », « 2 guides liés » — les morceaux du résumé des pièces jointes. */
  readonly resume: readonly string[];
  /** Après l'envoi : tout repart à zéro. */
  readonly vider: () => void;
}

const BROUILLON_VIDE = { question: '', options: ['', ''] as readonly string[], jours: 3 };

export function useSondageGuides(): SondageGuidesEtat {
  const [fenetre, setFenetre] = useState<FenetrePiece>(null);

  // ── Le sondage ──────────────────────────────────────────────────────────────
  const [brouillon, setBrouillon] = useState(BROUILLON_VIDE);
  const [multiple, setMultiple] = useState(false);
  /** Les deux défauts de l'accueil : résultats masqués avant le vote, anonyme. */
  const [apresVote, setApresVote] = useState(true);
  const [anonyme, setAnonyme] = useState(true);
  const [sondage, setSondage] = useState<SondageRetenu | null>(null);

  const maj = useCallback((patch: Partial<typeof BROUILLON_VIDE>) => {
    setBrouillon((b) => ({ ...b, ...patch }));
  }, []);
  const reponsesUtiles = brouillon.options.map((o) => o.trim()).filter((o) => o !== '');

  const onValiderSondage = useCallback(() => {
    const question = brouillon.question.trim();
    const reponses = brouillon.options.map((o) => o.trim()).filter((o) => o !== '');
    if (question === '' || reponses.length < 2) return;
    setSondage({ question, options: reponses, jours: brouillon.jours, multiple, apresVote, anonyme });
    setFenetre(null);
    notifySuccess('Sondage ajouté à votre publication.');
  }, [anonyme, apresVote, brouillon, multiple]);

  const sondageFenetre: A01SData = {
    sondageQuestion: brouillon.question,
    onSondageQuestion: (event) => {
      maj({ question: event.target.value });
    },
    sondageOptions: brouillon.options.map((texte, i) => ({
      texte,
      onTexte: (event: { target: { value: string } }) => {
        maj({ options: brouillon.options.map((o, j) => (j === i ? event.target.value : o)) });
      },
      onRetirer: () => {
        maj({ options: brouillon.options.filter((_, j) => j !== i) });
      },
      retirable: brouillon.options.length > 2,
    })),
    onAjouterOption: () => {
      maj({
        options:
          brouillon.options.length >= POLL_OPTIONS_MAX ? brouillon.options : [...brouillon.options, ''],
      });
    },
    sondageDurees: [1, 3, 7, 14].map((jours) => ({
      label: jours === 1 ? '1 jour' : `${String(jours)} jours`,
      on: brouillon.jours === jours,
      bg: brouillon.jours === jours ? '#fff' : 'transparent',
      fg: brouillon.jours === jours ? '#0F5C48' : '#5D6B66',
      onPick: () => {
        maj({ jours });
      },
    })),
    sondageMultiple: multiple,
    onSondageMultiple: () => {
      setMultiple((v) => !v);
    },
    sondageApresVote: apresVote,
    onSondageApresVote: () => {
      setApresVote((v) => !v);
    },
    sondageAnonyme: anonyme,
    onSondageAnonyme: () => {
      setAnonyme((v) => !v);
    },
    onValiderSondage,
    onAnnulerSondage: () => {
      setFenetre(null);
    },
    sondageBloque: brouillon.question.trim() === '' || reponsesUtiles.length < 2,
  };

  // ── Les guides liés ───────────────────────────────────────────────────────
  /** La liste ne se charge qu'à l'ouverture de la fenêtre, comme sur l'accueil. */
  const guides = useGuides(0, fenetre === 'A01G');
  const [recherche, setRecherche] = useState('');
  const rechercheGuides = useRechercheGuides(recherche);
  const [choisis, setChoisis] = useState<readonly string[]>([]);
  const [lies, setLies] = useState<readonly string[]>([]);

  const basculer = useCallback((id: string) => {
    setChoisis((courant) =>
      courant.includes(id)
        ? courant.filter((x) => x !== id)
        : courant.length >= FEED_LIMITS.postGuidesMax
          ? courant
          : [...courant, id],
    );
  }, []);

  const guidesFenetre: A01GData = {
    guidesSuggeres: [],
    guideRecherche: recherche,
    onGuideRecherche: (event) => {
      setRecherche(event.target.value);
    },
    guidesTrouves:
      rechercheGuides.resultats !== null
        ? rechercheGuides.resultats.map((g) => ({
            titre: g.titre,
            meta: g.meta,
            guideId: g.id,
            choisi: choisis.includes(g.id),
            onPick: () => {
              basculer(g.id);
            },
          }))
        : guides.page === null
          ? []
          : guidesLiablesDe(guides.page, choisis, basculer),
    onLierGuides: () => {
      setLies(choisis);
      setFenetre(null);
      notifySuccess(
        `${String(choisis.length)} guide${choisis.length > 1 ? 's' : ''} lié${choisis.length > 1 ? 's' : ''} à votre publication.`,
      );
    },
    onAnnulerGuides: () => {
      setChoisis(lies);
      setFenetre(null);
    },
    lierBloque: choisis.length === 0,
    lierLibelle: libelleLierGuides(choisis.length),
  };

  const piece = useCallback(
    (): Pick<CreatePost, 'poll' | 'guideIds'> => ({
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
      ...(lies.length === 0 ? {} : { guideIds: [...lies] }),
    }),
    [lies, sondage],
  );

  const resume = useMemo(
    () => [
      ...(sondage === null ? [] : ['sondage']),
      ...(lies.length === 0 ? [] : [lies.length === 1 ? '1 guide lié' : `${String(lies.length)} guides liés`]),
    ],
    [lies.length, sondage],
  );

  const vider = useCallback(() => {
    setSondage(null);
    setBrouillon(BROUILLON_VIDE);
    setMultiple(false);
    setApresVote(true);
    setAnonyme(true);
    setChoisis([]);
    setLies([]);
    setRecherche('');
  }, []);

  return {
    fenetre,
    ouvrirSondage: () => {
      setFenetre('A01S');
    },
    ouvrirGuides: () => {
      setChoisis(lies);
      setFenetre('A01G');
    },
    fermer: () => {
      setFenetre(null);
    },
    sondageFenetre,
    guidesFenetre,
    piece,
    resume,
    vider,
  };
}
