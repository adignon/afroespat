'use client';

import { O05AvecParcours } from '@/screens/o05/avecparcours.generated';
import { O05SansParcours } from '@/screens/o05/sansparcours.generated';
import { useOnboarding } from '@/screens/onboarding/data';
import { ScreenFrames } from '@/screens/frames';

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
 */
export function FinScreen({ withJourney }: { readonly withJourney: boolean }) {
  const { vals } = useOnboarding();

  return (
    <ScreenFrames
      screen="O05"
      desktop={withJourney ? <O05AvecParcours {...vals} /> : <O05SansParcours {...vals} />}
    />
  );
}
