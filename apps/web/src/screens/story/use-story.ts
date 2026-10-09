'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, hasAccessToken, resumeSession } from '@/lib/api/index';
import { urlMedia } from '@/lib/api/base';
import { notifyError, notifySuccess } from '@/components/notifications';
import type { StoryDetailResponse } from '@app/shared';
import {
  bookmarkStory,
  ecrireAAuteur,
  fetchStory,
  unbookmarkStory,
  unvoteStory,
  uploadStoryCapture,
  voteStory,
} from '../accueil/api';
import { capturerStory } from './capture';
import { echecDe, type FilEchec } from '../publication/echec';
import { storyLueFrom, type StoryLue, type VoteKind } from './from-api';
import { signalerStoryVue } from './vue';

/**
 * L'ÉTAT DE `/stories/:id`.
 *
 * ── `GET /stories/:id` EST UNE LECTURE QUI ÉCRIT ──────────────────────────
 *
 * Elle MARQUE LA STORY VUE — c'est l'anneau du bandeau, pas un compteur : §2.6
 * interdit tout compteur de vues, et l'API n'en expose aucun. La conséquence pour
 * ce crochet est concrète : l'appel n'est pas idempotent du point de vue de
 * l'anneau, donc il ne doit partir qu'UNE FOIS par story. `StrictMode` monte deux
 * fois en développement ; l'`AbortController` annule le premier, et l'effet ne
 * dépend que de l'identifiant.
 *
 * ── 404 SUR UNE STORY EXPIRÉE ─────────────────────────────────────────────
 *
 * §2.6 : une story expirée répond `404` sauf à son auteur ou à qui l'a gardée.
 * C'est une règle métier, pas un incident — `echecDe` la rend en `ApiError`, et
 * l'écran affiche la phrase française, jamais une page blanche.
 */

export interface StoryEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  readonly echec: FilEchec | null;
  readonly reponse: StoryDetailResponse | null;
}

