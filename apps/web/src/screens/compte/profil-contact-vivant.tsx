'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { notifyError, notifySuccess } from '@/components/notifications';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreEcrire } from '@/components/fenetre-ecrire';
import { FenetreSignalement } from '@/components/fenetre-signalement';
/**
 * LES DEUX APPELS DE « ÉCRIRE » SONT PARTAGÉS AVEC L'ONGLET « MEMBRES » D'UN
 * RÉSEAU, et ils vivent donc dans `components/ecrire.ts`.
 *
 * Ils étaient écrits ici, et c'était juste tant que ce bouton n'existait qu'au
 * profil. Il est maintenant dessiné six fois de plus sur les quatre planches de
 * A08T, et le savoir qu'il porte est du CONTRAT — `firstMessage` obligatoire,
 * route unique par paire, pseudo sans arobase dans la charge. Recopié, il aurait
 * divergé, et le symptôme aurait été un 400 affiché comme une panne.
 */
import { conversationAvec, ouvrirConversation } from '@/components/ecrire';
import { ApiError, memberApi, voidResponse } from '@/lib/api/index';
import { CONNECTION_MESSAGE_MIN } from '@app/shared';
import { z } from 'zod';
import type { ContactProfilView, EntreeOptionProfil, K02Data, MotifDemande } from './data';

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
   * LA RELATION, TELLE QUE LE SERVEUR L'A DITE PUIS TELLE QUE MES GESTES L'ONT
   * CHANGÉE. Le profil n'est pas rechargé après une demande : on avance l'état
   * nous-même (« envoyée », « contact »), ce que la prochaine lecture confirmera.
   */
  const [relation, setRelation] = useState<ContactProfilView['etat'] | null>(null);
  const [aConfirmer, setAConfirmer] = useState<'bloquer' | 'retirer' | null>(null);
  const [signaler, setSignaler] = useState(false);

  /**
   * LE PSEUDO PORTE L'AROBASE DANS L'URL (`/@fatou`), jamais dans la charge :
   * `handleSchema` refuse le `@`. L'oubli a déjà coûté un 400 sur l'ajout de
   * numéro, et une page blanche sur « Voir le profil ».
   */
  const handle = pseudo.startsWith('@') ? pseudo.slice(1) : pseudo;

  const onEcrire = useCallback(() => {
    setEnVol(true);
    conversationAvec(handle)
      .then((existante) => {
        if (existante === null) {
          setEcrire(true);
          return;
        }
        router.push(`/messages/${existante}`);
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
      ouvrirConversation(handle, message)
        .then((conversationId) => {
          setEcrire(false);
          router.push(`/messages/${conversationId}`);
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
        setRelation('envoyee');
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

  /**
   * ── LE BOUTON « AJOUTER AUX CONTACTS », SELON LA RELATION ─────────────────
   *
   * `relation` vient de `GET /users/:handle` (champ ajouté pour ce bouton) ; un
   * profil anonyme ou ancien la rend `null`, et l'on retombe sur « aucune » — le
   * serveur refusera de toute façon un doublon (`REQUEST_PENDING`).
   */
  const etat: ContactProfilView['etat'] =
    relation ??
    (donnees.relation?.status === 'CONNECTED'
      ? 'contact'
      : donnees.relation?.status === 'REQUEST_SENT'
        ? 'envoyee'
        : donnees.relation?.status === 'REQUEST_RECEIVED'
          ? 'recue'
          : donnees.relation?.status === 'SELF'
            ? 'soi'
            : 'aucune');
  const demandeRecue = donnees.relation?.requestId ?? null;

  const accepter = useCallback(() => {
    if (demandeRecue === null) return;
    setEnVol(true);
    memberApi
      .post(`/connection-requests/${encodeURIComponent(demandeRecue)}/accept`, z.unknown(), {
        body: {},
      })
      .then(() => {
        notifySuccess(`${donnees.membre.prenom} fait maintenant partie de vos contacts.`);
        setRelation('contact');
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'La demande n’a pas pu être acceptée.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [demandeRecue, donnees.membre.prenom]);

  const LIBELLES: Record<ContactProfilView['etat'], readonly [string, string]> = {
    aucune: ['Ajouter aux contacts', 'Ajouter'],
    envoyee: ['Demande envoyée', 'Envoyée'],
    recue: ['Accepter la demande', 'Accepter'],
    contact: ['Dans vos contacts', 'Contact'],
    soi: ['Votre profil', 'Vous'],
  };
  const contact: ContactProfilView = {
    etat,
    libelle: LIBELLES[etat][0],
    libelleCourt: LIBELLES[etat][1],
    inactif: enVol || etat === 'envoyee' || etat === 'contact' || etat === 'soi',
    onAction: etat === 'recue' ? accepter : () => undefined,
  };

  /**
   * ── LE MENU « ··· » ────────────────────────────────────────────────────────
   *
   * Le porteur : « le bouton d'option fait quoi ? » Rien : un `<button>` sans
   * geste. Il porte maintenant ce qu'un profil d'un autre membre appelle :
   *
   *   · « Retirer des contacts » — si nous le sommes (`DELETE /me/connections/:id`) ;
   *   · « Signaler » — `POST /reports`, genre `USER`, la fenêtre partagée ;
   *   · « Bloquer » — `POST /blocks`, après confirmation : le profil devient
   *     introuvable pour les deux (08 §4.4), donc on quitte la page.
   *
   * Sur mon propre profil, le menu est vide et `MenuRond` rend le rond inerte.
   */
  const userId = donnees.membre.userId;
  const options: readonly EntreeOptionProfil[] =
    etat === 'soi'
      ? []
      : [
          ...(etat === 'contact' && userId !== null
            ? [{ label: 'Retirer des contacts', onClick: () => setAConfirmer('retirer') }]
            : []),
          ...(userId === null
            ? []
            : [{ label: `Signaler ${donnees.membre.prenom}`, onClick: () => setSignaler(true) }]),
          { label: `Bloquer ${donnees.membre.prenom}`, onClick: () => setAConfirmer('bloquer') },
        ];
  /** À 390 px, « Recommander » n'est pas dessiné : il rejoint le menu, en tête. */
  const optionsMobile: readonly EntreeOptionProfil[] =
    etat === 'soi'
      ? []
      : [
          { label: `Recommander ${donnees.membre.prenom}`, onClick: () => setConfirmation(true) },
          ...options,
        ];

  const confirmerOption = useCallback(() => {
    const quoi = aConfirmer;
    if (quoi === null) return;
    setEnVol(true);
    const appel =
      quoi === 'bloquer'
        ? memberApi.post('/blocks', z.unknown(), { body: { handle } })
        : memberApi.del(`/me/connections/${encodeURIComponent(userId ?? '')}`, voidResponse);
    appel
      .then(() => {
        setAConfirmer(null);
        if (quoi === 'bloquer') {
          notifySuccess(`${donnees.membre.prenom} est bloqué·e. Vous ne vous verrez plus.`);
          router.push('/accueil');
          return;
        }
        notifySuccess(`${donnees.membre.prenom} ne fait plus partie de vos contacts.`);
        setRelation('aucune');
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof ApiError ? cause.displayMessage : 'L’action n’a pas abouti.');
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [aConfirmer, donnees.membre.prenom, handle, router, userId]);

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
    contact,
    options,
    optionsMobile,
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
      <FenetreConfirmation
        ouverte={aConfirmer !== null}
        titre={
          aConfirmer === 'bloquer'
            ? `Bloquer ${donnees.membre.prenom} ?`
            : `Retirer ${donnees.membre.prenom} de vos contacts ?`
        }
        question={
          aConfirmer === 'bloquer'
            ? `Vous ne verrez plus ${donnees.membre.prenom}, et ${donnees.membre.prenom} ne vous verra plus : ni profil, ni messages, ni publications.`
            : `${donnees.membre.prenom} ne sera pas prévenu·e. Vous pourrez lui renvoyer une demande plus tard.`
        }
        precision={
          aConfirmer === 'bloquer' ? 'Vous pourrez le débloquer depuis Compte › Contacts.' : ''
        }
        libelleConfirmer={aConfirmer === 'bloquer' ? 'Bloquer' : 'Retirer'}
        occupe={enVol}
        onConfirmer={confirmerOption}
        onAnnuler={() => {
          setAConfirmer(null);
        }}
        nom="PROFIL-OPTION"
      />
      <FenetreSignalement
        sujet={signaler && userId !== null ? { type: 'USER', id: userId } : null}
        onFermer={() => {
          setSignaler(false);
        }}
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
