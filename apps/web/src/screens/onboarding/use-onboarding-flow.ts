'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleSchema, type LevelRequiredDetailsParsed } from '@app/shared';
import {
  ApiError,
  displayMessageFor,
  advanceOnboarding,
  fetchMe,
  creerCompetence,
  listCities,
  listCountries,
  listLanguages,
  listSkills,
  pseudoEstPris,
  requestOtp,
  updateMe,
  updateProfile,
  verifyOtp,
} from '@/lib/api';
import { obtenirJetonCaptcha } from '@/lib/captcha';
import { notifyError, notifySuccess } from '@/components/notifications';
import { createJourney, listJourneyTemplates } from '@/screens/parcours/api';
import {
  type CityChoice,
  type CountryChoice,
  finalHandle,
  helpTypeCodes,
  occupationCode,
  type OnboardingState,
  type OnboardingVals,
  type ScreenActions,
  etatPseudo,
  useOnboarding,
} from './data';
import type { ChoixItem } from './choix-referentiel';
import { toTemplateChoices, type JourneyTemplateChoice } from './from-api';
import { REASON_EXPIRED } from './resume';

/**
 * Le parcours d'inscription, branché sur l'API — 01-identite.md §5.
 *
 * Six écrans, cinq passables sauf le téléphone. L'avancement est enregistré côté
 * serveur à chaque écran franchi, parce que §5 le demande « pour reprendre là où
 * le membre s'est arrêté » : un membre qui ferme l'onglet à l'écran 4 ne doit pas
 * recommencer au 2.
 *
 * Le défi OTP vit dans `sessionStorage` entre P01 et P02, et NULLE PART ailleurs.
 * Ce n'est pas un secret — c'est un identifiant public, inutilisable sans le code
 * reçu par SMS — mais il ne survit pas à la fermeture de l'onglet, ce qui est
 * exactement sa durée de vie utile : le défi expire en 10 minutes (§2.1).
 */

const CHALLENGE_KEY = 'dp_otp_challenge';

/**
 * ─── CE QUE P02 DOIT SAVOIR, ET QUE SEUL P01 CONNAISSAIT ─────────────────────
 *
 * « Renvoyer » doit refaire `POST /auth/otp/request`, donc il lui faut le NUMÉRO
 * et son pays. Or P02 est une autre page : son état React naît vide, et le numéro
 * tapé sur P01 n'existe plus nulle part côté client.
 *
 * Il voyage donc dans `sessionStorage`, à côté du défi, et pour la même raison
 * déjà écrite plus haut : la durée de vie utile est celle de l'onglet. Ce n'est
 * pas un secret — c'est le numéro que le membre vient de taper lui-même, sur
 * l'écran d'avant, dans le même onglet — et il ne survit ni à la fermeture ni à un
 * autre onglet.
 *
 * `dp_otp_resend_at` est l'ÉCHÉANCE, en millisecondes epoch, et non un nombre de
 * secondes restantes. La différence est tout l'intérêt : une actualisation de la
 * page ne remet pas le compteur à 45, alors qu'un compteur en mémoire aurait
 * laissé un membre redemander un code à chaque rechargement — trois
 * rechargements, et les trois envois par heure et par numéro sont épuisés.
 */
const PHONE_KEY = 'dp_otp_phone';
const COUNTRY_KEY = 'dp_otp_country';
const RESEND_AT_KEY = 'dp_otp_resend_at';

/**
 * 45 secondes — c'est la maquette qui le dit, « Nouveau code dans 0:45 ».
 *
 * Le serveur n'expose AUCUN délai de renvoi : `POST /auth/otp/request` répond
 * `{ challengeId, expiresAt }`, et `expiresAt` est l'expiration du CODE (dix
 * minutes, §2.1), pas une permission de redemander. Le délai est donc celui de la
 * maquette, et il est volontairement plus court que la vraie limite — trois envois
 * par heure et par numéro : l'attente rend le dépassement improbable au lieu de
 * l'interdire, et le `429` reste traité pour les cas qui passent quand même.
 */
const RESEND_COOLDOWN_SECONDS = 45;

/** L'écran suivant, par chemin. L'ordre est celui de §5. */
const NEXT_PATH: Record<number, string> = {
  1: '/bienvenue/phase',
  2: '/bienvenue/lieu',
  3: '/bienvenue/objectif',
  4: '/bienvenue/profil',
  5: '/bienvenue/fin',
};

const PHASES = ['PRE_DEPARTURE', 'RECENT_ARRIVAL', 'SETTLED'] as const;

/**
 * L'écran O03, celui de l'objectif.
 *
 * Nommé plutôt qu'écrit en chiffre à trois endroits : c'est LUI qui charge les
 * modèles de parcours, et ce n'est pas un détail d'implémentation — appeler
 * `GET /journey-templates` depuis P01, avant l'OTP, enverrait un `401` puis un
 * rafraîchissement sans cookie, ce qui marque la session MORTE avant même
 * qu'elle naisse. Le membre verrait ensuite « session expirée » sur un écran
 * d'inscription, et la cause serait invisible.
 */
const STEP_OBJECTIF = 4;

/**
 * Les refus de `POST /journeys` qui ne doivent PAS arrêter l'inscription.
 *
 * Décidé sur le CODE, jamais sur le message (§5.2) : « Vous avez déjà un parcours
 * actif » est une phrase que l'équipe des textes peut réécrire demain, et un
 * `if (message === …)` casserait alors en silence — en bloquant l'inscription.
 */
const TOLERATED_ON_CREATE: ReadonlySet<string> = new Set([
  'PLAN_LIMIT_REACHED',
  'LOCATION_REQUIRED',
]);

