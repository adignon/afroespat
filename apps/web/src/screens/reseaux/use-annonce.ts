'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  announcementTitleSchema,
  createAnnouncementSchema,
  type CreateAnnouncementResponse,
} from '@app/shared';
import { notifyError, notifySuccess } from '@/components/notifications';
import { createAnnouncement } from './api';
import { echecDe } from './echec';
import type { AnnonceComposeurView } from '../a08t/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAT DU FORMULAIRE D'ANNONCE — LES QUATRE CONTRÔLES DE LA PLANCHE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'annonce : tous les champs doivent être branchés. »
 *
 * MESURÉ avant : les deux planches « ADMIN · ANNONCE » étaient entièrement
 * inertes — le titre un `<div>`, le corps un `<div>`, les deux interrupteurs des
 * `<span>`, « Publier l'annonce » un `<button>` nu — et le contrat lui-même était
 * en deçà du dessin : `createAnnouncementSchema` n'acceptait que `{ body }`, et
 * `community_announcements` ne portait ni titre ni épinglage. Les deux colonnes
 * sont ajoutées (migration `annonce_titre_et_epinglage`), le schéma est élargi, et
 * ce crochet est ce qui relie l'écran aux quatre.
 *
 * ── LES DEUX INTERRUPTEURS PARTENT ALLUMÉS, ET CE N'EST PAS LE DÉFAUT DU
 *    SCHÉMA ────────────────────────────────────────────────────────────────────
 *
 * La planche les dessine allumés sur les DEUX largeurs : piste `#16785E`,
 * pastille à droite. L'écran part donc de cet état, parce que c'est le dessin.
 *
 * `createAnnouncementSchema`, lui, pose `pinned: false` et `notify: true` — c'est
 * l'ANCIEN COMPORTEMENT au bit près, pour qu'un appel direct qui ne passe rien
 * n'épingle pas soudainement. L'écart entre les deux est volontaire et il tient
 * en une phrase : le schéma protège les appelants existants, l'écran suit la
 * maquette.
 *
 * ── LES BORNES SONT LUES, JAMAIS RECOPIÉES ────────────────────────────────
 *
 * `announcementTitleSchema.maxLength` et `createAnnouncementSchema.shape.body.maxLength`
 * viennent du contrat partagé, à côté de ce que l'API refuse. Un `120` ou un
 * `2000` écrit ici serait une seconde source, et deux sources divergent toujours.
 *
 * ── LE TITRE VIDE N'EST PAS UN TITRE VIDE : IL EST ABSENT ─────────────────
 *
 * `title` est FACULTATIF côté schéma et NULLABLE en base (les annonces d'avant ce
 * lot n'en ont pas). Envoyer `title: ''` serait refusé par
 * `announcementTitleSchema` (minimum 3) et transformerait un champ laissé vide en
 * erreur de validation. La clé est donc OMISE quand le champ est vide — et
 * `exactOptionalPropertyTypes` est actif, donc `{ title: undefined }` n'est pas
 * la même chose que `{}`.
 *
 * ── CE QUE CE CROCHET NE DEVANCE PAS ──────────────────────────────────────
 *
 *   · le RANG. Annoncer est réservé au propriétaire et aux modérateurs (§2.3), et
 *     le service refuse en `403 FORBIDDEN`. Aucun `if (role === 'OWNER')` ici :
 *     l'onglet « annonce » n'est atteignable qu'en vue propriétaire, mais c'est le
 *     serveur qui tranche ;
 *   · la LIMITE DE DEUX PAR SEMAINE. Le service la compte sur les lignes des sept
 *     derniers jours et refuse en `422 ANNOUNCEMENT_LIMIT`. La recompter ici
 *     demanderait de charger la liste des annonces pour griser un bouton, et une
 *     seconde définition de la règle finirait par autoriser une troisième
 *     annonce. On TENTE, et le refus porte sa phrase.
 *
 * `pret` n'éteint le bouton que sur ce que le FORMULAIRE sait : un corps non vide
 * et aucun envoi en cours. C'est une commodité d'écriture, pas une autorisation.
 */
export interface AnnonceEtat {
  /** Les prises que les deux cadres d'annonce lisent. */
  readonly annonce: AnnonceComposeurView;
  /** La dernière annonce publiée, ou `null`. La page s'en sert pour naviguer. */
  readonly publiee: CreateAnnouncementResponse | null;
}

export function useAnnonce(
  slug: string,
  /** Ce qu'il faut faire après publication — la page a le routeur, pas le crochet. */
  apresPublication?: (annonce: CreateAnnouncementResponse) => void,
  /** Le geste d'« Annuler ». La page le sait aussi. */
  surAnnulation?: () => void,
): AnnonceEtat {
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [epingler, setEpingler] = useState(true);
  const [notifier, setNotifier] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [publiee, setPubliee] = useState<CreateAnnouncementResponse | null>(null);

  /**
   * LE CORPS PASSE PAR SON SCHÉMA et non par un `length > 0` écrit ici : le
   * schéma `trim()` avant de compter, donc trois espaces ne sont pas une annonce,
   * et c'est exactement ce que l'API applique.
   */
  const corpsValide = createAnnouncementSchema.shape.body.safeParse(corps).success;
  const pret = corpsValide && !envoi;

  const publier = useCallback(async () => {
    setEnvoi(true);
    try {
      const propre = titre.trim();
      const annonce = await createAnnouncement(slug, {
        ...(propre === '' ? {} : { title: propre }),
        body: corps,
        pinned: epingler,
        notify: notifier,
      });
      setPubliee(annonce);
      setTitre('');
      setCorps('');
      /**
       * LA CONFIRMATION DIT CE QUI S'EST VRAIMENT PASSÉ, et elle le lit sur la
       * RÉPONSE et non sur l'état du formulaire : c'est le serveur qui décide si
       * la notification est partie, et `notifiedAt` le porte. Un message composé
       * depuis l'interrupteur affirmerait une notification que le serveur
       * pourrait n'avoir pas envoyée.
       */
      notifySuccess(
        annonce.notifiedAt === null
          ? 'Annonce publiée, sans notification.'
          : 'Annonce publiée et notifiée aux membres.',
      );
      apresPublication?.(annonce);
    } catch (e) {
      /**
       * `echecDe` compose la phrase française — et JAMAIS le message brut du
       * serveur sur un `429`, qui dit « patientez un instant » pour une attente
       * qui peut valoir une heure. Les deux refus attendus ici sont
       * `422 ANNOUNCEMENT_LIMIT` (« Deux annonces par semaine au maximum. ») et
       * `403 FORBIDDEN` quand on n'est ni propriétaire ni modérateur.
       */
      const echec = echecDe(e);
      notifyError(
        echec.levelRequired?.labelFr === undefined
          ? echec.message
          : `Pour ${echec.levelRequired.labelFr}, vérifiez votre compte.`,
      );
    } finally {
      setEnvoi(false);
    }
  }, [apresPublication, corps, epingler, notifier, slug, titre]);

  const annonce: AnnonceComposeurView = useMemo(
    () => ({
      titreValue: titre,
      onTitre: (e) => setTitre(e.target.value),
      titreMax: announcementTitleSchema.maxLength ?? 0,
      corpsValue: corps,
      onCorps: (e) => setCorps(e.target.value),
      corpsMax: createAnnouncementSchema.shape.body.maxLength ?? 0,
      epingler,
      onEpingler: () => setEpingler((v) => !v),
      notifier,
      onNotifier: () => setNotifier((v) => !v),
      pret,
      /** `void` EXPLICITE : `onClick` attend un gestionnaire synchrone. */
      onPublier: () => {
        void publier();
      },
      onAnnuler: () => surAnnulation?.(),
    }),
    [corps, epingler, notifier, pret, publier, surAnnulation, titre],
  );

  return { annonce, publiee };
}
