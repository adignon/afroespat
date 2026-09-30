/**
 * CE QU'UN ÉCRAN DOIT SAVOIR D'UN ÉCHEC POUR LE MONTRER CORRECTEMENT.
 *
 * La forme (`FilEchec`) est celle que `screens/accueil/use-fil.ts` a fixée au lot
 * précédent, et elle est RÉUTILISÉE plutôt que redéclarée : deux formes d'échec
 * dans le même front, ce sont deux endroits où décider si un `429` se rejoue.
 * L'import est `import type`, donc il disparaît à la compilation — aucun couplage
 * d'exécution avec le crochet du fil, sur lequel quatre lots travaillent.
 *
 * La fonction, elle, est écrite ici parce que `use-fil.ts` ne l'exporte pas et
 * qu'on ne modifie pas un fichier partagé pour y ajouter une sortie.
 *
 * ── LES TROIS DÉCISIONS QU'ELLE PREND, ET AUCUNE AUTRE ─────────────────────
 *
 * 1. `ApiShapeError` D'ABORD, et il n'hérite PAS d'`ApiError` — c'est le socle qui
 *    en a décidé ainsi. Un `catch (e) { if (e instanceof ApiError) … }` ne peut
 *    donc pas transformer une rupture de contrat en message métier rassurant : un
 *    contrat cassé est un INCIDENT, pas une règle refusée.
 *
 * 2. On décide sur `error.code`, JAMAIS sur le message (§5.2). `displayMessageFor`
 *    compose la phrase française, y compris pour un `429` — dont le message du
 *    serveur dit « patientez un instant » pour une attente qui peut valoir une
 *    HEURE (trois routes sont chiffrées à l'heure). Ce message-là ne s'affiche
 *    jamais, et un `429` ne se rejoue jamais.
 *
 * 3. `levelRequired` est EXPOSÉ TEL QUEL, pour que l'écran montre l'INVITATION à
 *    monter de niveau que §7.3 exige, et non une erreur sèche. On ne lit jamais le
 *    niveau pour autoriser : on tente l'action, et c'est le serveur qui répond.
 */
import { ApiError, ApiShapeError, displayMessageFor } from '@/lib/api/index';
import type { FilEchec } from '../accueil/use-fil';

export type { FilEchec };

export function echecDe(error: unknown): FilEchec {
  if (error instanceof ApiShapeError) {
    return {
      message: displayMessageFor(error),
      levelRequired: null,
      incident: true,
      retryAfterSeconds: null,
    };
  }
  if (error instanceof ApiError) {
    return {
      message: displayMessageFor(error),
      levelRequired: error.levelRequired,
      incident: false,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  return {
    message: displayMessageFor(error),
    levelRequired: null,
    incident: false,
    retryAfterSeconds: null,
  };
}
