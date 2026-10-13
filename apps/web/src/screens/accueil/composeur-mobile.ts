'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FEED_LIMITS, PostType as POST_TYPES } from '@app/shared';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError } from '@/lib/api/index';
import { createPost, uploadPostImage } from './api';
import { accueilData } from './props';
import { draftTypesFor } from './data';
import type { AccueilData } from './data';
import type { A01SData } from '../a01/data';
import type { A01GData } from '../a01g/data';
import { useSondageGuides } from '../a01/use-sondage-guides';

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
 * Les deux fenêtres (A01S, A01G) sont montées par cette page ; leur état et leurs
 * règles viennent de `useSondageGuides` (`screens/a01/use-sondage-guides.ts`),
 * la logique UNIQUE du sondage et des guides liés, partagée avec le fil
 * d'accueil et le fil d'un réseau. Rien n'est recopié.
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
   * LE SONDAGE ET LES GUIDES LIÉS — l'état et les deux fenêtres viennent de
   * `useSondageGuides`, la logique UNIQUE que partagent le fil d'accueil, cette
   * page et le fil d'un réseau. La page garde la main sur la fenêtre ouverte
   * (`fenetre`), d'où le contrôle passé au crochet.
   */
  const pieces = useSondageGuides({ fenetre, setFenetre });

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
      // Le sondage et les guides liés, `closesAt` calculé à l'envoi : voir `useSondageGuides`.
      ...pieces.piece(),
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
  }, [envoi, images, pieces, router, texte, type]);

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
      pieces.sondage === null
        ? null
        : {
            question: pieces.sondage.question,
            options: pieces.sondage.options,
            /** La ligne de réglages dit ce que le sondage FERA — la même qu'au fil. */
            meta: pieces.sondageMeta,
            onModifier: () => {
              setFenetre('A01S');
            },
            onRetirer: pieces.retirerSondage,
          },
    composeurGuides: pieces.guidesLies.map((id) => ({
      titre: pieces.titreGuide(id),
      retirer: `Retirer ${pieces.titreGuide(id)}`,
      onRetirer: () => {
        pieces.retirerGuide(id);
      },
    })),
    composeurSondageCompte: pieces.sondage === null ? '0' : '1',
    composeurGuidesCompte: String(pieces.guidesLies.length),
  };

  return {
    donnees,
    fenetreSondage: pieces.sondageFenetre,
    fenetreGuides: pieces.guidesFenetre,
    fenetre,
    setFenetre,
  };
}
