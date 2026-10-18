import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAFF_SCOPES, type StaffRoleValue } from '../validation/admin.js';
import { StaffRole } from '../enums/generated.js';

/**
 * LA MATRICE DES RÔLES D'ÉQUIPE, FIGÉE — 15-administration.md §2.2.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE FICHIER EXISTE PARCE QU'UNE MUTATION EST RESTÉE VERTE.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La mesure, telle quelle. On a élargi `STAFF_SCOPES.moderation` pour y ajouter
 * `SUPPORT` — un rôle qui n'a PAS le droit de modérer au §2.2 — puis lancé toute
 * la suite d'intégration du module équipe plus la cloison de domaine :
 *
 *     62 tests, 62 passés, code de retour 0.
 *
 * Puis on a ouvert `STAFF_SCOPES.rgpd` — export RGPD, SUPPRESSION de compte,
 * remboursements, c'est-à-dire le périmètre le plus sensible de la matrice — aux
 * QUATRE rôles. Même résultat : 62 passés.
 *
 * Ce n'était pas un artefact de harnais. La première exécution en avait produit
 * un — la commande employait la configuration vitest PAR DÉFAUT, qui exclut les
 * `*.int.test.ts`, donc rien de ce qui compte ne tournait — et c'est précisément
 * pour cela que la mesure a été refaite deux fois, contre la bonne suite, avec
 * vérification d'empreinte avant/après à chaque fois. Le vert a tenu.
 *
 * ── CE QUI ÉTAIT GARDÉ, ET CE QUI NE L'ÉTAIT PAS ───────────────────────────
 *
 * La distinction est tout l'intérêt de la mesure, et elle est nette :
 *
 *   · L'APPLICATION de la matrice est bien gardée. Court-circuiter le contrôle de
 *     rôle de `StaffGuard` (`if (!allowed.includes(session.staff.role))`) fait
 *     ROUGIR « un rôle hors périmètre reçoit 403, un rôle du périmètre passe ».
 *     Le mécanisme est éprouvé.
 *   · Le CONTENU de la matrice ne l'était pas du tout. Les tests du garde
 *     fabriquent leurs propres listes de rôles et vérifient que le garde les
 *     respecte ; aucun ne confronte `STAFF_SCOPES` au tableau du §2.2. Un
 *     périmètre élargi d'une ligne accordait donc un privilège que rien ne
 *     contredisait — ni `tsc` (la liste reste bien typée), ni le lint, ni aucun
 *     test.
 *
 * C'est la même famille de défaut que celle déjà payée sur ce projet : non pas un
 * mécanisme absent, mais une VALEUR que personne ne relit. Un garde parfait qui
 * lit une mauvaise table applique parfaitement la mauvaise règle.
 *
 * ── POURQUOI RECOPIER LE TABLEAU PLUTÔT QUE LE DÉRIVER ─────────────────────
 *
 * Ce fichier recopie le §2.2 à la main, et c'est délibéré : un test qui dériverait
 * les listes de `STAFF_SCOPES` lui-même ne prouverait rien du tout — il serait
 * vrai par construction, quelle que soit la table. La valeur du test est
 * exactement dans la RECOPIE : elle vient de la spec, pas du code, donc elle le
 * contredit quand il bouge.
 *
 * Conséquence assumée : élargir un périmètre pour de bon demande de toucher ce
 * fichier, donc de lire ce commentaire, donc de dire pourquoi. C'est le but.
 */

/**
 * Le tableau du §2.2, recopié. CHAQUE périmètre y est, et l'exhaustivité est
 * vérifiée plus bas — sans quoi un périmètre AJOUTÉ à `STAFF_SCOPES` échapperait
 * à ce fichier en silence, ce qui serait le trou refermé à moitié.
 */
const SELON_LA_SPEC: Record<keyof typeof STAFF_SCOPES, readonly StaffRoleValue[]> = {
  /** Comptes équipe et rôles, feature flags, paramètres de paiement. */
  staffAdmin: ['SUPER_ADMIN'],
  /** Modèles, référentiels, pages, annonces, alertes arnaques, partenaires. */
  content: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
  /** File de modération, masquer, avertir, suspendre. */
  moderation: ['SUPER_ADMIN', 'MODERATOR'],
  /** Lire une fiche membre complète. */
  memberRead: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR', 'SUPPORT'],
  /** Export / suppression RGPD, remboursements. */
  rgpd: ['SUPER_ADMIN', 'SUPPORT'],
  /** Valider les fiches pro (justificatif). */
  proReview: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'SUPPORT'],
  /** Tableaux de bord et journal d'audit. */
  dashboard: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR', 'SUPPORT'],
  /** Paramètres système. Le registre resserre ensuite clé par clé. */
  settings: ['SUPER_ADMIN', 'CONTENT_ADMIN'],
};

