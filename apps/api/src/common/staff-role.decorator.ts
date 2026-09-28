import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import type { StaffRoleValue } from '@app/shared';

/**
 * Déclaration de rôle d'équipe sur une route — 15-administration.md §2.2 et
 * 00-fondations.md §7.4.
 *
 * Le pendant exact de `@RequiresCapability` pour l'autre domaine de sécurité.
 * Deux décorateurs et non un seul, parce que les deux domaines sont
 * HERMÉTIQUES (règle dure 15 §2.1) : un membre a un niveau de vérification et
 * aucun rôle, un compte équipe a un rôle et aucun niveau. Un décorateur unique
 * qui accepterait « une capacité OU un rôle » serait précisément la passerelle
 * que la règle interdit — et il suffirait d'un argument mal recopié pour ouvrir
 * une route d'équipe à tout compte L0.
 *
 * La déclaration est EXPLICITE et par liste : `@RequiresStaffRole('SUPER_ADMIN',
 * 'MODERATOR')`. Pas de hiérarchie, pas de « au moins ce rôle » — les quatre
 * rôles du §2.2 ne sont pas ordonnés (un `SUPPORT` valide une fiche pro, un
 * `MODERATOR` non ; un `MODERATOR` suspend, un `SUPPORT` non). Les listes
 * nommées de `STAFF_SCOPES` évitent de recopier la matrice route par route.
 *
 * Trois métadonnées d'un coup :
 *   · `STAFF_ROLE_KEY`, que `StaffGuard` lit à l'exécution ;
 *   · `x-staff-role` dans l'OpenAPI, pour que le front équipe cache ce que le
 *     rôle courant ne peut pas faire (T4 §9) ;
 *   · `x-capability`, avec un sentinelle `staff:…`.
 *
 * Ce dernier point mérite sa phrase : le test de couverture du §7.3 exige que
 * TOUTE route porte un `x-capability`, pour qu'une omission soit toujours une
 * erreur. Une route d'équipe n'a pas de capacité de membre — mais elle a bien
 * une autorisation déclarée, et la taire ferait échouer le test pour une bonne
 * raison au mauvais endroit. La valeur `staff:RÔLE|RÔLE` la dit, dans le même
 * champ, sans jamais pouvoir être confondue avec une vraie capacité : aucune
 * capacité de `@app/shared` ne commence par `staff:`, et `@PublicRead()` emploie
 * déjà le même procédé avec `none:public-read`.
 */

export const STAFF_ROLE_KEY = 'app:staffRole';

/** Préfixe du sentinelle `x-capability`. Jamais une capacité de membre. */
export const STAFF_CAPABILITY_PREFIX = 'staff:';

export function RequiresStaffRole(...roles: readonly [StaffRoleValue, ...StaffRoleValue[]]) {
  // Trié et dédoublonné : deux routes au même périmètre écrivent alors le même
  // `x-capability`, quel que soit l'ordre des arguments. Un document OpenAPI qui
  // change parce qu'on a permuté deux rôles fait diverger les clients générés.
  const normalized = [...new Set(roles)].sort();
  return applyDecorators(
    SetMetadata(STAFF_ROLE_KEY, normalized),
    ApiExtension('x-staff-role', normalized.join('|')),
    ApiExtension('x-capability', `${STAFF_CAPABILITY_PREFIX}${normalized.join('|')}`),
  );
}
