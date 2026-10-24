'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { TEXTES_DELAIS } from '@/lib/textes-delais';
import { z } from 'zod';
import type { K08Data } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ MES DONNÉES — PRÉPARER L'ARCHIVE, PUIS PRÉVENIR                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « lancement de téléchargement de données. Pour le téléchargement
 * on prépare et dès que prêt on l'informe pour qu'il vienne télécharger. »
 *
 * MESURÉ : trois `<button>` sans geste. `POST /me/export` répond `202` — la
 * génération est ASYNCHRONE, le code le dit — et `GET /me/export/latest` rend
 * l'état et le lien.
 *
 * ── ON INTERROGE, ON NE DEVINE PAS ────────────────────────────────────────
 *
 * Tant qu'une archive est en préparation, l'écran redemande son état toutes les
 * dix secondes et s'arrête dès qu'elle est prête. Dix secondes, et non une : la
 * génération prend des minutes, pas des millisecondes, et un sondage serré
 * remplirait le journal du serveur pour rien.
 *
 * LE SONDAGE S'ARRÊTE AVEC L'ÉCRAN. Sans le nettoyage, il continuerait après que
 * le membre a quitté la page, et chaque visite en ajouterait un.
 *
 * ── DÉSACTIVER SE CONFIRME, ET DIT CE QUI SE PASSE ────────────────────────
 *
 * `POST /me/deactivate` coupe l'accès : le profil disparaît des recherches et les
 * sessions tombent. C'est réversible — une reconnexion suffit — et la
 * confirmation le dit, parce que c'est ce qui distingue « désactiver » de
 * « supprimer ».
 */
const etatSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    requestedAt: z.string(),
    readyAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    downloadUrl: z.string().nullable(),
  })
  .nullable();

/** Ce que l'écran écrit à la place de la promesse « Préparé sous 48 h ». */
function phraseDe(etat: z.infer<typeof etatSchema>): string {
  // Les délais viennent de `lib/textes-delais.ts` (donc de `ACCOUNT_LIMITS`), pas de la maquette.
  if (etat === null) return TEXTES_DELAIS.exportAucune;
  if (etat.downloadUrl !== null) return TEXTES_DELAIS.exportPrete;
  if (etat.status === 'READY') return 'Votre archive a expiré. Demandez-en une nouvelle.';
  return 'Archive en préparation. Nous vous préviendrons dès qu’elle sera prête.';
}

export function DonneesVivantes({
  donnees,
  children,
}: {
  readonly donnees: K08Data;
  readonly children: (enrichies: K08Data) => ReactNode;
}) {
  const routeur = useRouter();
  const [enVol, setEnVol] = useState(false);
  const [etat, setEtat] = useState<z.infer<typeof etatSchema>>(null);
  const [desactivation, setDesactivation] = useState(false);

  const relire = useCallback(async () => {
    try {
      setEtat(await memberApi.get('/me/export/latest', etatSchema));
    } catch {
      /**
       * UNE LECTURE D'ÉTAT QUI ÉCHOUE NE CRIE PAS. La page reste utilisable et
       * la phrase garde sa valeur précédente ; un bandeau rouge toutes les dix
       * secondes sur une coupure réseau serait pire que le silence.
       */
    }
  }, []);

  useEffect(() => {
    void relire();
  }, [relire]);

  const enPreparation = etat !== null && etat.downloadUrl === null && etat.status !== 'READY';
  useEffect(() => {
    if (!enPreparation) return undefined;
    const minuteur = window.setInterval(() => {
      void relire();
    }, 10_000);
    return () => {
      window.clearInterval(minuteur);
    };
  }, [enPreparation, relire]);

  const enrichies: K08Data = {
    ...donnees,
    exportEtat: phraseDe(etat),
    exportLien: etat?.downloadUrl ?? null,
    donneesOccupe: enVol,
    onDemanderExport: () => {
      if (enVol) return;
      setEnVol(true);
      memberApi
        .post('/me/export', z.unknown(), { body: {} })
        .then(() => {
          notifySuccess('Archive demandée. Nous vous préviendrons dès qu’elle sera prête.');
          return relire();
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError
              ? cause.displayMessage
              : 'L’archive n’a pas pu être demandée.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    onDesactiver: () => {
      setDesactivation(true);
    },
  };

  return (
    <>
      <FenetreConfirmation
        ouverte={desactivation}
        nom="DESACTIVATION"
        titre="Désactiver mon compte ?"
        question="Votre profil disparaît des recherches et du fil, et toutes vos sessions se ferment."
        /**
         * CE QUI DISTINGUE « DÉSACTIVER » DE « SUPPRIMER », et c'est la seule
         * chose que le membre a besoin de savoir pour choisir.
         */
        precision="Rien n’est effacé : vous reconnecter réactive le compte."
        libelleConfirmer="Désactiver"
        occupe={enVol}
        onConfirmer={() => {
          setDesactivation(false);
          setEnVol(true);
          memberApi
            .post('/me/deactivate', z.unknown(), { body: {} })
            .then(() => {
              notifySuccess('Compte désactivé. Reconnectez-vous pour le réactiver.');
              /** Les sessions sont tombées : rester sur une page de compte n'a plus de sens. */
              routeur.push('/');
            })
            .catch((cause: unknown) => {
              notifyError(
                cause instanceof ApiError
                  ? cause.displayMessage
                  : 'Le compte n’a pas pu être désactivé.',
              );
            })
            .finally(() => {
              setEnVol(false);
            });
        }}
        onAnnuler={() => {
          setDesactivation(false);
        }}
      />
      {children(enrichies)}
    </>
  );
}
