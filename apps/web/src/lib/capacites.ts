'use client';

import { useEffect, useState } from 'react';
import {
  CAPABILITIES,
  levelSatisfies,
  type Capability,
  type VerificationLevel,
} from '@app/shared';
import { fetchMe } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FRONT PRÉVIENT, LE SERVEUR REFUSE                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « en N0 par exemple les boutons de publications (stories, fil
 * d'actualité et autres) non inclus dans ses autorisations doivent être
 * désactivés et on vérifie aussi côté serveur s'il peut faire les actions.
 * Pareil pour N1. Quand il clique un pop-up doit apparaître pour lui dire que
 * pour accéder à cette fonctionnalité il faut être de tel niveau avec les
 * conditions et un bouton pour passer à niveau dans ses paramètres. »
 *
 * ── CE MODULE N'AUTORISE RIEN, ET C'EST UNE RÈGLE ÉCRITE AILLEURS ─────────
 *
 * `lib/api/session.ts` la pose en toutes lettres : « le niveau ne sert JAMAIS à
 * autoriser, seulement à expliquer ». Elle tient, et ce module la respecte :
 *
 *   · la seule protection reste `@RequiresCapability` côté serveur, et un test
 *     d'intégration échoue si une route d'écriture n'en déclare pas ;
 *   · ici, le niveau sert à ÉTEINDRE un bouton et à dire pourquoi — c'est de
 *     l'explication, pas de l'autorisation ;
 *   · et si la copie est périmée — un membre rétrogradé entre deux lectures —
 *     le bouton reste allumé, l'action part, et le `403 LEVEL_REQUIRED` tranche.
 *     `forgetRights()` jette alors la copie. L'erreur possible va donc toujours
 *     dans le sens sûr : jamais une action interdite qui passe.
 *
 * ── LA LECTURE VIENT DE `fetchMe`, QUI A SON PROPRE CACHE ─────────────────
 *
 * On ne garde pas de copie de plus. `fetchMe()` sert la dernière réponse `/me`
 * connue et la jette à chaque `TOKEN_STALE` ou `LEVEL_REQUIRED` : le niveau lu
 * ici est donc celui que le reste de l'application croit, pas un second qui
 * pourrait diverger.
 */
export interface Capacites {
  /** `null` tant que `/me` n'a pas répondu : on n'éteint rien sur une supposition. */
  readonly niveau: VerificationLevel | null;
  /** Vrai tant que le niveau n'est pas connu, ou qu'il suffit. */
  readonly peut: (capacite: Capability) => boolean;
}

export function useCapacites(): Capacites {
  const [niveau, setNiveau] = useState<VerificationLevel | null>(null);

  useEffect(() => {
    let vivant = true;
    void fetchMe()
      .then((me) => {
        if (vivant) setNiveau(me.user.verificationLevel);
      })
      .catch(() => {
        /**
         * UN ÉCHEC DE LECTURE N'ÉTEINT RIEN. Si `/me` ne répond pas, `niveau`
         * reste `null` et tous les boutons restent allumés : le serveur fera
         * son travail. Griser l'interface sur une panne de lecture punirait le
         * membre d'un incident qui n'est pas le sien.
         */
      });
    return () => {
      vivant = false;
    };
  }, []);

  return {
    niveau,
    peut: (capacite) => (niveau === null ? true : levelSatisfies(niveau, capacite)),
  };
}

/**
 * LES CONDITIONS À REMPLIR, par niveau — ce que le porteur appelle « avec les
 * conditions ». Elles ne sont pas inventées : ce sont les deux marches que le
 * module Vérification (K03) fait franchir, dans ses mots.
 */
export const CONDITIONS_NIVEAU: Record<VerificationLevel, string> = {
  L0: 'Votre numéro de téléphone est confirmé.',
  L1: 'Vérifiez votre identité avec une pièce officielle — quelques minutes, depuis votre téléphone.',
  L2: 'Ajoutez un justificatif de présence dans votre pays d’accueil (quittance, attestation, contrat).',
};

/** Le libellé d'une capacité, pour la phrase de l'invitation. */
export function libelleCapacite(capacite: Capability): string {
  return CAPABILITIES[capacite].labelFr;
}

/** Le niveau exigé, dans les mots du porteur (« N1 » plutôt que « L1 »). */
export function niveauEcrit(niveau: VerificationLevel): string {
  return niveau.replace('L', 'N');
}
