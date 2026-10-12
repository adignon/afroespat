'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/index';
import { notifyError } from '@/components/notifications';
import { FenetreCommentaires } from '@/components/fenetre-commentaires';
import { FenetrePartage } from '@/components/fenetre-partage';
import {
  bookmarkPost,
  reactToPost,
  unbookmarkPost,
  unreactToPost,
} from '@/screens/accueil/api';
import type { FeedPostView } from '@/screens/a01/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « LES ACTIONS DE LA CARTE DE FIL NE MARCHENT PAS SUR LE PROFIL »          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Sur la page profil, les actions de la carte de fil d'actualité
 * ne marchent pas (like, comment, partager, bookmarks). Normalement tu dois
 * ramener toute leur interactivité aussi en fait. »
 *
 * Il a raison, et le défaut est le pendant exact de celui de la carte : le
 * DESSIN vivait dans le cadre du fil, les GESTES vivent dans sa page. Extraire
 * l'un sans l'autre donne une carte qui ressemble à la bonne et ne fait rien.
 *
 * ── CE QUE LA CARTE ATTEND, ET D'OÙ ÇA VIENT ────────────────────────────────
 *
 *   · le signet et la réaction sont des PRISES de la ligne (`p.onEnregistrer`,
 *     `p.reagi`) et un ATTRIBUT délégué (`data-post-reagir`) ;
 *   · « Commenter » et « Partager » posent `data-modal-open`, et attendent que
 *     quelqu'un monte A01C et A01P.
 *
 * Ce composant fournit les quatre, en appelant LES MÊMES fonctions que la page
 * du fil — `reactToPost`, `bookmarkPost`, `FenetreCommentaires`, `ecrireAAuteur`,
 * `publierDansReseau`. Aucune règle n'est recopiée : c'est le point de toute
 * l'opération, sinon les deux écrans divergeraient au premier changement.
 *
 * ── L'ÉTAT DES CARTES EST TENU ICI, ET PAS AILLEURS ────────────────────────
 *
 * Réagir et enregistrer changent la carte. La liste reçue en prise est donc
 * RECOPIÉE dans un état local, que les deux gestes mettent à jour sur la
 * réponse du serveur — jamais en optimiste, comme `use-fil` le fait déjà.
 */
