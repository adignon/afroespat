import { AbonnementEcran } from '@/screens/compte/abonnement-ecran';
import { voletPaiement } from '@/screens/compte/data';

/**
 * `/premium` — la seconde route de K06 (T5 §9 : « `/compte/abonnement`,
 * `/premium` »).
 *
 * LA MAQUETTE NE DESSINE QU'UNE PLANCHE pour les deux routes, et c'est elle qui
 * décide : sa section K06 porte un seul cadre d'ordinateur, qui montre à la fois
 * le plan courant, le comparatif Gratuit / Premium et les factures. T5 décrit
 * pourtant « Page Premium » comme le comparatif seul. En dessiner une seconde
 * version ici serait redessiner à la place du porteur ; servir la même planche
 * est ce que la maquette permet, et l'écart est signalé dans le rapport.
 *
 * Composant SERVEUR, comme `/compte/abonnement` : `useSearchParams()` forcerait
 * un rendu client et la page servie arriverait vide.
 */
export default async function PremiumPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <AbonnementEcran volet={voletPaiement(params['paiement'])} />;
}
