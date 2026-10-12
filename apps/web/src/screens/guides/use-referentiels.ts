'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { memberApi } from '@/lib/api/member';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LES FILTRES « PAYS » ET « VILLE » PROPOSENT                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « rends aussi la page, les filtres etc. dynamique ».
 *
 * Les deux listes viennent des RÉFÉRENTIELS — `GET /places/countries` et
 * `GET /places/cities` —, jamais d'une table recopiée dans le front : ce sont
 * les mêmes identifiants que `guideListQuerySchema` attend, et une copie
 * divergerait au premier pays ouvert.
 *
 * ── UN ÉCHEC NE VIDE PAS LA PAGE ───────────────────────────────────────────
 *
 * Les listes restent vides, les deux pastilles n'offrent que leur option
 * « tout », et la liste des guides s'affiche. Une page de documentation ne doit
 * pas tomber parce qu'un référentiel n'a pas répondu.
 */
/**
 * `passthrough()` ET NON `strict()` : ces deux routes rendent bien plus que ce
 * qu'une pastille de filtre affiche — région, indicatif, nombre de membres — et
 * refuser ces champs ferait tomber le filtre au premier enrichissement du
 * référentiel. On déclare ce qu'on LIT, et on laisse passer le reste.
 */
const paysSchema = z
  .object({ items: z.array(z.object({ id: z.string(), nameFr: z.string() }).passthrough()) })
  .passthrough();

const villesSchema = z
  .object({ items: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()) })
  .passthrough();

export function useReferentielsGuides(): {
  readonly pays: readonly { readonly id: string; readonly nameFr: string }[];
  readonly villes: readonly { readonly id: string; readonly name: string }[];
} {
  const [pays, setPays] = useState<readonly { id: string; nameFr: string }[]>([]);
  const [villes, setVilles] = useState<readonly { id: string; name: string }[]>([]);

  useEffect(() => {
    let vivant = true;
    void memberApi
      .get('/places/countries', paysSchema)
      .then((r) => {
        if (vivant) setPays(r.items.map((p) => ({ id: p.id, nameFr: p.nameFr })));
      })
      .catch(() => undefined);
    void memberApi
      .get('/places/cities?limit=100', villesSchema)
      .then((r) => {
        if (vivant) setVilles(r.items.map((v) => ({ id: v.id, name: v.name })));
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  return { pays, villes };
}
