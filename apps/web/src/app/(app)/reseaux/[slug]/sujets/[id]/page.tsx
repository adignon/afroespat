'use client';

import { use } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A09Desktop } from '@/screens/a09/desktop.generated';
import { A09Mobile } from '@/screens/a09/mobile.generated';
import { a09Fallback } from '@/screens/a09/data';
import { useSujet } from '@/screens/reseaux/use-sujet';

/**
 * A09 — un sujet du réseau. `/reseaux/:slug/sujets/:id`
 *
 * « vue auteur + modérateur », dit la maquette : les actions de modération —
 * épingler, clore, masquer — sont dessinées dans le même cadre. Elles sont
 * MONTRÉES d'après `canPin` et `canResolve`, que le serveur recalcule à chaque
 * lecture du sujet, et jamais d'après un rôle gardé en mémoire.
 *
 * ── LE REFUS N'EST PAS UNE PAGE VIDE ───────────────────────────────────────
 *
 * `GET /topics/:id` est la porte de derrière : elle atteint un sujet sans passer
 * par son réseau. Elle refuse un non-membre par `403 NOT_A_MEMBER` — et cette
 * page l'affiche comme tel, sans chercher ailleurs ce que la route a refusé. Il
 * n'y a pas d'ailleurs, et en inventer un serait contourner la garde.
 */
export default function SujetPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string; readonly id: string }>;
}) {
  const { slug, id } = use(params);
  const { data, pret, refuse, introuvable, echec } = useSujet(id);
  const props = pret && echec === null ? data : a09Fallback;

  if (refuse) {
    return (
      <p role="status" style={{ padding: '24px', color: '#16211D', fontSize: '14px' }}>
        Ce sujet appartient à un réseau que vous n’avez pas rejoint.{' '}
        <a href={`/reseaux/${slug}`} style={{ color: '#0F5C48', fontWeight: 700 }}>
          Voir le réseau
        </a>
      </p>
    );
  }

  /**
   * « Introuvable », et jamais « accès refusé ».
   *
   * Sur un réseau `INVITE_ONLY`, le 404 EST le refus — il est choisi pour ne pas
   * confirmer l'existence du réseau. Écrire « vous n'y avez pas accès »
   * annulerait tout le bénéfice de ce choix en révélant que quelque chose existe.
   */
  if (introuvable) {
    return (
      <p role="status" style={{ padding: '24px', color: '#16211D', fontSize: '14px' }}>
        Ce sujet est introuvable.
      </p>
    );
  }

  return (
    <ScreenFrames
      screen="A09"
      desktop={<A09Desktop {...props} />}
      mobile={<A09Mobile {...props} />}
    />
  );
}
