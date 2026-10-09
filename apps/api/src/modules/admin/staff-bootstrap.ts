import { newId, type Prisma } from '@app/db';
import { SYSTEM_AUDIT_ACTIONS, staffCreateSchema, type StaffRoleValue } from '@app/shared';
import { hashStaffPassword } from './staff-password';

/**
 * Amorçage du PREMIER compte d'équipe — l'œuf et la poule, refermé.
 *
 * ── Le défaut, mesuré ──────────────────────────────────────────────────────
 *
 * Sur une installation neuve, le domaine d'équipe est INACCESSIBLE. Mesuré par
 * HTTP sur une base neuve (migrations + `pnpm db:seed`), avant que ce fichier
 * n'existe :
 *
 *     POST /v1/admin/auth/login   → 401 STAFF_CREDENTIALS_INVALID  (0 ligne dans staff_users)
 *     GET  /v1/admin/staff        → 401 STAFF_SESSION_REQUIRED
 *     POST /v1/admin/auth/session → 401 STAFF_SESSION_REQUIRED
 *
 * La seule création d'un compte d'équipe du dépôt est `admin.service.createStaff`,
 * sur `@Post('staff')` gardée par `@RequiresStaffRole(...STAFF_SCOPES.staffAdmin)`
 * — elle exige donc un `SUPER_ADMIN` déjà connecté pour fabriquer le premier
 * `SUPER_ADMIN`. Le seed de `packages/db/src/seed/` ne crée aucun compte d'équipe
 * (zéro occurrence du mot `staff` dans tout le dossier). Les 22 fichiers de
 * `docs/specs/` ne mentionnent aucun amorçage : ni « premier compte », ni
 * « premier admin », ni « bootstrap », ni « super-admin initial ».
 *
 * ── CE QUE CE FICHIER NE DÉCIDE PAS ────────────────────────────────────────
 *
 * QUI est le premier administrateur, et par quel canal il reçoit ses
 * identifiants, sont des décisions de PRODUIT et de SÉCURITÉ. La spec est muette,
 * et un script n'a pas à trancher à la place du porteur. Ce mécanisme ne porte
 * donc AUCUN secret, AUCUN défaut, AUCUNE valeur de repli : il lit trois
 * variables d'environnement et REFUSE DE S'EXÉCUTER si l'une manque, en la
 * nommant. Un amorçage qui se tait et crée un compte devinable est pire que pas
 * d'amorçage — et ce dépôt est public.
 *
 * Ce qui reste à trancher par le porteur est écrit au-dessus de
 * `STAFF_BOOTSTRAP_ENV`, et répété dans `.env.example`.
 *
 * ── Les trois règles dures, et pourquoi elles sont dans une fonction PURE ───
 *
 *   1. **configuration absente → refus nommé.** Jamais de mot de passe par
 *      défaut ;
 *   2. **un compte d'équipe existe déjà → refus.** Sans cette règle, le
 *      mécanisme devient une PORTE DÉROBÉE PERMANENTE : quiconque peut poser une
 *      variable d'environnement se fabriquerait un `SUPER_ADMIN`, ce qui est
 *      l'inverse exact du but. Il n'ouvre donc que sur une base où personne
 *      n'est encore entré ;
 *   3. **le rôle accordé est `SUPER_ADMIN`, et il est DÉRIVÉ, pas choisi** —
 *      voir `STAFF_BOOTSTRAP_ROLE`.
 *
 * Les trois vivent dans `decideStaffBootstrap`, qui est PURE : elle prend
 * l'environnement et le NOMBRE de comptes existants, et rend un plan ou lève.
 * C'est le pli de `seed/pilot-city.ts`, et il est pris pour la même raison :
 * une décision qui ne touche pas la base s'éprouve exhaustivement, y compris le
 * cas qui compte le plus — le refus. L'enveloppe `bootstrapStaffUser` ne fait
 * plus que compter, appeler, puis écrire.
 */

// ════════════════════════════════════════════════════════════════════════════
// Le rôle accordé — DÉRIVÉ de la spec, pas choisi
// ════════════════════════════════════════════════════════════════════════════

/**
 * `SUPER_ADMIN`, et ce n'est pas un arbitrage de confort.
 *
 * 15 §2.2 n'accorde « Gérer les comptes équipe et rôles » qu'au `SUPER_ADMIN`,
 * et `STAFF_SCOPES.staffAdmin` vaut `['SUPER_ADMIN']` — c'est le garde de
 * `@Post('staff')`. Un compte d'amorçage de tout autre rôle ne pourrait donc PAS
 * créer les comptes suivants, et l'œuf et la poule survivraient à son propre
 * remède : il faudrait réamorcer pour chaque recrue, c'est-à-dire garder la porte
 * dérobée ouverte à demeure.
 *
 * Le rôle est donc le plus faible qui suffise à la seule chose que ce compte doit
 * savoir faire : créer les autres. `staff-bootstrap.test.ts` le CONFRONTE à
 * `STAFF_SCOPES.staffAdmin` au lieu de le recopier — sans quoi ce serait une
 * valeur que personne ne relit, écrite à côté d'une règle qu'elle pourrait
 * contredire.
 */