export function useStory(storyId: string) {
  const [etat, setEtat] = useState<StoryEtat>({
    pret: false,
    chargement: true,
    echec: null,
    reponse: null,
  });

  const reprise = useRef<Promise<boolean> | null>(null);

  const charger = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }
        const reponse = await fetchStory(storyId, signal);
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: null, reponse });
        /**
         * LA LECTURE EST FAITE — `GET /stories/:id` l'a ENREGISTRÉE côté serveur,
         * c'est sa règle (§2.6). On le dit au fil, qui est monté à côté dans une
         * route parallèle et ne le saurait pas autrement : son anneau restait vert
         * jusqu'au rechargement de la page. Voir `screens/story/vue.ts`.
         */
        signalerStoryVue(storyId);
      } catch (error) {
        if (signal.aborted) return;
        setEtat({ pret: true, chargement: false, echec: echecDe(error), reponse: null });
      }
    },
    [storyId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  /**
   * Voter, et retirer son vote. On envoie, PUIS on recale sur le serveur.
   *
   * Aucune mise à jour optimiste : `PUT /stories/:id/reaction` rend les compteurs
   * FRAÎCHEMENT RELUS, et une incrémentation locale divergerait dès qu'un autre
   * membre vote en même temps.
   *
   * Le `kind` EST envoyé ici — contrairement à la réaction de publication, où le
   * serveur le déduit du type. §2.6 en accepte deux par type, et le serveur refuse
   * `KIND_NOT_ALLOWED_FOR_TYPE` (mesuré 422) si l'on se trompe. L'appelant passe
   * donc `positiveKind` ou `negativeKind` lus SUR LA STORY, jamais une table tenue
   * dans le front.
   *
   * Un `429` n'est PAS rejoué.
   */
  const basculerVote = useCallback(
    async (kind: VoteKind): Promise<FilEchec | null> => {
      const courant = etat.reponse;
      if (courant === null) return null;
      try {
        const votes =
          courant.story.myReaction === kind
            ? await unvoteStory(storyId)
            : await voteStory(storyId, kind);
        setEtat((p) =>
          p.reponse === null
            ? p
            : {
                ...p,
                reponse: {
                  ...p.reponse,
                  story: {
                    ...p.reponse.story,
                    myReaction: courant.story.myReaction === kind ? null : kind,
                    votes: {
                      positive: votes.positive,
                      positiveKind: votes.positiveKind,
                      positiveLabel: votes.positiveLabel,
                      negative: votes.negative,
                      negativeKind: votes.negativeKind,
                      negativeLabel: votes.negativeLabel,
                    },
                  },
                },
              },
        );
        return null;
      } catch (error) {
        return echecDe(error);
      }
    },
    [etat.reponse, storyId],
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ÉCRIRE À L'AUTEUR, ET ENREGISTRER LA STORY                              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « implémente l'envoi de message avec l'input et le serveur » et
   * « Le bouton de bookmark permet d'enregistrer la stories. »
   *
   * Les deux états vivent ICI et non dans la réponse du serveur : le texte en
   * cours de frappe n'appartient à personne d'autre, et le signet doit basculer
   * à l'écran sans attendre l'aller-retour. Le serveur reste l'autorité — sa
   * réponse écrase l'état optimiste, et un refus le rend.
   */
  const [messageTexte, setMessageTexte] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [champActif, setChampActif] = useState(false);
  const [signet, setSignet] = useState<boolean | null>(null);

  /** Remis à zéro quand on change de story : un brouillon ne suit pas l'auteur. */
  useEffect(() => {
    setMessageTexte('');
    setSignet(null);
  }, [storyId]);

  /**
   * ── TOUT SAUF `onFermer` ─────────────────────────────────────────────────
   *
   * Ce crochet compose la story à partir de la réponse et des gestes qui la
   * concernent — voter, écrire, enregistrer. FERMER n'en fait pas partie : ça
   * dépend d'où la story a été ouverte (une fenêtre posée sur le fil, ou une page
   * atteinte par son adresse), et c'est l'écran qui le sait. Il l'ajoute.
   */
  const story: Omit<StoryLue, 'onFermer'> | null = useMemo(() => {
    if (etat.reponse === null) return null;
    const lue = storyLueFrom(etat.reponse);
    /**
     * ── LES DEUX GESTES DE VOTE, POSÉS ICI ───────────────────────────────────
     *
     * Le porteur : « Les boutons utile et pas utile permettent à l'utilisateur de
     * voter donc ils doivent être cliquables. » Ils ne l'étaient pas : zéro
     * `<button>` dans A13, mesuré.
     *
     * `storyLueFrom` est PURE — elle convertit une réponse, elle ne connaît
     * aucune action. Les gestes se posent donc ici, là où `basculerVote` vit.
     *
     * LE GENRE VIENT DE LA STORY, jamais d'une table tenue dans le front : §2.6
     * en accepte deux par type et le serveur refuse `KIND_NOT_ALLOWED_FOR_TYPE`.
     * C'est la règle que `basculerVote` documente déjà juste au-dessus.
     *
     * `void` sur l'appel : `basculerVote` rend un échec que l'écran n'affiche pas
     * encore. REMONTÉ — un refus de vote est aujourd'hui silencieux.
     */
    /**
     * L'ÉTAT OPTIMISTE L'EMPORTE TANT QU'IL EXISTE : `signet` vaut `null` tant
     * qu'on n'a rien touché, et c'est alors le serveur qui dit — `bookmarked`,
     * servi par `GET /stories/:id`.
     */
    const garde = signet ?? lue.signet;

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LA STORY PART AVEC LE MESSAGE, EN IMAGE                              ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « quand on envoie un message dans le contexte d'une story, il
     * faudrait que la story soit capturée comme une image et ajoutée au message
     * juste un peu sous le message ».
     *
     * MESURÉ avant : le destinataire recevait un texte NU. Une story vit
     * vingt-quatre heures ; le lendemain, « votre conseil m'a beaucoup aidée » ne
     * désigne plus rien, même pour son auteur.
     *
     * ── ET SI LA CAPTURE ÉCHOUE, LE MESSAGE PART QUAND MÊME ────────────────
     *
     * Trois choses peuvent manquer : le canvas (navigateur ancien), les octets du
     * fond (réseau), le dépôt du média (`429`, antivirus, plafond). Aucune ne doit
     * emporter le message : c'est LUI que le membre a écrit, l'image est un
     * accompagnement. On capture, on dépose, et si l'un des deux ne va pas, on
     * envoie le texte seul — sans rien dire, parce qu'annoncer « l'image n'a pas
     * pu être joint » devant un message correctement envoyé inquiéterait pour rien.
     *
     * ── L'ORDRE COMPTE : CAPTURER, DÉPOSER, PUIS ÉCRIRE ───────────────────
     *
     * Le dépôt échoue avant que le message existe, pas après. L'inverse — écrire
     * puis joindre — demanderait un SECOND message, que §5.2 refuse sur une
     * conversation en attente : voir `ecrireAAuteur`.
     */
    const capturerEtDeposer = async (): Promise<string | undefined> => {
      try {
        const image = await capturerStory({
          bg: lue.bg,
          avBg: lue.avBg,
          i: lue.i,
          name: lue.name,
          sub: lue.sub,
          label: lue.label,
          pill: lue.pill,
          pillFg: lue.pillFg,
          text: lue.text,
          state: lue.state,
          /**
           * L'ADRESSE BRUTE DU FOND, et non `photoFond` : celui-ci est une valeur
           * CSS (`url("…") center/cover no-repeat`, ou le hachurage de la maquette
           * quand il n'y a pas d'image). En extraire l'adresse par une expression
           * régulière marcherait jusqu'au jour où la recette change. La réponse du
           * serveur porte `backgroundUrl` ; c'est elle qu'on lit.
           */
          imageUrl: etat.reponse === null || etat.reponse.story.backgroundUrl === null
            ? null
            : urlMedia(etat.reponse.story.backgroundUrl),
        });
        if (image === null) return undefined;
        const fichier = new File([image], `story-${storyId}.png`, { type: 'image/png' });
        const depose = await uploadStoryCapture(fichier);
        return depose.id;
      } catch {
        return undefined;
      }
    };

    const envoyer = () => {
      const texte = messageTexte.trim();
      if (texte === '' || envoiEnCours || !lue.canMessage) return;
      setEnvoiEnCours(true);
      capturerEtDeposer()
        /**
         * `storyId` PART AVEC LE MESSAGE, et c'est ce qui rend la vignette
         * cliquable chez le destinataire : la capture est un média autonome qui ne
         * dit pas d'où il vient. Posé même quand la capture a échoué — le lien
         * vers la story reste vrai, image ou pas.
         */
        .then((mediaId) => ecrireAAuteur(lue.auteurHandle, texte, mediaId, storyId))
        .then((reponse) => {
          setMessageTexte('');
          /**
           * ── LE TOAST DIT CE QUI S'EST PASSÉ, PAS « C'EST FAIT » ───────────
           *
           * Le porteur : « il faut un toast message qui dit si le message est
           * bien envoyé ou pas ».
           *
           * `pending` vient du serveur : tant que la relation est froide (§5.2),
           * le premier message EST une demande, et il attend d'être accepté. Dire
           * « envoyé » dans ce cas laisserait croire à une conversation ouverte.
           */
          notifySuccess(
            reponse.pending
              ? `Demande envoyée à ${lue.name}. Elle s’ouvrira s’il l’accepte.`
              : `Message envoyé à ${lue.name}.`,
          );
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.',
          );
        })
        .finally(() => setEnvoiEnCours(false));
    };

    return {
      ...lue,
      onVoteUtile: () => void basculerVote(lue.positiveKind),
      onVotePasUtile: () => void basculerVote(lue.negativeKind),

      messageTexte,
      onMessageTexte: (event: { target: { value: string } }) =>
        setMessageTexte(event.target.value),
      /**
       * ENTRÉE ENVOIE. La planche ne dessine AUCUN bouton d'envoi à côté du
       * champ — seulement le signet — donc c'est la touche qui porte le geste.
       * C'est aussi ce qu'un champ d'une seule ligne appelle partout ailleurs.
       */
      onMessageTouche: (event: { key: string }) => {
        if (event.key === 'Enter') envoyer();
      },
      /** Grisé pendant l'envoi, et quand l'auteur n'accepte pas les messages. */
      messageBloque: envoiEnCours || !lue.canMessage,

      /**
       * ── LE BOUTON D'ENVOI ────────────────────────────────────────────────
       *
       * « dès que l'input est focus il faut afficher un bouton d'icône d'envoi
       * rounded blanc flottant dans le coin droit de l'input ».
       *
       * Visible AUSSI quand le champ est rempli mais plus actif : un texte écrit
       * puis abandonné doit garder son issue. Jamais quand l'auteur refuse les
       * messages — un bouton qui ne peut rien faire est pire que pas de bouton.
       */
      messageEnvoiVisible: lue.canMessage && (champActif || messageTexte.trim() !== ''),
      /**
       * LA BARRE S'ARRÊTE PENDANT QU'ON ÉCRIT — et le minuteur avec elle, dans
       * `story-ecran.tsx`. Les deux lisent la même valeur : une barre arrêtée
       * au-dessus d'une story qui change toute seule serait pire que rien.
       */
      barrePause: champActif ? 'oui' : '',
      onMessageFocus: () => setChampActif(true),
      /**
       * `setTimeout` : un clic sur le bouton provoque le `blur` du champ AVANT son
       * propre `click`. Masquer tout de suite retirerait le bouton sous le doigt,
       * et le clic ne toucherait plus rien. C'est le même écueil que la liste de
       * suggestions des compétences, et la même parade.
       */
      onMessageBlur: () => setTimeout(() => setChampActif(false), 150),
      onMessageEnvoyer: envoyer,

      signetActif: garde,
      signetNom: garde ? 'Retirer des enregistrées' : 'Enregistrer la story',
      // Un signet PLEIN dit « gardé » ; vide, il dit « à garder ».
      signetFill: garde ? '#fff' : 'none',
      onSignet: () => {
        const vise = !garde;
        setSignet(vise);
        const appel = vise ? bookmarkStory(lue.storyId) : unbookmarkStory(lue.storyId);
        appel
          .then((r) => {
            setSignet(r.bookmarked);
            /**
             * ── ON DIT CE QUI A ÉTÉ FAIT ────────────────────────────────────
             *
             * Le porteur : « Après le check du bookmark il faut informer "Storie
             * enregistré etc..." ». Le bouton change d'état, mais un changement
             * d'icône se rate ; une phrase, non.
             *
             * Elle dit AUSSI ce que l'enregistrement apporte, parce que c'est la
             * seule occasion de le dire : une story disparaît au bout de
             * vingt-quatre heures, sauf pour qui l'a gardée (`storyDetail`).
             */
            notifySuccess(
              r.bookmarked
                ? 'Story enregistrée. Vous la retrouverez après ses 24 heures.'
                : 'Story retirée de vos enregistrées.',
            );
          })
          .catch((cause: unknown) => {
            /**
             * ON REVIENT EN ARRIÈRE. Laisser le signet allumé sur un refus ferait
             * croire la story gardée — et elle disparaîtrait au bout de ses
             * vingt-quatre heures, sans que personne comprenne pourquoi.
             */
            setSignet(garde);
            notifyError(
              cause instanceof ApiError
                ? cause.displayMessage
                : 'L’enregistrement n’a pas pu être fait.',
            );
          });
      },
    };
  }, [etat.reponse, basculerVote, messageTexte, envoiEnCours, champActif, signet]);

  return { ...etat, story, basculerVote };
}
