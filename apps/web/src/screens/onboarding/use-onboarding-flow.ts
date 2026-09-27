'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiClientError,
  advanceOnboarding,
  requestOtp,
  updateMe,
  verifyOtp,
} from '@/lib/api';
import {
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

      const challenge = await requestOtp({
        phone,
        // TODO(pays) : l'indicatif est encore celui que la maquette dessine.
        // Le sélecteur de pays réel demande une liste depuis /places/countries
        // et un menu qui n'existe pas dans la maquette — à traiter à part.
        countryIso2: 'BJ',
        // Turnstile en production ; le fournisseur fictif accepte n'importe quoi
        // en développement, et `loadEnv` refuse le démarrage s'il reste fictif
        // en production.
        captchaToken: 'dev',
        purpose: 'SIGNUP',
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

      await advanceOnboarding(step);
      router.push(NEXT_PATH[step] ?? '/accueil');
    });
  }, [router, run, step]);

  const actions: ScreenActions = useMemo(
    () => ({ busy, onSubmit, onContinue }),
    [busy, onSubmit, onContinue],
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