export const STAFF_BOOTSTRAP_ROLE: StaffRoleValue = 'SUPER_ADMIN';

// ════════════════════════════════════════════════════════════════════════════
// La configuration — trois variables, aucun défaut
// ════════════════════════════════════════════════════════════════════════════

/**
 * Les trois variables lues, nommées UNE fois.
 *
 * Elles ne sont volontairement PAS dans `envSchema` (`config/env.ts`) : ce
 * schéma décrit ce sans quoi l'API refuse de démarrer, et l'amorçage n'est
 * NORMALEMENT PAS CONFIGURÉ. Les y déclarer requises empêcherait l'API de
 * démarrer partout ; les y déclarer optionnelles ferait croire qu'elles sont une
 * configuration de service, alors que ce sont les arguments d'une commande qu'on
 * lance une fois. On les lit donc ici, et on refuse ici.
 *
 * ── CE QUI RESTE À TRANCHER PAR LE PORTEUR ─────────────────────────────────
 *
 *   · **QUI** est le premier administrateur : l'adresse mise dans
 *     `STAFF_BOOTSTRAP_EMAIL`. Ce mécanisme n'en propose aucune ;
 *   · **PAR QUEL CANAL** il reçoit son mot de passe : la personne qui lance la
 *     commande le choisit et le transmet. Rien ici ne l'envoie, et rien ne
 *     l'écrit en clair — ni dans la base (argon2id), ni dans `audit_logs` (le
 *     nettoyeur d'`audit.service.ts` masque `password`, et on ne le lui passe de
 *     toute façon pas) ;
 *   · **S'IL LES PERD** : il n'existe AUCUN chemin de reprise. Ce mécanisme
 *     refuse de rejouer dès qu'un compte existe, et aucune route ne réinitialise
 *     un mot de passe d'équipe. La planche D01 dessine « Télécharger les codes de
 *     secours » ; ils n'existent nulle part dans le code (zéro occurrence de
 *     `backup`, `codes de secours`, `recoveryCode` dans `apps/api/src` et
 *     `packages/shared/src`). Tant qu'ils n'existent pas, la seule reprise est un
 *     accès direct à la base. C'est à dire au porteur, pas à décider ici.
 *
 * Note d'exploitation : le mot de passe passe par l'environnement, donc il peut
 * atterrir dans l'historique du shell. Le préfixer d'une espace, ou l'exporter
 * depuis un gestionnaire de secrets, est le geste à faire — et c'est écrit dans
 * `.env.example`.
 */
export const STAFF_BOOTSTRAP_ENV = {
  email: 'STAFF_BOOTSTRAP_EMAIL',
  displayName: 'STAFF_BOOTSTRAP_DISPLAY_NAME',
  password: 'STAFF_BOOTSTRAP_PASSWORD',
} as const;

/** Pourquoi l'amorçage a refusé. Chaque valeur a son code de sortie dans la CLI. */
export type StaffBootstrapRefusalReason =
  /** Une ou plusieurs des trois variables manquent ou sont vides. */
  | 'CONFIG_MISSING'
  /** Les variables sont là, mais une valeur est invalide (email, longueur du mot de passe…). */
  | 'CONFIG_INVALID'
  /** Au moins un compte d'équipe existe. Le mécanisme n'est pas une porte dérobée. */
  | 'STAFF_ALREADY_EXISTS';

/**
 * Le refus, porteur de sa raison.
 *
 * Une classe et non un `ApiError` : ce mécanisme n'est PAS une route. Lui donner
 * un code HTTP laisserait croire qu'on peut l'appeler depuis le réseau, et ce
 * serait exactement la porte dérobée que la règle 2 interdit.
 */
export class StaffBootstrapRefusal extends Error {
  constructor(
    readonly reason: StaffBootstrapRefusalReason,
    message: string,
  ) {
    super(message);
    this.name = 'StaffBootstrapRefusal';
  }
}

/** Ce que l'amorçage s'apprête à écrire. Le mot de passe n'est JAMAIS journalisé. */
export interface StaffBootstrapPlan {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly role: StaffRoleValue;
}

