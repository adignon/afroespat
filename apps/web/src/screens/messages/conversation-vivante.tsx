'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api/index';
import { notifyError, notifySuccess as notifySucces } from '@/components/notifications';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import {
  bloquerMembre,
  deposerImageDeMessage,
  envoyerMessage,
  mettreEnSourdine,
  signaler,
  type BulleAvecStory,
} from './appels';
import type { MenuConversation, SignalementVue } from './data';
import type { M01Data } from '../m01/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES GESTES DE LA CONVERSATION — ENVOI, IMAGE, ÉMOJIS, RETOUR À LA STORY   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'envoi de message aussi ne marche pas ainsi que les images dans
 * une conversation. Ajoute aussi les emojis » — et, sur la vignette : « Il faut
 * qu'on puisse cliquer sur ça et aller vers la story si toujours en ligne. Sinon
 * ça affirme que la story a expiré. »
 *
 * ── POURQUOI UN COMPOSANT ENTRE `EcranDonnees` ET LES CADRES ─────────────
 *
 * Le chargeur (`chargerM01`) est une fonction PURE, appelée depuis des épreuves
 * qui n'ont ni routeur ni annonces. Les cadres, eux, ne portent que du dessin.
 * Les gestes ont besoin des deux : d'un état qui survit aux rechargements, et du
 * routeur. Ils vivent donc ici, dans la seule couche qui a les deux.
 *
 * ── CE QUI SE PASSE APRÈS UN ENVOI ───────────────────────────────────────
 *
 * On RECHARGE la conversation plutôt que d'ajouter la bulle à la main. Une bulle
 * fabriquée côté client n'aurait ni l'heure du serveur, ni le `kind` déduit, ni
 * l'adresse résolue du média — trois choses que l'écran affiche. Mesuré sur le
 * fil : une insertion optimiste finit toujours par diverger de ce que la page
 * suivante renvoie.
 *
 * ── L'IMAGE EST MISE EN ATTENTE, PAS ENVOYÉE SEULE ───────────────────────
 *
 * ⚠ ARBITRAGE À REMONTER : `sendMessageSchema.body` exige AU MOINS UN CARACTÈRE
 * (`MESSAGE_BODY_MIN = 1`, et le résumé de la route dit « 1 à 4 000 caractères,
 * image facultative »). Une image seule serait donc refusée par un `400`, et
 * l'écran afficherait une erreur de validation là où le membre a simplement
 * choisi une photo.
 *
 * On met donc l'image EN ATTENTE au-dessus du champ — elle part avec le mot que
 * le membre écrit. Un émoji suffit, et le clavier est juste à côté. Si le porteur
 * veut l'image seule à la façon de Messenger, c'est la borne du serveur qu'il faut
 * desserrer, et c'est sa décision, pas la mienne.
 */
/**
 * QUATRE IMAGES AU PLUS, comme le composeur du fil (« + N / 4 »). La borne n'est
 * pas celle du serveur — il accepte une image par message, et chaque image part
 * dans son propre message — mais celle de l'écran : au-delà, les vignettes
 * débordent de la boîte de saisie sur la planche de 390 px.
 */
const IMAGES_MAX = 4;

/** Une image déposée, en attente de partir. `url` est l'aperçu local (`blob:`). */
interface Jointe {
  readonly id: string;
  readonly nom: string;
  readonly url: string;
}

