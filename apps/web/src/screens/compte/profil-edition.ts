'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  mediaAssetSchema,
  meResponseSchema,
  placesCitiesResponseSchema,
  placesCountriesResponseSchema,
  updateMeSchema,
  updateProfileSchema,
  type MeResponse,
  type MediaAssetView,
  type PlacesCity,
} from '@app/shared';
import { ApiError, fetchMe, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import { notifyError, notifySuccess } from '@/components/notifications';
import type { EditionProfil } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « MON PROFIL » — L'ÉCRITURE, QUI N'EXISTAIT PAS                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La page affichait un formulaire complet dont RIEN n'était saisissable : zéro
 * `<input>` dans le cadre, et son unique bouton « Enregistrer » sans geste. Les
 * deux routes existaient pourtant depuis le début — `PATCH /me` et
 * `PATCH /me/profile`.
 *
 * ── DEUX ROUTES, UN SEUL BOUTON ───────────────────────────────────────────
 *
 * Le découpage est celui de l'API, pas de l'écran : `PATCH /me` porte l'identité
 * (nom, pseudo, phase, ville, date d'arrivée, photo), `PATCH /me/profile` porte
 * le profil (bio, statut, disponibilité, visibilité). La maquette, elle, dessine
 * UN bouton. On envoie donc les deux, et l'une peut réussir quand l'autre échoue
 * — ce que le message dit, plutôt que d'annoncer un enregistrement partiel comme
 * un succès.
 *
 * ── ON N'ENVOIE QUE CE QUI A CHANGÉ ───────────────────────────────────────
 *
 * Et ce n'est pas une optimisation. `PATCH /me` est limité à 20 appels par heure
 * (§4.4) et le PSEUDO n'est modifiable qu'une fois par trimestre : renvoyer le
 * pseudo inchangé à chaque enregistrement consommerait ce droit pour rien. Le
 * service compare bien `patch.handle !== current.handle` avant d'agir, mais s'en
 * remettre à lui ferait dépendre l'écran d'un détail d'implémentation.
 *
 * ── CE QUI N'EST PAS ÉDITABLE, ET POURQUOI ────────────────────────────────
 *
 *   · COMPÉTENCES et LANGUES — `skillIds` / `languageIds` sont des identifiants
 *     de référentiel, et les lister demande `/referentials/*`, une route
 *     d'ÉQUIPE. Un champ de texte libre ne peut pas les produire ;
 *   · PAYS D'ORIGINE — §2.7 : modifiable une seule fois, puis figé. La maquette
 *     le dessine déjà verrouillé ;
 *   · « APPARAÎTRE DANS LES NOUVEAUX ARRIVANTS » — aucune colonne, aucune route.
 *
 * Les trois sont REMONTÉS, pas comblés.
 */

/** Les trois phases, dans les mots de la maquette. */
const PHASES: readonly { valeur: string; libelle: string }[] = [
  { valeur: 'PRE_DEPARTURE', libelle: 'Je prépare mon départ' },
  { valeur: 'RECENT_ARRIVAL', libelle: 'Je viens d’arriver' },
  { valeur: 'SETTLED', libelle: 'Je suis installé·e' },
];

/**
 * Les cinq statuts. LES QUATRE PREMIERS sont ceux que la maquette dessine en
 * pastilles ; `OTHER` (« Famille ») existe en base et sur O04, et il est gardé
 * pour qu'un membre qui l'a choisi à l'inscription ne le perde pas en ouvrant
 * cette page — une pastille absente aurait effacé son statut au premier
 * enregistrement.
 */
const STATUTS: readonly { valeur: string; libelle: string }[] = [
  { valeur: 'STUDENT', libelle: 'Étudiant·e' },
  { valeur: 'EMPLOYEE', libelle: 'Salarié·e' },
  { valeur: 'JOB_SEEKER', libelle: 'En recherche' },
  { valeur: 'ENTREPRENEUR', libelle: 'Indépendant·e' },
  { valeur: 'OTHER', libelle: 'Famille' },
];

interface Formulaire {
  nom: string;
  pseudo: string;
  bio: string;
  phase: string;
  ville: string;
  arrivee: string;
  statut: string;
  aide: boolean;
  visible: boolean;
}

const vide: Formulaire = {
  nom: '',
  pseudo: '',
  bio: '',
  phase: '',
  ville: '',
  arrivee: '',
  statut: '',
  aide: false,
  visible: false,
};

/** `GET /me` → le formulaire. La source de vérité, et le point de comparaison. */
function depuisMe(me: MeResponse): Formulaire {
  return {
    nom: me.user.displayName,
    pseudo: me.user.handle,
    bio: me.profile?.bio ?? '',
    phase: me.user.phase,
    ville: me.user.cityId ?? '',
    /**
     * `arrivalDate` arrive en ISO complet ou en date nue selon la route ; un
     * `<input type="date">` n'accepte QUE `YYYY-MM-DD`. On coupe donc au T, et
     * une valeur absente reste la chaîne vide — ce que le champ lit comme « non
     * renseigné » plutôt que comme une date de 1970.
     */
    arrivee: (me.user.arrivalDate ?? '').slice(0, 10),
    statut: me.profile?.occupationStatus ?? '',
    aide: me.profile?.availableToHelp ?? false,
    visible: me.profile?.isPublic ?? false,
  };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ `PUT /me/avatar` — LA ROUTE EXISTAIT, ET C'EST LA SEULE                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * La première version envoyait à `POST /media` avec `kind: 'AVATAR'`, puis posait
 * l'identifiant par `PATCH /me`. Le porteur a vu le résultat : « certaines
 * informations sont mal remplies ». MESURÉ — `POST /media` REFUSE ce genre :
 * `{"path":"kind","code":"INVALID_ENUM_VALUE"}`, 400.
 *
 * Et c'est délibéré : `mediaUploadKindSchema` écarte `AVATAR` en toutes lettres,
 * « il a sa propre route, `PUT /me/avatar` (01 §4.2) ». L'accepter ailleurs
 * « créerait un avatar que rien n'attache — un fichier payé et jamais affiché ».
 *
 * LA VRAIE ROUTE FAIT TOUT EN UN APPEL : elle dépose, attache, et RETIRE l'ancien
 * portrait, octets compris. Le détour par `PATCH /me` n'était donc pas seulement
 * refusé — il aurait laissé les anciens fichiers derrière lui.
 */
function televerserAvatar(fichier: File): Promise<MediaAssetView> {
  const corps = new FormData();
  corps.append('file', fichier);
  return memberApi.put('/me/avatar', mediaAssetSchema, { body: corps });
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA LISTE « VILLE » EST CELLE DU PAYS OÙ L'ON VIT — PAS DU PAYS D'ORIGINE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Lot W2A, phase 2.7. Le menu proposait les douze villes du pays d'ORIGINE (le
 * Bénin) à un membre qui habite Évry : sa ville n'y figurait pas, et le menu
 * affichait donc la première ville de la liste comme si c'était la sienne.
 *
 * Le pays est celui de la ville COURANTE (`cityCountryId`, rendu par `GET /me`) ;
 * sans ville, c'est le premier pays de destination actif — celui où l'on s'installe,
 * comme à l'onboarding. Les villes inactives sont proposées (`activeOnly=false`) :
 * on peut vivre dans une ville dont le réseau n'est pas encore ouvert. Et la ville
 * courante est TOUJOURS dans la liste, même si le référentiel ne la rendait plus
 * (ville fusionnée depuis) : un menu qui ne contient pas sa propre valeur affiche
 * une autre ville à la place.
 */
async function villesProposees(me: MeResponse): Promise<readonly PlacesCity[]> {
  let pays = me.user.cityCountryId;
  if (pays === null) {
    const liste = await memberApi.get('/places/countries?limit=50', placesCountriesResponseSchema);
    pays = liste.items.find((c) => c.kind !== 'ORIGIN')?.id ?? null;
  }
  const items =
    pays === null
      ? []
      : (
          await memberApi.get(
            `/places/cities?countryId=${encodeURIComponent(pays)}&activeOnly=false&limit=200`,
            placesCitiesResponseSchema,
          )
        ).items;
  const courante = me.user.cityId;
  if (courante === null || items.some((v) => v.id === courante)) return items;
  return [
    ...items,
    {
      id: courante,
      countryId: pays ?? courante,
      name: me.user.cityName ?? '',
      slug: '',
      region: null,
      isActive: false,
      memberCount: 0,
    },
  ];
}

export function useEditionProfil(): {
  readonly edition: EditionProfil;
  readonly rechargement: number;
} {
  const [depart, setDepart] = useState<Formulaire>(vide);
  const [form, setForm] = useState<Formulaire>(vide);
  const [villes, setVilles] = useState<readonly PlacesCity[]>([]);
  const [envoi, setEnvoi] = useState(false);
  /**
   * UN COMPTEUR, ET NON UN BOOLÉEN : il sert de clé de rechargement à l'écran
   * après un enregistrement réussi. Un booléen ne pourrait pas distinguer deux
   * enregistrements successifs, et le second ne rafraîchirait rien.
   */
  const [rechargement, setRechargement] = useState(0);

  const semer = useCallback(async (): Promise<void> => {
    try {
      /**
       * ╔════════════════════════════════════════════════════════════════════╗
       * ║ LA SESSION D'ABORD — le jeton d'accès MEURT au rechargement           ║
       * ╚════════════════════════════════════════════════════════════════════╝
       *
       * Il vit en mémoire, dans la clôture de `lib/api/session.ts`, et disparaît
       * avec l'onglet. MESURÉ au navigateur : après un `reload`, le formulaire
       * revenait ENTIÈREMENT VIDE — `fetchMe` partait sans en-tête, échouait, et le
       * `catch` silencieux ci-dessous laissait les champs à leur valeur initiale.
       * Un membre aurait alors effacé son nom en cliquant « Enregistrer » sur ce
       * qu'il croyait être son profil.
       *
       * C'est la même reprise que `usePublication` et `useMesReseaux` font déjà,
       * et pour la même raison.
       */
      if (!hasAccessToken()) await resumeSession();
      const me = await fetchMe({ force: true });
      const forme = depuisMe(me);
      setDepart(forme);
      setForm(forme);
      setVilles(await villesProposees(me));
    } catch {
      /**
       * LE SEMIS NE CRIE PAS. L'écran a déjà affiché le profil par son propre
       * chargement ; un second message d'erreur pour le formulaire ferait croire
       * à une page cassée alors que la lecture a réussi. Les champs restent
       * vides, et « Enregistrer » refuse un nom vide.
       */
    }
  }, []);

  useEffect(() => {
    void semer();
  }, [semer]);

  const champ =
    (cle: keyof Formulaire) =>
    (event: { target: { value: string } }): void => {
      const valeur = event.target.value;
      setForm((f) => ({ ...f, [cle]: valeur }));
    };

  const bascule = (cle: 'aide' | 'visible') => (): void => {
    setForm((f) => ({ ...f, [cle]: !f[cle] }));
  };

  const onPhoto = (): void => {
    const choix = document.createElement('input');
    choix.type = 'file';
    choix.accept = 'image/*';
    choix.addEventListener('change', () => {
      const fichier = choix.files?.[0];
      if (fichier === undefined) return;
      void televerserAvatar(fichier)
        .then(() => {
          /**
           * ELLE EST DÉJÀ APPLIQUÉE : `PUT /me/avatar` attache le portrait lui-même.
           * Dire « enregistrez pour l'appliquer » serait faux, et le membre pourrait
           * quitter la page en croyant avoir perdu sa photo.
           *
           * ON RECHARGE L'ÉCRAN pour que le rond du bandeau et l'aperçu suivent —
           * ils lisent `avatarUrl` de `GET /me`, pas le formulaire.
           */
          notifySuccess('Photo de profil mise à jour.');
          /**
           * ╔══════════════════════════════════════════════════════════════════╗
           * ║ ON RAFRAÎCHIT `GET /me` AVANT DE REMONTER L'ÉCRAN                ║
           * ╚══════════════════════════════════════════════════════════════════╝
           *
           * `rechargement` est la clé de `EcranDonnees` : la bouger le remonte, et
           * il rappelle `chargerK01`, qui lit `fetchMe()` SANS `force` — donc la
           * copie en mémoire. Posée dans cet ordre, la remontée partait avant que
           * `semer()` n'ait rafraîchi cette copie, et l'écran se reconstruisait sur
           * l'ancien `avatarUrl`.
           *
           * MESURÉ : le rond gardait ses initiales et son aplat après un envoi qui
           * avait pourtant réussi — exactement le « ça met photo mise à jour sans
           * rien faire » du porteur, déplacé d'un cran.
           *
           * `semer()` appelle `fetchMe({ force: true })`, qui REMPLACE la copie. On
           * l'attend donc, et on remonte ensuite.
           */
          void semer().then(() => {
            setRechargement((n) => n + 1);
          });
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'La photo n’a pas pu être déposée.',
          );
        });
    });
    choix.click();
  };

  const onEnregistrer = (): void => {
    if (envoi || form.nom.trim() === '') return;
    setEnvoi(true);

    /** `PATCH /me` — uniquement les champs qui ont bougé. Voir l'en-tête. */
    const identite: Record<string, unknown> = {};
    if (form.nom !== depart.nom) identite['displayName'] = form.nom.trim();
    if (form.pseudo !== depart.pseudo) identite['handle'] = form.pseudo.trim();
    if (form.phase !== depart.phase && form.phase !== '') identite['phase'] = form.phase;
    if (form.ville !== depart.ville && form.ville !== '') identite['cityId'] = form.ville;
    if (form.arrivee !== depart.arrivee && form.arrivee !== '') {
      identite['arrivalDate'] = form.arrivee;
    }

    const profil: Record<string, unknown> = {};
    if (form.bio !== depart.bio) profil['bio'] = form.bio;
    if (form.statut !== depart.statut && form.statut !== '') {
      profil['occupationStatus'] = form.statut;
    }
    if (form.aide !== depart.aide) profil['availableToHelp'] = form.aide;
    if (form.visible !== depart.visible) profil['isPublic'] = form.visible;

    /**
     * LE FRONT PRÉVIENT AVEC LES SCHÉMAS PARTAGÉS, le serveur décide. `parse` levait
     * une `ZodError` non rattrapée dans ce gestionnaire (bouton figé en « envoi »,
     * aucun message) dès qu'un pseudo ou une date ne passait pas : `safeParse` rend
     * le premier message du schéma — pseudo (chiffre en tête, moins de 3
     * caractères, séparateur final, majuscules), date d'arrivée dans le futur,
     * départ dans le passé, fuseau inconnu.
     */
    const identiteValide = Object.keys(identite).length > 0 ? updateMeSchema.safeParse(identite) : null;
    if (identiteValide !== null && !identiteValide.success) {
      notifyError(identiteValide.error.issues[0]?.message ?? 'Une information est invalide.');
      setEnvoi(false);
      return;
    }
    const profilValide = Object.keys(profil).length > 0 ? updateProfileSchema.safeParse(profil) : null;
    if (profilValide !== null && !profilValide.success) {
      notifyError(profilValide.error.issues[0]?.message ?? 'Une information est invalide.');
      setEnvoi(false);
      return;
    }

    const envois: Promise<unknown>[] = [];
    if (identiteValide !== null && identiteValide.success) {
      envois.push(memberApi.patch('/me', meResponseSchema, { body: identiteValide.data }));
    }
    if (profilValide !== null && profilValide.success) {
      envois.push(memberApi.patch('/me/profile', meResponseSchema, { body: profilValide.data }));
    }

    if (envois.length === 0) {
      notifySuccess('Rien n’a changé.');
      setEnvoi(false);
      return;
    }

    /**
     * `allSettled` ET NON `all` : les deux routes sont indépendantes, et une bio
     * refusée ne doit pas annuler un nom accepté côté serveur — il l'est déjà.
     * Dire « échec » sur l'ensemble ferait croire que rien n'a été écrit.
     */
    void Promise.allSettled(envois)
      .then((issues) => {
        const rates = issues.filter((i) => i.status === 'rejected');
        if (rates.length === 0) {
          notifySuccess('Profil enregistré.');
        } else {
          const premier = rates[0];
          const cause = premier?.status === 'rejected' ? (premier.reason as unknown) : null;
          notifyError(
            cause instanceof ApiError
              ? cause.displayMessage
              : 'Une partie du profil n’a pas pu être enregistrée.',
          );
        }
        setRechargement((n) => n + 1);
        void semer();
      })
      .finally(() => {
        setEnvoi(false);
      });
  };

  const edition: EditionProfil = {
    nom: form.nom,
    onNom: champ('nom'),
    pseudo: form.pseudo,
    onPseudo: champ('pseudo'),
    bio: form.bio,
    onBio: champ('bio'),
    phase: form.phase,
    onPhase: champ('phase'),
    phases: PHASES,
    ville: form.ville,
    onVille: champ('ville'),
    villes: villes.map((v) => ({ valeur: v.id, libelle: v.name })),
    arrivee: form.arrivee,
    onArrivee: champ('arrivee'),
    statuts: STATUTS.map((st) => ({
      ...st,
      choisi: form.statut === st.valeur,
      onChoisir: (): void => {
        setForm((f) => ({ ...f, statut: st.valeur }));
      },
    })),
    aide: form.aide,
    onAide: bascule('aide'),
    visible: form.visible,
    onVisible: bascule('visible'),
    onPhoto,
    onEnregistrer,
    bloque: envoi || form.nom.trim() === '',
    libelle: envoi ? 'Enregistrement…' : 'Enregistrer',
  };

  return { edition, rechargement };
}
