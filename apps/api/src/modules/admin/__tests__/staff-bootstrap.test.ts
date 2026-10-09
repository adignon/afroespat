import { STAFF_PASSWORD_MIN, STAFF_SCOPES, SYSTEM_AUDIT_ACTIONS, StaffRole } from '@app/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  STAFF_BOOTSTRAP_ENV,
  STAFF_BOOTSTRAP_ROLE,
  StaffBootstrapRefusal,
  bootstrapStaffUser,
  decideStaffBootstrap,
  type StaffBootstrapAuditor,
  type StaffBootstrapStore,
} from '../staff-bootstrap';

/**
 * L'amorçage du premier compte d'équipe — `staff-bootstrap.ts`.
 *
 * Ce fichier éprouve la DÉCISION, qui est pure. Les trois règles dures y vivent
 * toutes les trois, et c'est délibéré : un refus est ce qui se teste le plus mal
 * à travers une base de données, et c'est pourtant ce qui compte le plus ici.
 *
 * Le parcours réel — base neuve, migrations, seed, puis vraie session d'équipe
 * ouverte par HTTP — est exercé à la main et rapporté ; `staff-bootstrap.int.test.ts`
 * garde le refus contre une vraie base.
 *
 * TÉMOIN : `le témoin — une valeur qui ne décide de rien`, tout en bas. Il doit
 * rester VERT quand on mute quelque chose d'inoffensif, sans quoi ce fichier ne
 * prouverait que sa propre sensibilité au bruit.
 */

const MOT_DE_PASSE = 'correct-cheval-pile-agrafe-2026';

const CONFIG_COMPLETE: Record<string, string> = {
  [STAFF_BOOTSTRAP_ENV.email]: 'r.adjovi@afroexpates.com',
  [STAFF_BOOTSTRAP_ENV.displayName]: 'R. Adjovi',
  [STAFF_BOOTSTRAP_ENV.password]: MOT_DE_PASSE,
};

/** Attrape le refus et le rend, pour pouvoir éprouver SA RAISON et SON MESSAGE. */
function refus(env: Record<string, string | undefined>, nombreDeComptes: number): StaffBootstrapRefusal {
  try {
    decideStaffBootstrap(env, nombreDeComptes);
  } catch (error) {
    if (error instanceof StaffBootstrapRefusal) return error;
    throw new Error(
      `Un refus NOMMÉ était attendu, et c’est tout l’objet de ce mécanisme. Reçu : ${String(error)}`,
    );
  }
  throw new Error('Aucun refus : l’amorçage a accepté ce qu’il devait refuser.');
}

describe('amorçage du premier compte d’équipe — le rôle accordé', () => {
  /**
   * LA valeur que personne ne relirait.
   *
   * On ne recopie pas `'SUPER_ADMIN'` : on CONFRONTE le rôle d'amorçage au
   * périmètre qui garde `POST /v1/admin/staff`. Écrire
   * `expect(STAFF_BOOTSTRAP_ROLE).toBe('SUPER_ADMIN')` ne prouverait rien — ce
   * serait la constante contre sa propre copie, et ce dépôt a déjà payé cette
   * famille de défauts (on pouvait élargir `STAFF_SCOPES.rgpd` aux quatre rôles
   * avec 62 tests d'intégration verts).
   *
   * La règle, elle, est : le compte d'amorçage doit pouvoir créer les comptes
   * suivants, sinon l'œuf et la poule survit à son remède.
   */
  it('[RÈGLE DURE] le rôle d’amorçage ouvre la création des comptes d’équipe', () => {
    expect(
      STAFF_SCOPES.staffAdmin,
      'Le compte d’amorçage doit pouvoir créer les comptes suivants (POST /v1/admin/staff, ' +
        'gardée par STAFF_SCOPES.staffAdmin). Sans cela il faudrait réamorcer pour chaque ' +
        'recrue — c’est-à-dire laisser la porte dérobée ouverte à demeure.',
    ).toContain(STAFF_BOOTSTRAP_ROLE);
  });

  /**
   * ET PAS PLUS QUE CE QU'IL FAUT.
   *
   * `staffAdmin` ne porte qu'un rôle dans la spec (§2.2, « Gérer les comptes
   * équipe et rôles » : `SUPER_ADMIN` seul). Si quelqu'un élargissait ce
   * périmètre, le test précédent resterait vert alors que l'amorçage pourrait
   * désormais accorder un rôle plus faible — ou qu'un rôle plus faible pourrait
   * créer des comptes. Celui-ci le dit.
   */
  it('[RÈGLE DURE] le périmètre qui l’autorise ne porte QUE ce rôle (§2.2)', () => {
    expect(
      [...STAFF_SCOPES.staffAdmin],
      'Élargir STAFF_SCOPES.staffAdmin change QUI peut créer un compte d’équipe. Si c’est ' +
        'voulu, mettre à jour la spec §2.2, packages/shared et ce test, en disant pourquoi.',
    ).toEqual([STAFF_BOOTSTRAP_ROLE]);
  });

  it('le rôle d’amorçage est un rôle d’équipe qui existe', () => {
    expect(StaffRole).toContain(STAFF_BOOTSTRAP_ROLE);
  });
});