const trie = (roles: readonly string[]): string[] => [...roles].sort();

describe('la matrice des rôles d’équipe (15 §2.2)', () => {
  it('[RÈGLE DURE] chaque périmètre porte EXACTEMENT les rôles du §2.2', () => {
    for (const [perimetre, attendus] of Object.entries(SELON_LA_SPEC)) {
      const reels = STAFF_SCOPES[perimetre as keyof typeof STAFF_SCOPES];
      expect(
        trie(reels),
        `Le périmètre « ${perimetre} » n’a plus les rôles du §2.2. Élargir un ` +
          `périmètre ACCORDE un privilège : si c’est voulu, mettre à jour la spec ET ` +
          `ce fichier, en disant pourquoi.`,
      ).toEqual(trie(attendus));
    }
  });

  /**
   * L'EXHAUSTIVITÉ, sans quoi le test précédent ne garderait que ce qu'il connaît.
   *
   * Un périmètre ajouté à `STAFF_SCOPES` et absent de la recopie ci-dessus
   * passerait inaperçu — et ce serait exactement le même défaut, un cran plus
   * loin. Le `Record<keyof typeof STAFF_SCOPES, …>` fait déjà rougir `tsc` sur un
   * périmètre MANQUANT ; cette assertion le dit aussi à l'exécution, pour que le
   * message nomme le périmètre au lieu d'être une erreur de types.
   */
  it('aucun périmètre n’a été ajouté sans passer par ce fichier', () => {
    expect(trie(Object.keys(STAFF_SCOPES))).toEqual(trie(Object.keys(SELON_LA_SPEC)));
  });

  /**
   * Les quatre rôles, et SEULEMENT eux.
   *
   * Un périmètre qui nommerait un rôle inexistant — faute de frappe, rôle retiré
   * de l'énumération — serait une liste qui n'accorde rien à personne, donc une
   * route que PLUS AUCUN rôle n'ouvre. Le symptôme serait un 403 pour tout le
   * monde, et la cause invisible : la liste a l'air pleine.
   */
  it('aucun périmètre ne nomme un rôle qui n’existe pas', () => {
    for (const [perimetre, roles] of Object.entries(STAFF_SCOPES)) {
      for (const role of roles) {
        expect(StaffRole, `« ${role} » dans « ${perimetre} » n’est pas un rôle d’équipe`).toContain(
          role,
        );
      }
    }
  });

  /**
   * LA MATRICE N'EST PAS UNE HIÉRARCHIE, et ce test l'empêche d'en devenir une.
   *
   * `validation/admin.ts` le dit en commentaire — « les quatre rôles ne sont pas
   * ordonnés » — et c'est vrai de façon vérifiable : `SUPPORT` peut valider une
   * fiche pro, ce que `MODERATOR` ne peut pas ; `MODERATOR` peut modérer, ce que
   * `SUPPORT` ne peut pas. Les deux moitiés sont affirmées ici.
   *
   * L'intérêt n'est pas de garder une curiosité : c'est d'arrêter la refonte « on
   * remplace la matrice par des niveaux 1 à 4 », qui paraît toujours plus propre
   * et qui produit une matrice FAUSSE — un garde qui laisse passer le mauvais
   * rôle. Le jour où quelqu'un l'essaie, ce test tombe et explique.
   */
  it('les rôles ne sont pas ordonnables : SUPPORT et MODERATOR se croisent', () => {
    expect(STAFF_SCOPES.proReview).toContain('SUPPORT');
    expect(STAFF_SCOPES.proReview).not.toContain('MODERATOR');
    expect(STAFF_SCOPES.moderation).toContain('MODERATOR');
    expect(STAFF_SCOPES.moderation).not.toContain('SUPPORT');
  });

  /**
   * LE PÉRIMÈTRE LE PLUS SENSIBLE, nommé à part — règle dure « aucune donnée
   * personnelle exposée au-delà de ce que le rôle permet ».
   *
   * `rgpd` couvre l'export des données d'un membre, la SUPPRESSION de son compte
   * et les remboursements. C'est le périmètre qu'il ne faut jamais élargir par
   * commodité, et c'est celui dont l'élargissement est passé inaperçu à la mesure :
   * ouvert aux quatre rôles, 62 tests restaient verts.
   *
   * Il est donc affirmé DEUX FOIS — une fois par le tableau ci-dessus, une fois
   * ici, nommément. La redondance est le but : la première assertion peut être
   * « corrigée » en recopiant la nouvelle valeur sans réfléchir, celle-ci demande
   * d'effacer une phrase qui dit pourquoi.
   */
  it('[RÈGLE DURE] seuls SUPER_ADMIN et SUPPORT touchent aux données personnelles (rgpd)', () => {
    expect(trie(STAFF_SCOPES.rgpd)).toEqual(['SUPER_ADMIN', 'SUPPORT']);
    expect(STAFF_SCOPES.rgpd).not.toContain('MODERATOR');
    expect(STAFF_SCOPES.rgpd).not.toContain('CONTENT_ADMIN');
  });

  /**
   * `staffAdmin` reste le périmètre d'UN SEUL rôle.
   *
   * Il porte la gestion des comptes d'équipe et des rôles — donc le pouvoir de
   * s'accorder tous les autres périmètres. Un deuxième rôle ici rendrait la
   * matrice entière contournable depuis l'intérieur, et aucune des assertions
   * ci-dessus ne le verrait : elles resteraient vraies, pendant qu'un
   * `CONTENT_ADMIN` se promouvrait `SUPER_ADMIN`.
   */
  it('[RÈGLE DURE] seul SUPER_ADMIN gère les comptes d’équipe et les rôles', () => {
    expect(STAFF_SCOPES.staffAdmin).toEqual(['SUPER_ADMIN']);
  });

  /**
   * ── LOT A : LES LISTES ÉCRITES À LA MAIN DANS L'API ────────────────────────
   *
   * Mesuré : `admin-moderation.controller.ts` et `moderation.service.ts`
   * répétaient `['MODERATOR', 'CONTENT_ADMIN', 'SUPER_ADMIN']` — six endroits de
   * la file, des actions et des suspensions — alors que la matrice ne donne la
   * modération qu'à SUPER_ADMIN et MODERATOR. `STAFF_SCOPES` restait juste,
   * donc ce fichier restait vert, pendant que l'API appliquait une autre table.
   *
   * Ce test lit donc le CODE de l'API : aucune liste littérale ne doit mêler
   * MODERATOR et CONTENT_ADMIN (seule exception documentée : la LECTURE des seuils,
   * que CONTENT_ADMIN édite, écrite `...STAFF_SCOPES.moderation, 'CONTENT_ADMIN'`),
   * et chaque garde de la file doit citer `STAFF_SCOPES.moderation`.
   */
  describe('l’API applique STAFF_SCOPES.moderation, pas une copie', () => {
    const lire = (chemin: string): string =>
      readFileSync(resolve(__dirname, '../../../../apps/api/src/modules', chemin), 'utf8');
    const fichiers = {
      controleur: lire('admin/admin-moderation.controller.ts'),
      service: lire('moderation/moderation.service.ts'),
    };
    // Une liste littérale qui nomme MODERATOR ET CONTENT_ADMIN.
    const copie = /\[[^\]]*'MODERATOR'[^\]]*'CONTENT_ADMIN'[^\]]*\]|\([^)]*'MODERATOR'[^)]*'CONTENT_ADMIN'[^)]*\)/;

    it('aucune liste littérale ne redonne la modération à CONTENT_ADMIN', () => {
      for (const [nom, source] of Object.entries(fichiers)) {
        const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(copie.test(sansCommentaires), `${nom} : liste littérale MODERATOR + CONTENT_ADMIN`).toBe(
          false,
        );
      }
    });

    it('la file, les actions et les suspensions lisent STAFF_SCOPES.moderation', () => {
      const gardesService = fichiers.service.match(/assertRole\(\s*staff,\s*STAFF_SCOPES\.moderation/g) ?? [];
      // listCases, caseDetail, history, assign, release, stats (+ act, sur deux lignes).
      expect(gardesService.length).toBeGreaterThanOrEqual(6);
      expect(fichiers.service).toMatch(/BAN_USER' \? \['SUPER_ADMIN'\] : STAFF_SCOPES\.moderation/);
      const gardesControleur = fichiers.controleur.match(/@RequiresStaffRole\(\.\.\.STAFF_SCOPES\.moderation\)/g) ?? [];
      expect(gardesControleur.length).toBeGreaterThanOrEqual(7);
    });
  });
});
