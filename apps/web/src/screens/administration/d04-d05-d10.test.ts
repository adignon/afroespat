import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adminModerationCaseDetailSchema,
  adminModerationStatsResponseSchema,
  adminProProfilesResponseSchema,
} from '@app/shared';
import { vueD04, vueD05 } from './appels';

/**
 * D04, D05, D10 — ÉPROUVÉS SUR LES CHARGES RELEVÉES.
 *
 * Les trois fixtures sont prises OCTET POUR OCTET sur l'API qui tournait, avec une
 * vraie session d'équipe (argon2id puis TOTP). Elles sont PARSÉES par les schémas
 * partagés avant d'entrer dans les dérivations.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER GARDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · D04 — que la file compte `OPEN` **et** `IN_REVIEW`. Les deux sources
 *     disponibles donnent 1 847 et 1 811, et prendre la mauvaise fait disparaître
 *     36 dossiers d'une file de modération. Ils sont en cours d'examen, pas sortis.
 *   · D05 — qu'un type de sujet ou un état de SLA inconnu ARRÊTE l'écran au lieu
 *     d'écrire une constante d'énumération dans une phrase française, et que
 *     l'état du SLA vient du SERVEUR.
 *   · D10 — que le schéma des fiches pro est `.strict()`, donc qu'un champ greffé
 *     sur une fiche professionnelle — qui porte un SIRET et un justificatif —
 *     arrête l'écran au lieu d'être dépouillé en silence.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8'));

describe('D04 — le compte de la file', () => {
  /**
   * LE DÉFAUT RÉEL, MESURÉ : deux sources disent « les dossiers ouverts » et ne
   * donnent pas le même nombre. `openByPriority` somme à 1 847 ;
   * `moderation.cases_by_status/OPEN` du tableau de bord vaut 1 811. L'écart de 36
   * est le nombre de dossiers `IN_REVIEW` — pris en main par un modérateur, donc
   * TOUJOURS DANS LA FILE.
   *
   * Prendre la mesure du tableau de bord ferait disparaître 36 dossiers du compteur
   * d'une file de modération, et le nombre resterait parfaitement crédible.
   */
  /**
   * LE NOMBRE EST ÉCRIT EN DUR, ET C'EST VOLONTAIRE.
   *
   * La première version de ce test calculait l'attendu par le MÊME `reduce` que la
   * dérivation, puis comparait les deux. C'était une tautologie : le test passait
   * quelle que soit la règle, puisqu'il la rejouait au lieu de l'éprouver.
   *
   * La charge relevée porte `{1:512, 2:572, 3:555, 4:104, 5:104}`, qui somme à
   * 1 847. Ce nombre est donc posé ici à la main, pris sur la charge : une
   * dérivation qui ne sommerait qu'une priorité, ou qui en oublierait une, DONNE
   * UN AUTRE NOMBRE et le test rougit.
   */
  it('somme TOUTES les priorités de `openByPriority`, et pas une seule', () => {
    const stats = adminModerationStatsResponseSchema.parse(charge('admin_moderation_stats'));

    expect(vueD04(stats).file.ouverts).toBe('1 847');

    // Et surtout : ce n'est AUCUNE des priorités prises seule.
    for (const n of Object.values(stats.openByPriority)) {
      expect(vueD04(stats).file.ouverts).not.toBe(new Intl.NumberFormat('fr-FR').format(n));
    }
  });

  /**
   * LES DEUX SOURCES NE DONNENT PAS LE MÊME NOMBRE, et c'est le cœur du choix.
   *
   * 1 847 ici, 1 811 au tableau de bord : 36 dossiers `IN_REVIEW`, pris en main par
   * un modérateur et TOUJOURS dans la file. Ce test fige l'écart pour que personne
   * ne « simplifie » D04 en réutilisant la mesure du tableau de bord — ce qui
   * ferait disparaître 36 dossiers derrière un nombre parfaitement crédible.
   */
  it('ne se confond pas avec `moderation.cases_by_status/OPEN` du tableau de bord', () => {
    const stats = adminModerationStatsResponseSchema.parse(charge('admin_moderation_stats'));
    const dash = charge('admin_dashboard') as {
      blocks: { moderation: { metric: string; dimension: string; value: number }[] };
    };
    const open = dash.blocks.moderation.find(
      (p) => p.metric === 'moderation.cases_by_status' && p.dimension === 'OPEN',
    );

    expect(open?.value).toBe(1811);
    expect(vueD04(stats).file.ouverts).not.toBe(new Intl.NumberFormat('fr-FR').format(1811));
  });

  /**
   * `slaComplianceRate` EST UNE PROPORTION DANS [0,1], et la borne n'est pas
   * décorative : le jour où le serveur rendrait `93` au lieu de `0.93`, l'écran
   * doit s'arrêter plutôt qu'afficher « 9 300 % ».
   */
  it('REFUSE un `slaComplianceRate` hors de [0,1]', () => {
    const brut = charge('admin_moderation_stats') as Record<string, unknown>;
    expect(() =>
      adminModerationStatsResponseSchema.parse({ ...brut, slaComplianceRate: 93 }),
    ).toThrow();
  });
});

