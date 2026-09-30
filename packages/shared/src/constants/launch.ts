/**
 * Décisions de LANCEMENT — la ville pilote.
 *
 * 02 §2.2 et T3 B.2 se tiennent : les villes sont chargées INACTIVES, et « la
 * ville pilote est activée à la main le jour du lancement ». Ce que les 22
 * fichiers de `docs/specs/` ne disaient pas, c'est LAQUELLE — et cette absence
 * bloquait l'amorçage : un seed ne peut pas choisir une ville à la place du
 * porteur, et une route d'activation ne sait pas quelle ville proposer.
 *
 * ARBITRAGE DU PORTEUR : la ville pilote est PARIS.
 *
 * Elle est nommée ICI, à UN seul endroit, et par son `slug` — pas par son nom
 * affiché, qui est de la donnée administrée en back-office et peut être corrigé
 * sans que l'identité de la ville change. Le prochain arbitrage se joue donc sur
 * cette ligne, et sur elle seule : personne ne recopie « paris » ailleurs.
 *
 * CE QUE CETTE CONSTANTE N'EST PAS :
 *   · ce n'est PAS le référentiel des villes. `cities` porte 43 villes de France
 *     plus celles du Bénin et du Togo — Cotonou comprise, qui est une vraie ville
 *     du Bénin et le reste. Nommer la pilote n'ajoute ni ne retire aucune entrée.
 *   · ce n'est PAS un état. `cities.is_active` et `cities.activated_at` restent la
 *     vérité : la pilote est la ville qu'on OUVRE le jour J, pas une ville qui
 *     serait ouverte parce qu'une constante la désigne. L'ouverture réelle passe
 *     par `POST /v1/admin/ref/cities/:id/activate`, qui crée le réseau CITY et
 *     émet `city.activated` (02 §4.2 et §6).
 *   · ce n'est PAS une règle de niveau de vérification. Le niveau L2 se dérive de
 *     `countries.kind` via `phone_numbers.is_destination` (01 §2.5), et rien ici
 *     ne le touche.
 */

/** Le `slug` de la ville pilote — l'unique point où la décision se change. */
export const PILOT_CITY_SLUG = 'paris';

/**
 * Le pays de la ville pilote, en ISO 3166-1 alpha-2.
 *
 * Il est déclaré pour que l'incohérence soit RATTRAPABLE : une pilote qui ne
 * serait pas dans un pays de destination ouvrirait un réseau CITY là où personne
 * n'arrive. Le référentiel reste la source du rattachement réel ; cette valeur
 * dit ce qu'on attend d'y trouver.
 */
export const PILOT_CITY_COUNTRY_ISO2 = 'FR';

/** Vrai si ce `slug` est celui de la ville pilote. Comparaison insensible à la casse. */
export function isPilotCitySlug(slug: string): boolean {
  return slug.trim().toLowerCase() === PILOT_CITY_SLUG;
}
