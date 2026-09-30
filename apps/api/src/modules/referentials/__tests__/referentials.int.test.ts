import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { MAX_PAGE_LIMIT } from '@app/shared';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import type { StaffUser } from '../../../common/staff.guard';
import { CommunitiesService } from '../../communities/communities.service';
import { ReferentialsService } from '../referentials.service';

/**
 * Administration des référentiels — 02-referentiels.md §4.2.
 *
 * CE MODULE MANQUAIT ENTIÈREMENT, et son absence était le blocage le plus concret
 * du projet : §2.2 dit qu'une ville « passe active quand l'équipe le décide » et
 * qu'« à l'activation : création du `community` CITY, les membres déjà rattachés y
 * sont inscrits par événement ». Aucune route ne le faisait. Le premier geste du
 * jour du lancement — ouvrir la ville pilote — n'avait pas de bouton.
 *
 * Ces tests séparent DEUX choses que l'activation fait, et qui échouent
 * différemment : ce qu'elle écrit dans SA transaction (le drapeau, le réseau, la
 * trace) et ce que l'ÉVÉNEMENT fait ensuite (inscrire les membres). Les mêler
 * exigerait que le relais et le worker tournent pendant les tests, ce que cette
 * suite évite partout — et masquerait lequel des deux est cassé.
 */
