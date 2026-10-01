'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { chargerJ09Fiche } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { J09MobileFiche } from '@/screens/j09/mobilefiche.generated';

/**
 * `/parcours/publics/:id` — la vue publique d'un parcours (§3.7).
 *
 * ── LA FICHE N'A PAS LA FORME DE LA LISTE, ET C'EST MESURÉ ─────────────────
 *
 * `GET /journeys/public/:id` rend `currentStep { id, title, position }` ;
 * `GET /journeys/public` NE LE REND PAS. C'est exactement le piège déjà payé entre
 * `GET /journeys` et `GET /journeys/:id`, une seconde fois dans le même module et
 * sur d'autres clés — et il se voit de la même façon : pas du tout, puisque
 * `z.array(item)` accepte `[]`. Les deux schémas existent dans `@app/shared`,
 * l'un étend l'autre, et le test de fixtures fige l'écart DANS LES DEUX SENS.
 *
 * ── UNE SEULE PLANCHE, ET C'EST UN MANQUE DE LA MAQUETTE ───────────────────
 *
 * Elle ne dessine cette vue qu'en 390 px. On ne lui invente pas un cadre
 * d'ordinateur — la planche unique s'étire, comme `ScreenFrames` le fait déjà pour
 * O05, qui n'a pas non plus de cadre mobile. Consigné dans `docs/decisions.md`.
 *
 * ── CE QUE LE TITRE NE DIT PAS ─────────────────────────────────────────────
 *
 * RÈGLE DURE §3.7 : jamais le titre personnel. La maquette titre « Parcours de
 * Fatou » — le PRÉNOM du membre, pas le nom que Fatou a donné à son parcours — et
 * affiche « Parcours Études · Lyon ». La donnée liée est donc le nom AFFICHÉ du
 * membre, et le serveur ne rend même pas `title` : il n'y a rien à retenir.
 *
 * `member.handle` sert de repli quand `displayName` est vide — la charge relevée en
 * contient un, sur un compte qui n'a pas rempli son profil.
 */
export default function Page() {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const charger = useCallback(() => chargerJ09Fiche(journeyId), [journeyId]);

  return (
    <EcranParcoursDonnees
      screen="J09F"
      charger={charger}
      desktop={(d) => <J09MobileFiche {...d} />}
    />
  );
}