/**
 * LA décision, en entier, sans toucher à la base.
 *
 * @param env l'environnement, lu et non muté.
 * @param existingStaffCount le nombre de lignes de `staff_users`. L'appelant le
 *   compte ; la décision, elle, reste éprouvable sans base.
 * @throws {StaffBootstrapRefusal} sur chacune des trois règles dures.
 */
export function decideStaffBootstrap(
  env: Readonly<Record<string, string | undefined>>,
  existingStaffCount: number,
): StaffBootstrapPlan {
  /**
   * RÈGLE DURE 2, et elle passe EN PREMIER.
   *
   * L'ordre n'est pas cosmétique : la fermeture de la porte dérobée ne doit
   * dépendre d'AUCUNE autre branche. Placée après la lecture de la
   * configuration, elle serait contournable par tout défaut qui ferait sortir
   * plus tôt — et c'est la famille de défauts la plus coûteuse d'ici.
   */
  if (existingStaffCount > 0) {
    throw new StaffBootstrapRefusal(
      'STAFF_ALREADY_EXISTS',
      `Amorçage refusé : ${String(existingStaffCount)} compte(s) d’équipe existent déjà. ` +
        'Ce mécanisme n’ouvre QUE sur une base où personne n’est encore entré — sinon il ' +
        'serait une porte dérobée permanente. Les comptes suivants se créent depuis ' +
        'l’application d’administration (POST /v1/admin/staff, rôle SUPER_ADMIN). Un mot de ' +
        'passe perdu ne se réinitialise par AUCUNE route : voir staff-bootstrap.ts.',
    );
  }

  // RÈGLE DURE 1 : configuration absente → refus NOMMÉ. On liste tout ce qui
  // manque d'un coup, pour que l'opérateur n'ait pas à rejouer trois fois.
  const read = (name: string): string | undefined => {
    const raw = env[name]?.trim();
    return raw === undefined || raw.length === 0 ? undefined : raw;
  };
  const values = {
    email: read(STAFF_BOOTSTRAP_ENV.email),
    displayName: read(STAFF_BOOTSTRAP_ENV.displayName),
    password: read(STAFF_BOOTSTRAP_ENV.password),
  };

  const missing = (Object.keys(values) as (keyof typeof values)[])
    .filter((key) => values[key] === undefined)
    .map((key) => STAFF_BOOTSTRAP_ENV[key]);

  if (missing.length > 0) {
    throw new StaffBootstrapRefusal(
      'CONFIG_MISSING',
      `Amorçage refusé : variable(s) d’environnement manquante(s) — ${missing.join(', ')}. ` +
        'Ce mécanisme ne porte aucun mot de passe par défaut et n’en invente aucun : ' +
        'il attend exactement ' +
        `${STAFF_BOOTSTRAP_ENV.email} (l’adresse du premier administrateur), ` +
        `${STAFF_BOOTSTRAP_ENV.displayName} (son nom affiché) et ` +
        `${STAFF_BOOTSTRAP_ENV.password} (12 caractères minimum, hors liste des mots de ` +
        'passe trop courants). Qui est ce premier administrateur, et par quel canal il ' +
        'reçoit ces identifiants, est une décision du porteur.',
    );
  }

  /**
   * Le MÊME schéma que la route `POST /v1/admin/staff`.
   *
   * Recopier la politique de mot de passe ici en ferait une seconde source de
   * vérité, et le compte le plus puissant du produit serait justement celui qui
   * échapperait à la règle des 12 caractères (§2.1) et à la liste des mots de
   * passe trop courants. `changeme` est dans cette liste : il est refusé ici
   * sans que ce fichier ait à le savoir.
   */
  const parsed = staffCreateSchema.safeParse({
    email: values.email,
    displayName: values.displayName,
    password: values.password,
    role: STAFF_BOOTSTRAP_ROLE,
  });
  if (!parsed.success) {
    // Les messages de Zod, SANS les valeurs : `password` ne doit pas fuiter dans
    // une sortie de terminal ni dans un journal de déploiement.
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join(' · ');
    throw new StaffBootstrapRefusal(
      'CONFIG_INVALID',
      `Amorçage refusé : configuration invalide — ${problems}. ` +
        `La politique est celle de la route POST /v1/admin/staff : ${String(
          STAFF_BOOTSTRAP_ENV.password,
        )} fait 12 caractères minimum et ne peut pas être un mot de passe trop courant.`,
    );
  }

  return {
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    password: parsed.data.password,
    role: STAFF_BOOTSTRAP_ROLE,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// L'enveloppe — compter, décider, écrire
// ════════════════════════════════════════════════════════════════════════════

/** Le strict minimum attendu du client Prisma, pour que l'enveloppe reste éprouvable. */
export interface StaffBootstrapStore {
  staffUser: {
    count(): Promise<number>;
    create(args: {
      data: {
        id: string;
        email: string;
        displayName: string;
        passwordHash: string;
        totpSecretEncrypted: Uint8Array;
        role: StaffRoleValue;
        isActive: boolean;
      };
    }): Promise<unknown>;
  };
}

/** Ce qu'`AuditService` sait faire, et dont on a besoin ici. */
export interface StaffBootstrapAuditor {
  recordSystem(
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void>;
}

export interface StaffBootstrapResult {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: StaffRoleValue;
  /**
   * Toujours `true`. Le compte est créé AVEC UN SECRET TOTP DE LONGUEUR NULLE,
   * donc non enrôlé : `staff-auth.service.login` rendra `enrollmentRequired`, et
   * seul `/auth/totp/confirm` pourra ouvrir sa session. Voir ci-dessous.
   */
  readonly totpEnrollmentRequired: true;
}

/**
 * Crée le premier compte d'équipe, ou refuse. Idempotent par construction : le
 * premier appel réussi fait échouer tous les suivants sur `STAFF_ALREADY_EXISTS`.
 *
 * ── Le compte créé DEVRA s'enrôler en TOTP ─────────────────────────────────
 *
 * `totpSecretEncrypted` est posé à `new Uint8Array(0)`, exactement comme
 * `admin.service.createStaff`. Ce n'est pas un détail d'implémentation : la
 * colonne est `Bytes` NON NUL, et tout le domaine lit « longueur nulle » comme
 * « pas encore enrôlé ». Conséquence, structurelle et non conditionnelle :
 *
 *   · `login` rend un défi en mode `CONFIRM` et `enrollmentRequired: true` ;
 *   · `totp` (le second facteur ordinaire) REFUSE ce défi — `STAFF_TOTP_ENROLLMENT_REQUIRED` ;
 *   · il faut passer par `/auth/totp/enroll` puis `/auth/totp/confirm` pour
 *     qu'une session naisse.
 *
 * C'est la planche D01 (« ENRÔLEMENT FORCÉ », « Activer la double
 * authentification », le QR code) et §2.1 (« enrôlement forcé à la première
 * connexion »). On a donc choisi la planche contre la facilité d'amorçage :
 * amorcer un compte DISPENSÉ de TOTP aurait tenu en une ligne de moins et aurait
 * créé le seul compte du produit à un seul facteur — celui qui peut tout.
 *
 * ── Pourquoi l'acteur de l'audit est `SYSTEM` ──────────────────────────────
 *
 * `audit_logs.actor_id` est un UUID de compte d'équipe, et il n'y en a aucun :
 * c'est tout le problème qu'on referme. L'action est donc celle du système,
 * `staff.bootstrapped`, DISTINCTE de `staff.created` — pour qu'on puisse
 * répondre plus tard à « ce compte est-il né d'un amorçage ou d'une création en
 * back-office ? », qui est exactement la question qu'un audit de sécurité posera.
 *
 * La trace n'est PAS transactionnelle, à la différence de la règle du §2.3, et
 * c'est assumé : `recordSystem` écrit hors transaction. Le pire cas est une
 * ligne d'audit manquante pour un compte créé — visible, puisque le compte est
 * là. L'inverse (une transaction qui échouerait sur l'audit et annulerait
 * l'amorçage) laisserait la plateforme sans porte d'entrée pour une ligne de
 * journal, ce qui est le mauvais compromis ici.
 */
export async function bootstrapStaffUser(
  store: StaffBootstrapStore,
  audit: StaffBootstrapAuditor,
  env: Readonly<Record<string, string | undefined>>,
): Promise<StaffBootstrapResult> {
  const existingStaffCount = await store.staffUser.count();
  const plan = decideStaffBootstrap(env, existingStaffCount);

  const id = newId();
  const passwordHash = await hashStaffPassword(plan.password);

  await store.staffUser.create({
    data: {
      id,
      email: plan.email,
      displayName: plan.displayName,
      passwordHash,
      // §2.1 « enrôlement forcé à la première connexion » : secret de longueur
      // nulle = pas encore enrôlé. Voir l'en-tête de cette fonction.
      totpSecretEncrypted: new Uint8Array(0),
      role: plan.role,
      isActive: true,
    },
  });

  // Ni le mot de passe, ni son condensé, ni l'email : `audit.service.ts` masque
  // déjà `password` et `email`, et on ne les lui passe pas.
  await audit.recordSystem(SYSTEM_AUDIT_ACTIONS.staffBootstrapped, 'staff_user', id, {
    role: plan.role,
    displayName: plan.displayName,
    totpEnrollmentRequired: true,
  });

  return {
    id,
    email: plan.email,
    displayName: plan.displayName,
    role: plan.role,
    totpEnrollmentRequired: true,
  };
}
