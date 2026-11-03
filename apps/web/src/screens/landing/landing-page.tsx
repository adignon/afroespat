'use client';

import type { PublicLanding } from '@app/shared';
import { useLandingVals } from './data';
import { LandingView } from './landing.generated';
import './landing.css';

/** La page d'accueil des visiteurs : le dessin transcodé de la maquette, alimenté par les données publiques. */
export function LandingPage({ landing }: { readonly landing: PublicLanding }) {
  return <LandingView {...useLandingVals(landing)} />;
}