describe('amorçage du premier compte d’équipe — les refus', () => {
  /**
   * RÈGLE DURE 1. Aucun secret en dur, donc aucun amorçage silencieux.
   *
   * On éprouve les SEPT combinaisons incomplètes, pas seulement « tout manque » :
   * un refus qui ne tiendrait que sur le cas vide laisserait passer
   * « email + nom posés, mot de passe oublié », qui est précisément la faute
   * qu'on commet en vrai.
   */
  const TROIS = [
    STAFF_BOOTSTRAP_ENV.email,
    STAFF_BOOTSTRAP_ENV.displayName,
    STAFF_BOOTSTRAP_ENV.password,
  ] as const;

  for (let masque = 0; masque < 7; masque += 1) {
    const presentes = TROIS.filter((_, i) => (masque & (1 << i)) !== 0);
    const absentes = TROIS.filter((v) => !presentes.includes(v));

    it(`[RÈGLE DURE] refuse quand il manque ${absentes.join(' + ')}`, () => {
      const env = Object.fromEntries(presentes.map((k) => [k, CONFIG_COMPLETE[k]]));
      const erreur = refus(env, 0);

      expect(erreur.reason).toBe('CONFIG_MISSING');
      // Le message doit NOMMER ce qui manque : « un amorçage qui se tait et crée
      // un compte deviné est pire que pas d'amorçage ».
      for (const nom of absentes) expect(erreur.message).toContain(nom);
    });
  }

  it('[RÈGLE DURE] une variable vide ou en espaces vaut absente', () => {
    for (const valeur of ['', '   ', '\t\n']) {
      const erreur = refus({ ...CONFIG_COMPLETE, [STAFF_BOOTSTRAP_ENV.password]: valeur }, 0);
      expect(erreur.reason).toBe('CONFIG_MISSING');
      expect(erreur.message).toContain(STAFF_BOOTSTRAP_ENV.password);
    }
  });

  /**
   * RÈGLE DURE 2, celle qui empêche la porte dérobée permanente.
   *
   * Et elle est éprouvée AVEC UNE CONFIGURATION COMPLÈTE ET VALIDE : c'est le
   * seul cas qui prouve quelque chose. Refuser un compte existant alors que la
   * configuration manque de toute façon ne distinguerait pas les deux règles.
   */
  it('[RÈGLE DURE] refuse si un compte d’équipe existe déjà, config valide ou non', () => {
    for (const nombre of [1, 2, 395]) {
      const erreur = refus(CONFIG_COMPLETE, nombre);
      expect(erreur.reason).toBe('STAFF_ALREADY_EXISTS');
      expect(erreur.message).toContain(String(nombre));
    }
  });

  /**
   * L'ORDRE des deux refus, et il décide de quelque chose.
   *
   * La fermeture de la porte dérobée ne doit dépendre d'aucune autre branche :
   * sur une base peuplée ET sans configuration, c'est `STAFF_ALREADY_EXISTS`
   * qu'on doit lire. Si l'ordre s'inversait, le refus d'existence deviendrait
   * contournable par tout défaut qui ferait sortir plus tôt.
   */
  it('[RÈGLE DURE] le refus d’existence passe AVANT la lecture de la configuration', () => {
    expect(refus({}, 1).reason).toBe('STAFF_ALREADY_EXISTS');
  });

  /**
   * La politique de mot de passe n'est pas recopiée : c'est `staffCreateSchema`,
   * le schéma de la route `POST /v1/admin/staff`. Le compte le plus puissant du
   * produit ne doit pas être celui qui échappe à la règle des 12 caractères.
   */
  it('[RÈGLE DURE] refuse un mot de passe plus court que la politique (§2.1)', () => {
    const court = 'a'.repeat(STAFF_PASSWORD_MIN - 1);
    const erreur = refus({ ...CONFIG_COMPLETE, [STAFF_BOOTSTRAP_ENV.password]: court }, 0);
    expect(erreur.reason).toBe('CONFIG_INVALID');
  });

  it('[RÈGLE DURE] refuse « changeme » — la liste des mots de passe trop courants s’applique', () => {
    const erreur = refus({ ...CONFIG_COMPLETE, [STAFF_BOOTSTRAP_ENV.password]: 'changeme!!!!' }, 0);
    expect(erreur.reason).toBe('CONFIG_INVALID');
  });

  it('refuse une adresse qui n’est pas une adresse', () => {
    const erreur = refus({ ...CONFIG_COMPLETE, [STAFF_BOOTSTRAP_ENV.email]: 'pas-une-adresse' }, 0);
    expect(erreur.reason).toBe('CONFIG_INVALID');
  });

  /**
   * Le message de refus ne doit JAMAIS contenir le mot de passe.
   *
   * Un refus s'affiche dans un terminal et atterrit dans un journal de
   * déploiement. Zod sait recopier la valeur fautive dans certains messages ;
   * c'est pour cela qu'on ne lui passe que `issue.message` et le chemin.
   */
  it('[RÈGLE DURE] aucun message de refus ne recopie le mot de passe', () => {
    const secret = 'ceci-est-le-secret-a-ne-pas-divulguer';
    const cas: readonly [Record<string, string>, number][] = [
      // configuration invalide (adresse), table vide
      [{ ...CONFIG_COMPLETE, [STAFF_BOOTSTRAP_ENV.password]: secret, [STAFF_BOOTSTRAP_ENV.email]: 'x' }, 0],
      // compte déjà existant, configuration par ailleurs valide
      [{ ...CONFIG_COMPLETE, [STAFF_BOOTSTRAP_ENV.password]: secret }, 3],
    ];
    for (const [env, comptes] of cas) {
      expect(refus(env, comptes).message).not.toContain(secret);
    }
  });
});

