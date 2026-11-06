'use client';

import { useEffect, useState } from 'react';
import { myConnectionsResponseSchema } from '@app/shared';
import { hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import { contactsPartageFrom, type PersonneCarte } from './from-api';

/**
 * LES CONTACTS DE LA FENÊTRE « PARTAGER » — tous, pas seulement ceux « en ligne ».
 *
 * `GET /me/connections` est lu à l'ouverture de la fenêtre (une fois : un membre sans
 * contact rend une liste vide, qui est une réponse). Tant qu'il n'a pas répondu, ou s'il
 * échoue, `repli` — les contacts en ligne de la colonne — garde la fenêtre utile.
 * La recherche de la fenêtre porte alors sur tous les contacts chargés.
 */
export function useContactsPartage(
  actif: boolean,
  repli: readonly PersonneCarte[],
): readonly PersonneCarte[] {
  const [contacts, setContacts] = useState<readonly PersonneCarte[] | null>(null);
  const [essaye, setEssaye] = useState(false);

  useEffect(() => {
    if (!actif || essaye) return undefined;
    setEssaye(true);
    let vivant = true;
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const page = await memberApi.get('/me/connections?limit=50', myConnectionsResponseSchema);
        if (vivant) setContacts(contactsPartageFrom(page.items));
      } catch {
        // Un confort qui n'aboutit pas ne parle pas : le repli reste affiché.
      }
    })();
    return () => {
      vivant = false;
    };
  }, [actif, essaye]);

  return contacts ?? repli;
}
