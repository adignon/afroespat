import { FicheProEcran } from '@/screens/services/fiche-pro-ecran';

/**
 * S07 — la fiche d'un professionnel (`/services/annuaire/:id`, 10 §4.3 et §4.4).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * L'IDENTIFIANT EST MAINTENANT LU et part dans `GET /pros/:id`. Le commentaire
 * précédent disait l'inverse, et c'était vrai de son lot : afficher la même fiche
 * pour tous les identifiants était une promesse que l'écran ne tenait pas.
 *
 * `404` EST LE BON CODE pour une fiche invisible, et c'est §4.1 : « la fiche est
 * invisible avant » validation. T4 §3 veut qu'elle soit alors indiscernable d'une
 * fiche qui n'existe pas — donc `404` et non `403`, et `displayMessageFor` dit
 * « introuvable » dans les deux cas.
 *
 * COMPOSANT SERVEUR : le paramètre de route arrive en propriété, et c'est l'écran
 * (`@/screens/services/fiche-pro-ecran`) qui est client.
 */
export default async function FichePro({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  return <FicheProEcran id={id} />;
}