describe('amorçage du premier compte d’équipe — ce qui est accepté', () => {
  it('rend un plan au bon rôle quand tout est là et que la table est vide', () => {
    const plan = decideStaffBootstrap(CONFIG_COMPLETE, 0);
    expect(plan.role).toBe(STAFF_BOOTSTRAP_ROLE);
    expect(plan.email).toBe('r.adjovi@afroexpates.com');
    expect(plan.displayName).toBe('R. Adjovi');
    expect(plan.password).toBe(MOT_DE_PASSE);
  });

  it('normalise les espaces autour des valeurs', () => {
    const plan = decideStaffBootstrap(
      {
        [STAFF_BOOTSTRAP_ENV.email]: '  r.adjovi@afroexpates.com  ',
        [STAFF_BOOTSTRAP_ENV.displayName]: '  R. Adjovi  ',
        [STAFF_BOOTSTRAP_ENV.password]: MOT_DE_PASSE,
      },
      0,
    );
    expect(plan.email).toBe('r.adjovi@afroexpates.com');
    expect(plan.displayName).toBe('R. Adjovi');
  });
});

describe('amorçage du premier compte d’équipe — l’écriture', () => {
  function faussaire(nombreExistant: number) {
    const create = vi.fn(() => Promise.resolve({}));
    const recordSystem = vi.fn(() => Promise.resolve());
    const store: StaffBootstrapStore = {
      staffUser: { count: () => Promise.resolve(nombreExistant), create },
    };
    const audit: StaffBootstrapAuditor = { recordSystem };
    return { store, audit, create, recordSystem };
  }

  /**
   * RÈGLE DURE : le compte créé DEVRA s'enrôler en TOTP.
   *
   * `totpSecretEncrypted` de longueur nulle est ce que tout le domaine lit comme
   * « pas encore enrôlé » — `admin.service.createStaff` fait pareil. Un amorçage
   * qui poserait un secret valide créerait le seul compte du produit à un seul
   * facteur, et ce serait celui qui peut tout. C'est la planche D01
   * (« ENRÔLEMENT FORCÉ ») et §2.1.
   */
  it('[RÈGLE DURE] crée un compte NON ENRÔLÉ en TOTP (secret de longueur nulle)', async () => {
    const { store, audit, create } = faussaire(0);
    const resultat = await bootstrapStaffUser(store, audit, CONFIG_COMPLETE);

    expect(resultat.totpEnrollmentRequired).toBe(true);
    const [args] = create.mock.calls[0] as unknown as [{ data: { totpSecretEncrypted: Uint8Array } }];
    expect(
      args.data.totpSecretEncrypted.length,
      'Un secret TOTP NON VIDE dispenserait le compte le plus puissant du produit de sa ' +
        'double authentification (15 §2.1, planche D01 « ENRÔLEMENT FORCÉ »).',
    ).toBe(0);
  });

  it('[RÈGLE DURE] crée le compte avec le rôle d’amorçage et actif', async () => {
    const { store, audit, create } = faussaire(0);
    await bootstrapStaffUser(store, audit, CONFIG_COMPLETE);
    const [args] = create.mock.calls[0] as unknown as [{ data: { role: string; isActive: boolean } }];
    expect(args.data.role).toBe(STAFF_BOOTSTRAP_ROLE);
    expect(args.data.isActive).toBe(true);
  });

  /** argon2id, jamais le mot de passe en clair — §2.1 et 00 §8.3. */
  it('[RÈGLE DURE] stocke un condensé argon2id, jamais le mot de passe', async () => {
    const { store, audit, create } = faussaire(0);
    await bootstrapStaffUser(store, audit, CONFIG_COMPLETE);
    const [args] = create.mock.calls[0] as unknown as [{ data: { passwordHash: string } }];
    expect(args.data.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(args.data.passwordHash).not.toContain(MOT_DE_PASSE);
  });

  /**
   * L'IDEMPOTENCE, par construction : l'enveloppe COMPTE avant d'écrire, et un
   * compte existant arrête tout. On vérifie que `create` n'est JAMAIS appelé —
   * pas seulement qu'une erreur sort.
   */
  it('[RÈGLE DURE] rejoué sur une table non vide, n’écrit RIEN', async () => {
    const { store, audit, create, recordSystem } = faussaire(1);
    await expect(bootstrapStaffUser(store, audit, CONFIG_COMPLETE)).rejects.toThrow(
      StaffBootstrapRefusal,
    );
    expect(create).not.toHaveBeenCalled();
    expect(recordSystem).not.toHaveBeenCalled();
  });

  it('n’écrit rien non plus quand la configuration manque', async () => {
    const { store, audit, create } = faussaire(0);
    await expect(bootstrapStaffUser(store, audit, {})).rejects.toThrow(StaffBootstrapRefusal);
    expect(create).not.toHaveBeenCalled();
  });

  it('audite sous une action DISTINCTE de staff.created, sans secret', async () => {
    const { store, audit, recordSystem } = faussaire(0);
    await bootstrapStaffUser(store, audit, CONFIG_COMPLETE);

    const [action, cible, , metadonnees] = recordSystem.mock.calls[0] as unknown as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];
    expect(action).toBe(SYSTEM_AUDIT_ACTIONS.staffBootstrapped);
    expect(action).not.toBe('staff.created');
    expect(cible).toBe('staff_user');
    expect(JSON.stringify(metadonnees)).not.toContain(MOT_DE_PASSE);
  });

  /**
   * ── LE TÉMOIN ─────────────────────────────────────────────────────────────
   *
   * Une valeur qui ne décide de RIEN : le libellé de la cible d'audit est une
   * chaîne de filtrage dans la page « Journal d'audit », et la muter ne change
   * aucun droit, aucun refus, aucune session. Ce test doit rester VERT quand on
   * mute `'staff_user'` en autre chose — sinon ce fichier ne mesurerait que sa
   * propre sensibilité au bruit, et ses verdicts de mutation ne vaudraient rien.
   *
   * Il est VERT par construction : il n'assertit que des faits insensibles au
   * libellé.
   */
  it('le témoin — une valeur qui ne décide de rien', async () => {
    const { store, audit, recordSystem } = faussaire(0);
    const resultat = await bootstrapStaffUser(store, audit, CONFIG_COMPLETE);

    // Le compte est créé, son rôle est le bon, et une ligne d'audit est écrite.
    // Rien ici ne dépend du LIBELLÉ de la cible.
    expect(resultat.role).toBe(STAFF_BOOTSTRAP_ROLE);
    expect(recordSystem).toHaveBeenCalledTimes(1);
  });
});