export function CartesFilVivantes({
  cartes,
  children,
}: {
  readonly cartes: readonly FeedPostView[];
  readonly children: (vivantes: readonly FeedPostView[]) => ReactNode;
}) {
  const [etats, setEtats] = useState<
    Readonly<Record<string, { readonly reagi: boolean; readonly enregistre: boolean }>>
  >({});
  const [enVol, setEnVol] = useState(false);
  const [fenetre, setFenetre] = useState<'A01C' | 'A01P' | null>(null);
  const [sujet, setSujet] = useState<string | null>(null);

  const etatDe = useCallback(
    (carte: FeedPostView) => {
      const courant = carte.postId === undefined ? undefined : etats[carte.postId];
      return {
        reagi: courant?.reagi ?? carte.reagi ?? false,
        enregistre: courant?.enregistre ?? carte.enregistre ?? false,
      };
    },
    [etats],
  );

  const basculerReaction = useCallback(
    (postId: string, deja: boolean): void => {
      if (enVol) return;
      setEnVol(true);
      void (deja ? unreactToPost(postId) : reactToPost(postId))
        .then((etat) => {
          setEtats((c) => ({
            ...c,
            [postId]: { reagi: etat.mine !== null, enregistre: c[postId]?.enregistre ?? false },
          }));
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'La réaction n’a pas abouti.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [enVol],
  );

  const basculerSignet = useCallback(
    (postId: string, deja: boolean): void => {
      if (enVol) return;
      setEnVol(true);
      void (deja ? unbookmarkPost(postId) : bookmarkPost(postId))
        .then(({ bookmarked }) => {
          setEtats((c) => ({
            ...c,
            [postId]: { reagi: c[postId]?.reagi ?? false, enregistre: bookmarked },
          }));
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'L’enregistrement n’a pas abouti.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [enVol],
  );

  /**
   * LES DEUX FENÊTRES S'OUVRENT PAR DÉLÉGATION, comme sur le fil : les boutons
   * de la carte portent `data-modal-open` et `data-post-reagir`, et faire
   * voyager deux fonctions par carte à travers du JSX transcodé est précisément
   * ce que ce dépôt évite.
   */
  const onClic = useCallback(
    (event: { target: unknown }): void => {
      const cible = event.target;
      if (!(cible instanceof Element)) return;

      const reagir = cible.closest('[data-post-reagir]');
      if (reagir !== null) {
        const postId = reagir.getAttribute('data-post-reagir');
        if (postId !== null && postId !== '') {
          const carte = cartes.find((c) => c.postId === postId);
          basculerReaction(postId, carte === undefined ? false : etatDe(carte).reagi);
        }
        return;
      }

      const ouvrir = cible.closest('[data-modal-open]');
      if (ouvrir === null) return;
      const quoi = ouvrir.getAttribute('data-modal-open');
      const cibleId = ouvrir.getAttribute('data-modal-subject');
      if (quoi !== 'A01C' && quoi !== 'A01P') return;
      setSujet(cibleId === null || cibleId === '' ? null : cibleId);
      setFenetre(quoi);
    },
    [basculerReaction, cartes, etatDe],
  );

  const vivantes = useMemo(
    () =>
      cartes.map((carte) => {
        const etat = etatDe(carte);
        return {
          ...carte,
          reagi: etat.reagi,
          enregistre: etat.enregistre,
          onEnregistrer: (): void => {
            if (carte.postId === undefined) return;
            basculerSignet(carte.postId, etat.enregistre);
          },
        };
      }),
    [basculerSignet, cartes, etatDe],
  );

  /**
   * LA CARTE DONT LA FEUILLE EST OUVERTE, retrouvée par le `postId` que le
   * déclencheur a posé. `undefined` tant qu'aucune feuille n'est ouverte, et
   * aussi si la carte a quitté la liste entre-temps.
   */
  const carteCommentee =
    fenetre === 'A01C' && sujet !== null ? cartes.find((c) => c.postId === sujet) : undefined;

  /**
   * LE LIEN PARTAGÉ — et la condition d'ouverture de la feuille, en une seule
   * valeur.
   *
   * `window.location.origin` N'EST LU QUE QUAND LA FEUILLE S'OUVRE, et c'est la
   * même précaution qu'avant l'extraction : ce composant est `'use client'`, mais
   * Next le rend d'abord sur le serveur, où `window` n'existe pas. La lecture est
   * donc gardée par le `sujet`, qui ne peut venir que d'un clic.
   */
  const lienPartage =
    fenetre === 'A01P' && sujet !== null && typeof window !== 'undefined'
      ? `${window.location.origin}/publications/${sujet}`
      : null;

  return (
    <div onClick={onClic}>
      {children(vivantes)}
      {/**
       * LA FEUILLE DE COMMENTAIRES N'EST PLUS LOCALE À CE FICHIER : elle vit dans
       * `@/components/fenetre-commentaires`, parce que la page d'un GUIDE la
       * monte aussi (le porteur : « emprunter A01C au guide »). Une recopie
       * aurait fait deux feuilles qui auraient divergé au premier changement de
       * maquette.
       *
       * UNE CHAÎNE SUFFIT ICI, et elle dit ce qu'on veut dire : le sujet est une
       * PUBLICATION. `usePublication` la lit comme `{ subjectType: 'POST' }`,
       * donc l'appel réseau est à l'octet celui d'avant.
       */}
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LA FEUILLE DU PROFIL N'AVAIT NI CARTE DE SUJET NI COMPTEUR            ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * DÉFAUT MESURÉ, et il datait de l'extraction : dans sa version locale, la
       * feuille lisait sa carte et son compte sur `usePublication().post`, que
       * `avecPublication: false` laisse `null` POUR TOUJOURS. Ouverte depuis
       * cette page, elle n'a donc JAMAIS montré ni l'un ni l'autre — alors que la
       * planche de A01C dessine les deux, et que la page du fil les remplit.
       *
       * LES CINQ VALEURS SONT CELLES DE LA CARTE QU'ON VIENT DE TOUCHER, et pas
       * un second appel : `carteCommentee` est retrouvée par son `postId`, celui
       * que le déclencheur porte. C'est l'arbitrage que `fenetre-commentaires.tsx`
       * écrit déjà — « la feuille s'ouvre depuis un écran qui l'affiche déjà […]
       * et aller rechercher ce que le membre regarde serait un appel pour rien ».
       *
       * ── LES MÊMES CHAMPS QUE LA PAGE DU FIL, ET C'EST VÉRIFIABLE ──────────
       *
       * `/accueil` compose sa carte depuis la RÉPONSE de l'API :
       * `avatarDe(author)`, `author.displayName`, `typeLabel`, `excerpt`. Ici on
       * la compose depuis la VUE, et les quatre sont les mêmes valeurs, posées par
       * `feedPostFrom` : `i`/`bg` viennent du même `avatar()`, `name` est
       * `displayName`, `type` est `typeLabel`, `body` est `excerpt`. Aucune
       * conversion n'est refaite, donc les deux chemins ne peuvent pas diverger.
       *
       * `null` QUAND LA CARTE N'EST PAS RETROUVÉE, plutôt qu'une carte d'exemple :
       * c'est la règle que la prise elle-même écrit, « mieux vaut rien qu'un
       * exemple ».
       */}
      <FenetreCommentaires
        sujet={fenetre === 'A01C' ? sujet : null}
        sujetCarte={
          carteCommentee === undefined
            ? null
            : {
                i: carteCommentee.i,
                bg: carteCommentee.bg,
                nom: carteCommentee.name,
                badge: carteCommentee.type,
                extrait: carteCommentee.body,
              }
        }
        /**
         * ⚠ `commentCount` ET NON `n` : `n` est `counter.displayCount`, qui vaut
         * le nombre de RÉACTIONS sur une victoire. Écrire « Commentaires · 12 »
         * depuis `n` aurait affiché un nombre de bravos.
         *
         * Vide quand on ne l'a pas — le titre reste « Commentaires » sans nombre,
         * plutôt que « · 0 » sur un fil qu'on n'a pas compté.
         */
        compte={
          carteCommentee?.commentCount === undefined
            ? ''
            : `· ${String(carteCommentee.commentCount)}`
        }
        onFermer={() => {
          setFenetre(null);
        }}
      />
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LA FEUILLE « PARTAGER » N'EST PLUS LOCALE À CE FICHIER                ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Elle vit dans `@/components/fenetre-partage`, parce que la BARRE HAUTE
       * MOBILE D'UN GUIDE la monte aussi — le porteur : « les icon du header ne
       * marchent pas ». C'est le même déménagement que `FenetreCommentaires` a
       * fait au lot précédent, et pour la même raison : une recopie aurait fait
       * deux feuilles qui auraient divergé au premier changement de maquette.
       *
       * LES TROIS PRISES SONT CE QUI DÉPEND DU SUJET, et elles portent ici les
       * MÊMES CHAÎNES qu'avant l'extraction, au caractère près : le lien
       * `/publications/:id`, la phrase « Je partage cette publication avec
       * vous : … » et l'objet « Une publication de la diaspora ». Rien de ce que
       * le membre lit n'a changé.
       */}
      <FenetrePartage
        lien={lienPartage}
        message={
          lienPartage === null ? '' : `Je partage cette publication avec vous : ${lienPartage}`
        }
        objetCourriel="Une publication de la diaspora"
        onFermer={() => {
          setFenetre(null);
        }}
      />
    </div>
  );
}
