/**
 * La construction d'un `jobId` BullMQ — un seul endroit, parce que la règle est
 * contre-intuitive et qu'elle échoue en silence.
 *
 * BullMQ REFUSE un `jobId` contenant « : » — sauf s'il en compte exactement
 * trois segments, une compatibilité laissée aux anciens travaux répétables que
 * son propre code marque « TODO: replace this check ».
 *
 * Éprouvé contre un vrai Redis, et le résultat mérite d'être écrit :
 *
 *   push:abc          → REFUSÉ  « Custom Id cannot contain : »
 *   email:abc         → REFUSÉ
 *   analyze:POST:abc  → ACCEPTÉ   ← trois segments, donc toléré
 *   a:b:c:d           → REFUSÉ
 *   push-abc          → ACCEPTÉ
 *
 * Deux conséquences, et c'est pourquoi ce fichier existe :
 *
 *   1. `push:<uuid>` et `email:<uuid>` en comptaient DEUX. La mise en file
 *      levait, l'erreur était journalisée, et la ligne `outbound_messages`
 *      restait éternellement en `QUEUED` : **aucun push ni aucun email ne
 *      partait jamais**. Invisible en test — la doublure de file est en
 *      mémoire et n'a pas cette contrainte — visible seulement en lançant le
 *      worker.
 *   2. `analyze:<type>:<id>` fonctionnait PAR ACCIDENT, en tombant juste sur
 *      les trois segments tolérés. Ajouter ou retirer un segment aurait arrêté
 *      toute l'analyse de modération, en silence, avec des lignes bloquées et
 *      une erreur dans le journal sans rapport apparent.
 *
 * Le second cas est ce qui a décidé ce fichier : corriger la ligne fautive et
 * laisser la ligne chanceuse, c'est garder la mine et retirer le panneau.
 */

/** Le séparateur. Un tiret, jamais « : ». Voir le préambule. */
const SEPARATOR = '-';

/**
 * Assemble un `jobId` sûr.
 *
 * Lève si un segment contient « : » : mieux vaut échouer à l'écriture du code —
 * un test le voit — qu'à la mise en file, où l'échec est journalisé puis oublié.
 */
export function jobIdOf(...parts: readonly string[]): string {
  for (const part of parts) {
    if (part.includes(':')) {
      throw new Error(
        `Segment de jobId invalide « ${part} » : BullMQ refuse « : » (voir queue/job-id.ts).`,
      );
    }
  }
  return parts.join(SEPARATOR);
}
