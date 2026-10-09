'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { notifyError, notifySuccess } from '@/components/notifications';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreEcrire } from '@/components/fenetre-ecrire';
import { ApiError, memberApi } from '@/lib/api/index';
import {
  CONNECTION_MESSAGE_MIN,
  conversationSchema,
  conversationsResponseSchema,
} from '@app/shared';
import { z } from 'zod';
import type { K02Data, MotifDemande } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX GESTES DU PROFIL PUBLIC                                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Sur le profil, le bouton écrire et ajouter ne marche pas. Le
 * bouton ajouter affiche un modal qui ne marche pas. Aussi ces deux boutons
 * sont-ils sur l'interface desktop ? »
 *
 * OUI, les deux sont dessinés sur les deux planches — mesuré. Et aucun des deux
 * ne faisait quoi que ce soit : zéro `onClick` dans les trois cadres de K02.
 *
 * ── ÉCRIRE : ON CHERCHE AVANT D'OUVRIR ────────────────────────────────────
 *
 * `POST /conversations/direct` exige un `firstMessage`, et la route est « unique
 * par paire ». Si une conversation existe déjà, lui en renvoyer un premier
 * message enverrait un message de plus pour rien : on regarde donc d'abord dans
 * `GET /conversations`, et on y va directement le cas échéant. La fenêtre ne
 * s'ouvre que quand il n'y a vraiment rien.
 *
 * ── AJOUTER : LE MESSAGE EST OBLIGATOIRE, LA PLANCHE DIT LE CONTRAIRE ─────
 *
 * `createConnectionRequestSchema` exige `message`. La planche écrit « Message
 * (facultatif) ». On ne réécrit pas la maquette : le bouton reste éteint tant
 * que le message est trop court, ce qui dit la même chose sans mentir, et
 * l'étiquette est remontée au porteur.
 *
 * Les erreurs métier ont leurs phrases dans `CONNECTION_ERROR_MESSAGES` —
 * « Ce membre fait déjà partie de vos contacts », « Une demande est déjà en
 * attente » — et `ApiError.displayMessage` les sert. On ne les recopie pas ici.
 */
const MOTIFS_DESSINES = ['Entraide', 'Parrainage', 'Rencontre', 'Réseau'] as const;

export function ProfilContactVivant({
  donnees,
  pseudo,
  onFermerAjout,
  children,
}: {
  readonly donnees: K02Data;
  readonly pseudo: string;
  readonly onFermerAjout: () => void;
  readonly children: (enrichies: K02Data) => ReactNode;
}) {
  const router = useRouter();
  const [motif, setMotif] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [ecrire, setEcrire] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  /**
   * LE PSEUDO PORTE L'AROBASE DANS L'URL (`/@fatou`), jamais dans la charge :
   * `handleSchema` refuse le `@`. L'oubli a déjà coûté un 400 sur l'ajout de
   * numéro, et une page blanche sur « Voir le profil ».
   */
  const handle = pseudo.startsWith('@') ? pseudo.slice(1) : pseudo;

  const onEcrire = useCallback(() => {
    setEnVol(true);
    memberApi
      .get('/conversations?limit=50', conversationsResponseSchema)
      .then((page) => {
        const existante = page.items.find((c) =>
          c.members.some((m) => m.handle === handle),
        );
        if (existante === undefined) {
          setEcrire(true);
          return;
        }
        router.push(`/messages/${existante.id}`);
      })
      .catch((cause: unknown) => {
        /**
         * UNE LISTE ILLISIBLE N'EMPÊCHE PAS D'ÉCRIRE : on ouvre la fenêtre.
         * Le pire cas est un message de plus dans un fil existant — très loin
         * devant un bouton qui ne répond pas.
         */
        void cause;
        setEcrire(true);
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [handle, router]);

  const onEnvoyerPremier = useCallback(
    (message: string) => {
      setEnVol(true);
      memberApi
        .post('/conversations/direct', conversationSchema, {
          body: { toHandle: handle, firstMessage: message },
        })
        .then((conversation) => {
          setEcrire(false);
          router.push(`/messages/${conversation.id}`);
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [handle, router],
  );

  const onEnvoyerDemande = useCallback(() => {
    setEnVol(true);
    memberApi
      .post('/connection-requests', z.unknown(), {
        body: { toHandle: handle, message: texte.trim() },
      })
      .then(() => {
        notifySuccess(`Votre demande est partie à ${donnees.membre.prenom}.`);
        setTexte('');
        setMotif(null);
        onFermerAjout();
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'La demande n’a pas pu partir.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [donnees.membre.prenom, handle, onFermerAjout, texte]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ RECOMMANDER — ET ON NE PEUT PAS LE DÉFAIRE                              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « les boutons écrire, recommander et autres marchent ? » Celui-ci
   * n'avait aucun geste. `POST /recommendations/members` existe depuis le début
   * (`jobs.controller.ts`), et le profil en lit déjà le pendant — « Recommandé·e
   * par N membres ».
   *
   * ⚠ AUCUNE ROUTE NE RETIRE UNE RECOMMANDATION. Elle passe donc par une
   * confirmation, comme la suppression d'une publication et le blocage : c'est la
   * règle que ce dépôt s'est donnée pour tout geste irréversible. REMONTÉ : il
   * manque un `DELETE`.
   */
  const onRecommander = useCallback(() => {
    setConfirmation(true);
  }, []);

  const envoyerRecommandation = useCallback(() => {
    setEnVol(true);
    memberApi
      .post('/recommendations/members', z.unknown(), { body: { toHandle: handle } })
      .then(() => {
        notifySuccess(`Vous avez recommandé ${donnees.membre.prenom}.`);
        setConfirmation(false);
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'La recommandation n’a pas abouti.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [donnees.membre.prenom, handle]);

  const motifs: readonly MotifDemande[] = MOTIFS_DESSINES.map((libelle) => {
    const actif = motif === libelle;
    return {
      cle: libelle,
      libelle,
      fond: actif ? '#16785E' : '#fff',
      texte: actif ? '#fff' : '#16211D',
      bord: actif ? '#16785E' : '#E6EBE9',
      actif,
      onChoisir: () => {
        setMotif((courant) => (courant === libelle ? null : libelle));
      },
    };
  });

  const enrichies: K02Data = {
    ...donnees,
    onEcrire,
    motifs,
    demandeTexte: texte,
    onDemandeTexte: (event) => {
      setTexte(event.target.value);
    },
    onEnvoyerDemande,
    demandeBloque: enVol || texte.trim().length < CONNECTION_MESSAGE_MIN,
    onRecommander,
    recommandeBloque: enVol,
  };

  return (
    <>
      {children(enrichies)}
      <FenetreConfirmation
        ouverte={confirmation}
        titre={`Recommander ${donnees.membre.prenom} ?`}
        question={`Votre recommandation sera visible sur le profil de ${donnees.membre.prenom}, et les recruteurs la verront sur ses candidatures.`}
        precision="Aucune route ne permet encore de la retirer : une fois envoyée, elle reste."
        libelleConfirmer="Recommander"
        occupe={enVol}
        onConfirmer={envoyerRecommandation}
        onAnnuler={() => {
          setConfirmation(false);
        }}
        nom="RECOMMANDATION"
      />
      <FenetreEcrire
        ouverte={ecrire}
        prenom={donnees.membre.prenom}
        occupe={enVol}
        onEnvoyer={onEnvoyerPremier}
        onFermer={() => {
          setEcrire(false);
        }}
      />
    </>
  );
}
