'use client';

import { useEffect, useState } from 'react';
import { O05AvecParcours } from '@/screens/o05/avecparcours.generated';
import { O05SansParcours } from '@/screens/o05/sansparcours.generated';
import { useOnboardingFlow } from '@/screens/onboarding/use-onboarding-flow';
import { ScreenFrames } from '@/screens/frames';
import { FlowError } from '@/screens/onboarding/flow-error';
import { LevelInvitation } from '@/components/level-invitation';
import { listJourneys } from '@/screens/parcours/api';

/**
 * Les deux atterrissages de §5, écran 6.
 *
 * DEUX variantes, et c'est une règle dure : « le parcours n'est jamais imposé ».
 * Avec parcours, on arrive sur la première étape ; sans, sur le réseau de la
 * ville, trois événements et un parrain suggéré. Les deux sont de vrais
 * atterrissages, pas un principal et un dégradé.
 *
 * La maquette ne donne pas de cadre mobile pour cet écran : les deux variantes
 * font 700 px. Le cadre unique s'étire donc, sans bascule au seuil de 1024 px.
 *
 * ── LA VARIANTE VIENT DE `GET /journeys`, ET D'ELLE SEULE ───────────────────
 *
 * Elle était décidée par `?parcours=non`, c'est-à-dire par l'URL. C'était juste
 * pour montrer la planche, et faux pour un membre : celui qui avait décoché
 * « Créer mon parcours » à O03 atterrissait quand même sur « votre parcours est
 * prêt », avec un bouton vers un parcours qui n'existait pas.
 *
 * Le paramètre ne fait plus que donner la valeur de DÉPART, le temps que la liste
 * réponde — il évite un écran vide, rien de plus. Une première version le traitait
 * comme une dérogation qui court-circuitait l'appel, et c'était une mauvaise idée
 * pour deux raisons :
 *
 *   · elle rendait l'écran dépendant d'une URL que personne ne construit. La
 *     planche « sans parcours » est atteignable par le vrai chemin — décocher la
 *     case à O03 — donc elle n'a pas besoin d'un paramètre pour exister ;
 *   · elle rendait le test de bout en bout CREUX. Sa variante par défaut était
 *     celle qu'il attendait, donc il passait même quand l'appel échouait. Et
 *     l'appel échouait : `journeysListResponseSchema` décrivait la forme du DÉTAIL
 *     et non celle de la LISTE, ce qui ne se voit pas sur une liste vide. Le test
 *     mesurait la valeur par défaut, pas le branchement.
 *
 * Une bascule à la première réponse reste possible, et c'est assumé : les deux
 * variantes sont des atterrissages complets, et un écran vide au dernier écran
 * d'une inscription serait bien pire — c'est le piège des cinq pages blanches.
 */
export function FinScreen({ withJourney }: { readonly withJourney: boolean }) {
  // Écran 6 : le dernier. `onContinue` y marque l'onboarding terminé.
  const { vals, error, levelRequired, dismissLevelRequired } = useOnboardingFlow(6);

  const [hasJourney, setHasJourney] = useState(withJourney);

  useEffect(() => {
    let alive = true;
    void listJourneys()
      .then(({ items }) => {
        if (alive) setHasJourney(items.length > 0);
      })
      // Un échec laisse la valeur de départ. Ne pas savoir n'est pas une raison de
      // montrer l'autre planche : ce serait deviner. Mais l'échec n'est plus
      // invisible pour autant — le test l'exerce dans le sens où il compte.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <ScreenFrames
        screen="O05"
        desktop={hasJourney ? <O05AvecParcours {...vals} /> : <O05SansParcours {...vals} />}
      />
      <FlowError message={error} />
      <LevelInvitation details={levelRequired} onClose={dismissLevelRequired} />
    </>
  );
}
