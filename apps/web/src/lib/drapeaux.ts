'use client';

import { useEffect, useState } from 'react';
import { myFlagsSchema } from '@app/shared';
import { memberApi } from '@/lib/api/index';

/**
 * LES FEATURE FLAGS, CÔTÉ WEB — 15 §4.3.
 *
 * Le web ne reçoit JAMAIS la règle (conditions, pourcentage), seulement son RÉSULTAT pour
 * le membre connecté : `GET /me/flags` rend `{ flags: { clé: booléen } }`, évalué par
 * `FeatureFlagService` côté serveur. « Le front prévient, le serveur décide » : un drapeau
 * qui coupe une fonctionnalité en incident doit aussi être refusé par la route — le web ne
 * fait qu'éviter de dessiner ce qui ne marchera pas.
 *
 * Une lecture par chargement, partagée (une promesse mémorisée) ; le cache de l'API est de
 * une minute. Un drapeau inconnu — ou une lecture en échec — rend `defaut`.
 */
let lecture: Promise<Record<string, boolean>> | null = null;

function lireDrapeaux(): Promise<Record<string, boolean>> {
  lecture ??= memberApi.get('/me/flags', myFlagsSchema).then(
    (r) => r.flags,
    () => ({}),
  );
  return lecture;
}

export function useDrapeau(cle: string, defaut: boolean): boolean {
  const [valeur, setValeur] = useState(defaut);
  useEffect(() => {
    let annule = false;
    void lireDrapeaux().then((f) => {
      if (!annule && cle in f) setValeur(f[cle] === true);
    });
    return () => {
      annule = true;
    };
  }, [cle]);
  return valeur;
}
