'use client';

import { useCallback, useMemo, useState } from 'react';
import { FEED_LIMITS, PostType as POST_TYPES } from '@app/shared';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError } from '@/lib/api/index';
import { createPost, uploadPostImage } from '../accueil/api';
import { postTypesFor } from '../a01/data';
import type { ComposeurReseauView } from '../a08t/vivant';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE COMPOSEUR DU FIL D'UN RÉSEAU                                             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Voir `ComposeurReseauView`. Les APPELS sont ceux du composeur de l'accueil —
 * `createPost` et `uploadPostImage`, de `screens/accueil/api.ts` — et les
 * PASTILLES sont `postTypesFor`, la palette par type de la planche A01 : le
 * composeur du réseau et celui de l'accueil ne peuvent pas diverger sur ce
 * qu'est une « Victoire ».
 *
 * La seule différence est `communityId` : la publication est celle DU RÉSEAU
 * (§2.3), visible de ses membres seuls, et le serveur y applique les deux
 * paramètres de « Gérer » qui la concernent — la validation des nouvelles
 * publications, les sondages réservés à l'équipe.
 *
 * ⚠ AUCUN CONTRÔLE DE NIVEAU : `post.create` est en N1 et le front PRÉVIENT
 * sans autoriser (mémo §5). On tente, le serveur refuse, et son message
 * s'affiche.
 */
export function useComposeurReseau(
  communityId: string | null,
  onPublie: () => void,
): ComposeurReseauView {
  const [texte, setTexte] = useState('');
  const [type, setType] = useState(0);
  const [images, setImages] = useState<readonly { readonly id: string }[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [enAttente, setEnAttente] = useState(false);

  const onTexte = useCallback((event: { readonly target: { readonly value: string } }) => {
    setTexte(event.target.value);
  }, []);

  /**
   * Le choisisseur est créé à la volée, comme sur l'accueil : un `<input
   * type="file">` caché dans le cadre demanderait un `ref`, c'est-à-dire du DOM
   * dans un contrat de dessin.
   */
  const onAjouterImage = useCallback(() => {
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
              courant.length >= FEED_LIMITS.postMediaMax ? courant : [...courant, { id: media.id }],
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

  const onIndisponible = useCallback(() => {
    notifyError(
      'Le sondage et le guide lié se joignent depuis le fil d’accueil pour le moment ; dans un réseau, publiez le texte et les images.',
    );
  }, []);

  const corps = texte.trim();
  const bloque = corps === '' || envoi || communityId === null;

  const onPublier = useCallback(() => {
    if (bloque || communityId === null) return;
    setEnvoi(true);
    void createPost({
      type: POST_TYPES[type] ?? 'DISCUSSION',
      body: corps,
      communityId,
      ...(images.length === 0 ? {} : { mediaIds: images.map((im) => im.id) }),
    })
      .then((publiee) => {
        setTexte('');
        setImages([]);
        const attend = publiee.post.awaitingApproval;
        setEnAttente(attend);
        notifySuccess(
          attend
            ? 'Publication envoyée : elle paraîtra dans le fil dès qu’un modérateur l’aura validée.'
            : 'Publication envoyée.',
        );
        onPublie();
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'La publication n’a pas pu être envoyée.',
        );
      })
      .finally(() => {
        setEnvoi(false);
      });
  }, [bloque, communityId, corps, images, onPublie, type]);

  const types = useMemo(() => postTypesFor(type, setType), [type]);

  return {
    texte,
    onTexte,
    types,
    onAjouterImage,
    images:
      images.length === 0 ? '' : images.length === 1 ? '1 image' : `${String(images.length)} images`,
    onIndisponible,
    bloque,
    onPublier,
    enAttente,
  };
}