/**
 * LE PSEUDO REFUSÉ MÉRITE SA PHRASE — trouvé en faisant le tour au navigateur.
 *
 * `PATCH /me` refuse un pseudo déjà pris par un `409 CONFLICT`, avec
 * `details: { field: 'handle', reason: 'HANDLE_TAKEN' }`. Le catalogue partagé
 * traduit `CONFLICT` par « Cette action n'est plus possible dans l'état actuel. »
 * — ce qui est juste pour la plupart des conflits et INCOMPRÉHENSIBLE ici : le
 * membre vient de taper un pseudo, il lit une phrase qui ne parle pas de pseudo, et
 * rien ne lui dit qu'il suffit d'en choisir un autre. L'inscription s'arrête au
 * cinquième écran sur six.
 *
 * Mesuré, pas supposé : le parcours de bout en bout est tombé exactement là, sur
 * un pseudo qu'une exécution précédente avait pris.
 *
 * On décide sur `code` PUIS sur `details.field` — jamais sur le message, qui est du
 * texte d'interface et sera réécrit (§5.2). Les autres conflits gardent la phrase du
 * catalogue : préciser ceux qu'on ne connaît pas serait inventer leur cause.
 */
const CONFLITS_DE_PSEUDO: Readonly<Record<string, string>> = {
  HANDLE_TAKEN: 'Ce pseudo est déjà pris. Choisissez-en un autre.',
  HANDLE_RESERVED: 'Ce pseudo est réservé. Choisissez-en un autre.',
};

function messagePourEchec(cause: unknown): string {
  if (cause instanceof ApiError && cause.is('CONFLICT') && cause.details['field'] === 'handle') {
    const raison = cause.details['reason'];
    const precise = typeof raison === 'string' ? CONFLITS_DE_PSEUDO[raison] : undefined;
    if (precise !== undefined) return precise;
  }
  return displayMessageFor(cause);
}

export interface FlowResult {
  readonly vals: OnboardingVals;
  readonly state: OnboardingState;
  /**
   * LE MOTIF DE REPRISE RENDU PAR LE SERVEUR, et lui seul.
   *
   * Tous les refus SURVENUS pendant le parcours passent maintenant par
   * `react-hot-toast` — choix du porteur, voir `components/notifications.tsx`.
   * Celui-ci ne peut pas : il arrive dans l'URL (`/connexion?reprise=…`), il est
   * rendu par le composant SERVEUR, et il doit figurer dans le premier octet de
   * HTML. Une notification est montée côté client, donc elle arriverait APRÈS —
   * et un test l'exige explicitement dans la réponse HTTP (`inscription.spec.ts`,
   * « affiche le motif de reprise rendu par le SERVEUR »).
   *
   * Il n'est donc JAMAIS réécrit après le premier rendu : la bannière porte la
   * raison d'être revenu là, les notifications portent ce qui échoue ensuite.
   */
  readonly error: string | null;
  /**
   * Les détails d'un `403 LEVEL_REQUIRED`, ou `null`.
   *
   * SÉPARÉS de `error`, et ce n'est pas du rangement : 00 §7.3 exige une
   * INVITATION à monter de niveau, « jamais une simple erreur ». Les mêler
   * aurait fait afficher « Cette action demande de vérifier votre compte » dans
   * la bannière orange des refus — une porte fermée là où il faut un chemin.
   */
  readonly levelRequired: LevelRequiredDetailsParsed | null;
  /** Ferme l'invitation sans rien changer au compte. */
  readonly dismissLevelRequired: () => void;
}

/**
 * @param step Le numéro de l'écran courant, de 1 à 6 (§5).
 */
