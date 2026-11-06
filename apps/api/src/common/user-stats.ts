import type { Prisma } from '@app/db';

/** Les compteurs de `user_stats` qui suivent des lignes de `reputation_events`. */
export type UserStatField =
  | 'helpValidatedCount'
  | 'guideHelpfulVotes'
  | 'guideContributions'
  | 'eventsOrganized';

/**
 * Fait bouger un compteur de réputation dans la transaction qui écrit (ou supprime)
 * la ligne `reputation_events` correspondante.
 *
 * L'appelant passe le nombre de lignes RÉELLEMENT créées ou supprimées (le `count`
 * de `createMany` / `deleteMany`), jamais « 1 » : un rejeu, qui ne crée rien,
 * ne doit pas faire dériver le compteur.
 *
 * Positif : `upsert`, car la ligne `user_stats` n'est pas créée à l'inscription.
 * Négatif : `updateMany` gardé par `> 0`, le compteur ne passe jamais sous zéro.
 */
export async function bumpUserStat(
  tx: Prisma.TransactionClient,
  userId: string,
  field: UserStatField,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const now = new Date();
  if (delta > 0) {
    await tx.userStats.upsert({
      where: { userId },
      create: { userId, [field]: delta, computedAt: now },
      update: { [field]: { increment: delta }, computedAt: now },
    });
    return;
  }
  await tx.userStats.updateMany({
    where: { userId, [field]: { gte: -delta } },
    data: { [field]: { decrement: -delta }, computedAt: now },
  });
}
