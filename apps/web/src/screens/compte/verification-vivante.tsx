'use client';

import { useState, type ReactNode } from 'react';
import { FenetreNumero } from '@/components/fenetre-numero';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { z } from 'zod';
import type { K03Data } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES GESTES DE « VÉRIFICATION ET NIVEAUX »                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La page vérification est faite totalement ? Le bouton pour faire
 * la vérification d'identité est là ? Et l'ajout du numéro marche ? »
 *
 * MESURÉ : les deux boutons étaient des `<button>` SANS `onClick`.
 *
 * ── LE KYC PART CHEZ LE FOURNISSEUR, DANS UN AUTRE ONGLET ─────────────────
 *
 * `POST /me/kyc/session` rend `{ sessionId, verificationUrl, expiresAt }` :
 * l'adresse est celle de Didit, pas une page du dépôt. On l'ouvre dans un ONGLET
 * À PART plutôt que de quitter la page — le membre revient ici en fermant
 * l'onglet, et la vérification ne lui fait pas perdre ce qu'il faisait.
 *
 * `noopener` : une page tierce ouverte par `window.open` peut sinon manipuler
 * celle qui l'a ouverte par `window.opener`. C'est la règle pour tout lien
 * sortant, et elle vaut d'autant plus pour un fournisseur d'identité.
 *
 * ── LE LIBELLÉ DIT L'ÉTAT, ET LE BOUTON S'ÉTEINT QUAND IL N'Y A RIEN À FAIRE ─
 *
 * `me.kyc.status` est déjà dans `/me`. `APPROVED` → l'identité est vérifiée, il
 * n'y a plus rien à commencer. `IN_REVIEW` / `PENDING` → la démarche est en
 * cours, et relancer une session en ouvrirait une seconde. `DECLINED` → un
 * nouvel essai est possible, et le mot le dit.
 */
const LIBELLES: Record<string, { readonly mot: string; readonly actif: boolean }> = {
  APPROVED: { mot: 'Identité vérifiée', actif: false },
  PENDING: { mot: 'Reprendre la vérification', actif: true },
  IN_REVIEW: { mot: 'En cours de revue', actif: false },
  DECLINED: { mot: 'Réessayer la vérification', actif: true },
};

const sessionSchema = z
  .object({ sessionId: z.string(), verificationUrl: z.string(), expiresAt: z.string() })
  .strict();

export function VerificationVivante({
  donnees,
  statutKyc,
  detailKyc,
  onRecharger,
  children,
}: {
  readonly donnees: K03Data;
  /** `me.kyc.status`, ou `null` quand aucune démarche n'a jamais été ouverte. */
  readonly statutKyc: string | null;
  /** `GET /me/kyc` en entier : la carte « ÉTATS KYC » a besoin du détail. */
  readonly detailKyc: {
    readonly status: string;
    readonly retryAvailableAt: string | null;
    readonly isMinor: boolean;
  } | null;
  readonly onRecharger: () => void;
  readonly children: (enrichies: K03Data) => ReactNode;
}) {
  const [enVol, setEnVol] = useState(false);
  const [numeroOuvert, setNumeroOuvert] = useState(false);

  const etat = statutKyc === null ? null : (LIBELLES[statutKyc] ?? null);

  /**
   * ── UN SEUL PAVÉ ALLUMÉ, ET C'EST CELUI DU MEMBRE ───────────────────────
   *
   * `IN_PROGRESS` → « En cours », `IN_REVIEW` → « En revue », `DECLINED` →
   * « Refusée ». `isMinor` est indépendant du statut — §2.3 : « un mineur voit
   * son compte désactivé » — et il prime : c'est la seule de ces quatre lignes
   * qui ne se défait pas en recommençant.
   *
   * `NOT_STARTED`, `APPROVED`, `ABANDONED` et `EXPIRED` n'ont AUCUN pavé dans la
   * planche. Aucun n'est allumé, et c'est juste : la carte redevient ce qu'elle
   * est, une légende de ce qui peut arriver.
   */
  const mineur = detailKyc?.isMinor === true;
  const etatsKyc = {
    enCours: !mineur && detailKyc?.status === 'IN_PROGRESS',
    enRevue: !mineur && detailKyc?.status === 'IN_REVIEW',
    refusee: !mineur && detailKyc?.status === 'DECLINED',
    mineur,
    /**
     * « Nouvel essai possible dans 7 jours » EST UN EXEMPLE. `retryAvailableAt`
     * donne la vraie date ; sans elle, on garde la phrase de la planche plutôt
     * que d'écrire une date inventée.
     */
    /** `?? null` puis `===` : `eqeqeq` est `error` dans la lint du dépôt. */
    ...((detailKyc?.retryAvailableAt ?? null) === null
      ? {}
      : {
          refuseeSous: `Nouvel essai possible le ${new Intl.DateTimeFormat('fr-FR', {
            day: 'numeric',
            month: 'long',
          }).format(new Date(detailKyc?.retryAvailableAt ?? ''))}`,
        }),
  };

  const enrichies: K03Data = {
    ...donnees,
    etatsKyc,
    kycLibelle: etat?.mot ?? 'Commencer',
    /**
     * DEUX DRAPEAUX, et les confondre était un défaut mesuré : avec un seul, un
     * membre dont l'identité est déjà vérifiée ne pouvait plus ajouter de numéro.
     */
    verificationOccupe: enVol,
    kycBloque: enVol || etat?.actif === false,
    onVerifierIdentite: () => {
      if (enVol) return;
      setEnVol(true);
      memberApi
        .post('/me/kyc/session', sessionSchema, { body: {} })
        .then((r) => {
          notifySuccess('Vérification ouverte dans un nouvel onglet.');
          window.open(r.verificationUrl, '_blank', 'noopener,noreferrer');
          onRecharger();
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError
              ? cause.displayMessage
              : 'La vérification n’a pas pu être ouverte.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    onAjouterNumero: () => {
      setNumeroOuvert(true);
    },
  };

  return (
    <>
      <FenetreNumero
        ouverte={numeroOuvert}
        onFermer={() => {
          setNumeroOuvert(false);
        }}
        onAjoute={onRecharger}
      />
      {children(enrichies)}
    </>
  );
}