export function ConversationVivante({
  donnees,
  conversationId,
  onRecharger,
  children,
}: {
  readonly donnees: M01Data;
  /** Celle que l'URL demande — `null` sur `/messages`, qui n'en nomme aucune. */
  readonly conversationId: string | null;
  readonly onRecharger: () => void;
  /**
   * Le second argument porte les gestes du MENU de conversation. Ils ne peuvent
   * pas voyager dans `M01Data` : le menu n'est pas rendu par le cadre mais par
   * `Modal`, à côté de lui.
   */
  readonly children: (
    enrichies: M01Data,
    menu: MenuConversation,
    signalement: SignalementVue,
  ) => ReactNode;
}) {
  const routeur = useRouter();
  /**
   * ── CELLE QUI EST OUVERTE, PAS CELLE QUE L'URL NOMME ─────────────────────
   *
   * MESURÉ : sur `/messages`, le cadre d'ordinateur montre les DEUX volets — la
   * liste et une conversation — mais l'URL n'en nomme aucune. On se fiait au
   * paramètre, donc à `null`, donc le composeur se bloquait lui-même : champ
   * grisé, émojis grisés, trombone grisé, flèche grise. Le porteur : « l'envoi de
   * message, la saisie, l'ajout d'image et d'emojis ne marche toujours pas ».
   *
   * Le CHARGEUR sait laquelle il a ouverte — celle de repli, la plus récente — et
   * il le dit maintenant. L'URL reste prioritaire quand elle en nomme une.
   */
  const cible = conversationId ?? donnees.conversationOuverte ?? null;
  const [texte, setTexte] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [images, setImages] = useState<readonly Jointe[]>([]);
  const [emojisOuverts, setEmojisOuverts] = useState(false);
  const [blocageDemande, setBlocageDemande] = useState(false);
  const [motif, setMotif] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const choisirFichier = useRef<HTMLInputElement>(null);

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ PLUSIEURS IMAGES = PLUSIEURS MESSAGES, COMME SUR MESSENGER                ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * `sendMessageSchema` ne porte QU'UNE image — `mediaId`, au singulier. Ce n'est
   * pas une limite à contourner : c'est la forme de la messagerie, et c'est aussi
   * celle de Messenger, où chaque photo est sa propre bulle. On envoie donc un
   * message par image.
   *
   * LE TEXTE VA SUR LE PREMIER, et sur lui seul : le répéter sur chaque photo
   * écrirait la même phrase quatre fois dans le fil.
   *
   * EN SÉRIE ET NON EN PARALLÈLE. `Promise.all` partirait plus vite et poserait
   * les bulles DANS LE DÉSORDRE : l'ordre du fil est celui des identifiants, que
   * le serveur attribue à la réception. Quatre photos envoyées ensemble
   * arriveraient mélangées, et c'est le genre de défaut qu'on ne voit qu'une fois
   * sur deux.
   *
   * ET ON S'ARRÊTE À LA PREMIÈRE ERREUR : continuer après un refus — quota,
   * conversation en attente — enverrait trois messages de plus pour les voir
   * refusés aussi, et le membre lirait quatre bandeaux rouges pour une seule
   * cause.
   */
  const envoyer = useCallback(() => {
    const corps = texte.trim();
    if (cible === null || enVol) return;
    if (corps === '' && images.length === 0) return;
    setEnVol(true);

    void (async () => {
      try {
        if (images.length === 0) {
          await envoyerMessage(cible, corps);
        } else {
          for (const [rang, jointe] of images.entries()) {
            await envoyerMessage(cible, rang === 0 ? corps : '', jointe.id);
          }
        }
        setTexte('');
        images.forEach((j) => {
          URL.revokeObjectURL(j.url);
        });
        setImages([]);
        onRecharger();
      } catch (cause: unknown) {
        notifyError(
          cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.',
        );
      } finally {
        setEnVol(false);
      }
    })();
  }, [cible, texte, images, enVol, onRecharger]);

  /**
   * L'ÉMOJI S'INSÈRE AU CURSEUR, pas à la fin. Un membre qui corrige le début de
   * sa phrase et choisit un émoji le verrait sinon atterrir après le dernier mot
   * — et devrait le déplacer à la main. `selectionStart` est posé par le
   * navigateur ; sans champ monté, on retombe sur la fin, qui est le cas courant.
   */
  const insererEmoji = useCallback(
    (emoji: string) => {
      /**
       * LE CHAMP EST RETROUVÉ PAR SON REPÈRE, et non par une `ref`.
       *
       * Il est ÉMIS PAR LE TRANSCODEUR, à l'intérieur du cadre : ce composant ne
       * peut pas lui en poser une. `data-conversation-champ` est posé par la même
       * transformation que le champ lui-même, donc les deux ne peuvent pas
       * diverger. Par repère et jamais par une classe — la maquette n'en a aucune.
       *
       * Le cadre VISIBLE seulement : les deux planches sont montées en même temps
       * et seule l'une des deux est affichée. Insérer dans celle qui est cachée
       * écrirait dans un champ que personne ne voit.
       */
      const n = [...document.querySelectorAll<HTMLInputElement>('[data-conversation-champ]')].find(
        (e) => e.offsetParent !== null,
      );
      const debut = n?.selectionStart ?? texte.length;
      const fin = n?.selectionEnd ?? texte.length;
      setTexte(`${texte.slice(0, debut)}${emoji}${texte.slice(fin)}`);
      if (n !== undefined) {
        /** Le curseur se replace APRÈS le rendu, sinon React le remet à la fin. */
        window.setTimeout(() => {
          n.focus();
          n.setSelectionRange(debut + emoji.length, debut + emoji.length);
        }, 0);
      }
    },
    [texte],
  );

  const bulles = donnees.messages.map((m) => {
    const avec = m as BulleAvecStory;
    if (avec.storyId === null || avec.storyId === undefined) return m;
    const id = avec.storyId;
    return {
      ...m,
      /**
       * UNE SEULE DESTINATION, DEUX RÉPONSES. « Encore en ligne » est calculé par
       * le SERVEUR (`storyAlive`) : une story vit vingt-quatre heures, et
       * l'horloge d'un navigateur peut être fausse de plusieurs heures. Expirée,
       * on le DIT plutôt que de mener à une page qui répondrait 404.
       */
      onImage: () => {
        if (avec.storyVivante) routeur.push(`/stories/${id}`);
        else notifyError('Cette story a expiré : elle n’est plus consultable.');
      },
      imageNom: avec.storyVivante ? 'Voir la story' : 'Story expirée',
    };
  });

  const enrichies: M01Data = {
    ...donnees,
    messages: bulles,
    composeurTexte: texte,
    onComposeurTexte: (e) => {
      setTexte(e.target.value);
    },
    onComposeurTouche: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        envoyer();
      }
    },
    onEnvoyer: envoyer,
    /** Rien à envoyer : ni texte, ni image. L'un des deux suffit désormais. */
    envoiBloque: enVol || cible === null || (texte.trim() === '' && images.length === 0),
    composeurBloque: enVol || cible === null,
    onJoindreImage: () => {
      choisirFichier.current?.click();
    },
    onEmoji: insererEmoji,
    composeurImages: images.map((j) => ({
      /**
       * L'APERÇU EST LOCAL (`blob:`), et c'est voulu : l'image vient d'être
       * déposée, mais la servir depuis l'API demanderait un aller-retour de plus
       * pour une vignette que le navigateur a déjà en mémoire. `photoFondFor`
       * n'est pas employé — la recette « couvrir » tient en deux déclarations et
       * la vignette n'est pas un fond de carte.
       */
      fond: `url("${j.url}")`,
      nom: j.nom,
      apercu: true,
      retirer: `Retirer ${j.nom}`,
      onRetirer: () => {
        URL.revokeObjectURL(j.url);
        setImages((liste) => liste.filter((autre) => autre.id !== j.id));
      },
    })),
    composeurAjoutBloque: images.length >= IMAGES_MAX,
    emojisOuverts,
    onBasculerEmojis: () => {
      setEmojisOuverts((o) => !o);
    },
  };

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LES QUATRE ENTRÉES DU MENU                                                ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Les options voir le profil, mettre en sourdine, bloquer et
   * signaler ne marchent pas. Intègre tout ça. »
   *
   * Deux sont des NAVIGATIONS et vivent dans le cadre (le profil public,
   * `?feuille=signaler`). Les deux autres écrivent, et c'est ici.
   *
   * ── BLOQUER DEMANDE CONFIRMATION, ET PAS LA SOURDINE ─────────────────────
   *
   * Bloquer est IRRÉVERSIBLE DANS SES EFFETS : §4 dit que débloquer ne restaure
   * pas les contacts. Un clic malheureux dans un menu ne doit pas le déclencher.
   * La sourdine, elle, se défait d'un second clic — la confirmer serait du bruit.
   *
   * LA CONFIRMATION EST UNE FENÊTRE DESSINÉE, et plus `window.confirm`. Le
   * porteur : « pour les confirmations inspire-toi du design pour créer un modal
   * bien fait ». Son châssis vient de K08 · suppression de compte, la seule
   * confirmation que les maquettes dessinent — voir `FenetreConfirmation`.
   */
  const menu: MenuConversation = {
    profil: donnees.entete.profil ?? null,
    sourdine: donnees.conversationSourdine ?? false,
    menuOccupe: enVol,
    onSourdine: () => {
      if (cible === null || enVol) return;
      const voulu = !(donnees.conversationSourdine ?? false);
      setEnVol(true);
      mettreEnSourdine(cible, voulu)
        .then(() => {
          notifySucces(
            voulu
              ? 'Conversation en sourdine : vous ne recevrez plus ses notifications.'
              : 'Notifications réactivées pour cette conversation.',
          );
          onRecharger();
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'La sourdine n’a pas pu être posée.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    onBloquer: () => {
      if ((donnees.conversationHandle ?? null) === null || enVol) return;
      setBlocageDemande(true);
    },
  };

  const confirmerBlocage = (): void => {
      const handle = donnees.conversationHandle ?? null;
      if (handle === null || enVol) return;
      setEnVol(true);
      bloquerMembre(handle)
        .then(() => {
          notifySucces(`${donnees.entete.nom} est bloqué.`);
          /**
           * ON QUITTE LA CONVERSATION. Rester dessus après un blocage montrerait
           * un fil que le serveur masque déjà à moitié (§4) : la liste est le seul
           * endroit juste où atterrir.
           */
          routeur.push('/messages');
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'Le blocage n’a pas pu être posé.',
          );
        })
        .finally(() => {
          setEnVol(false);
          setBlocageDemande(false);
        });
  };

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA FEUILLE « SIGNALER »                                                   ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le modal n'est pas du tout dynamique (pas d'input, les choix
   * ne marchent pas ainsi que la soumission) ».
   *
   * APRÈS L'ENVOI, ON POUSSE `?feuille=merci` plutôt que de fermer : la maquette
   * dessine une confirmation (X03M), et la page la monte sur ce paramètre. C'est
   * le chemin que l'écran connaît déjà, et c'est aussi ce qui remet la feuille de
   * signalement à zéro — la fenêtre change, l'état de son formulaire avec.
   */
  const signalement: SignalementVue = {
    motif,
    onMotif: (choix) => {
      setMotif(choix);
    },
    details,
    onDetails: (e) => {
      setDetails(e.target.value);
    },
    envoiBloque: motif === null || enVol || (donnees.conversationUserId ?? null) === null,
    onEnvoyer: () => {
      const sujet = donnees.conversationUserId ?? null;
      if (motif === null || sujet === null || enVol) return;
      setEnVol(true);
      signaler('USER', sujet, motif, details)
        .then(() => {
          setMotif(null);
          setDetails('');
          routeur.push('?feuille=merci');
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError
              ? cause.displayMessage
              : 'Le signalement n’a pas pu être envoyé.',
          );
        })
        .finally(() => {
          setEnVol(false);
        });
    },
  };

  return (
    <>
      {/*
       * LE SÉLECTEUR DE FICHIER EST CACHÉ, et c'est la recette du dépôt : la
       * maquette dessine un trombone rond, jamais le contrôle gris du navigateur.
       * `accept` borne au genre que `POST /media` accepte pour un message.
       */}
      <input
        ref={choisirFichier}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        /**
         * `multiple`, PARCE QUE LE PORTEUR L'A DEMANDÉ : « il faut permettre
         * plusieurs images ». Le sélecteur en rendait UNE, et le code n'en lisait
         * qu'une (`files?.[0]`).
         */
        multiple
        data-conversation-fichier=""
        style={{ display: 'none' }}
        onChange={(e) => {
          const choisis = [...(e.target.files ?? [])];
          e.target.value = '';
          if (choisis.length === 0) return;

          /**
           * ON ÉCARTE LE SURPLUS EN LE DISANT. Prendre les quatre premiers en
           * silence laisserait le membre croire que ses huit photos sont parties.
           */
          const place = IMAGES_MAX - images.length;
          const retenus = choisis.slice(0, Math.max(place, 0));
          if (retenus.length < choisis.length) {
            notifyError(`Quatre images au plus par envoi : ${choisis.length - retenus.length} écartée(s).`);
          }
          if (retenus.length === 0) return;

          setEnVol(true);
          void (async () => {
            try {
              /**
               * EN SÉRIE, comme l'envoi : `POST /media` est limité en cadence
               * (§5.3), et quatre dépôts simultanés prennent un `429` que le
               * membre lirait comme un refus de son image.
               */
              for (const fichier of retenus) {
                const depose = await deposerImageDeMessage(fichier);
                const url = URL.createObjectURL(fichier);
                setImages((liste) => [...liste, { id: depose.id, nom: fichier.name, url }]);
              }
            } catch (cause: unknown) {
              notifyError(
                cause instanceof ApiError
                  ? cause.displayMessage
                  : 'L’image n’a pas pu être déposée.',
              );
            } finally {
              setEnVol(false);
            }
          })();
        }}
      />

      {/*
       * LE BANDEAU D'ATTENTE A DISPARU, et c'est la demande du porteur : « tu le
       * mets dans l'input comme on a fait avec l'input de publication de la file
       * d'actualité ». Les vignettes vivent maintenant DANS la boîte de saisie,
       * posées par le transcodeur (`M01_COMPOSEUR`), avec leur croix de retrait —
       * exactement comme le composeur du fil. Un bandeau flottant en plus ferait
       * dire deux fois la même chose, et sur la planche de 390 px il recouvrait le
       * bouton d'envoi.
       */}
      <FenetreConfirmation
        ouverte={blocageDemande}
        nom="BLOCAGE"
        titre={`Bloquer ${donnees.entete.nom} ?`}
        question={`${donnees.entete.nom} ne pourra plus vous écrire, ni voir ce que vous publiez. Vous ne verrez plus ses contenus non plus.`}
        /**
         * LA PRÉCISION VIENT DE LA RÈGLE, pas d'une formule rassurante : §4 dit
         * que débloquer ne restaure PAS les contacts. C'est la seule chose qu'on
         * ne pourra pas défaire, et c'est donc la seule qui mérite l'encart.
         */
        precision="Si vous le débloquez plus tard, vos contacts ne seront pas restaurés."
        libelleConfirmer="Bloquer"
        occupe={enVol}
        onConfirmer={confirmerBlocage}
        onAnnuler={() => {
          setBlocageDemande(false);
        }}
      />
      {children(enrichies, menu, signalement)}
    </>
  );
}
