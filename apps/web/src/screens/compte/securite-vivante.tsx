'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreNumero } from '@/components/fenetre-numero';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { z } from 'zod';
import type { K04Data } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES GESTES DE « TÉLÉPHONES ET SESSIONS »                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Niveau page sécurité, l'ajout de numéro marche et la révocation
 * de SESSIONS ? »
 *
 * MESURÉ : ni l'un ni l'autre. Les quatre contrôles étaient dessinés — « +
 * Ajouter », « Retirer », « Révoquer », et « Révoquer toutes les autres » qui
 * était même un `<a href="#">`. Le chargeur lisait pourtant déjà les vraies
 * données (`me.phones`, `GET /auth/sessions`) et les quatre routes existaient.
 *
 * ── DEUX GESTES DEMANDENT CONFIRMATION, DEUX NON ──────────────────────────
 *
 * RETIRER UN NUMÉRO et RÉVOQUER TOUTES LES AUTRES SESSIONS se confirment : le
 * premier peut couper la seule façon de se reconnecter, le second déconnecte
 * tous les autres appareils du membre. Révoquer UNE session nommée ne se
 * confirme pas — on l'a désignée, et elle se refait d'une reconnexion.
 *
 * ── LES IDENTIFIANTS MANQUAIENT, ET IL A FALLU LES FAIRE DESCENDRE ────────
 *
 * `K04Data` ne portait que des libellés : « masque », « appareil », « vu ». On ne
 * peut pas appeler `DELETE /me/phones/:id` avec un masque. Le chargeur pose donc
 * maintenant le geste SUR LA LIGNE — c'est lui qui a l'identifiant sous la main,
 * et c'est la forme qu'emploie déjà le fil pour ses publications.
 */
export function SecuriteVivante({
  donnees,
  onRecharger,
  children,
}: {
  readonly donnees: K04Data;
  readonly onRecharger: () => void;
  readonly children: (enrichies: K04Data) => ReactNode;
}) {
  const [enVol, setEnVol] = useState(false);
  const [numeroOuvert, setNumeroOuvert] = useState(false);
  const [toutDemande, setToutDemande] = useState(false);

  const appeler = useCallback(
    (promesse: Promise<unknown>, reussite: string, echec: string) => {
      setEnVol(true);
      promesse
        .then(() => {
          notifySuccess(reussite);
          onRecharger();
        })
        .catch((cause: unknown) => {
          notifyError(cause instanceof ApiError ? cause.displayMessage : echec);
          // La liste a pu changer sous nos pieds (un autre onglet a déjà retiré un
          // numéro : `LAST_PHONE`) : on la relit, pour que l'écran dise la vérité.
          onRecharger();
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [onRecharger],
  );

  const [retrait, setRetrait] = useState<{ id: string; masque: string } | null>(null);

  const enrichies: K04Data = {
    ...donnees,
    /**
     * LES GESTES SONT POSÉS SUR CHAQUE LIGNE, parce que le cadre dessine un
     * bouton par numéro et un par session. Une prise unique ne saurait pas
     * lequel, et l'identifiant ne vit que sur la ligne.
     */
    telephones: donnees.telephones.map((t) => ({
      ...t,
      ...(t.id === undefined
        ? {}
        : {
            onRetirer: () => {
              setRetrait({ id: t.id as string, masque: t.masque });
            },
          }),
    })),
    sessions: donnees.sessions.map((s) => ({
      ...s,
      ...(s.id === undefined
        ? {}
        : {
            onRevoquer: () => {
              appeler(
                memberApi.del(`/auth/sessions/${s.id ?? ''}`, z.unknown()),
                `${s.appareil} a été déconnecté.`,
                'La session n’a pas pu être révoquée.',
              );
            },
          }),
    })),
    securiteOccupe: enVol,
    onAjouterNumero: () => {
      setNumeroOuvert(true);
    },
    onRevoquerTout: () => {
      setToutDemande(true);
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
      <FenetreConfirmation
        ouverte={toutDemande}
        nom="SESSIONS"
        titre="Révoquer les autres sessions ?"
        question="Tous vos autres appareils seront déconnectés. Celui-ci reste connecté."
        /**
         * CE QU'ON NE POURRA PAS DÉFAIRE, et rien d'autre : il faudra se
         * reconnecter par SMS sur chacun, ce qui n'est pas rien quand on a perdu
         * l'accès au numéro.
         */
        precision="Chaque appareil devra se reconnecter par un code SMS."
        libelleConfirmer="Révoquer"
        occupe={enVol}
        onConfirmer={() => {
          setToutDemande(false);
          appeler(
            memberApi.del('/auth/sessions', z.unknown()),
            'Les autres sessions ont été révoquées.',
            'Les sessions n’ont pas pu être révoquées.',
          );
        }}
        onAnnuler={() => {
          setToutDemande(false);
        }}
      />
      <FenetreConfirmation
        ouverte={retrait !== null}
        nom="NUMERO_RETRAIT"
        titre="Retirer ce numéro ?"
        question={`Le numéro ${retrait?.masque ?? ''} ne recevra plus de code de connexion ni de SMS.`}
        /**
         * §2.5 : le serveur refuse le DERNIER numéro (`LAST_PHONE`). Le bouton est
         * déjà éteint dans ce cas ; la précision dit pourquoi le retrait compte.
         */
        precision="Vous ne pourrez plus vous connecter avec ce numéro."
        libelleConfirmer="Retirer"
        occupe={enVol}
        onConfirmer={() => {
          const cible = retrait;
          setRetrait(null);
          if (cible === null) return;
          appeler(
            memberApi.del(`/me/phones/${cible.id}`, z.unknown()),
            'Numéro retiré.',
            'Le numéro n’a pas pu être retiré.',
          );
        }}
        onAnnuler={() => {
          setRetrait(null);
        }}
      />
      {children(enrichies)}
    </>
  );
}