export function useOnboardingFlow(step: number, initialError: string | null = null): FlowResult {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [levelRequired, setLevelRequired] = useState<LevelRequiredDetailsParsed | null>(null);

  /**
   * L'état vivant, lu par les gestionnaires.
   *
   * Une référence, et non la valeur capturée : `onSubmit` est mémoïsé et
   * lirait sinon le numéro tel qu'il était au premier rendu — donc toujours
   * vide. C'est le genre de bogue qui ne se voit qu'en tapant.
   */
  const latest = useRef<OnboardingState | null>(null);

  /**
   * Les pays proposés au sélecteur d'indicatif.
   *
   * Chargés une fois, sans bloquer l'écran : tant que la réponse n'est pas là, le
   * sélecteur affiche l'indicatif de la maquette. Un écran d'attente pour remplir
   * un menu serait disproportionné — surtout au premier écran d'une inscription,
   * où chaque seconde d'hésitation coûte un membre.
   *
   * Seuls les pays d'ORIGINE sont retenus : le sélecteur sert à composer un
   * numéro, et un pays de destination n'en fournit pas d'indicatif utile ici.
   * L'exception est la France, qui est aussi le pays de résidence — un membre déjà
   * installé a un numéro français, et l'API le gère.
   */
  const [countryOptions, setCountryOptions] = useState<readonly CountryChoice[]>([]);

  /**
   * Le catalogue des villes, chargé une fois.
   *
   * `activeOnly=false` : 02 §2.2 rend une ville inactive SÉLECTIONNABLE à
   * l'inscription. Au lancement aucune ne l'est — elles le deviennent vers 20
   * membres — donc filtrer sur l'activité rendrait une liste vide et l'écran
   * paraîtrait cassé.
   */
  const [cityCatalogue, setCityCatalogue] = useState<readonly CityChoice[]>([]);

  /**
   * LES COMPÉTENCES ET LES LANGUES — `GET /places/skills`, `GET /places/languages`.
   *
   * Le porteur : « L'ajout de compétences et langue ». Les deux routes
   * répondaient depuis toujours et personne ne les appelait : l'écran affichait
   * cinq noms écrits dans la maquette.
   *
   * Chargés une seule fois, à l'arrivée sur l'écran du profil (`step === 5`) :
   * ce sont les seuls écrans qui s'en servent, et les faire payer dès la première
   * page de l'inscription serait deux allers-retours pour rien.
   */
  const [skillCatalogue, setSkillCatalogue] = useState<readonly ChoixItem[]>([]);
  const [languageCatalogue, setLanguageCatalogue] = useState<readonly ChoixItem[]>([]);
  const referentielsCharges = useRef(false);

  useEffect(() => {
    if (step !== 5 || referentielsCharges.current) return;
    referentielsCharges.current = true;
    void Promise.all([listSkills(), listLanguages()])
      .then(([competences, langues]) => {
        setSkillCatalogue(
          competences.items.map((c) => ({ id: c.id, nom: c.nameFr, detail: c.category })),
        );
        setLanguageCatalogue(langues.items.map((l) => ({ id: l.id, nom: l.nameFr })));
      })
      .catch(() => {
        /**
         * Un catalogue qui n'arrive pas laisse les deux champs VIDES, et le champ
         * dit « Aucun résultat. » : le membre voit que rien n'est proposé, et il
         * peut continuer — compétences et langues sont facultatives. Crier ici
         * ferait passer pour cassé un écran qui s'enregistre très bien sans elles.
         */
        referentielsCharges.current = false;
      });
  }, [step]);

  useEffect(() => {
    let alive = true;
    void listCities()
      .then(({ items }) => {
        if (alive) setCityCatalogue(items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void listCountries()
      .then(({ items }) => {
        if (!alive) return;
        setCountryOptions(
          items.map((c) => ({
            id: c.id,
            iso2: c.iso2,
            nameFr: c.nameFr,
            dialCode: c.dialCode,
          })),
        );
      })
      // Un échec ici ne doit pas empêcher de s'inscrire : le sélecteur reste sur
      // l'indicatif dessiné, et le membre peut continuer.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Le catalogue des modèles de parcours (03 §2.1), chargé au seul écran O03.
   *
   * Vide ailleurs, et volontairement : voir `STEP_OBJECTIF`. Un échec ne doit pas
   * empêcher de s'inscrire — les cartes de la maquette s'affichent alors sans
   * nombre d'étapes, et « Continuer » n'essaiera simplement pas de créer.
   */
  const [templates, setTemplates] = useState<readonly JourneyTemplateChoice[]>([]);

  useEffect(() => {
    if (step !== STEP_OBJECTIF) return undefined;
    let alive = true;
    void listJourneyTemplates()
      .then((response) => {
        // La conversion vit dans `from-api.ts`, avec son test : c'est là que se
        // décide que le nombre d'étapes vient de la VERSION du modèle et non de
        // la maquette, et cette décision mérite mieux qu'un test de navigateur.
        if (alive) setTemplates(toTemplateChoices(response));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [step]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setLevelRequired(null);
    try {
      await work();
    } catch (cause) {
      /**
       * ON DÉCIDE SUR `error.code`, ET `displayMessageFor` FAIT LE RESTE.
       *
       * Deux corrections tiennent dans ces six lignes, et les deux étaient des
       * messages faux :
       *
       *   · `instanceof ApiError` ne rattrape PAS `ApiShapeError` — c'est
       *     délibéré dans le socle. Le repli « Connexion impossible » habillait
       *     donc un CONTRAT CASSÉ en panne de réseau : on faisait vérifier son
       *     wifi à un membre pendant que l'API avait changé de forme.
       *     `displayMessageFor` traite les trois échecs, chacun avec sa phrase ;
       *
       *   · un `429` sur `POST /auth/otp/request` (10 par HEURE et par IP) porte
       *     `Retry-After: 3600`. Le message du serveur dit « patientez un
       *     instant ». `ApiError.displayMessage` le remplace par « réessayez dans
       *     une heure », et chaque essai de trop coûte un SMS aux autres derrière
       *     le même NAT. On ne rejoue donc JAMAIS un `429` ici : l'erreur remonte
       *     telle quelle, sans nouvelle tentative.
       */
      const invitation = cause instanceof ApiError ? cause.levelRequired : null;
      if (invitation !== null) {
        // §7.3 : une invitation, pas une erreur. Aucune notification.
        setLevelRequired(invitation);
      } else {
        notifyError(messagePourEchec(cause));
      }
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * ─── LE COMPTE À REBOURS DE RENVOI ─────────────────────────────────────────
   *
   * Il DÉCOMPTE, et c'était le défaut : la maquette écrit « 0:45 » et le cadre
   * transcodé rendait ce texte figé. Un membre pouvait fixer un minuteur mort
   * pendant une minute en attendant qu'il arrive à zéro.
   *
   * L'échéance vit dans `sessionStorage` (voir `RESEND_AT_KEY`) et le temps
   * restant s'en DÉDUIT à chaque battement. Un compteur décrémenté en mémoire
   * aurait deux défauts que celui-ci n'a pas : il repartirait de 45 à chaque
   * rechargement, et il dériverait quand l'onglet passe en arrière-plan — les
   * navigateurs y ralentissent les intervalles, parfois à un par minute.
   */
  const resteAAttendre = useCallback((): number => {
    const raw = sessionStorage.getItem(RESEND_AT_KEY);
    if (raw === null) return 0;
    const echeance = Number(raw);
    if (!Number.isFinite(echeance)) return 0;
    return Math.max(0, Math.ceil((echeance - Date.now()) / 1000));
  }, []);

  const [resendIn, setResendIn] = useState(0);
  /** Bougé par `armResend` : c'est ce qui RELANCE l'intervalle arrêté à zéro. */
  const [resendTour, setResendTour] = useState(0);

  useEffect(() => {
    /**
     * LU DANS UN EFFET, et jamais dans l'état initial.
     *
     * `sessionStorage` n'existe pas au rendu serveur. Un `useState(() =>
     * resteAAttendre())` aurait rendu le serveur et le client différents, et
     * React aurait signalé une divergence d'hydratation sur une page
     * d'inscription — là où un écran qui clignote fait abandonner.
     */
    let battement = 0;
    const lire = () => {
      const reste = resteAAttendre();
      setResendIn(reste);
      // Arrivé à zéro, l'intervalle n'a plus rien à faire : on l'arrête plutôt
      // que de laisser un battement par seconde sur chacun des six écrans
      // d'inscription, pour toujours. `armResend` le relance.
      if (reste === 0 && battement !== 0) {
        window.clearInterval(battement);
        battement = 0;
      }
    };

    lire();
    // Deux battements par seconde : avec un seul, l'affichage peut rester deux
    // secondes sur le même chiffre selon le moment où l'échéance a été posée.
    if (resteAAttendre() > 0) battement = window.setInterval(lire, 500);

    return () => {
      if (battement !== 0) window.clearInterval(battement);
    };
  }, [resteAAttendre, resendTour]);

  /** Pose l'échéance et relance le battement. */
  const armResend = useCallback((seconds: number) => {
    sessionStorage.setItem(RESEND_AT_KEY, String(Date.now() + seconds * 1000));
    setResendIn(seconds);
    setResendTour((n) => n + 1);
  }, []);

  /**
   * La vérification part au sixième chiffre, sans bouton : c'est ce que montre la
   * maquette de P02, qui n'en dessine aucun. Le garde `fired` évite de la lancer
   * deux fois — un rendu de plus la relancerait sur un défi déjà consommé, et le
   * membre verrait « ce code n'est pas le bon » alors qu'il l'était.
   *
   * DÉCLARÉ ICI, au-dessus de `verify` et d'`onResend`, parce que les deux le
   * REMETTENT À ZÉRO — voir leurs commentaires. Il vivait sous le corps du
   * fichier, ce qui ne tenait que tant que personne n'avait besoin de l'oublier.
   */
  const fired = useRef<string | null>(null);

  /** P01 — envoi du code. */
  const onSubmit = useCallback(() => {
    void run(async () => {
      const phone = latest.current?.phone ?? '';
      if (phone.replace(/\D/g, '').length < 6) {
        notifyError('Entrez votre numéro de téléphone.');
        return;
      }

      // §5 : la case est obligatoire. On le dit ICI plutôt que de laisser l'API
      // refuser : le membre verrait sinon un message générique sans savoir quoi
      // corriger. L'API le vérifie aussi — un écran n'est pas une garantie.
      if (latest.current?.consentAccepted !== true) {
        notifyError('Vous devez accepter les conditions et la politique de confidentialité.');
        return;
      }

      const countryIso2 = latest.current?.countryIso2 ?? 'BJ';
      const challenge = await requestOtp({
        phone,
        countryIso2,
        // Turnstile (`lib/captcha.ts`) : jeton à usage unique tiré MAINTENANT. Sans
        // clé de site, le jeton de test officiel de Cloudflare.
        captchaToken: await obtenirJetonCaptcha(),
        purpose: 'SIGNUP',
        acceptTerms: true,
      });

      sessionStorage.setItem(CHALLENGE_KEY, challenge.challengeId);
      // Ce que P02 ne peut pas deviner : à qui renvoyer un code, et depuis quand
      // attendre. Voir `PHONE_KEY`.
      sessionStorage.setItem(PHONE_KEY, phone);
      sessionStorage.setItem(COUNTRY_KEY, countryIso2);
      armResend(RESEND_COOLDOWN_SECONDS);
      router.push('/connexion/code');
    });
  }, [armResend, router, run]);

  /**
   * P02 — « Renvoyer », le `<span>` qui n'était même pas un bouton.
   *
   * ── ON NE REJOUE JAMAIS UN `429`, ET L'ATTENTE PASSE AVANT L'APPEL ─────────
   *
   * `POST /auth/otp/request` est borné deux fois : `@RateLimit(10, 'hour', 'ip')`
   * sur la route, et trois envois par heure et par NUMÉRO dans le service. Le
   * dépassement répond `retryAfterSeconds: 3600` — une heure. Derrière un même
   * NAT, c'est une heure pour tout le monde.
   *
   * D'où trois précautions, et aucune n'est en double :
   *
   *   · le bouton est `disabled` tant que le compte à rebours tourne ;
   *   · ce gestionnaire REVÉRIFIE l'échéance avant d'appeler. Un clic programmé,
   *     un double événement ou un test qui force le clic ne doivent pas passer ;
   *   · un `429` ARME l'attente avec le délai du serveur au lieu d'être oublié :
   *     le bouton reste refusé pendant toute l'heure annoncée. Sans cela, le
   *     membre réessaierait en boucle et chaque essai prolongerait la fenêtre.
   *
   * ── LE MESSAGE N'EST PAS RÉÉCRIT ICI, ET UNE MUTATION M'A REPRIS ──────────
   *
   * Ce bloc composait sa propre phrase, avec ce raisonnement écrit noir sur
   * blanc : « `ApiError.rateLimitMessage` ne remplace le message du serveur que
   * si l'en-tête `Retry-After` est là ; le refus par NUMÉRO vient du service,
   * donc il n'en a pas, donc le membre lirait “patientez un instant” pour une
   * heure ». C'ÉTAIT FAUX, et la mutation l'a montré : remplacer ma phrase par
   * `cause.displayMessage` laissait le test VERT.
   *
   * La raison est dans `lib/api/transport.ts`, qui construit l'erreur :
   * `retryAfterSeconds` vient de l'en-tête OU, à défaut, de
   * `details.retryAfterSeconds`. Le socle couvrait donc déjà exactement le cas
   * que je croyais découvrir — et ma phrase était un second endroit où dire la
   * même chose, c'est-à-dire un endroit où elle finirait par diverger.
   *
   * L'erreur remonte donc telle quelle à `run`, qui l'affiche par
   * `displayMessageFor` : « Trop de tentatives. Réessayez dans une heure. » Le
   * message du serveur, lui, n'est jamais montré — et `e2e/code-otp.spec.ts` le
   * vérifie de bout en bout, sur l'écran.
   */
  const onResend = useCallback(() => {
    if (resteAAttendre() > 0) return;

    void run(async () => {
      const phone = sessionStorage.getItem(PHONE_KEY);
      if (phone === null || phone === '') {
        // L'onglet a été rouvert : on ne connaît plus le numéro, donc on ne peut
        // pas renvoyer. Le motif part dans l'URL, comme pour le défi perdu.
        router.push(`/connexion?reprise=${REASON_EXPIRED}`);
        return;
      }

      try {
        const challenge = await requestOtp({
          phone,
          countryIso2: sessionStorage.getItem(COUNTRY_KEY) ?? 'BJ',
          captchaToken: await obtenirJetonCaptcha(),
          purpose: 'SIGNUP',
          acceptTerms: true,
        });
        sessionStorage.setItem(CHALLENGE_KEY, challenge.challengeId);
        /**
         * LE GARDE DE DOUBLE VÉRIFICATION EST OUBLIÉ, et c'est nécessaire.
         *
         * Le défi d'avant est mort ; le code qui vient d'arriver peut être le
         * MÊME. En développement il l'est toujours — `SMS_FAKE_FIXED_CODE` vaut
         * `123456`. Sans cette ligne, retaper le nouveau code ne déclenchait
         * rien du tout : ni vérification, ni message.
         */
        fired.current = null;
        armResend(RESEND_COOLDOWN_SECONDS);
        notifySuccess('Un nouveau code vient de partir par SMS.');
      } catch (cause) {
        if (cause instanceof ApiError && cause.isRateLimited) {
          /**
           * `RESEND_COOLDOWN_SECONDS` en dernier recours, et pas 3 600.
           *
           * Un `429` sans aucun délai annonçable est le cas où l'on ne sait pas.
           * Verrouiller une heure « au cas où » punirait le membre d'une
           * incertitude qui est la nôtre ; 45 s le laisse réessayer une fois,
           * et le prochain refus réarmera avec ce que le serveur dira alors.
           */
          armResend(cause.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
        }
        throw cause;
      }
    });
  }, [armResend, resteAAttendre, router, run]);

  /**
   * P02 — « Changer de numéro », l'`<a href="#">` qui ne menait nulle part.
   *
   * Le défi en cours est EFFACÉ avant de revenir : le laisser derrière soi
   * laisserait un défi valide pour un numéro que le membre vient d'abandonner, et
   * c'est lui qu'une arrivée sur `/connexion/code` reprendrait.
   *
   * L'ÉCHÉANCE DE RENVOI, ELLE, SURVIT. Elle ne concerne pas un numéro mais une
   * cadence, et l'effacer offrirait un contournement évident : aller-retour vers
   * l'écran du numéro, et le compte à rebours repart de zéro. Elle sera de toute
   * façon réarmée par le prochain envoi.
   */
  const onChangeNumber = useCallback(() => {
    sessionStorage.removeItem(CHALLENGE_KEY);
    router.push('/connexion');
  }, [router]);

  /** P02 — vérification, dès le sixième chiffre. */
  const verify = useCallback(
    (code: string) => {
      void run(async () => {
        const challengeId = sessionStorage.getItem(CHALLENGE_KEY);
        if (challengeId === null) {
          // Le motif part dans l'URL, et non dans l'état : la navigation
          // remonte le composant et effacerait le message. Le membre se
          // retrouverait à l'écran du numéro sans savoir pourquoi — le pire
          // moment pour abandonner une inscription.
          router.push(`/connexion?reprise=${REASON_EXPIRED}`);
          return;
        }

        let session;
        try {
          session = await verifyOtp({ challengeId, code });
        } catch (cause) {
          /**
           * LE CODE REFUSÉ EST OUBLIÉ, et c'est la seconde moitié de « corriger
           * son code est possible ».
           *
           * Le garde `fired` existe pour ne pas vérifier deux fois le même code
           * sur un défi consommé. Mais après un REFUS, le défi n'est pas
           * consommé — et laisser le code dans le garde rendait l'écran muet :
           * le membre retapait exactement les mêmes six chiffres, et il ne se
           * passait rien. Pas de vérification, pas de notification, rien.
           *
           * Les cinq tentatives de §4.1 restent comptées par le SERVEUR, qui est
           * le seul endroit où elles signifient quelque chose.
           */
          fired.current = null;
          throw cause;
        }

        // Le défi est consommé : le garder invite à le rejouer.
        sessionStorage.removeItem(CHALLENGE_KEY);
        // Le numéro et la cadence n'ont plus d'objet : la session est ouverte.
        sessionStorage.removeItem(PHONE_KEY);
        sessionStorage.removeItem(COUNTRY_KEY);
        sessionStorage.removeItem(RESEND_AT_KEY);

        // On reprend là où le membre s'est arrêté, au lieu de le renvoyer
        // systématiquement à l'écran 2 : c'est toute la raison d'être de
        // `onboarding_step`.
        const next = session.onboarding.complete
          ? '/accueil'
          : (NEXT_PATH[Math.max(1, session.onboarding.step)] ?? '/bienvenue/phase');
        router.push(next);
      });
    },
    [router, run],
  );

  /** O01 à O04 — enregistrer, puis avancer. */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE RETOUR — IL N'EXISTAIT PAS, ET LE BOUTON ÉTAIT DESSINÉ SUR QUATRE     ║
   * ║ ÉCRANS                                                                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le bouton back ne marche pas dans l'onboarding. » Un lot
   * précédent l'avait refusé en le remontant — « `onBack` n'existe nulle part
   * dans `use-onboarding-flow.ts` » — et c'était la bonne conduite : il manquait
   * la décision, pas le code.
   *
   * `step` est l'étape vers laquelle l'écran AVANCE (O01 appelle
   * `useOnboardingFlow(2)`). L'écran précédent est donc `NEXT_PATH[step - 2]`.
   *
   * SUR O01 IL N'Y EN A PAS, et l'écran d'avant est le code SMS — sur une session
   * DÉJÀ OUVERTE. Y renvoyer redemanderait une vérification déjà faite. On emploie
   * alors l'historique du navigateur, ce qu'un chevron gauche signifie
   * littéralement : le membre revient d'où il vient, et rien ne se passe s'il est
   * arrivé par une URL directe — soit exactement le comportement d'aujourd'hui,
   * donc aucune régression possible dans ce cas.
   *
   * `router.push` et non `replace` : revenir en arrière est une navigation que le
   * membre a demandée, et elle doit pouvoir s'annuler par le retour du navigateur.
   */
  const onBack = useCallback(() => {
    const precedent = NEXT_PATH[step - 2];
    if (precedent === undefined) router.back();
    else router.push(precedent);
  }, [router, step]);

  const onContinue = useCallback(() => {
    void run(async () => {
      const state = latest.current;

      // Chaque écran écrit ce qui lui appartient (§5).
      if (step === 2 && state !== null) {
        await updateMe({ phase: PHASES[state.phase] ?? 'PRE_DEPARTURE' });
      }

      if (step === 3 && state !== null) {
        const patch: Record<string, unknown> = {};
        // Le pays d'origine n'est envoyé que s'il a CHANGÉ du défaut : §2.7 ne
        // permet qu'une modification, et la consommer pour confirmer une valeur
        // déjà posée priverait le membre de sa seule correction.
        // `force: true` : on veut la valeur du SERVEUR, pas celle qu'on croit
        // connaître. L'écran précédent a pu écrire, et décider de consommer l'unique
        // modification du pays d'origine sur une copie périmée serait la pire façon
        // de se tromper — elle est irréversible (§2.7).
        const current = await fetchMe({ force: true });
        const chosen = countryOptions.find((c) => c.iso2 === state.originIso2);
        if (chosen !== undefined && chosen.id !== current.user.originCountryId) {
          patch['originCountryId'] = chosen.id;
        }
        if (state.cityId !== null) patch['cityId'] = state.cityId;

        if (Object.keys(patch).length > 0) await updateMe(patch);
      }

      /**
       * Écran 4 — l'objectif, et la CRÉATION DU PARCOURS (03 §3.1).
       *
       * « Créer mon parcours maintenant » était une case qui ne créait rien. Elle
       * est maintenant tenue : `POST /journeys` part avec le modèle mis en avant
       * par la maquette, et le membre arrive sur O05 avec un vrai parcours.
       *
       * TROIS REFUS SONT NORMAUX ICI, et aucun ne doit arrêter l'inscription — le
       * parcours est un bonus de §5, pas une étape obligatoire (« le parcours
       * n'est jamais imposé », règle dure de 03 §1.2) :
       *
       *   · `PLAN_LIMIT_REACHED` — un parcours actif existe déjà en gratuit. Un
       *     membre qui repasse par O03 après avoir déjà créé son parcours le
       *     rencontre, et c'est le cas NORMAL. L'arrêter là lui interdirait de
       *     finir son inscription pour une raison qui n'en est pas une ;
       *   · `LOCATION_REQUIRED` — la ville n'a pas été renseignée à O02, qui est
       *     passable. Mesuré sur l'API : la création est refusée avant O02 ;
       *   · `LEVEL_REQUIRED`     — `journey.create` est L0 dans la matrice §7.3,
       *     donc ce refus ne devrait pas venir. S'il vient, c'est que la matrice a
       *     changé, et l'invitation du §7.3 s'affiche — sans bloquer l'écran.
       *
       * L'AVANCEMENT EST ENREGISTRÉ QUAND MÊME, et c'est là le point : `advance`
       * est APRÈS ce bloc, hors du chemin d'échec. Faire échouer l'écran sur un
       * `PLAN_LIMIT_REACHED` aurait bloqué l'inscription au quatrième écran sur six
       * — la pire façon de perdre un membre, pour un parcours qu'il a déjà.
       */
      if (step === STEP_OBJECTIF && state !== null && state.create) {
        /**
         * LE TYPE CHOISI, et non plus toujours le premier.
         *
         * C'était `templates[0]` — avec la conséquence écrite dans `data.ts` :
         * « le parcours créé est celui du PREMIER modèle servi ». Les cartes sont
         * désormais sélectionnables (le porteur l'a demandé, et la maquette le
         * dessinait déjà : état choisi, et une phrase qui NOMME le parcours
         * retenu). Créer autre chose que ce que cette phrase annonce serait le
         * pire des deux mondes.
         *
         * Le repli sur `templates[0]` demeure : un rang hors liste — une liste
         * rechargée entre-temps — ne doit pas annuler la création.
         */
        const chosen = templates[state.goal] ?? templates[0];
        /**
         * UN OBJECTIF QUI N'OUVRE PAS DE PARCOURS N'EN OUVRE PAS.
         *
         * « M'intégrer, rencontrer du monde » et « Aider les autres » sont des
         * objectifs de même rang (T5 §O03) mais `creates_journey` est faux : ils
         * ont une version publiée à zéro étape, et créer dessus donnerait un
         * parcours vide. La règle dure de §5 — « le parcours n'est jamais
         * imposé » — se tient ici, à l'endroit où la création part.
         */
        if (chosen !== undefined && !chosen.createsJourney) return;
        if (chosen !== undefined) {
          try {
            await createJourney({ templateId: chosen.id });
          } catch (cause) {
            if (!(cause instanceof ApiError)) throw cause;
            const invitation = cause.levelRequired;
            if (invitation !== null) setLevelRequired(invitation);
            else if (!TOLERATED_ON_CREATE.has(cause.code)) throw cause;
          }
        }
      }

      /**
       * Écran 5 — le profil (§5).
       *
       * Deux routes, parce que ce sont deux tables : `users` porte le nom et le
       * pseudo, `user_profiles` le statut et la disponibilité. L'ordre compte —
       * le pseudo peut être refusé (réservé, pris, délai de 30 jours), et
       * échouer AVANT d'écrire le profil évite un compte à moitié rempli.
       */
      if (step === 5 && state !== null) {
        const identity: Record<string, unknown> = {};
        if (state.displayName.trim().length >= 2)
          identity['displayName'] = state.displayName.trim();
        const handle = finalHandle(state.handle);
        if (handle.length >= 3) identity['handle'] = handle;
        if (Object.keys(identity).length > 0) await updateMe(identity);

        await updateProfile({
          occupationStatus: occupationCode(state.occupation),
          availableToHelp: state.help,
          // Les types d'aide ne valent que si la disponibilité est active : les
          // envoyer sinon enregistrerait une intention que l'écran ne montre plus.
          helpTypes: state.help ? helpTypeCodes(state.helpChoices) : [],
          /**
           * LES COMPÉTENCES ET LES LANGUES PARTENT ENFIN. `updateProfileSchema`
           * les acceptait depuis le début (`skillIds`, `languageIds`, dix au
           * plus) ; l'écran n'en envoyait aucune parce que rien ne s'y cochait.
           *
           * Les deux clés sont envoyées MÊME VIDES : c'est ainsi qu'un membre
           * retire sa dernière compétence. Les omettre voudrait dire « ne touche
           * à rien », et la ligne retirée reviendrait au rechargement.
           */
          skillIds: [...state.skillIds],
          languageIds: [...state.languageIds],
        });
      }

      await advanceOnboarding(step);
      router.push(NEXT_PATH[step] ?? '/accueil');
    });
    // `templates` est dans la liste : sans lui, `onContinue` garderait la liste
    // vide du premier rendu et la case « Créer mon parcours » ne créerait rien —
    // exactement le défaut qu'on vient de corriger, réintroduit par une clôture.
  }, [countryOptions, router, run, step, templates]);

  const actions: ScreenActions = useMemo(
    () => ({
      busy,
      onSubmit,
      onContinue,
      onBack,
      countryOptions,
      cityCatalogue,
      skillCatalogue,
      languageCatalogue,
      templates,
      resendIn,
      onResend,
      onChangeNumber,
    }),
    [
      busy,
      onSubmit,
      onContinue,
      onBack,
      countryOptions,
      cityCatalogue,
      /**
       * CES DEUX-LÀ MANQUAIENT, et c'est un défaut mesuré : `actions` est un
       * `useMemo`, donc il rend le MÊME objet tant que ses dépendances ne bougent
       * pas. Les deux catalogues arrivent APRÈS le premier rendu ; sans eux dans
       * cette liste, `actions` gardait les tableaux vides.
       *
       * Le symptôme a été trompeur : les suggestions s'affichaient quand même,
       * parce qu'une AUTRE dépendance changeait au même instant et forçait le
       * recalcul. Ça tenait par accident. Ce qui ne tenait pas : une compétence
       * créée à la main n'apparaissait jamais en pastille — le catalogue qui
       * sert à la nommer était celui d'avant.
       *
       * C'est la seconde fois dans ce lot qu'une dépendance omise coûte un
       * défaut silencieux. `react-hooks/exhaustive-deps` n'est pas configuré
       * dans ce dépôt ; REMONTÉ.
       */
      skillCatalogue,
      languageCatalogue,
      templates,
      resendIn,
      onResend,
      onChangeNumber,
    ],
  );

  const { state, patch, vals } = useOnboarding(actions);
  latest.current = state;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « ENVOYÉ AU … » NE DISAIT RIEN DU TOUT                                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La page d'onboarding "Entrez le code reçu" ne montre pas le
   * numéro, même anonymisé un peu. »
   *
   * MESURÉ au navigateur, après avoir demandé un code pour `0196377474` :
   * « Envoyé au » suivi de RIEN — et pas seulement après un rechargement, dès
   * l'arrivée sur l'écran.
   *
   * LA CAUSE : `/connexion` et `/connexion/code` sont DEUX PAGES. Chacune monte
   * son propre flux, donc son propre état, et le numéro tapé sur la première
   * n'existe pas dans la seconde. `phoneMasque` masquait une chaîne vide, ce que
   * `masqueNumero` rend comme chaîne vide — correctement, mais il n'avait rien à
   * masquer.
   *
   * Le numéro est pourtant DÉJÀ CONSERVÉ : `onPhoneSubmit` l'écrit dans
   * `sessionStorage` pour que « Renvoyer » puisse s'en servir. Il n'y avait donc
   * rien à stocker de plus — seulement à le relire au montage.
   *
   * ── POURQUOI `sessionStorage` ET NON L'URL ────────────────────────────────
   *
   * Un numéro de téléphone n'a rien à faire dans une adresse : elle s'écrit dans
   * l'historique, dans les journaux du serveur et dans ce qu'on recopie à
   * quelqu'un. `sessionStorage` meurt avec l'onglet, et c'est la durée de vie
   * d'un code OTP.
   */
  useEffect(() => {
    if (state.phone !== '') return;
    const garde = sessionStorage.getItem(PHONE_KEY);
    if (garde === null || garde === '') return;
    patch({ phone: garde, countryIso2: sessionStorage.getItem(COUNTRY_KEY) ?? state.countryIso2 });
    // `state.phone` suffit : on ne relit qu'une fois, quand il est vide.
  }, [state.phone, state.countryIso2, patch]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE PSEUDO EST VÉRIFIÉ — IL NE L'ÉTAIT PAS                                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le pseudo est vérifié ? » Non : la coche verte et le mot
   * « Disponible » de la maquette s'affichaient quoi qu'on tape. Le refus
   * n'arrivait qu'au `PATCH /me`, sur un écran que le membre avait quitté.
   *
   * ── TROIS PRÉCAUTIONS, ET CHACUNE ÉVITE UN DÉFAUT PRÉCIS ─────────────────
   *
   *   · 400 ms D'ATTENTE. Sans elles, chaque frappe part en requête : un pseudo
   *     de dix lettres ferait dix appels, et `GET /users/:handle` est borné comme
   *     le reste. On interroge quand la frappe s'arrête, pas pendant ;
   *   · `AbortController`. Deux pseudos tapés coup sur coup peuvent revenir dans
   *     le désordre, et la réponse du PREMIER déciderait de l'état du SECOND. Le
   *     signal coupe l'ancienne demande, exactement comme pour les étapes d'un
   *     parcours ;
   *   · LE PSEUDO DU MEMBRE LUI-MÊME. L'inscription lui en attribue un ; le
   *     retaper rendrait `200`, donc « déjà pris », sur son propre compte. On
   *     compare donc au pseudo courant avant d'appeler — et ce pseudo, c'est le
   *     flux qui le connaît, pas `pseudoEstPris`.
   */
  const [pseudoPris, setPseudoPris] = useState<boolean | null>(null);
  const [pseudoEnCours, setPseudoEnCours] = useState(false);
  const pseudoActuel = useRef<string | null>(null);

  useEffect(() => {
    const handle = state.handle;
    if (handle === '' || !handleSchema.safeParse(handle).success) {
      setPseudoPris(null);
      setPseudoEnCours(false);
      return undefined;
    }
    /** Son propre pseudo n'est pas « pris » : il est déjà à lui. */
    if (handle === pseudoActuel.current) {
      setPseudoPris(false);
      setPseudoEnCours(false);
      return undefined;
    }

    const stop = new AbortController();
    setPseudoEnCours(true);
    const minuteur = setTimeout(() => {
      void (async () => {
        const reponse = await pseudoEstPris(handle, stop.signal);
        if (stop.signal.aborted) return;
        setPseudoPris(reponse);
        setPseudoEnCours(false);
      })();
    }, 400);

    return () => {
      clearTimeout(minuteur);
      stop.abort();
    };
  }, [state.handle]);

  /**
   * Le pseudo que le membre a DÉJÀ. Lu une fois, à l'arrivée sur l'écran du
   * profil : `fetchMe` est mis en cache par le socle, donc cet appel ne coûte
   * rien s'il a déjà eu lieu.
   */
  useEffect(() => {
    if (step !== 5 || pseudoActuel.current !== null) return;
    void fetchMe()
      .then((me) => {
        pseudoActuel.current = me.user.handle;
      })
      .catch(() => {
        // Sans lui, retaper son propre pseudo s'affiche « déjà pris ». C'est
        // gênant, pas bloquant : on n'en fait pas une erreur à l'écran.
      });
  }, [step]);

  const onCodeChange = useCallback(
    (event: { target: { value: string } }) => {
      vals.onCodeChange(event);
      const code = event.target.value.replace(/\D/g, '').slice(0, 6);
      if (code.length === 6 && fired.current !== code) {
        fired.current = code;
        verify(code);
      }
    },
    [vals, verify],
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CRÉER UNE COMPÉTENCE À SOI, ET LA RETENIR AUSSITÔT                      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Les compétences doivent aussi supporter le free typing qui crée
   * de nouvelles compétences que les administrateurs peuvent globaliser. »
   *
   * TROIS GESTES EN UN, et l'ordre compte : le serveur crée (ou rend la ligne qui
   * portait déjà ce nom), on l'AJOUTE AU CATALOGUE — sans quoi `resoudre` ne
   * saurait pas la nommer et la pastille sortirait vide —, puis on la retient.
   *
   * `patch` plutôt que la prise `onAjouterCompetence` : celle-ci lit l'état du
   * rendu courant, qui ne connaît pas encore la nouvelle ligne. On écrit donc
   * directement, en relisant l'état le plus frais par `latest`.
   */
  const onCreerCompetence = useCallback(
    async (nom: string): Promise<void> => {
      try {
        const creee = await creerCompetence(nom);
        setSkillCatalogue((avant) =>
          avant.some((c) => c.id === creee.id)
            ? avant
            : [...avant, { id: creee.id, nom: creee.nameFr, detail: creee.category }],
        );
        const deja = latest.current?.skillIds ?? [];
        if (!deja.includes(creee.id) && deja.length < 10) {
          patch({ skillIds: [...deja, creee.id] });
        }
      } catch (cause) {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'Cette compétence n’a pas pu être créée.',
        );
      }
    },
    [patch],
  );

  const dismissLevelRequired = useCallback(() => setLevelRequired(null), []);

  return {
    state,
    error: initialError,
    levelRequired,
    dismissLevelRequired,
    vals: {
      ...vals,
      onCodeChange,
      /**
       * CE QUE LE SERVEUR A RÉPONDU RECOUVRE L'ÉTAT PAR DÉFAUT. `onboardingVals`
       * est une fonction PURE : elle ne connaît que la forme du pseudo. La
       * disponibilité, elle, ne se sait qu'ici.
       */
      ...etatPseudo(state.handle, pseudoPris, pseudoEnCours),
      onCreerCompetence,
    },
  };
}