describe('D05 — le sous-titre du dossier', () => {
  it('dérive « sujet · priorité · SLA » de la charge relevée', () => {
    const dossier = adminModerationCaseDetailSchema.parse(charge('admin_moderation_case'));
    const vue = vueD05(dossier);

    expect(vue.dossier.priorite).toBe(String(dossier.priority));
    // La charge relevée porte `sla: "OVERDUE"` → le mot de la maquette.
    expect(vue.dossier.slaEtat).toBe('dépassé');
    // `HELP_REQUEST` s'écrit en français, jamais en constante d'énumération.
    expect(vue.dossier.sujet).not.toMatch(/[A-Z_]{4,}/);
  });

  /**
   * [RÈGLE DURE] UN LIBELLÉ INCONNU ARRÊTE L'ÉCRAN.
   *
   * Le défaut réel : le serveur ajoute un treizième type de sujet, et le
   * modérateur lit « HELP_RESPONSE · priorité 1 · SLA dépassé ». Un `?? subjectType`
   * en repli aurait produit exactement cela, et le défaut ne se serait vu que le
   * jour où un dossier porte ce type. On refuse, en nommant la valeur reçue.
   */
  it('REFUSE un type de sujet qu’il ne sait pas écrire en français', () => {
    const dossier = adminModerationCaseDetailSchema.parse(charge('admin_moderation_case'));
    const inconnu = { ...dossier, subjectType: 'TYPE_QUI_NEXISTE_PAS' as never };
    expect(() => vueD05(inconnu)).toThrow(/TYPE_QUI_NEXISTE_PAS/);
  });

  /**
   * L'ÉTAT DU SLA VIENT DU SERVEUR, et ce test fige le fait plutôt que l'intention.
   *
   * L'horloge du navigateur est réglable. Un modérateur dont la machine est en
   * retard d'une heure ne doit pas lire « respecté » sur un dossier hors délai —
   * c'est pourquoi `sla` est servi calculé et jamais recalculé ici à partir de
   * `slaDueAt`. La charge porte les deux ; seul `sla` est lu.
   */
  it('lit l’état du SLA SERVI, et ne le recalcule pas sur `slaDueAt`', () => {
    const dossier = adminModerationCaseDetailSchema.parse(charge('admin_moderation_case'));

    // `slaDueAt` est dans le passé ET `sla` vaut OVERDUE : ils concordent ici.
    expect(dossier.sla).toBe('OVERDUE');

    // On fait MENTIR l'échéance en la plaçant loin dans le futur, sans toucher
    // `sla`. Un écran qui recalculerait dirait « respecté » ; celui-ci suit le
    // serveur et dit toujours « dépassé ».
    const futur = { ...dossier, slaDueAt: '2099-01-01T00:00:00.000Z' };
    expect(vueD05(futur).dossier.slaEtat).toBe('dépassé');
  });

  it('REFUSE un état de SLA inconnu', () => {
    const dossier = adminModerationCaseDetailSchema.parse(charge('admin_moderation_case'));
    expect(() => vueD05({ ...dossier, sla: 'PEUT_ETRE' as never })).toThrow(/PEUT_ETRE/);
  });
});