describe('référentiels, administration (02 §4.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ref: ReferentialsService;
  let communities: CommunitiesService;

  const run = String(Date.now()).slice(-7);
  let counter = 0;
  /**
   * `StaffUser` est en lecture seule — c'est voulu, un contexte d'équipe ne se
   * modifie pas en cours de requête. On le construit donc après avoir créé le
   * compte, au lieu d'en muter un champ.
   */
  let staff: StaffUser;

  let countryId = '';
  const createdCities: string[] = [];
  const createdUsers: string[] = [];
  const createdCommunities: string[] = [];

  async function city(options: { active?: boolean; country?: string } = {}): Promise<string> {
    counter += 1;
    const created = await ref.createCity(staff, {
      countryId: options.country ?? countryId,
      name: `Ville ${run}${counter}`,
      slug: `ville-${run}-${counter}`,
      latitude: 6.37 + counter / 1000,
      longitude: 2.39 + counter / 1000,
    });
    createdCities.push(created.id);
    if (options.active === true) {
      await ref.activateCity(staff, created.id, { reason: 'Ouverture décidée par l’équipe produit.' });
    }
    return created.id;
  }

  async function memberIn(cityId: string): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `rf${run}${counter}`,
        displayName: 'Membre référentiel',
        phase: 'SETTLED',
        verificationLevel: 'L1',
        plan: 'FREE',
        status: 'ACTIVE',
        originCountryId: countryId,
        cityId,
      },
    });
    createdUsers.push(id);
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    ref = app.get(ReferentialsService);
    communities = app.get(CommunitiesService);

    const staffRow = await prisma.staffUser.create({
      data: {
        id: newId(),
        email: `ref-${run}@local`,
        displayName: 'Équipe contenu',
        passwordHash: 'x',
        totpSecretEncrypted: new Uint8Array([0]),
        role: 'CONTENT_ADMIN',
        isActive: true,
      },
      select: { id: true },
    });
    staff = { staffId: staffRow.id, role: 'CONTENT_ADMIN', sessionId: newId(), ip: null };

    // Un pays `BOTH` et ACTIF : une ville d'un pays inactif n'apparaît nulle part,
    // et le service le refuse — c'est éprouvé plus bas.
    countryId = (await prisma.country.findUniqueOrThrow({ where: { iso2: 'FR' } })).id;
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await prisma.communityMember.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    const cityCommunities = await prisma.community.findMany({
      where: { cityId: { in: createdCities } },
      select: { id: true },
    });
    createdCommunities.push(...cityCommunities.map((c) => c.id));
    if (createdCommunities.length > 0) {
      await prisma.communityMember.deleteMany({ where: { communityId: { in: createdCommunities } } });
      await prisma.community.deleteMany({ where: { id: { in: createdCommunities } } });
    }
    if (createdCities.length > 0) {
      // La fusion pose `merged_into_city_id` : on le retire d'abord, sinon la
      // contrainte `Restrict` de l'auto-référence refuse la suppression.
      await prisma.city.updateMany({
        where: { id: { in: createdCities } },
        data: { mergedIntoCityId: null },
      });
      await prisma.city.deleteMany({ where: { id: { in: createdCities } } });
    }
    await app.close();
  });

  describe('activation d’une ville — le geste du jour du lancement (§2.2)', () => {
    it('[RÈGLE DURE] active la ville, CRÉE son réseau, et émet l’événement', async () => {
      const id = await city();
      const before = await prisma.city.findUniqueOrThrow({
        where: { id },
        select: { isActive: true, activatedAt: true },
      });
      expect(before.isActive).toBe(false);
      expect(before.activatedAt).toBeNull();

      const result = await ref.activateCity(staff, id, {
        reason: 'Vingt membres rattachés : la ville est prête.',
      });

      expect(result.isActive).toBe(true);
      // Le réseau est créé, et son identifiant est rendu : c'est lui qu'on ouvre
      // juste après, depuis l'écran d'administration.
      expect(result.communityId).not.toBeNull();
      const community = await prisma.community.findFirstOrThrow({
        where: { kind: 'CITY', cityId: id },
        select: { id: true, status: true },
      });
      expect(community.status).toBe('ACTIVE');

      const after = await prisma.city.findUniqueOrThrow({
        where: { id },
        select: { isActive: true, activatedAt: true },
      });
      expect(after.isActive).toBe(true);
      expect(after.activatedAt).not.toBeNull();

      // §2.2 : « les membres déjà rattachés y sont inscrits PAR ÉVÉNEMENT ».
      // L'activation promet l'événement ; c'est son consommateur qui inscrit, et
      // il est éprouvé séparément juste en dessous.
      const event = await prisma.domainEvent.findFirst({
        where: { type: 'city.activated', aggregateId: id },
        select: { id: true },
      });
      expect(event).not.toBeNull();
    });

    it('[RÈGLE DURE] l’événement inscrit les membres DÉJÀ rattachés, et le rejeu n’ajoute rien', async () => {
      const id = await city();
      const a = await memberIn(id);
      const b = await memberIn(id);
      await ref.activateCity(staff, id, { reason: 'Ouverture décidée par l’équipe produit.' });

      const first = await communities.handleLocationActivated({ cityId: id });
      expect(first.scanned).toBe(2);
      expect(first.joined).toBeGreaterThanOrEqual(2);

      const community = await prisma.community.findFirstOrThrow({
        where: { kind: 'CITY', cityId: id },
        select: { id: true },
      });
      const members = await prisma.communityMember.findMany({
        where: { communityId: community.id, userId: { in: [a, b] } },
        select: { userId: true, status: true },
      });
      expect(members).toHaveLength(2);
      expect(members.every((m) => m.status === 'ACTIVE')).toBe(true);

      /**
       * LE REJEU N'AJOUTE RIEN. Un consommateur d'événement est rejoué — BullMQ le
       * fait sur échec, et le relais peut le redéposer. Une boucle d'inscriptions
       * créerait un doublon au second passage ; `syncAutoMemberships` RECALCULE,
       * donc il ne fait rien la seconde fois.
       */
      const second = await communities.handleLocationActivated({ cityId: id });
      expect(second.joined).toBe(0);
      expect(
        await prisma.communityMember.count({
          where: { communityId: community.id, userId: { in: [a, b] } },
        }),
      ).toBe(2);
    });

    it('refuse d’activer une ville d’un pays INACTIF', async () => {
      /**
       * Une ville d'un pays inactif n'apparaîtrait nulle part — et le réseau de
       * pays, qui est l'autre appartenance du membre, n'existerait pas. Refuser ici
       * évite une ville « active » qu'aucun écran ne montre, c'est-à-dire le genre
       * de configuration qu'on met des heures à comprendre.
       */
      const inactive = await prisma.country.findFirstOrThrow({
        where: { isActive: false },
        select: { id: true, kind: true },
      });
      await prisma.country.update({ where: { id: inactive.id }, data: { kind: 'BOTH' } });
      const id = await city({ country: inactive.id });

      await expect(
        ref.activateCity(staff, id, { reason: 'Tentative sur un pays fermé.' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      /**
       * ON REMET LA VALEUR LUE, et non une valeur devinée.
       *
       * La première version restaurait `'ORIGIN'` en dur. Elle est tombée sur le
       * Togo — que le seed venait de passer en `BOTH` — et l'a rendu `ORIGIN` : le
       * test SUIVANT, qui importait une ville togolaise, échouait alors en accusant
       * l'import. Une donnée de référence partagée se restaure à ce qu'elle était,
       * jamais à ce qu'on croit qu'elle était.
       */
      await prisma.country.update({ where: { id: inactive.id }, data: { kind: inactive.kind } });
    });

    it('accepte une ville sous un pays ORIGIN, SANS toucher au niveau de vérification', async () => {
      /**
       * CE TEST A CHANGÉ DE SENS, et c'est le cœur de la décision.
       *
       * Il vérifiait le refus, conformément à 02 §2.2. Le porteur a demandé les
       * villes du Bénin et du Togo, et ma première réponse — passer ces pays en
       * `BOTH` — a fait tomber six tests dans quatre fichiers : `kind` décide AUSSI
       * de `phone_numbers.is_destination`, donc du niveau L2. Un numéro béninois se
       * mettait à prouver une présence en France.
       *
       * On relâche donc la règle des villes, et on éprouve ici que l'autre sens de
       * `kind` n'a PAS bougé — sans quoi la prochaine tentative referait le même
       * détour.
       */
      const origin = await prisma.country.findFirstOrThrow({
        where: { kind: 'ORIGIN' },
        select: { id: true, kind: true },
      });
      const created = await ref.createCity(staff, {
        countryId: origin.id,
        name: `Ville d’origine ${run}`,
        slug: `ville-origine-${run}`,
        latitude: 9,
        longitude: 2,
      });
      createdCities.push(created.id);
      expect(created.isActive).toBe(false);

      // Le pays n'a pas changé de nature en chemin.
      const after = await prisma.country.findUniqueOrThrow({
        where: { id: origin.id },
        select: { kind: true },
      });
      expect(after.kind).toBe('ORIGIN');
    });

    it('activer deux fois est un conflit, et `activated_at` ne bouge pas à la réouverture', async () => {
      const id = await city({ active: true });
      await expect(
        ref.activateCity(staff, id, { reason: 'Seconde tentative, sans effet attendu.' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      const opened = await prisma.city.findUniqueOrThrow({
        where: { id },
        select: { activatedAt: true },
      });
      await ref.deactivateCity(staff, id, { reason: 'Fermeture le temps de corriger les données.' });
      await ref.activateCity(staff, id, { reason: 'Réouverture après correction.' });
      const reopened = await prisma.city.findUniqueOrThrow({
        where: { id },
        select: { activatedAt: true },
      });
      // La date d'OUVERTURE, pas celle de la dernière bascule : c'est elle qu'on
      // cherche quand on demande depuis quand une ville existe.
      expect(reopened.activatedAt?.getTime()).toBe(opened.activatedAt?.getTime());
    });

    it('refermer une ville GARDE son réseau', async () => {
      const id = await city({ active: true });
      await ref.deactivateCity(staff, id, { reason: 'Fermeture le temps de corriger les données.' });
      // Une ville qu'on referme doit pouvoir rouvrir sans que ses membres aient
      // perdu leurs sujets et leurs annonces.
      expect(await prisma.community.count({ where: { kind: 'CITY', cityId: id } })).toBe(1);
    });
  });

  /**
   * LA VILLE PILOTE DÉSIGNÉE DANS LA LISTE — décision D6, `PILOT_CITY_SLUG`.
   *
   * Le premier geste du jour du lancement est d'ouvrir UNE ville parmi plus de
   * cinquante, toutes fermées et triées par nom. Ces tests éprouvent que la liste
   * d'administration porte le repère, et qu'elle le porte sur la bonne ligne.
   *
   * ILS NOMMENT « PARIS » EN DUR, ET C'EST VOULU. Une première version interrogeait
   * la liste avec `q: PILOT_CITY_SLUG` puis vérifiait que la ligne marquée portait
   * ce même slug : la mutation `paris → cotonou` passait au VERT, le test se
   * comparant à lui-même. Le point unique de changement est une propriété du CODE
   * DE PRODUCTION, pas des tests : c'est en écrivant la ville attendue à la main
   * qu'on rend l'arbitrage éprouvable.
   */
  describe('la ville pilote dans la liste d’administration (D6)', () => {
    /**
     * `limit` est plafonné à `MAX_PAGE_LIMIT` par le schéma de la route : les
     * appels ci-dessous restent dans ce que l'application admin peut demander,
     * sinon le test éprouverait une page que personne n'obtient.
     */
    const page = { limit: MAX_PAGE_LIMIT } as const;

    it('marque PARIS, et elle seule dans sa page', async () => {
      const { items } = await ref.listCities({ ...page, q: 'Paris' });
      const paris = items.find((c) => c.slug === 'paris');
      expect(paris, 'Paris a disparu du référentiel des villes.').toBeDefined();
      expect(paris?.isPilot).toBe(true);
      // Dans un pays de DESTINATION : un réseau CITY s'ouvre là où les membres
      // arrivent. Et avec ce que la France exige d'une ville.
      expect(paris?.country.iso2).toBe('FR');
      expect(paris?.region).toBeTruthy();
      expect(paris?.latitude).toBeCloseTo(48.8566, 3);
      expect(paris?.longitude).toBeCloseTo(2.3522, 3);

      expect(items.filter((c) => c.isPilot)).toHaveLength(1);
    });

    /**
     * LE REPÈRE N'EST PAS UN ÉTAT. Désigner la pilote ne l'ouvre pas : `isActive`
     * reste seul à dire ce qui est ouvert, et `isPilot` survivrait à une
     * fermeture. Les confondre ferait croire la ville ouverte avant le jour J.
     */
    it('ne dit RIEN de l’ouverture : `isPilot` et `isActive` sont indépendants', async () => {
      const { items } = await ref.listCities({ ...page, q: 'Paris' });
      const pilot = items.find((c) => c.isPilot);
      const stored = await prisma.city.findUniqueOrThrow({
        where: { slug: 'paris' },
        select: { isActive: true },
      });
      expect(pilot?.isActive).toBe(stored.isActive);
    });

    it('ne marque AUCUNE des villes créées par cette suite', async () => {
      await city();
      await city({ active: true });
      const { items } = await ref.listCities({ ...page, q: `Ville ${run}` });
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((c) => c.isPilot === false)).toBe(true);
    });

    /**
     * COTONOU EST AU RÉFÉRENTIEL, ET N'EST PAS LA PILOTE.
     *
     * Une première réponse l'avait donnée comme ville pilote ; elle a été annulée.
     * Ce test garde les deux moitiés de l'arbitrage : la ville reste une entrée du
     * référentiel — nommer la pilote n'en supprime aucune — et ne porte pas le
     * repère.
     */
    it('Cotonou reste une ville du Bénin, et n’est pas la pilote', async () => {
      const { items } = await ref.listCities({ ...page, q: 'Cotonou' });
      const cotonou = items.find((c) => c.slug === 'cotonou');
      expect(cotonou, 'Cotonou a disparu du référentiel des villes.').toBeDefined();
      expect(cotonou?.country.iso2).toBe('BJ');
      expect(cotonou?.isPilot).toBe(false);
    });
  });

  describe('fusion de deux villes (§2.2, irréversible)', () => {
    it('[RÈGLE DURE] exige le SLUG de la ville absorbée, tapé à la main', async () => {
      const source = await city();
      const target = await city();
      await expect(
        ref.mergeCity(staff, source, {
          targetCityId: target,
          confirmSlug: 'pas-le-bon-slug',
          reason: 'Fusion des deux entrées de la même ville.',
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

      // Rien n'a bougé : une confirmation manquée ne fusionne pas à moitié.
      const untouched = await prisma.city.findUniqueOrThrow({
        where: { id: source },
        select: { mergedIntoCityId: true },
      });
      expect(untouched.mergedIntoCityId).toBeNull();
    });

    it('déplace les membres et rend l’ancienne invisible', async () => {
      const source = await city({ active: true });
      const target = await city({ active: true });
      const moved = await memberIn(source);
      const slug = (await prisma.city.findUniqueOrThrow({ where: { id: source }, select: { slug: true } })).slug;

      const result = await ref.mergeCity(staff, source, {
        targetCityId: target,
        confirmSlug: slug,
        reason: 'Fusion des deux entrées de la même ville.',
      });
      expect(result.usersMoved).toBe(1);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: moved },
        select: { cityId: true },
      });
      expect(user.cityId).toBe(target);

      const absorbed = await prisma.city.findUniqueOrThrow({
        where: { id: source },
        select: { mergedIntoCityId: true, isActive: true },
      });
      expect(absorbed.mergedIntoCityId).toBe(target);
      // « L'ancienne devient invisible » : inactive, donc ni carte ni fiche.
      expect(absorbed.isActive).toBe(false);
    });

    it('refuse de fusionner vers une ville elle-même fusionnée', async () => {
      const first = await city();
      const middle = await city();
      const last = await city();
      const middleSlug = (await prisma.city.findUniqueOrThrow({ where: { id: middle }, select: { slug: true } })).slug;
      await ref.mergeCity(staff, middle, {
        targetCityId: last,
        confirmSlug: middleSlug,
        reason: 'Première fusion de la chaîne.',
      });

      const firstSlug = (await prisma.city.findUniqueOrThrow({ where: { id: first }, select: { slug: true } })).slug;
      // Suivre la chaîne donnerait un résultat juste aujourd'hui et une chaîne de
      // redirections demain, que personne ne saurait plus lire.
      await expect(
        ref.mergeCity(staff, first, {
          targetCityId: middle,
          confirmSlug: firstSlug,
          reason: 'Fusion vers une ville déjà fusionnée.',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('import CSV (§4.2)', () => {
    const csv = (rows: string[]): string => `nom;région;latitude;longitude;pays\n${rows.join('\n')}`;

    it('VALIDE sans rien écrire quand `apply` est faux', async () => {
      const before = await prisma.city.count();
      const report = await ref.importCities(staff, {
        csv: csv([`Import A ${run};Littoral;6.37;2.39;BJ`]),
        apply: false,
      });
      expect(report.applied).toBe(false);
      expect(report.accepted).toBe(1);
      // Rien n'est écrit : importer est le genre d'opération qu'on lance une fois
      // sur un fichier qu'on n'a pas relu.
      expect(await prisma.city.count()).toBe(before);
    });

    it('refuse ligne par ligne et dit POURQUOI, sans bloquer les bonnes', async () => {
      const report = await ref.importCities(staff, {
        csv: csv([
          `Import B ${run};Littoral;6.37;2.39;BJ`,
          `Import C ${run};Centrale;999;2.39;TG`,
          `Import D ${run};Maritime;6.13;1.22;ZZ`,
          `Cotonou;Littoral;6.37;2.39;BJ`,
        ]),
        apply: false,
      });
      expect(report.accepted).toBe(1);
      expect(report.rejected).toHaveLength(3);
      const reasons = report.rejected.map((r) => r.reason).join(' | ');
      expect(reasons).toMatch(/latitude invalide/);
      expect(reasons).toMatch(/pays inconnu/);
      expect(reasons).toMatch(/déjà connue/);
    });

    it('écrit quand `apply` est vrai, avec un slug sans accents', async () => {
      const name = `Kpalimé Import ${run}`;
      const report = await ref.importCities(staff, {
        csv: csv([`${name};Plateaux;6.9;0.63;TG`]),
        apply: true,
      });
      expect(report.applied).toBe(true);
      expect(report.accepted).toBe(1);

      const created = await prisma.city.findFirstOrThrow({
        where: { name },
        select: { id: true, slug: true, isActive: true },
      });
      createdCities.push(created.id);
      // Le slug est dérivé du nom, sans accents : « Kpalimé » donne « kpalime ».
      expect(created.slug).toMatch(/^kpalime-import-/);
      // Inactive : l'import ne décide pas d'ouvrir une ville.
      expect(created.isActive).toBe(false);
    });
  });

  describe('les listes fermées (§2.3)', () => {
    it('une compétence se retire des propositions, une langue NON', async () => {
      const skill = await ref.createTagged(staff, 'skills', {
        nameFr: `Compétence ${run}`,
        category: 'numérique',
        isActive: true,
      });
      await ref.updateTagged(staff, 'skills', skill.id, { isActive: false });
      const row = await prisma.skill.findUniqueOrThrow({
        where: { id: skill.id },
        select: { isActive: true },
      });
      expect(row.isActive).toBe(false);
      await prisma.skill.delete({ where: { id: skill.id } });

      /**
       * §2.3 exige la même chose pour les LANGUES — « une entrée `is_active =
       * false` reste affichée sur les profils qui l'ont déjà, mais n'est plus
       * proposée ». La colonne manque au schéma, signalée et non migrée : la liste
       * le DIT au lieu de faire semblant.
       */
      const languages = await ref.listSimple('languages', {});
      expect(languages.meta.deactivatable).toBe(false);
      const skills = await ref.listSimple('skills', {});
      expect(skills.meta.deactivatable).toBe(true);
    });
  });

  describe('la trace d’audit (§4.2, dernière ligne)', () => {
    it('chaque écriture laisse sa trace, sous son propre nom', async () => {
      const id = await city();
      await ref.activateCity(staff, id, { reason: 'Ouverture décidée par l’équipe produit.' });

      const traces = await prisma.auditLog.findMany({
        where: { targetId: id, actorId: staff.staffId },
        select: { action: true },
      });
      const actions = traces.map((t) => t.action);
      // Deux actions DISTINCTES : créer une ville et l'ouvrir ne sont pas le même
      // geste, et le journal doit pouvoir répondre « qui a ouvert cette ville ».
      expect(actions).toContain('ref.city_created');
      expect(actions).toContain('ref.city_activated');
    });
  });
});
