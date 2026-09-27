'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiClientError,
  advanceOnboarding,
  apiRequest,
  listCities,
  listCountries,
  requestOtp,
  updateMe,
  updateProfile,
  verifyOtp,
} from '@/lib/api';
import {
  type CityChoice,
  type CountryChoice,
  finalHandle,
  helpTypeCodes,
  occupationCode,
  type OnboardingState,
  type OnboardingVals,
  type ScreenActions,
  useOnboarding,
} from './data';
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


/** L'écran suivant, par chemin. L'ordre est celui de §5. */
const NEXT_PATH: Record<number, string> = {
  1: '/bienvenue/phase',
  2: '/bienvenue/lieu',
  3: '/bienvenue/objectif',
  4: '/bienvenue/profil',
  5: '/bienvenue/fin',
};

const PHASES = ['PRE_DEPARTURE', 'RECENT_ARRIVAL', 'SETTLED'] as const;

export interface FlowResult {
  readonly vals: OnboardingVals;
  readonly state: OnboardingState;
  /** Message d'erreur à afficher, ou `null`. Vient du serveur (§5.2). */
  readonly error: string | null;
}

/**
 * @param step Le numéro de l'écran courant, de 1 à 6 (§5).
 */
export function useOnboardingFlow(step: number, initialError: string | null = null): FlowResult {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

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

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.displayMessage
          : 'Connexion impossible. Vérifiez votre réseau et réessayez.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  /** P01 — envoi du code. */
  const onSubmit = useCallback(() => {
    void run(async () => {
      const phone = latest.current?.phone ?? '';
      if (phone.replace(/\D/g, '').length < 6) {
        setError('Entrez votre numéro de téléphone.');
        return;
      }

      // §5 : la case est obligatoire. On le dit ICI plutôt que de laisser l'API
      // refuser : le membre verrait sinon un message générique sans savoir quoi
      // corriger. L'API le vérifie aussi — un écran n'est pas une garantie.
      if (latest.current?.consentAccepted !== true) {
        setError('Vous devez accepter les conditions et la politique de confidentialité.');
        return;
      }

      const challenge = await requestOtp({
        phone,
        countryIso2: latest.current?.countryIso2 ?? 'BJ',
        // Turnstile en production ; le fournisseur fictif accepte n'importe quoi
        // en développement, et `loadEnv` refuse le démarrage s'il reste fictif
        // en production.
        captchaToken: 'dev',
        purpose: 'SIGNUP',
        acceptTerms: true,
      });

      sessionStorage.setItem(CHALLENGE_KEY, challenge.challengeId);
      router.push('/connexion/code');
    });
  }, [router, run]);

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

        const session = await verifyOtp({ challengeId, code });
        // Le défi est consommé : le garder invite à le rejouer.
        sessionStorage.removeItem(CHALLENGE_KEY);

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
  const onContinue = useCallback(() => {
    void run(async () => {
      const state = latest.current;

      // Chaque écran écrit ce qui lui appartient (§5). O03 crée le parcours, qui
      // relève du module 03 : rien à écrire ici pour l'instant.
      if (step === 2 && state !== null) {
        await updateMe({ phase: PHASES[state.phase] ?? 'PRE_DEPARTURE' });
      }

      if (step === 3 && state !== null) {
        const patch: Record<string, unknown> = {};
        // Le pays d'origine n'est envoyé que s'il a CHANGÉ du défaut : §2.7 ne
        // permet qu'une modification, et la consommer pour confirmer une valeur
        // déjà posée priverait le membre de sa seule correction.
        const current = await apiRequest<{ user: { originCountryId: string } }>('/me');
        const chosen = countryOptions.find((c) => c.iso2 === state.originIso2);
        if (chosen !== undefined && chosen.id !== current.user.originCountryId) {
          patch['originCountryId'] = chosen.id;
        }
        if (state.cityId !== null) patch['cityId'] = state.cityId;

        if (Object.keys(patch).length > 0) await updateMe(patch);
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
        if (state.displayName.trim().length >= 2) identity['displayName'] = state.displayName.trim();
        const handle = finalHandle(state.handle);
        if (handle.length >= 3) identity['handle'] = handle;
        if (Object.keys(identity).length > 0) await updateMe(identity);

        await updateProfile({
          occupationStatus: occupationCode(state.occupation),
          availableToHelp: state.help,
          // Les types d'aide ne valent que si la disponibilité est active : les
          // envoyer sinon enregistrerait une intention que l'écran ne montre plus.
          helpTypes: state.help ? helpTypeCodes(state.helpChoices) : [],
        });
      }

      await advanceOnboarding(step);
      router.push(NEXT_PATH[step] ?? '/accueil');
    });
  }, [router, run, step]);

  const actions: ScreenActions = useMemo(
    () => ({ busy, onSubmit, onContinue, countryOptions, cityCatalogue }),
    [busy, onSubmit, onContinue, countryOptions, cityCatalogue],
  );

  const { state, vals } = useOnboarding(actions);
  latest.current = state;

  /**
   * La vérification part au sixième chiffre, sans bouton : c'est ce que montre la
   * maquette de P02, qui n'en dessine aucun. Le garde `fired` évite de la lancer
   * deux fois — un rendu de plus la relancerait sur un défi déjà consommé, et le
   * membre verrait « ce code n'est pas le bon » alors qu'il l'était.
   */
  const fired = useRef<string | null>(null);
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

  return { state, error, vals: { ...vals, onCodeChange } };
}