describe('D10 — les fiches professionnelles', () => {
  /**
   * [RÈGLE DURE] `.strict()` SUR UNE FICHE PRO N'EST PAS UNE FORMALITÉ.
   *
   * Cette charge porte un SIRET, un justificatif (`storageKey`) et l'identité du
   * membre. Sans `.strict()`, zod DÉPOUILLE en silence tout champ ajouté — c'est le
   * mécanisme exact par lequel `isPilot` a été servi et ignoré des semaines, et ici
   * le champ greffé pourrait être une donnée personnelle que le rôle ne couvre pas.
   * Un champ inconnu doit ARRÊTER l'écran.
   */
  it('un champ greffé sur une fiche pro ARRÊTE la validation', () => {
    const brut = charge('admin_pro_profiles') as { items: Record<string, unknown>[] };
    const greffe = {
      ...brut,
      items: brut.items.map((i) => ({ ...i, phoneEncrypted: 'ZmFrZQ==' })),
    };
    expect(() => adminProProfilesResponseSchema.parse(greffe)).toThrow();
  });

  /** La charge relevée, elle, passe : le schéma est figé sur du réel. */
  it('la charge relevée passe le schéma sans retouche', () => {
    expect(() => adminProProfilesResponseSchema.parse(charge('admin_pro_profiles'))).not.toThrow();
  });

  /**
   * LE TYPE DU JUSTIFICATIF N'EST PAS SERVI, et c'est la raison pour laquelle la
   * ligne de D10 reste dessinée. Ce test fige le MANQUE : le jour où le back
   * ajoute un type de pièce, il rougira, et ce sera le signal d'aller brancher la
   * ligne au lieu de la laisser figée.
   */
  it('`proof` ne porte AUCUN type de pièce — d’où la ligne non liée', () => {
    const r = adminProProfilesResponseSchema.parse(charge('admin_pro_profiles'));
    const proof = r.items[0]?.proof;
    expect(proof).not.toBeUndefined();
    expect(Object.keys(proof ?? {}).sort()).toEqual(
      ['id', 'mime', 'sizeBytes', 'status', 'storageKey'].sort(),
    );
  });
});

/**
 * ─── TROIS DÉFAUTS QUE LES CAS CI-DESSUS NE VOIENT PAS ─────────────────────
 *
 * Les cas précédents REFUSENT ce qui est inconnu — un type de sujet, un état de
 * SLA, un champ greffé. Refuser l'inconnu ne dit rien de la QUALITÉ de ce qui est
 * connu, et c'est là que vivent les trois défauts suivants. Tous les trois
 * laisseraient l'écran compiler, s'afficher, et mentir.
 */
