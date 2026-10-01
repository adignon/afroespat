import { OffreEcran } from '@/screens/services/offre-ecran';

/**
 * S05 — une offre d'emploi (`/services/emploi/:id`, 10 §3.1).
 *
 * DEUX ROUTES, UNE SEULE PLANCHE, et c'est la maquette qui l'écrit : sa légende
 * dit « /services/emploi/:id · /nouveau ». Le cadre d'ordinateur porte le détail
 * de l'offre dans sa colonne centrale ET le formulaire « PUBLIER UNE OFFRE » dans
 * sa colonne de droite.
 *
 * ── CE QUE LE BRANCHEMENT A RÉVÉLÉ, ET QUI EST REMONTÉ AU PORTEUR ───────────
 *
 * Tant que l'écran lisait la maquette, les deux routes pouvaient partager une
 * planche : il n'y avait rien à charger. Avec l'API elles DIVERGENT —
 * `/services/emploi/:id` lit `GET /jobs/:id`, et `/services/emploi/nouveau` n'a
 * aucune offre à lire. La maquette ne dit pas ce que la colonne de détail devrait
 * montrer dans ce second cas.
 *
 * `nouveau/page.tsx` est donc devenu un segment STATIQUE à part, qui gagne sur
 * `[id]` dans le routeur. Sans lui, `/services/emploi/nouveau` tombait ici et
 * partait chercher une offre dont l'identifiant est le mot « nouveau » — un
 * `400 VALIDATION_FAILED`, parce que le contrôleur valide `:id` comme un UUID.
 * L'écart est consigné plutôt que masqué.
 *
 * L'IDENTIFIANT EST MAINTENANT LU et part dans `GET /jobs/:id`.
 */
export default async function OffreEmploiPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  return <OffreEcran id={id} />;
}
