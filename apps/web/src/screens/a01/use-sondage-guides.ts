'use client';

import { useCallback, useMemo, useState } from 'react';
import { FEED_LIMITS, POLL_OPTIONS_MAX, type CreatePost } from '@app/shared';
import { notifySuccess } from '@/components/notifications';
import { useGuides } from '../guides/use-guides';
import { useRechercheGuides } from '../guides/use-recherche-guides';
import { guidesLiablesDe } from '../guides/from-api';
import type { A01SData } from './data';
import { libelleLierGuides, type A01GData } from '../a01g/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE SONDAGE ET LES GUIDES LIÉS D'UNE PUBLICATION — UNE SEULE LOGIQUE         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les fenêtres A01S (« Créer un sondage ») et A01G (« Lier un guide ») servent
 * TROIS composeurs : celui du fil d'accueil (et sa fenêtre de modification),
 * celui de la page mobile « Nouvelle publication », et celui du fil d'un réseau.
 * Chacun portait SA copie de cet état — le porteur : « Deux copies de la même
 * logique : réunis-les » (il y en avait trois). Elles avaient déjà divergé : le
 * composeur mobile ne bornait pas le nombre de guides, et ne disait pas les mêmes
 * mots sous un sondage.
 *
 * Ce crochet est la copie UNIQUE. Il rend les prises EXACTES des deux fenêtres
 * (`A01SData`, `A01GData`), la pièce à joindre à `createPost` (`piece`), et ce
 * que les cartes du composeur affichent (`sondage`, `sondageMeta`, `guidesLies`,
 * `titreGuide`). Les règles :
 *
 *   · une question et deux réponses au moins, au plus `POLL_OPTIONS_MAX`
 *     réponses (le plafond du SERVEUR, pas le « 2 à 5 » de la planche) ;
 *   · quatre durées (1, 3, 7, 14 jours), `closesAt` calculé À L'ENVOI ;
 *   · trois réglages, aux défauts d'avant (résultats après le vote, anonyme) ;
 *   · au plus `FEED_LIMITS.postGuidesMax` guides, et la recherche REMPLACE la
 *     liste au lieu de s'y ajouter ;
 *   · le BROUILLON (ce qu'on remplit) et le sondage RETENU (ce qui part) sont
 *     deux états : fermer la fenêtre sans valider n'attache rien.
 *
 * DEUX OPTIONS, pour l'accueil :
 *
 *   · `fenetre` / `setFenetre` — la page d'accueil a d'autres fenêtres (A01C,
 *     A01P) dans le MÊME état ; elle garde la main dessus. Sans ces options, le
 *     crochet tient son propre état.
 *   · `surValiderSondage` / `surLierGuides` — la fenêtre de MODIFICATION d'une
 *     publication écrit dans SON brouillon, pas dans celui du composeur. Le
 *     rappel rend `true` s'il a pris la main ; sinon le composeur est rempli.
 *     `semerSondage` et `semerGuides` ouvrent la fenêtre sur ce que la
 *     publication porte déjà.
 */
export type FenetrePiece = 'A01S' | 'A01G' | null;

/** Le sondage RETENU — celui qui part avec la publication. */
export interface SondageRetenu {
  readonly question: string;
  readonly options: readonly string[];
  readonly jours: number;
  readonly multiple: boolean;
  readonly apresVote: boolean;
  readonly anonyme: boolean;
}

export interface OptionsSondageGuides {
  readonly fenetre?: FenetrePiece;
  readonly setFenetre?: (fenetre: FenetrePiece) => void;
  readonly surValiderSondage?: (sondage: SondageRetenu) => boolean;
  /** `titreConnu` rend le titre lu dans la liste chargée, ou `undefined`. */
  readonly surLierGuides?: (
    ids: readonly string[],
    titreConnu: (id: string) => string | undefined,
  ) => boolean;
}

export interface SondageGuidesEtat {
  readonly fenetre: FenetrePiece;
  readonly ouvrirSondage: () => void;
  readonly ouvrirGuides: () => void;
  readonly fermer: () => void;
  readonly sondageFenetre: A01SData;
  readonly guidesFenetre: A01GData;
  /** Le sondage retenu, ou `null`. */
  readonly sondage: SondageRetenu | null;
  /** « 3 jours · résultats après le vote · anonyme » — ce que le sondage FERA. */
  readonly sondageMeta: string;
  readonly retirerSondage: () => void;
  readonly guidesLies: readonly string[];
  readonly retirerGuide: (id: string) => void;
  /** Le titre d'un guide, lu dans la liste chargée — « Guide lié » à défaut. */
  readonly titreGuide: (id: string) => string;
  /** Remplit le brouillon (modifier un sondage existant) avant d'ouvrir. */
  readonly semerSondage: (question: string, options: readonly string[]) => void;
  /** Coche ces guides (modifier une publication) avant d'ouvrir. */
  readonly semerGuides: (ids: readonly string[]) => void;
  /** Ce qu'ajouter au corps de `createPost` — vide quand rien n'est joint. */
  readonly piece: () => Pick<CreatePost, 'poll' | 'guideIds'>;
  /** « sondage », « 2 guides liés » — les morceaux d'un résumé de pièces jointes. */
  readonly resume: readonly string[];
  /** Après l'envoi : tout repart à zéro. */
  readonly vider: () => void;
}

const BROUILLON_VIDE: { question: string; options: readonly string[]; jours: number } = {
  question: '',
  options: ['', ''],
  jours: 3,
};

export function useSondageGuides(options: OptionsSondageGuides = {}): SondageGuidesEtat {
  const { surValiderSondage, surLierGuides } = options;
  const [fenetreInterne, setFenetreInterne] = useState<FenetrePiece>(null);
  const fenetre = options.setFenetre === undefined ? fenetreInterne : (options.fenetre ?? null);
  const setFenetre = options.setFenetre ?? setFenetreInterne;

  // ── Le sondage ──────────────────────────────────────────────────────────────
  const [brouillon, setBrouillon] = useState(BROUILLON_VIDE);
  const [multiple, setMultiple] = useState(false);
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
    const retenu: SondageRetenu = { question, options: reponses, jours: brouillon.jours, multiple, apresVote, anonyme };
    if (surValiderSondage?.(retenu) !== true) setSondage(retenu);
    setFenetre(null);
    notifySuccess('Sondage ajouté à votre publication.');
  }, [anonyme, apresVote, brouillon, multiple, setFenetre, surValiderSondage]);

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
      /** En dessous de deux réponses, ce n'est plus un sondage : la croix disparaît. */
      retirable: brouillon.options.length > 2,
    })),
    /** Le onzième clic ne fait rien : le serveur refuserait au-delà de `POLL_OPTIONS_MAX`. */
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
  /** La liste ne se charge qu'à l'ouverture de la fenêtre. */
  const guides = useGuides(0, fenetre === 'A01G');
  const [recherche, setRecherche] = useState('');
  const rechercheGuides = useRechercheGuides(recherche);
  const [choisis, setChoisis] = useState<readonly string[]>([]);
  const [lies, setLies] = useState<readonly string[]>([]);

  /**
   * LE TITRE D'UN GUIDE vient de la liste que la fenêtre a chargée : la sélection
   * ne porte que des identifiants. Sans elle, « Guide lié » plutôt qu'un
   * identifiant, qui ne dirait rien.
   */
  const guidesParId = useMemo(() => {
    const table = new Map<string, string>();
    for (const g of guides.page?.items ?? []) table.set(g.id, g.title);
    return table;
  }, [guides.page]);
  const titreGuide = useCallback((id: string) => guidesParId.get(id) ?? 'Guide lié', [guidesParId]);

  const basculer = useCallback((id: string) => {
    setChoisis((courant) =>
      courant.includes(id)
        ? courant.filter((x) => x !== id)
        : // « Jusqu'à 3 » : le quatrième clic ne fait rien, plutôt que d'être
          // écarté en silence par le serveur.
          courant.length >= FEED_LIMITS.postGuidesMax
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
      if (surLierGuides?.(choisis, (id) => guidesParId.get(id)) !== true) setLies(choisis);
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

  const sondageMeta =
    sondage === null
      ? ''
      : [
          sondage.jours === 1 ? '1 jour' : `${String(sondage.jours)} jours`,
          sondage.apresVote ? 'résultats après le vote' : 'résultats visibles tout de suite',
          sondage.anonyme ? 'anonyme' : 'votants nommés',
          ...(sondage.multiple ? ['plusieurs réponses'] : []),
        ].join(' · ');

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
    sondage,
    sondageMeta,
    retirerSondage: () => {
      setSondage(null);
    },
    guidesLies: lies,
    retirerGuide: (id) => {
      setLies((c) => c.filter((x) => x !== id));
      setChoisis((c) => c.filter((x) => x !== id));
    },
    titreGuide,
    semerSondage: (question, opts) => {
      maj({ question, options: opts.length === 0 ? ['', ''] : [...opts] });
    },
    semerGuides: (ids) => {
      setChoisis(ids);
    },
    piece,
    resume,
    vider,
  };
}