describe('D04 et D05 — ce que « refuser l’inconnu » ne garde pas', () => {
  const statsReelles = () =>
    adminModerationStatsResponseSchema.parse(charge('admin_moderation_stats'));
  const dossierReel = () =>
    adminModerationCaseDetailSchema.parse(charge('admin_moderation_case'));

  it('[D04] le compteur ne PLAFONNE pas à une page de liste', () => {
    /**
     * LE DÉFAUT QUE CE TEST PRÉVIENT, et c'est le premier réflexe qu'on a en
     * écrivant cet écran : compter `items.length` sur `GET /moderation/cases`.
     * `MAX_PAGE_LIMIT` vaut 50, donc le compteur resterait bloqué à « 50 dossiers
     * ouverts » sur une file de 1 847 — un plafond qui ressemble à un total, et
     * que personne ne regarde deux fois.
     *
     * Le cas ci-dessus vérifie la SOMME ; celui-ci vérifie qu'elle n'est pas
     * plafonnée, ce qui est un autre défaut et se casse autrement.
     */
    const valeur = Number(vueD04(statsReelles()).file.ouverts.replace(/\D/g, ''));
    expect(valeur, 'le compteur est resté sous la taille d’une page de liste').toBeGreaterThan(50);
  });

  it('[D04] une file VIDE rend « 0 », pas une chaîne vide', () => {
    /** Aucun dossier ouvert est l'état SOUHAITABLE, pas une erreur à masquer. */
    expect(vueD04({ ...statsReelles(), openByPriority: {} }).file.ouverts).toBe('0');
  });

  it('[D04] une file NEUVE — rien de résolu, deux champs NULS — se dérive sans incident', () => {
    /**
     * LE CAS DU PREMIER JOUR, celui que l'échantillon ne montrait pas.
     * `ModerationService.stats` rend `slaComplianceRate` et `averageResolutionMs`
     * à `null` tant qu'aucun dossier n'est résolu. La charge relevée les portait
     * tous deux NON nuls, parce que la base de développement a des dossiers
     * résolus — un schéma et une dérivation écrits sur ce seul échantillon se
     * seraient cassés le jour du lancement, c'est-à-dire quand personne ne regarde.
     */
    const vue = vueD04({
      ...statsReelles(),
      slaComplianceRate: null,
      averageResolutionMs: null,
      resolvedSampleSize: 0,
    });
    expect(vue.file.ouverts).toBe('1 847');
  });

  it('[D05] les TROIS états de SLA rendent trois mots DISTINCTS', () => {
    /**
     * LE DÉFAUT QUE CE TEST PRÉVIENT. La maquette n'écrit que « dépassé », parce
     * qu'elle ne dessine qu'un dossier en retard. Un repli qui ferait tomber `OK`
     * et `WARNING` sur ce même mot afficherait « SLA dépassé » sur un dossier dans
     * les délais, et le modérateur traiterait en urgence ce qui n'en est pas une.
     * Le repli inverse — tout sur « respecté » — est plus grave encore.
     *
     * Le cas plus haut REFUSE un état inconnu ; celui-ci garde que les trois états
     * CONNUS ne se confondent pas, ce qu'un refus ne peut pas voir.
     */
    const base = dossierReel();
    const mots = (['OK', 'WARNING', 'OVERDUE'] as const).map(
      (sla) => vueD05({ ...base, sla }).dossier.slaEtat,
    );
    expect(new Set(mots).size, `les trois états rendent ${JSON.stringify(mots)}`).toBe(3);
    expect(mots[2]).toBe('dépassé');
  });

  it('[D05] les DOUZE types de sujet ont un libellé français, aucun ne fuit brut', () => {
    /**
     * L'exhaustivité est déjà tenue par le TYPE — `Record<ReportSubjectType, …>`
     * ne compile pas s'il en manque un. Ce test garde la QUALITÉ des douze
     * libellés, ce que le type ne peut pas faire : un `HELP_RESPONSE` recopié tel
     * quel dans la phrase française compilerait parfaitement et s'afficherait dans
     * l'écran qui sert à décider d'une sanction.
     */
    const types = [
      'POST', 'COMMENT', 'TOPIC', 'GUIDE', 'HELP_REQUEST', 'HELP_RESPONSE',
      'HOUSING', 'JOB', 'PRO', 'EVENT', 'MESSAGE', 'USER',
    ] as const;
    const base = dossierReel();
    for (const subjectType of types) {
      const sujet = vueD05({ ...base, subjectType }).dossier.sujet;
      expect(sujet, `« ${subjectType} » n’a pas de libellé français`).not.toMatch(/^[A-Z_]+$/);
      expect(sujet.length).toBeGreaterThan(2);
    }
  });

  it('[D05] la vue ne porte NI contenu NI auteur — l’absence est gardée', () => {
    /**
     * Ce test garde une ABSENCE, et c'est le point de D05 : aucune route d'équipe
     * ne joint le CONTENU visé au dossier, ni le nom de son auteur. Si quelqu'un
     * ajoute un jour un de ces champs à la vue sans que la route le serve, il sera
     * FIGÉ sur tous les dossiers — et ce test le dira. C'est aussi la trace écrite
     * de ce qu'il faut demander au back.
     */
    expect(Object.keys(vueD05(dossierReel()).dossier).sort()).toEqual([
      'priorite',
      'slaEtat',
      'sujet',
    ]);
  });
});
