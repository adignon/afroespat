import { AbonnementEcran } from '@/screens/compte/abonnement-ecran';
import { voletPaiement } from '@/screens/compte/data';

/**
 * K06 — « Abonnement et Premium » (`/compte/abonnement`, 14 §3 et §4).
 *
 * Composant SERVEUR : les paramètres d'URL arrivent en propriété, sans
 * `useSearchParams()` — ce crochet force un rendu côté client et la page servie
 * arriverait VIDE, invisible tant qu'on ne lit pas la réponse du serveur.
 *
 * `?paiement=numero|attente|succes` choisit le volet du flux Mobile Money
 * (14 §4.2) ; voir `@/screens/compte/abonnement-ecran` pour la raison.
 */
export default async function AbonnementPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <AbonnementEcran volet={voletPaiement(params['paiement'])} />;
}
