import { PILOT_CITY_SLUG } from '@app/shared';

/**
 * QUELLE ville le seed ouvre — et à quelle condition.
 *
 * La fonction est PURE et vit dans son propre fichier parce que `seed/index.ts`
 * s'exécute en s'important : il ouvre une connexion Prisma et appelle `main()` au
 * chargement. Un test qui voudrait l'éprouver amorcerait la base. Ici, on éprouve
 * la décision sans toucher à rien.
 *
 * DEUX CHOSES DISTINCTES, et c'est tout l'objet de ce fichier :
 *
 *   1. QUI est la ville pilote — `PILOT_CITY_SLUG`, arbitrage du porteur, une
 *      seule ligne dans `@app/shared`. Le seed ne la choisit pas, il la LIT.
 *   2. SI le seed a le droit de l'ouvrir — un opt-in explicite, jamais un défaut.
 *
 * Confondre les deux ferait d'un chargement de données une décision produit :
 * relancer `pnpm db:seed` ouvrirait une ville, avec son réseau et ses membres.
 *
 * En développement :
 *
 *     SEED_ACTIVATE_PILOT_CITY=true pnpm db:seed   # ouvre la ville pilote
 *     SEED_PILOT_CITY_SLUG=lyon pnpm db:seed       # ouvre une AUTRE ville (essai)
 *
 * LIMITE ASSUMÉE, inchangée : cette activation pose `is_active` et `activated_at`
 * et RIEN d'autre. L'ouverture réelle crée le `community` CITY et y inscrit les
 * membres déjà rattachés, par l'événement `city.activated` (02 §6) ; le seed n'a
 * pas de boîte d'envoi. Le jour J passe par
 * `POST /v1/admin/ref/cities/:id/activate`.
 */
export interface PilotCityActivation {
  /** Le `slug` à ouvrir. */
  readonly slug: string;
  /** Vrai si l'environnement a demandé une AUTRE ville que la pilote. */
  readonly overridden: boolean;
}

const TRUTHY = new Set(['1', 'true', 'yes', 'oui', 'on']);

/**
 * Rien à ouvrir → `null`. C'est le cas par défaut, y compris en production.
 *
 * @throws si on demande une activation en production : le jour du lancement, la
 * ville pilote s'ouvre en back-office, pour que son réseau existe.
 */
export function resolvePilotCityActivation(
  env: Readonly<Record<string, string | undefined>>,
): PilotCityActivation | null {
  const override = env['SEED_PILOT_CITY_SLUG']?.trim().toLowerCase();
  const optIn = env['SEED_ACTIVATE_PILOT_CITY']?.trim().toLowerCase();

  let asked: PilotCityActivation | null = null;
  if (override !== undefined && override.length > 0) {
    asked = { slug: override, overridden: override !== PILOT_CITY_SLUG };
  } else if (optIn !== undefined && TRUTHY.has(optIn)) {
    asked = { slug: PILOT_CITY_SLUG, overridden: false };
  }
  if (asked === null) return null;

  if (env['NODE_ENV'] === 'production') {
    throw new Error(
      'Activer une ville depuis le seed est refusé en production : la ville pilote ' +
        `(« ${PILOT_CITY_SLUG} ») s’ouvre à la main, en back-office, pour que son réseau soit créé (02 §6).`,
    );
  }
  return asked;
}
