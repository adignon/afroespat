import { randomBytes } from 'node:crypto';
import { newId } from '@app/db';
import {
  FEED_LIMITS,
  POST_REACTION_KIND,
  POST_TYPE_VOCABULARY,
  STORY_BACKGROUND_COLORS,
  STORY_TYPE_VOCABULARY,
  feedQuerySchema,
  type PostType,
  type StoryType,
} from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { VisibilityService } from '../../../common/visibility.service';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { ConsentsService } from '../../consents/consents.service';
import { createPollSchema } from '@app/shared';
import { CommunitiesService } from '../../communities/communities.service';
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../../messaging/messaging.service';
import { FeedService, type FeedActor } from '../feed.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';

/**
 * Fil d'actualité — 04-fil.md §9.
 *
 * Les dix règles dures de §9 ont chacune leur test, nommé `rule:`. Trois
 * principes ont guidé leur écriture, et ils expliquent leur longueur.
 *
 * 1. **Chaque test vérifie d'abord sa PRÉMISSE.** Un test de blocage qui
 *    n'établit pas que le contenu était visible AVANT le blocage passerait aussi
 *    sur une liste vide — c'est-à-dire pour rien.
 *
 * 2. **On teste la COMBINAISON de deux filtres, jamais chacun seul.** C'est la
 *    seule façon d'attraper deux clauses conditionnelles qui posent la même clé
 *    et s'écrasent : chacune prise isolément fonctionne, et `tsc` ne dit rien.
 *    D'où « blocage + filtre de type + filtre de ville + filtre de phase », et
 *    « blocage + audience CITY ».
 *
 * 3. **On teste le cas NULL des colonnes nullables.** `posts.city_id` est
 *    nullable, et la remontée locale du §2.3 partage le fil en deux moitiés : si
 *    la seconde était écrite `notIn` sans tolérance au NULL, les publications
 *    sans ville disparaîtraient du fil entier. Le test le prouve en donnant une
 *    ville au LECTEUR et aucune à l'auteur.
 */
/**
 * Ces tests parlent à une VRAIE base et créent leurs membres par le vrai
 * parcours d'inscription (OTP et hachage compris). Les plus lourds en créent une
 * dizaine : ils dépassent les 5 secondes que vitest accorde par défaut, non
 * parce qu'ils attendent quelque chose, mais parce qu'ils travaillent.
 *
 * Le délai est large — deux minutes — et ce n'est pas de la prudence gratuite.
 * Mesuré sur cette machine, le temps de COMPILATION du module par vitest varie
 * de 0,6 s à 62 s d'un lancement à l'autre, sans que les tests changent. Vitest
 * compte cette compilation dans la durée du test qui déclenche l'import : un
 * délai de 30 s faisait donc échouer un test différent à chaque lancement,
 * toujours le premier à s'exécuter, et jamais en isolation. Un faux échec qui se
 * déplace coûte plus cher qu'un test lent.
 *
 * Le délai est posé ici, dans CE fichier, et non dans le `vitest.int.config.ts`
 * que tous les modules partagent.
 */
const TEST_TIMEOUT_MS = 120_000;

describe('fil d’actualité (04 §2, §4, §9)', () => {
  let prisma: PrismaService;
  let feed: FeedService;
  /**
   * LE SERVICE DU MODULE 07, pour voter sur le sondage d'une publication.
   *
   * On ne monte pas un second mécanisme de vote : `polls` est le même modèle des
   * deux côtés, et `POST /polls/:id/vote` est la route qui existe. Le cas emploie
   * donc le service qui la sert, ce qui vérifie AUSSI que son garde d'accès sait
   * traiter un sondage sans réseau.
   */
  let communities: CommunitiesService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();

  const createdUserIds: string[] = [];
  const createdCommunityIds: string[] = [];
  const createdCityTipIds: string[] = [];
  const createdMediaIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdStepDefinitionIds: string[] = [];
  const createdScamAlertIds: string[] = [];
  const createdStaffIds: string[] = [];
  /**
   * NETTOYÉS APRÈS LES PUBLICATIONS : `post_guides` les référence, et la base est
   * PARTAGÉE entre fichiers de test — un reste ferait échouer une autre suite sur
   * une contrainte de clé étrangère qui n'a rien à voir avec elle.
   */
  const createdGuides: string[] = [];

  /** Lyon. */
  let cityA: { id: string; name: string };
  /** Villeurbanne — 4 km : DANS le rayon de 30 km, mais pas la même ville. */
  let cityNear: { id: string; name: string };
  /** Saint-Étienne — 50 km : HORS du rayon, donc « le reste » du fil. */
  let cityFar: { id: string; name: string };

  let counter = 0;
  const nextPhone = (): string => numeroDEpreuve(counter++);

  /**
   * UNE LIGNE DE FIL QUI DOIT ÊTRE LISIBLE, et le test le dit au lieu de le
   * supposer.
   *
   * `commentPage` rend désormais une UNION : un commentaire, ou l'emplacement
   * `{ removed: true }` qu'un retrait de modération laisse. Les cas qui lisent
   * `.id` ou `.replies` parlent tous d'un commentaire qu'ils viennent de créer :
   * cette fonction porte l'assertion à l'endroit où elle a un sens, et un
   * emplacement qui apparaîtrait là ÉCHOUERAIT le test en le nommant, plutôt que
   * de lever un `TypeError` trente lignes plus bas.
   */
  function lisible<T extends object>(ligne: T | { removed: true } | undefined): T {
    expect(ligne, 'la ligne attendue manque dans le fil').toBeDefined();
    expect(
      ligne !== undefined && 'removed' in ligne,
      'cette ligne devait être un commentaire lisible, pas un emplacement retiré',
    ).toBe(false);
    return ligne as T;
  }

  /**
   * Un membre neuf. Le NIVEAU est porté par l'acteur, comme le jeton le porte —
   * c'est ce qui rend la règle dure de §9 (« un L0 ne peut pas publier ») visible
   * sans passer par HTTP.
   */
  async function newMember(
    level: 'L0' | 'L1' | 'L2' = 'L1',
    over: { cityId?: string | null; phase?: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED' } = {},
  ): Promise<FeedActor> {
    const { challengeId } = await auth.requestOtp({
      phone: nextPhone(),
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const session = await auth.verifyOtp({
      challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    createdUserIds.push(session.userId);
    const cityId = over.cityId === undefined ? cityA.id : over.cityId;
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        verificationLevel: level,
        cityId,
        ...(over.phase === undefined ? {} : { phase: over.phase }),
      },
    });
    return { userId: session.userId, level };
  }

  const post = (over: Record<string, unknown> = {}) => ({
    type: 'DISCUSSION' as PostType,
    body: 'Le rendez-vous à la préfecture s’est bien passé, le dossier est déposé.',
    ...over,
  });

  const story = (over: Record<string, unknown> = {}) => ({
    type: 'CONSEIL' as StoryType,
    body: 'Pensez à demander le récépissé avant de partir du guichet.',
    backgroundColor: STORY_BACKGROUND_COLORS[0],
    textStyle: 'BOLD' as const,
    category: 'LOGEMENT' as const,
    audience: 'ALL' as const,
    allowMessages: false,
    ...over,
  });

  /** Un réseau dont `member` est membre ACTIF — pour le déplacement de §2.3. */
  async function newCommunity(memberIds: readonly string[]): Promise<{ id: string; name: string }> {
    const suffix = `${Date.now()}-${counter++}`;
    const community = await prisma.community.create({
      data: {
        id: newId(),
        kind: 'INTEREST',
        name: `Réseau de test ${suffix}`,
        slug: `reseau-test-${suffix}`,
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        memberCount: memberIds.length,
        lastActivityAt: new Date(),
      },
    });
    createdCommunityIds.push(community.id);
    for (const userId of memberIds) {
      await prisma.communityMember.create({
        data: {
          id: newId(),
          communityId: community.id,
          userId,
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
    }
    return { id: community.id, name: community.name };
  }

  /** Une `step_definition` réutilisable, pour les conseils et l'encart d'étape. */
  async function newStepDefinition(nameFr = 'Logement'): Promise<string> {
    const definition = await prisma.stepDefinition.create({
      data: {
        id: newId(),
        code: `test-feed-step-${Date.now()}-${counter++}`,
        nameFr,
        category: 'ARRIVAL',
        blockerTarget: 'HELP',
        isMajorMilestone: false,
        isRisky: false,
        documentChecklist: [],
      },
    });
    createdStepDefinitionIds.push(definition.id);
    return definition.id;
  }

  /**
   * UN GUIDE, dans l'état demandé.
   *
   * `PUBLISHED` est le seul état qu'une publication peut lier : un brouillon ou
   * un guide supprimé poserait une étiquette qui mène à une page introuvable.
   * `draftGuide` existe pour éprouver précisément ce refus.
   */
  async function guideAvecStatut(status: 'PUBLISHED' | 'DRAFT'): Promise<string> {
    const id = newId();
    const marque = id.slice(-8);
    await prisma.guide.create({
      data: {
        id,
        title: `Guide ${marque}`,
        slug: `guide-${marque}`,
        category: 'HOUSING',
        scope: 'UNIVERSAL',
        status,
        lastContentUpdateAt: new Date(),
      },
    });
    createdGuides.push(id);
    return id;
  }

  const publishedGuide = () => guideAvecStatut('PUBLISHED');
  const draftGuide = () => guideAvecStatut('DRAFT');

  /**
   * LA PAGE 1 D'UN GUIDE — le sujet d'un commentaire depuis que les guides ont
   * des pages (05 `GuidePage`).
   *
   * Écrite en base plutôt que par `GuidesService` : ce fichier éprouve le module
   * 04, et monter le service des guides ici pour obtenir un identifiant de page
   * aurait fait dépendre les tests du fil de la publication d'un guide.
   */
  async function pageDeGuide(guideId: string): Promise<string> {
    const id = newId();
    const page = await prisma.guidePage.create({
      data: { id, guideId, position: 1, title: `Page ${id.slice(-8)}`, slug: `page-${id.slice(-8)}` },
    });
    return page.id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const outbox = new OutboxService(prisma);
    feed = new FeedService(prisma, outbox, new AuditService(prisma), new VisibilityService(prisma));
    /**
     * `MessagingService` EN SIXIÈME ARGUMENT — ajouté au constructeur de
     * `CommunitiesService` pour « Contacter les modérateurs ». Ce test ne s'en
     * sert pas : il monte le module réseaux pour créer les réseaux où ses
     * publications atterrissent.
     */
    const auditFeed = new AuditService(prisma);
    const visibilityFeed = new VisibilityService(prisma);
    communities = new CommunitiesService(
      prisma,
      outbox,
      auditFeed,
      visibilityFeed,
      new MessagingService(
        prisma,
        new CryptoService(),
        outbox,
        auditFeed,
        visibilityFeed,
        new ConnectionsService(prisma, outbox, auditFeed, visibilityFeed),
      ),
    );
    auth = new AuthService(
      prisma,
      new CryptoService(),
      outbox,
      new TokenService(),
      new ConsentsService(prisma),
      sms,
      new FakeCaptchaProvider(),
    );

    cityA = await prisma.city.findUniqueOrThrow({
      where: { slug: 'lyon' },
      select: { id: true, name: true },
    });
    cityNear = await prisma.city.findUniqueOrThrow({
      where: { slug: 'villeurbanne' },
      select: { id: true, name: true },
    });
    cityFar = await prisma.city.findUniqueOrThrow({
      where: { slug: 'saint-etienne' },
      select: { id: true, name: true },
    });
  });

  afterAll(async () => {
    if (createdGuides.length > 0) {
      await prisma.postGuide.deleteMany({ where: { guideId: { in: createdGuides } } });
      await prisma.guide.deleteMany({ where: { id: { in: createdGuides } } });
    }
    // L'ordre compte : `scam_alerts.created_by_staff_id` est en `Restrict`, et
    // `city_tips.author_user_id` en `SetNull` — un conseil de ville survivrait
    // donc à son auteur et resterait dans la base des tests suivants.
    if (createdScamAlertIds.length > 0) {
      await prisma.scamAlert.deleteMany({ where: { id: { in: createdScamAlertIds } } });
    }
    if (createdStaffIds.length > 0) {
      await prisma.staffUser.deleteMany({ where: { id: { in: createdStaffIds } } });
    }
    if (createdCityTipIds.length > 0) {
      await prisma.cityTip.deleteMany({ where: { id: { in: createdCityTipIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdCommunityIds.length > 0) {
      await prisma.community.deleteMany({ where: { id: { in: createdCommunityIds } } });
    }
    if (createdMediaIds.length > 0) {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
    }
    if (createdTemplateIds.length > 0) {
      await prisma.journeyTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
    }
    if (createdStepDefinitionIds.length > 0) {
      await prisma.stepDefinition.deleteMany({ where: { id: { in: createdStepDefinitionIds } } });
    }
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE : le titre personnel d'un parcours n'apparaît jamais ════════

  it('rule: le titre personnel d’un parcours n’apparaît jamais dans le fil', async () => {
    const author = await newMember();
    const personalTitle = 'Mon projet secret à moi, à ne jamais montrer';

    const template = await prisma.journeyTemplate.create({
      data: {
        id: newId(),
        code: `test-feed-${Date.now()}`,
        nameFr: 'Études',
        targetPhase: 'PRE_DEPARTURE',
        isActive: true,
        sortOrder: 901,
      },
    });
    createdTemplateIds.push(template.id);
    const version = await prisma.journeyTemplateVersion.create({
      data: { id: newId(), templateId: template.id, version: 1, status: 'PUBLISHED' },
    });
    const definitionId = await newStepDefinition('Logement');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: author.userId },
      select: { originCountryId: true },
    });
    const journey = await prisma.journey.create({
      data: {
        id: newId(),
        ownerUserId: author.userId,
        templateVersionId: version.id,
        title: personalTitle,
        status: 'ACTIVE',
        originCountryId: user.originCountryId,
        destinationCityId: cityA.id,
        lastActivityAt: new Date(),
      },
    });
    // Trois étapes, la deuxième franchie : l'encart doit dire « 2 sur 3 ».
    const steps = await Promise.all(
      [1, 2, 3].map((position) =>
        prisma.journeyStep.create({
          data: {
            id: newId(),
            journeyId: journey.id,
            ...(position === 2 ? { stepDefinitionId: definitionId } : {}),
            title: `Étape ${position}`,
            position,
            status: position === 2 ? 'DONE' : 'TODO',
            ...(position === 2 ? { completedAt: new Date() } : {}),
          },
        }),
      ),
    );
    const doneStep = steps[1];
    if (doneStep === undefined) expect.unreachable('fixture d’étape absente');

    const created = await feed.createPost(
      author,
      post({ type: 'VICTORY', journeyStepId: doneStep.id }),
    );

    // §2.2 : la ligne de contexte porte le NOM DU TYPE, jamais le titre personnel.
    expect(created.post.context.text).toContain('Parcours Études');
    expect(created.post.context.text).toContain(cityA.name);
    expect(created.post.stepBadge?.label).toBe('Étape franchie · 2 sur 3');

    // La prémisse : le titre personnel EXISTE bien en base. Sans ce contrôle, le
    // test passerait aussi si le parcours n'avait pas de titre du tout.
    expect(
      (await prisma.journey.findUniqueOrThrow({ where: { id: journey.id } })).title,
    ).toBe(personalTitle);

    // Et il n'apparaît NULLE PART dans ce qui sort de l'API — ni dans le détail,
    // ni dans la liste. La sérialisation entière est inspectée : chercher un champ
    // précis laisserait passer le titre glissé dans un autre.
    const reader = await newMember();
    const list = await feed.feed(reader, feedQuerySchema.parse({}));
    for (const payload of [created, await feed.postDetail(reader, created.post.id), list]) {
      expect(JSON.stringify(payload)).not.toContain('secret');
      expect(JSON.stringify(payload)).not.toContain(personalTitle);
    }
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : le vocabulaire de réaction suit le type (§2.1) ════════════

  it('rule: le vocabulaire de réaction renvoyé correspond au type de publication', async () => {
    // Le tableau de §2.1, recopié ici à la main. Volontairement : le lire depuis
    // `POST_REACTION_KIND` ferait un test qui se contente de comparer la table à
    // elle-même et passerait quelle que soit sa valeur.
    const expected = {
      VICTORY: { kind: 'BRAVO', action: 'Bravo', one: 'félicitation', many: 'félicitations' },
      QUESTION: { kind: 'SUPPORT', action: 'Soutenir', one: 'réponse', many: 'réponses' },
      INFO: { kind: 'LIKE', action: 'J’ai vu', one: 'réaction', many: 'réactions' },
      DISCUSSION: { kind: 'LIKE', action: 'J’aime', one: 'réaction', many: 'réactions' },
    } as const;

    for (const [type, want] of Object.entries(expected)) {
      const author = await newMember();
      const reader = await newMember();
      const created = await feed.createPost(author, post({ type }));

      const card = created.post;
      expect(card.reaction.kind).toBe(want.kind);
      expect(card.reaction.actionLabel).toBe(want.action);

      const reacted = await feed.reactToPost(reader, card.id);
      expect(reacted.kind).toBe(want.kind);
      expect(reacted.actionLabel).toBe(want.action);

      // Le `kind` STOCKÉ est celui du type — c'est là que la règle se joue, pas
      // dans le libellé renvoyé.
      const row = await prisma.postReaction.findFirstOrThrow({
        where: { postId: card.id, userId: reader.userId },
      });
      expect(row.kind).toBe(want.kind);

      // §2.1 : le compteur d'une QUESTION compte des RÉPONSES (= commentaires),
      // pas des réactions. Les autres comptent les réactions.
      if (type === 'QUESTION') {
        await feed.createComment(reader, {
          subjectType: 'POST',
          subjectId: card.id,
          body: 'Il faut prendre rendez-vous en ligne avant de se déplacer.',
        });
      }
      const after = await feed.postDetail(reader, card.id);
      expect(after.post.counter.displayCount).toBe(1);
      // Le compteur est ACCORDÉ : « 1 félicitation », pas « 1 félicitations ».
      // Attendre le pluriel ici était une erreur du test, pas du service —
      // `countLabel` suit le français, et §5 montre le compteur sous la carte.
      expect(after.post.counter.word).toBe(want.one);

      // Au pluriel, avec un second membre : c'est la forme que §2.1 cite.
      const secondReader = await newMember('L0');
      if (type === 'QUESTION') {
        await feed.createComment(secondReader, {
          subjectType: 'POST',
          subjectId: card.id,
          body: 'Même question de mon côté, je viens d’arriver.',
        });
      } else {
        await feed.reactToPost(secondReader, card.id);
      }
      const plural = await feed.postDetail(reader, card.id);
      expect(plural.post.counter.displayCount).toBe(2);
      expect(plural.post.counter.word).toBe(want.many);
      // Le vocabulaire partagé dit la même chose que l'API : une seule source.
      expect(POST_TYPE_VOCABULARY[type as PostType].reaction).toBe(want.kind);
      expect(POST_REACTION_KIND[type as PostType]).toBe(want.kind);
    }
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : un L0 commente et réagit, mais ne publie pas (§2.4) ══════

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE CAS A ÉTÉ RETOURNÉ DEUX FOIS. IL REVIENT À §2.4, ET VOICI LA TRACE    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ÉTAT 1 — il gelait §2.4 mot pour mot : « Capacité `post.create` (L1). Un L0
   * voit le composeur grisé avec l'invitation à monter de niveau. »
   *
   * ÉTAT 2 — le porteur, après avoir vu la photo refusée dans le composeur de
   * story : « Autorise pour tout le monde la possibilité de publier des stories
   * avec tout ce qui va avec. » `post.create` est passée en L0 et ce cas a été
   * retourné : le composeur était ouvert, `canPost` valait `true`.
   *
   * ÉTAT 3, celui-ci — la refonte des niveaux (2026-10-09) range explicitement
   * « publier dans le fil d'actualité et stories » en N1 : « N1 : publier dans le
   * fil d'actualité et stories, répondre à l'entraide, demander un parrain. »
   * L'instruction la plus récente l'emporte, `post.create` est revenue en L1, et
   * §2.4 se retrouve dit par la table plutôt que contredit par elle.
   *
   * ── CE QUE CE VA-ET-VIENT ENSEIGNE, ET QUI VAUT PLUS QUE LE CAS ───────────
   *
   * Ce test n'a jamais été faux : il a été JUSTE TROIS FOIS, sur trois règles
   * différentes. C'est ce qu'on attend d'un test de règle — qu'il tombe le jour où
   * la règle change, bruyamment, au lieu de laisser le code dériver en silence.
   * Ce qu'il faut tenir, c'est l'en-tête : sans la trace des trois états, le
   * prochain lecteur croit lire une règle intemporelle.
   *
   * ── L'AUTRE MOITIÉ N'A JAMAIS BOUGÉ, ET C'EST ELLE QU'ON PROTÈGE ──────────
   *
   * COMMENTER ET RÉAGIR. `comment.create` est en L0 dans les trois états — la
   * liste du porteur l'y range elle aussi (« N0 : commenter des publications »).
   * Le piège serait de fermer le commentaire « par symétrie » le jour où on ferme
   * la publication : les deux moitiés sont ici dans le MÊME cas exprès, pour que
   * ce geste-là casse quelque chose.
   */
  it('rule: un L0 commente et réagit, mais ne publie pas (§2.4)', async () => {
    const pre = await newMember('L0');
    const settled = await newMember('L1');
    // La prémisse : le membre est bien L0, sinon le test ne prouve rien.
    expect(pre.level).toBe('L0');

    await expect(feed.createPost(pre, post())).rejects.toThrow();

    // Et l'API le DIT à l'écran : `canPost` est ce qui grise le composeur. Sans
    // cette attente, le serveur refuserait pendant que le bouton reste allumé —
    // le membre écrirait son texte avant d'apprendre qu'il ne peut pas l'envoyer.
    const list = await feed.feed(pre, feedQuerySchema.parse({}));
    expect(list.meta.canPost).toBe(false);

    // La story tombe avec : §2.6 emploie la MÊME capacité, et la liste du porteur
    // nomme les deux d'un seul souffle (« le fil d'actualité ET stories »).
    await expect(feed.createStory(pre, story())).rejects.toThrow();

    // Et il COMMENTE et RÉAGIT — l'autre moitié de la règle, qui n'a jamais
    // dépendu du niveau et que l'on casse en ajoutant un contrôle « par symétrie ».
    const published = await feed.createPost(settled, post({ type: 'QUESTION' }));
    const comment = await feed.createComment(pre, {
      subjectType: 'POST',
      subjectId: published.post.id,
      body: 'Je me pose la même question, je suis encore au pays.',
    });
    expect(comment.comment.id).toBeDefined();
    const reacted = await feed.reactToPost(pre, published.post.id);
    expect(reacted.kind).toBe('SUPPORT');
    expect(reacted.reactionCount).toBe(1);

    // Et le même texte publié par un L1 passe : c'est bien le NIVEAU qui refusait,
    // et non le texte, la ville ou le type.
    expect((await feed.createPost(settled, post())).post.id).toBeDefined();
    expect((await feed.feed(settled, feedQuerySchema.parse({}))).meta.canPost).toBe(true);
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : aucun score d'engagement dans le tri (§2.3) ══════════════

  it('rule: le fil n’applique aucun score d’engagement au tri', async () => {
    const reader = await newMember();
    const authorOld = await newMember();
    const authorNew = await newMember();

    // Les deux publications sont LOCALES (même ville que le lecteur) et de la
    // même tranche de 24 h : seul le temps peut alors les séparer.
    const older = await feed.createPost(authorOld, post({ body: 'Publication ancienne, très commentée.' }));
    const newer = await feed.createPost(authorNew, post({ body: 'Publication récente, ignorée de tous.' }));

    // On charge l'ancienne d'engagement : cinq réactions et trois commentaires.
    for (let i = 0; i < 5; i += 1) {
      const fan = await newMember('L0');
      await feed.reactToPost(fan, older.post.id);
      if (i < 3) {
        await feed.createComment(fan, {
          subjectType: 'POST',
          subjectId: older.post.id,
          body: `Commentaire numéro ${i + 1} sur cette publication.`,
        });
      }
    }
    const loaded = await prisma.post.findUniqueOrThrow({ where: { id: older.post.id } });
    // La prémisse : l'engagement EXISTE. Sans elle, l'ordre observé ne prouverait
    // rien — il serait juste chronologique par défaut.
    expect(loaded.reactionCount).toBe(5);
    expect(loaded.commentCount).toBe(3);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: newer.post.id } })).reactionCount,
    ).toBe(0);

    const ids = (await feed.feed(reader, feedQuerySchema.parse({ limit: 50 }))).items.map(
      (i) => (i as { id: string }).id,
    );
    // La récente reste devant : chronologique inverse, et rien d'autre.
    expect(ids.indexOf(newer.post.id)).toBeLessThan(ids.indexOf(older.post.id));
  }, TEST_TIMEOUT_MS);

  // ══ §2.3 : remontée locale, et le cas NULL de `posts.city_id` ═════════════

  it('remonte le local dans la tranche de 24 h, sans PERDRE les publications sans ville', async () => {
    const reader = await newMember('L1', { cityId: cityA.id });
    const localAuthor = await newMember('L1', { cityId: cityNear.id });
    const farAuthor = await newMember('L1', { cityId: cityFar.id });
    // §2.2 : `posts.city_id` suit la ville de l'AUTEUR, et elle est nullable —
    // un pré-départ qui n'a pas encore choisi sa ville publie quand même.
    const cityless = await newMember('L1', { cityId: null });

    // Ordre de création : local, puis lointain, puis sans ville. Chronologique
    // inverse donnerait donc : sans ville, lointain, local.
    const localPost = await feed.createPost(localAuthor, post({ body: 'À quatre kilomètres d’ici.' }));
    const farPost = await feed.createPost(farAuthor, post({ body: 'À cinquante kilomètres d’ici.' }));
    const cityLess = await feed.createPost(cityless, post({ body: 'Je n’ai pas encore choisi ma ville.' }));

    // Les prémisses : les villes sont bien celles qu'on croit.
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: localPost.post.id } })).cityId,
    ).toBe(cityNear.id);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: cityLess.post.id } })).cityId,
    ).toBeNull();

    const ids = (await feed.feed(reader, feedQuerySchema.parse({ limit: 50 }))).items.map(
      (i) => (i as { id: string }).id,
    );

    // 1. La remontée locale : Villeurbanne est à 4 km, donc AVANT les deux autres,
    //    bien qu'elle soit la plus ancienne des trois.
    expect(ids.indexOf(localPost.post.id)).toBeLessThan(ids.indexOf(farPost.post.id));
    expect(ids.indexOf(localPost.post.id)).toBeLessThan(ids.indexOf(cityLess.post.id));

    // 2. LE PIÈGE : la publication SANS VILLE est toujours là. Écrite
    //    `cityId: { notIn: [...] }`, la moitié « le reste » du fil l'aurait
    //    perdue — `NULL NOT IN (…)` est inconnu, donc faux, en SQL.
    expect(ids).toContain(cityLess.post.id);
    expect(ids).toContain(farPost.post.id);

    // 3. Et le lecteur SANS ville voit les trois : sans ville, pas de remontée
    //    locale, donc un tri purement chronologique.
    const idsForCityless = (
      await feed.feed(cityless, feedQuerySchema.parse({ limit: 50 }))
    ).items.map((i) => (i as { id: string }).id);
    for (const id of [localPost.post.id, farPost.post.id, cityLess.post.id]) {
      expect(idsForCityless).toContain(id);
    }
  }, TEST_TIMEOUT_MS);

  it('pagine le fil sans répéter ni perdre une publication, remontée locale comprise', async () => {
    const reader = await newMember('L1', { cityId: cityA.id });
    const localAuthor = await newMember('L1', { cityId: cityA.id });
    const farAuthor = await newMember('L1', { cityId: cityFar.id });

    const expectedIds = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      expectedIds.add((await feed.createPost(localAuthor, post({ body: `Local ${i}` }))).post.id);
      expectedIds.add((await feed.createPost(farAuthor, post({ body: `Lointain ${i}` }))).post.id);
    }

    // Deux par page : la pagination doit traverser la frontière entre la moitié
    // locale et « le reste », qui est justement là où un curseur mal fichu
    // boucle ou saute.
    const seen: string[] = [];
    let cursor: string | undefined;
    /**
     * LE PLAFOND N'EST PAS UNE BORNE DE CORRECTION, c'est un garde-fou contre une
     * boucle infinie — et il doit le DIRE quand c'est lui qui arrête.
     *
     * Il valait 12 pages de 2, soit 24 éléments, ce qui suffisait quand le fil de
     * développement était presque vide. Le fil a grossi ; le test a vu ses 24
     * éléments, s'est arrêté sur son plafond, et a conclu qu'une publication était
     * PERDUE. Il accusait la pagination de ce que sa propre borne causait — le même
     * défaut qu'un test de collage calibré sur cinq publications d'exemple, qui
     * mesurait la hauteur du contenu en croyant mesurer le `sticky`.
     *
     * Deux changements, et le second compte plus que le premier :
     *   · le plafond suit la taille du fil au lieu d'être un nombre écrit à la main ;
     *   · atteindre le plafond est un ÉCHEC NOMMÉ, pas une sortie silencieuse. Sans
     *     cela, la prochaine fois que le fil grandira, le test remettra la faute sur
     *     le curseur.
     */
    const totalPublications = await prisma.post.count({ where: { deletedAt: null } });
    const plafond = Math.ceil(totalPublications / 2) + 4;
    let arretParFinDeFil = false;
    for (let page = 0; page < plafond; page += 1) {
      const result = await feed.feed(
        reader,
        feedQuerySchema.parse(cursor === undefined ? { limit: 2 } : { limit: 2, cursor }),
      );
      seen.push(...result.items.map((i) => (i as { id: string }).id));
      if (result.nextCursor === null) {
        arretParFinDeFil = true;
        break;
      }
      cursor = result.nextCursor;
    }

    expect(
      arretParFinDeFil,
      `la pagination n’a pas atteint la fin du fil en ${plafond} pages : c’est le plafond du test qui a arrêté, pas le curseur`,
    ).toBe(true);

    expect(new Set(seen).size).toBe(seen.length); // aucune répétition
    for (const id of expectedIds) expect(seen).toContain(id);
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : un membre bloqué n'apparaît nulle part, DANS LES DEUX SENS ═

  it('rule: une publication d’un membre bloqué n’est jamais renvoyée — filtres compris', async () => {
    const reader = await newMember('L1', { cityId: cityA.id, phase: 'SETTLED' });
    const blocked = await newMember('L1', { cityId: cityA.id, phase: 'SETTLED' });
    const neutral = await newMember('L1', { cityId: cityA.id, phase: 'SETTLED' });

    const hidden = await feed.createPost(blocked, post({ type: 'INFO', body: 'Publication du membre qui sera bloqué.' }));
    const control = await feed.createPost(neutral, post({ type: 'INFO', body: 'Publication de contrôle, jamais bloquée.' }));
    const comment = await feed.createComment(blocked, {
      subjectType: 'POST',
      subjectId: control.post.id,
      body: 'Un commentaire qui devra disparaître avec son auteur.',
    });

    // Prémisse : tout est visible AVANT le blocage — sans quoi le test passerait
    // sur une liste vide.
    const before = await feed.feed(reader, feedQuerySchema.parse({}));
    expect(before.items.map((i) => (i as { id: string }).id)).toContain(hidden.post.id);
    expect(
      (await feed.comments(reader, {
        subjectType: 'POST',
        subjectId: control.post.id,
        limit: 20,
      sort: 'RELEVANT',
      })).items.map((c) => (c as { id: string }).id),
    ).toContain(comment.comment.id);

    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader.userId, blockedUserId: blocked.userId },
    });

    /**
     * LA COMBINAISON. Chacun de ces filtres fonctionne seul ; c'est ENSEMBLE
     * qu'ils se marchent dessus. `phase` porte sur la relation `author`, que le
     * filtre de visibilité emploie déjà : étalés dans un même objet littéral, le
     * second `author:` écraserait le premier et la publication du membre bloqué
     * reviendrait — exactement le bogue qui a coûté cher au module 06.
     *
     * La publication de CONTRÔLE partage tous les attributs filtrés. Elle doit
     * rester : sans elle, une liste vide passerait le test pour la mauvaise
     * raison.
     */
    const combinations = [
      {},
      { type: 'INFO' },
      { cityId: cityA.id },
      { phase: 'SETTLED' },
      { type: 'INFO', phase: 'SETTLED' },
      { type: 'INFO', cityId: cityA.id, phase: 'SETTLED' },
    ];
    for (const filters of combinations) {
      const result = await feed.feed(reader, feedQuerySchema.parse({ limit: 50, ...filters }));
      const ids = result.items.map((i) => (i as { id: string }).id);
      expect(ids, `filtres ${JSON.stringify(filters)}`).not.toContain(hidden.post.id);
      expect(ids, `filtres ${JSON.stringify(filters)}`).toContain(control.post.id);
    }

    // Le détail, les commentaires et la réaction tombent aussi — 404, jamais 403.
    await expect(feed.postDetail(reader, hidden.post.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(feed.reactToPost(reader, hidden.post.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      feed.createComment(reader, {
        subjectType: 'POST',
        subjectId: hidden.post.id,
        body: 'Un commentaire qui ne doit jamais atteindre son destinataire.',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      (await feed.comments(reader, { subjectType: 'POST', subjectId: control.post.id, limit: 20, sort: 'RELEVANT' }))
        .items.map((c) => (c as { id: string }).id),
    ).not.toContain(comment.comment.id);

    // DANS L'AUTRE SENS : la publication du BLOQUANT est invisible au bloqué.
    const readerPost = await feed.createPost(reader, post({ body: 'Publication de celui qui a bloqué.' }));
    expect(
      (await feed.feed(blocked, feedQuerySchema.parse({ limit: 50 }))).items.map(
        (i) => (i as { id: string }).id,
      ),
    ).not.toContain(readerPost.post.id);

    // L'auteur, lui, garde sa publication : le blocage la cache aux autres, il ne
    // la lui confisque pas.
    expect((await feed.postDetail(blocked, hidden.post.id)).post.id).toBe(hidden.post.id);

    // Et le gestionnaire d'événement `user.blocked` — le témoin — ne trouve rien
    // qui traverse : c'est la même règle, vérifiée par le chemin de la file.
    await expect(
      feed.handleUserBlocked({ blockerUserId: reader.userId, blockedUserId: blocked.userId }),
    ).resolves.toMatchObject({ checked: 2 });
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : le déplacement vers un réseau n'est jamais automatique ════

  it('rule: le déplacement vers un réseau n’est jamais automatique', async () => {
    const author = await newMember();
    const community = await newCommunity([author.userId]);
    const question = await feed.createPost(
      author,
      post({ type: 'QUESTION', body: 'Comment obtenir une attestation d’hébergement ?' }),
    );

    // Six commentaires — donc AU-DELÀ des 5 de §2.3 —, dont une réponse à une
    // réponse, pour vérifier que la copie garde la structure.
    const commenters: FeedActor[] = [];
    let firstCommentId = '';
    for (let i = 0; i < 6; i += 1) {
      const member = await newMember('L0');
      commenters.push(member);
      const created = await feed.createComment(member, {
        subjectType: 'POST',
        subjectId: question.post.id,
        body: `Réponse numéro ${i + 1} à cette question.`,
      });
      if (i === 0) firstCommentId = created.comment.id;
    }
    const replier = commenters[1];
    if (replier === undefined) expect.unreachable('fixture de commentateur absente');
    await feed.createComment(replier, {
      subjectType: 'POST',
      subjectId: question.post.id,
      body: 'Je précise ma réponse : il faut aussi une pièce d’identité.',
      parentCommentId: firstCommentId,
    });

    // LE CŒUR DE LA RÈGLE : le seuil est franchi, et RIEN n'a bougé en base.
    const stillThere = await prisma.post.findUniqueOrThrow({ where: { id: question.post.id } });
    expect(stillThere.commentCount).toBeGreaterThan(FEED_LIMITS.moveToTopicMinReplies);
    expect(stillThere.movedToTopicId).toBeNull();
    expect(await prisma.topic.count({ where: { originPostId: question.post.id } })).toBe(0);

    // Ce n'est qu'une INVITATION, et elle n'est offerte qu'à l'auteur.
    const asAuthor = await feed.postDetail(author, question.post.id);
    expect(asAuthor.post.canMoveToTopic).toBe(true);
    const reader = await newMember();
    expect((await feed.postDetail(reader, question.post.id)).post.canMoveToTopic).toBe(false);

    // Un membre qui n'est pas du réseau ne peut pas y déposer la question.
    const outsiderCommunity = await newCommunity([]);
    await expect(
      feed.moveToTopic(author, question.post.id, { communityId: outsiderCommunity.id }),
    ).rejects.toMatchObject({ code: 'NOT_COMMUNITY_MEMBER' });

    // L'appel EXPLICITE, lui, déplace — corps et commentaires copiés (§2.3).
    const moved = await feed.moveToTopic(author, question.post.id, { communityId: community.id });
    const topic = await prisma.topic.findUniqueOrThrow({ where: { id: moved.topicId } });
    expect(topic.body).toBe(stillThere.body);
    expect(topic.originPostId).toBe(question.post.id);
    const copies = await prisma.comment.findMany({
      where: { subjectType: 'TOPIC', subjectId: moved.topicId },
      select: { parentCommentId: true },
    });
    expect(copies).toHaveLength(7);
    // La structure est conservée : six racines, une réponse.
    expect(copies.filter((c) => c.parentCommentId !== null)).toHaveLength(1);

    // La publication RESTE, avec son lien « Suite dans le réseau X » (§2.3).
    const after = await feed.postDetail(author, question.post.id);
    expect(after.post.movedTo?.topicId).toBe(moved.topicId);
    expect(after.post.movedTo?.label).toContain(community.name);
    expect(after.post.canMoveToTopic).toBe(false);
    await expect(
      feed.moveToTopic(author, question.post.id, { communityId: community.id }),
    ).rejects.toMatchObject({ code: 'ALREADY_MOVED' });

    // Les deux autres refus de §4.
    const discussion = await feed.createPost(author, post({ type: 'DISCUSSION' }));
    await expect(
      feed.moveToTopic(author, discussion.post.id, { communityId: community.id }),
    ).rejects.toMatchObject({ code: 'NOT_A_QUESTION' });

    const quiet = await feed.createPost(author, post({ type: 'QUESTION' }));
    await expect(
      feed.moveToTopic(author, quiet.post.id, { communityId: community.id }),
    ).rejects.toMatchObject({ code: 'NOT_ENOUGH_REPLIES' });
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : un vote hors du type de la story est refusé (§2.6) ═══════

  it('rule: une réaction dont le kind n’appartient pas au type de la story est refusée', async () => {
    const voter = await newMember();
    const cases = [
      { type: 'CONSEIL' as StoryType, extra: { category: 'LOGEMENT' } },
      { type: 'DECOUVERTE' as StoryType, extra: { category: 'LIEU', placeLabel: 'Marché de la Croix-Rousse' } },
      { type: 'INFORMATION' as StoryType, extra: { category: 'DEMARCHES' } },
    ];

    for (const testCase of cases) {
      const author = await newMember();
      const created = await feed.createStory(author, story({ type: testCase.type, ...testCase.extra }));
      const vocabulary = STORY_TYPE_VOCABULARY[testCase.type];

      // Les deux votes DU TYPE passent, et le compteur suit le bon camp.
      const positive = await feed.reactToStory(voter, created.story.id, {
        kind: vocabulary.positive.kind,
      });
      expect(positive.positive).toBe(1);
      expect(positive.negative).toBe(0);
      const negative = await feed.reactToStory(voter, created.story.id, {
        kind: vocabulary.negative.kind,
      });
      // « une réaction par membre et par story, MODIFIABLE » : changer de camp
      // déplace le vote, il ne l'ajoute pas.
      expect(negative.positive).toBe(0);
      expect(negative.negative).toBe(1);

      // Tous les autres `kind` de l'énumération sont refusés — et c'est bien
      // `KIND_NOT_ALLOWED_FOR_TYPE`, le code que §4 nomme.
      const foreign = (['USEFUL', 'NOT_USEFUL', 'WANT_TO_GO', 'BEEN_THERE', 'CONFIRM', 'CHANGED'] as const).filter(
        (k) => k !== vocabulary.positive.kind && k !== vocabulary.negative.kind,
      );
      expect(foreign).toHaveLength(4);
      for (const kind of foreign) {
        await expect(
          feed.reactToStory(voter, created.story.id, { kind }),
        ).rejects.toMatchObject({
          code: 'KIND_NOT_ALLOWED_FOR_TYPE',
          details: { type: testCase.type, kind },
        });
      }
      // Et le refus n'a RIEN écrit : le vote précédent est intact.
      const row = await prisma.storyReaction.findFirstOrThrow({
        where: { storyId: created.story.id, userId: voter.userId },
      });
      expect(row.kind).toBe(vocabulary.negative.kind);
      const counts = await prisma.story.findUniqueOrThrow({ where: { id: created.story.id } });
      expect(counts.negativeCount).toBe(1);
      expect(counts.positiveCount).toBe(0);
    }
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : une story expirée n'est visible que de l'auteur et des ═══
  //                 membres qui l'ont enregistrée (§2.6)

  it('rule: une story expirée n’est renvoyée qu’à son auteur et aux membres qui l’ont enregistrée', async () => {
    const author = await newMember();
    const keeper = await newMember();
    const stranger = await newMember();
    const created = await feed.createStory(author, story());
    const storyId = created.story.id;

    // Prémisse : la story est visible de tous AVANT d'expirer.
    for (const reader of [author, keeper, stranger]) {
      expect((await feed.storyDetail(reader, storyId)).story.id).toBe(storyId);
    }

    // Le signet du « keeper » — c'est lui qui ouvre la dérogation de §2.6.
    await prisma.bookmark.create({
      data: { id: newId(), userId: keeper.userId, subjectType: 'STORY', subjectId: storyId },
    });

    // On la fait expirer par la TÂCHE, pas à la main : c'est le chemin réel.
    await prisma.story.update({
      where: { id: storyId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await feed.expireStories();
    expect(expired.expired).toBeGreaterThanOrEqual(1);
    expect((await prisma.story.findUniqueOrThrow({ where: { id: storyId } })).status).toBe(
      'EXPIRED',
    );

    // L'auteur : oui. Celui qui l'a gardée : oui. N'importe qui d'autre : 404.
    expect((await feed.storyDetail(author, storyId)).story.expired).toBe(true);
    expect((await feed.storyDetail(keeper, storyId)).story.id).toBe(storyId);
    await expect(feed.storyDetail(stranger, storyId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // « tant que le signet existe » : le retirer referme l'accès.
    await prisma.bookmark.deleteMany({
      where: { userId: keeper.userId, subjectType: 'STORY', subjectId: storyId },
    });
    await expect(feed.storyDetail(keeper, storyId)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Elle sort du bandeau pour tout le monde, l'auteur compris (§2.6 :
    // « retrait du bandeau »).
    for (const reader of [author, keeper, stranger]) {
      const band = await feed.storyBand(reader, {});
      const ids = band.items.flatMap((b) =>
        (b as { stories: { id: string }[] }).stories.map((s) => s.id),
      );
      expect(ids).not.toContain(storyId);
    }

    // Elle reste dans l'historique de 30 jours de son auteur (§2.6).
    expect(
      (await feed.myStories(author, { limit: 50 })).items.map((s) => (s as { id: string }).id),
    ).toContain(storyId);

    // Et on ne vote plus, ni on ne convertit, une story expirée.
    await expect(
      feed.reactToStory(stranger, storyId, { kind: 'USEFUL' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      feed.convertStory(author, storyId, { target: 'HELP_REQUEST' }),
    ).rejects.toMatchObject({ code: 'STORY_EXPIRED' });
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : aucun compteur de vues, pour personne (§2.6) ═════════════

  it('rule: aucune réponse de story ne contient de compteur de vues', async () => {
    const author = await newMember();
    const created = await feed.createStory(author, story());
    const storyId = created.story.id;

    // Trois lecteurs distincts ouvrent la story : `story_views` se remplit.
    const readers = [await newMember(), await newMember(), await newMember()];
    for (const reader of readers) await feed.storyDetail(reader, storyId);

    // Prémisse INDISPENSABLE : les vues sont bien enregistrées. Sans elle, le
    // test passerait sur une table vide — c'est-à-dire sans rien prouver.
    expect(await prisma.storyView.count({ where: { storyId } })).toBe(3);

    /** Toutes les clés d'un objet, récursivement. */
    const keysOf = (value: unknown, out: string[] = [], depth = 0): string[] => {
      if (depth > 12 || value === null || typeof value !== 'object') return out;
      if (Array.isArray(value)) {
        for (const item of value) keysOf(item, out, depth + 1);
        return out;
      }
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        out.push(key);
        keysOf(nested, out, depth + 1);
      }
      return out;
    };

    /** Toutes les valeurs portées par une clé `audience`, récursivement. */
    const audienceValuesOf = (value: unknown, out: unknown[] = [], depth = 0): unknown[] => {
      if (depth > 12 || value === null || typeof value !== 'object') return out;
      if (Array.isArray(value)) {
        for (const item of value) audienceValuesOf(item, out, depth + 1);
        return out;
      }
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (key === 'audience') out.push(nested);
        audienceValuesOf(nested, out, depth + 1);
      }
      return out;
    };

    const responses = [
      await feed.storyDetail(author, storyId),
      await feed.storyDetail(readers[0] as FeedActor, storyId),
      await feed.storyBand(author, {}),
      await feed.storyBand(readers[0] as FeedActor, {}),
      // L'AUTEUR non plus : §2.6 dit « pour personne », et l'historique est
      // l'endroit où un compteur de vues se glisserait le plus naturellement.
      await feed.myStories(author, { limit: 20 }),
    ];

    for (const response of responses) {
      const keys = keysOf(response);
      const suspicious = keys.filter((k) => /view|vue|watch|impression|reach|spectat/i.test(k));
      expect(suspicious).toEqual([]);
      // `audience` EST un champ de §2.6 (« audience ALL · CITY ») : il est donc
      // attendu, mais il ne doit jamais devenir un NOMBRE — ce serait le
      // compteur de vues sous un autre nom.
      for (const value of audienceValuesOf(response)) {
        expect(['ALL', 'CITY']).toContain(value);
      }
      // Et aucun champ ne vaut 3 sous un nom de compteur : le nombre de lecteurs
      // ne doit pas ressortir déguisé.
      expect(JSON.stringify(response)).not.toContain('viewCount');
      expect(JSON.stringify(response)).not.toContain('seenBy');
    }

    // L'anneau, lui, EXISTE — c'est un booléen propre au lecteur, pas une
    // audience : sans lui la règle serait respectée par simple amputation.
    const bandForViewer = await feed.storyBand(readers[0] as FeedActor, {});
    const bubble = bandForViewer.items.find((b) =>
      (b as { stories: { id: string }[] }).stories.some((s) => s.id === storyId),
    ) as { hasUnseen: boolean; stories: { id: string; seen: boolean }[] } | undefined;
    expect(bubble?.hasUnseen).toBe(false);
    expect(bubble?.stories.find((s) => s.id === storyId)?.seen).toBe(true);

    const bandForFresh = await feed.storyBand(await newMember(), {});
    const freshBubble = bandForFresh.items.find((b) =>
      (b as { stories: { id: string }[] }).stories.some((s) => s.id === storyId),
    ) as { hasUnseen: boolean } | undefined;
    expect(freshBubble?.hasUnseen).toBe(true);
  }, TEST_TIMEOUT_MS);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LIRE UNE STORY NE LA FAIT PAS SORTIR DU RUBAN                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le marquage de lecture a un comportement bizarre. Quand tu
   * cliques sur plusieurs stories, l'une est lue et l'autre non. Parfois rien
   * n'est marqué lu. »
   *
   * MESURÉ au navigateur : après lecture, la story n'était plus dans le ruban DU
   * TOUT — ni grise, ni verte : absente. Donc jamais « marquée lue », puisqu'il
   * n'y avait plus rien à marquer.
   *
   * LA CAUSE : on triait « non-vu d'abord » PUIS on coupait aux trente auteurs. À
   * rang égal — et pour un conseil le rang est `-score`, qui vaut zéro tant que
   * personne n'a voté — le vu/non-vu devenait le tri PRINCIPAL, et la bulle lue
   * tombait au-delà de la coupe. Soixante-dix-huit auteurs pour trente places, sur
   * la base de développement.
   *
   * CE CAS LE REPRODUIT EN PETIT : plus d'auteurs que de places, le lecteur lit la
   * story de tête, et elle doit RESTER — grise. Il tombe si l'on remet la coupe
   * après le départage.
   */
  it('une story lue RESTE dans le ruban, et y passe en « vue » (§2.6)', async () => {
    const lecteur = await newMember();

    /**
     * On déborde la coupe : `storyBandMaxAuthors` auteurs, plus un. Chacun a UNE
     * story, pour que lire la sienne vide son groupe de tout non-vu — c'est
     * exactement la condition qui la faisait tomber.
     */
    const dessus = FEED_LIMITS.storyBandMaxAuthors + 1;
    const ids: string[] = [];
    for (let i = 0; i < dessus; i += 1) {
      /**
       * UNE AUTRE VILLE, ET C'EST POUR NE PAS DÉRANGER LES VOISINS. La colonne
       * droite liste les NOUVEAUX ARRIVANTS de la ville du lecteur, trois au plus.
       * Créer ici trente-et-un membres dans la ville commune du fichier évinçait
       * celui qu'un autre cas vérifie — et ce cas-là tombait pour une raison qui
       * n'avait rien à voir avec lui.
       *
       * Les stories restent VISIBLES : elles sont d'audience `ALL`, donc le ruban
       * les rend quelle que soit la ville du lecteur. C'est ce que ce cas mesure,
       * et la ville n'y entre pas.
       */
      const auteur = await newMember('L1', { cityId: cityFar.id, phase: 'SETTLED' });
      const { story } = await feed.createStory(auteur, {
        type: 'CONSEIL',
        body: `Conseil numéro ${String(i)} pour éprouver le ruban.`,
        backgroundColor: '#1B4332',
        textStyle: 'BOLD',
        category: 'LOGEMENT',
        audience: 'ALL',
        allowMessages: true,
      });
      ids.push(story.id);
    }

    const avant = await feed.storyBand(lecteur, { type: 'CONSEIL' });
    const premier = avant.items[0]?.stories[0]?.id;
    expect(premier, 'le ruban est vide : le cas ne mesure rien').toBeDefined();
    if (premier === undefined) return;
    expect(ids).toContain(premier);

    // On la LIT — c'est `GET /stories/:id` qui enregistre la vue.
    await feed.storyDetail(lecteur, premier);

    const apres = await feed.storyBand(lecteur, { type: 'CONSEIL' });
    const toujours = apres.items.flatMap((b) => b.stories).find((s) => s.id === premier);
    expect(toujours, 'la story lue a disparu du ruban au lieu de griser').toBeDefined();
    expect(toujours?.seen, 'la story lue n’est pas marquée vue').toBe(true);
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE : ni lien, ni numéro, ni email dans une story (§2.6) ═══════

  it('rule: une story contenant un lien ou un numéro est refusée', async () => {
    const author = await newMember();
    const refused = [
      'Le dossier se dépose sur https://prefecture.example.fr avant vendredi.',
      'Regardez sur www.service-public.fr, tout y est expliqué.',
      'Appelez le 06 12 34 56 78, ils répondent vite.',
      'Mon numéro est +229 97 00 00 42 si besoin.',
      'Écrivez à contact@exemple.fr pour le rendez-vous.',
      'Rejoignez @groupe_demarches, on s’y entraide.',
    ];

    for (const body of refused) {
      await expect(feed.createStory(author, story({ body }))).rejects.toMatchObject({
        code: 'CONTENT_BLOCKED',
        details: { reason: 'NO_LINK_PHONE_EMAIL' },
      });
    }
    // Rien n'a été écrit : le refus est SYNCHRONE, contrairement au verdict IA.
    expect(await prisma.story.count({ where: { authorUserId: author.userId } })).toBe(0);

    // Le même conseil, sans coordonnées, passe : c'est bien le lien ou le numéro
    // qui était refusé, et non le texte.
    const accepted = await feed.createStory(
      author,
      story({ body: 'Le dossier se dépose à la préfecture avant vendredi, pensez au récépissé.' }),
    );
    expect(accepted.story.id).toBeDefined();

    // Et une PUBLICATION, elle, accepte le lien (§2.4 : rendu `nofollow ugc`) :
    // le filtre des stories est plus dur, pas le même.
    const published = await feed.createPost(
      author,
      post({ body: 'Tout est expliqué sur https://www.service-public.fr, allez voir.' }),
    );
    expect(published.post.linkRel).toBe('noopener nofollow ugc');

    // En revanche, une demande de versement est refusée des DEUX côtés (13 §2).
    await expect(
      feed.createPost(author, post({ body: 'Envoyez-moi 200 € sur mon compte et je m’occupe du dossier.' })),
    ).rejects.toMatchObject({ code: 'CONTENT_BLOCKED' });
  }, TEST_TIMEOUT_MS);

  // ══ RÈGLE DURE 13 §2 : rien ne part vers l'IA sans masquage ═══════════════

  it('rule (13 §2): le corps envoyé à la modération est masqué — ni numéro ni email', async () => {
    const author = await newMember();
    const body =
      'Mon conseiller Dupont m’a dit d’appeler le 06 12 34 56 78 ou d’écrire à jean.dupont@exemple.fr.';

    const created = await feed.createPost(author, post({ body }));
    const events = await prisma.domainEvent.findMany({
      where: { aggregateId: created.post.id, type: 'post.published' },
    });
    expect(events).toHaveLength(1);
    const payload = events[0]?.payload as Record<string, unknown>;

    // Le corps BRUT n'est pas dans la charge utile — seulement sa version masquée.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('06 12 34 56 78');
    expect(serialized).not.toContain('jean.dupont@exemple.fr');
    expect(serialized).not.toContain('@exemple.fr');
    expect(payload['redacted']).toBe(true);
    expect(String(payload['redactedBody'])).toContain('[TEL]');
    expect(String(payload['redactedBody'])).toContain('[EMAIL]');

    // Le corps affiché au membre, lui, est INTACT : le masquage est pour l'IA,
    // pas pour le lecteur.
    expect((await feed.postDetail(author, created.post.id)).post.body).toBe(body);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: created.post.id } })).body,
    ).toBe(body);

    // Même garantie sur un commentaire.
    const comment = await feed.createComment(author, {
      subjectType: 'POST',
      subjectId: created.post.id,
      body: 'Rappelez-moi au 07 88 99 00 11, c’est plus simple.',
    });
    const commentEvent = await prisma.domainEvent.findFirstOrThrow({
      where: { type: 'post.commented', aggregateId: created.post.id },
    });
    expect(JSON.stringify(commentEvent.payload)).not.toContain('07 88 99 00 11');
    expect(comment.comment.body).toContain('07 88 99 00 11');
  }, TEST_TIMEOUT_MS);

  // ══ §2.6 : audience CITY et blocage, ENSEMBLE ═════════════════════════════

  it('n’expose pas une story CITY hors de sa ville — ni celle d’un membre bloqué, ni les deux', async () => {
    const reader = await newMember('L1', { cityId: cityA.id });
    const sameCity = await newMember('L1', { cityId: cityA.id });
    const otherCity = await newMember('L1', { cityId: cityFar.id });
    const blockedSameCity = await newMember('L1', { cityId: cityA.id });

    const visible = await feed.createStory(sameCity, story({ audience: 'CITY' }));
    const elsewhere = await feed.createStory(otherCity, story({ audience: 'CITY' }));
    const openElsewhere = await feed.createStory(otherCity, story({ audience: 'ALL' }));
    const blockedStory = await feed.createStory(blockedSameCity, story({ audience: 'ALL' }));

    const idsFor = async (actor: FeedActor): Promise<string[]> =>
      (await feed.storyBand(actor, {})).items.flatMap((b) =>
        (b as { stories: { id: string }[] }).stories.map((s) => s.id),
      );

    // Prémisses : les quatre stories existent, et trois sont visibles du lecteur.
    const before = await idsFor(reader);
    expect(before).toContain(visible.story.id);
    expect(before).toContain(openElsewhere.story.id);
    expect(before).toContain(blockedStory.story.id);
    // Le filtre d'audience, seul : une story CITY d'ailleurs ne passe pas.
    expect(before).not.toContain(elsewhere.story.id);
    await expect(feed.storyDetail(reader, elsewhere.story.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader.userId, blockedUserId: blockedSameCity.userId },
    });

    /**
     * LA COMBINAISON. Les deux filtres emploient `OR` — l'audience et, par
     * symétrie d'écriture, l'auteur. Dans un même objet littéral, le second
     * écraserait le premier SANS ERREUR, et l'une des deux stories reviendrait.
     * Les tester séparément n'aurait rien vu : chacun marche seul.
     */
    const after = await idsFor(reader);
    expect(after).not.toContain(elsewhere.story.id); // audience toujours appliquée
    expect(after).not.toContain(blockedStory.story.id); // blocage appliqué
    expect(after).toContain(visible.story.id); // et le reste passe encore
    expect(after).toContain(openElsewhere.story.id);

    // Dans l'autre sens : le bloqué ne voit plus les stories du bloquant.
    const readerStory = await feed.createStory(reader, story({ audience: 'ALL' }));
    expect(await idsFor(blockedSameCity)).not.toContain(readerStory.story.id);

    // Et l'auteur voit toujours sa propre story CITY, où qu'il soit.
    expect(await idsFor(otherCity)).toContain(elsewhere.story.id);
  }, TEST_TIMEOUT_MS);

  // ══ §2.6 : rattachement obligatoire, quotas, conversion ═══════════════════

  it('exige le rattachement que le type impose (§2.6)', async () => {
    const author = await newMember();
    const stepDefinitionId = await newStepDefinition('Ouvrir un compte bancaire');

    // CONSEIL : une `step_definition` OU un sujet.
    await expect(
      feed.createStory(author, story({ type: 'CONSEIL', category: undefined })),
    ).rejects.toMatchObject({
      code: 'INVALID_ATTACHMENT',
      details: { reason: 'CONSEIL_NEEDS_STEP_OR_SUBJECT' },
    });
    const byStep = await feed.createStory(
      author,
      story({ type: 'CONSEIL', category: undefined, stepDefinitionId }),
    );
    expect(byStep.story.stepDefinition?.id).toBe(stepDefinitionId);
    // Un conseil ne se range pas dans une catégorie de découverte.
    await expect(
      feed.createStory(author, story({ type: 'CONSEIL', category: 'LIEU' })),
    ).rejects.toMatchObject({ details: { reason: 'CONSEIL_CATEGORY_MUST_BE_SUBJECT' } });

    // DECOUVERTE : catégorie ET lieu.
    const discoverer = await newMember();
    await expect(
      feed.createStory(discoverer, story({ type: 'DECOUVERTE', category: 'LOGEMENT' })),
    ).rejects.toMatchObject({ details: { reason: 'DECOUVERTE_NEEDS_CATEGORY' } });
    await expect(
      feed.createStory(discoverer, story({ type: 'DECOUVERTE', category: 'LIEU' })),
    ).rejects.toMatchObject({ details: { reason: 'DECOUVERTE_NEEDS_PLACE' } });

    // INFORMATION : sujet obligatoire ; `valid_until` réservé à ce type.
    const informer = await newMember();
    await expect(
      feed.createStory(informer, story({ type: 'INFORMATION', category: 'LIEU' })),
    ).rejects.toMatchObject({ details: { reason: 'INFORMATION_NEEDS_SUBJECT' } });
    await expect(
      feed.createStory(
        informer,
        story({ validUntil: new Date(Date.now() + 3_600_000).toISOString() }),
      ),
    ).rejects.toMatchObject({ details: { reason: 'VALID_UNTIL_INFORMATION_ONLY' } });

    // §2.6 : « 24 h, ou `valid_until` si plus tôt ».
    const soon = new Date(Date.now() + 2 * 3_600_000);
    const dated = await feed.createStory(
      informer,
      story({ type: 'INFORMATION', category: 'DEMARCHES', validUntil: soon.toISOString() }),
    );
    const row = await prisma.story.findUniqueOrThrow({ where: { id: dated.story.id } });
    expect(row.expiresAt.getTime()).toBe(soon.getTime());
    // Et une date de validité PLUS LOIN que 24 h ne prolonge rien.
    const late = new Date(Date.now() + 72 * 3_600_000);
    const capped = await feed.createStory(
      informer,
      story({ type: 'INFORMATION', category: 'DEMARCHES', validUntil: late.toISOString() }),
    );
    const cappedRow = await prisma.story.findUniqueOrThrow({ where: { id: capped.story.id } });
    expect(cappedRow.expiresAt.getTime()).toBeLessThan(late.getTime());

    // §2.6 : 3 stories par jour.
    const third = await feed.createStory(informer, story({ type: 'INFORMATION', category: 'SANTE' }));
    expect(third.story.id).toBeDefined();
    await expect(
      feed.createStory(informer, story({ type: 'INFORMATION', category: 'SANTE' })),
    ).rejects.toMatchObject({ code: 'STORY_LIMIT', details: { max: 3 } });
  }, TEST_TIMEOUT_MS);

  it('garde une story avant expiration, et jamais deux fois (§2.6)', async () => {
    // CONSEIL → demande d'entraide.
    const adviser = await newMember();
    const advice = await feed.createStory(adviser, story({ category: 'DEMARCHES' }));
    const kept = await feed.convertStory(adviser, advice.story.id, { target: 'HELP_REQUEST' });
    const helpRequest = await prisma.helpRequest.findUniqueOrThrow({
      where: { id: kept.targetId },
    });
    expect(helpRequest.type).toBe('PAPERWORK');
    expect(helpRequest.authorUserId).toBe(adviser.userId);
    const advised = await prisma.story.findUniqueOrThrow({ where: { id: advice.story.id } });
    expect(advised.convertedToType).toBe('help_request');
    expect(advised.convertedToId).toBe(kept.targetId);

    await expect(
      feed.convertStory(adviser, advice.story.id, { target: 'HELP_REQUEST' }),
    ).rejects.toMatchObject({ code: 'ALREADY_CONVERTED' });

    // DECOUVERTE → conseil de ville, avec `source_story_id` (§2.6).
    const finder = await newMember();
    const discovery = await feed.createStory(
      finder,
      story({ type: 'DECOUVERTE', category: 'PRODUIT', placeLabel: 'Épicerie Afrique Market' }),
    );
    const tip = await feed.convertStory(finder, discovery.story.id, { target: 'CITY_TIP' });
    createdCityTipIds.push(tip.targetId);
    const cityTip = await prisma.cityTip.findUniqueOrThrow({ where: { id: tip.targetId } });
    expect(cityTip.kind).toBe('SHOP');
    expect(cityTip.sourceStoryId).toBe(discovery.story.id);
    expect(cityTip.body).toContain('Épicerie Afrique Market');

    // Les cibles ne sont pas interchangeables.
    const other = await newMember();
    const plain = await feed.createStory(other, story({ category: 'LOGEMENT' }));
    await expect(
      feed.convertStory(other, plain.story.id, { target: 'CITY_TIP' }),
    ).rejects.toMatchObject({ code: 'INVALID_CONVERSION_TARGET' });
    const finderSecond = await feed.createStory(
      finder,
      story({ type: 'DECOUVERTE', category: 'SORTIE', placeLabel: 'Concert au parc' }),
    );
    await expect(
      feed.convertStory(finder, finderSecond.story.id, { target: 'HELP_REQUEST' }),
    ).rejects.toMatchObject({ code: 'INVALID_CONVERSION_TARGET' });

    // Et seul l'AUTEUR garde sa story.
    await expect(
      feed.convertStory(other, finderSecond.story.id, { target: 'CITY_TIP' }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHOR' });
  }, TEST_TIMEOUT_MS);

  // ══ §2.5 : fenêtre de modification de 15 minutes — SUR LE COMMENTAIRE SEUL ══

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA PUBLICATION N'A PLUS DE DÉLAI — arbitrage du porteur contre §2.4      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * « On peut modifier quand on veut. » Ce cas affirmait l'inverse ; il affirme
   * maintenant les deux moitiés de la décision, et c'est ce qui compte :
   *
   *   · une publication SE MODIFIE encore seize minutes plus tard ;
   *   · un COMMENTAIRE, lui, reste fermé à quinze minutes (§2.5).
   *
   * Vérifier seulement la première laisserait passer la suppression du délai SUR
   * LES DEUX, qui n'est pas ce qui a été demandé.
   */
  it('ne ferme plus la modification d’une publication, mais toujours celle d’un commentaire', async () => {
    const author = await newMember();
    const created = await feed.createPost(author, post());

    const edited = await feed.updatePost(author, created.post.id, {
      body: 'Texte corrigé dans la minute qui suit la publication.',
    });
    expect(edited.post.body).toBe('Texte corrigé dans la minute qui suit la publication.');
    // La modification remet la publication en file de modération : sans cela,
    // publier un texte acceptable puis le remplacer contournerait le filtre.
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: created.post.id } })).moderationStatus,
    ).toBe('PENDING');

    // Seize minutes en arrière : la publication se modifie QUAND MÊME.
    await prisma.$executeRaw`UPDATE posts SET created_at = created_at - interval '16 minutes' WHERE id = ${created.post.id}::uuid`;
    const tardif = await feed.updatePost(author, created.post.id, {
      body: 'Une correction bien après la publication.',
    });
    expect(tardif.post.body).toBe('Une correction bien après la publication.');
    /**
     * ET ELLE REPASSE EN MODÉRATION. C'est ce qui rend l'ouverture tenable : sans
     * délai, un contenu ancien et déjà validé peut être réécrit, donc il doit être
     * revu comme s'il était neuf. Sans ce relevé, retirer le `PENDING` passerait
     * inaperçu — et c'est précisément le garde-fou qui remplace le délai.
     */
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: created.post.id } })).moderationStatus,
    ).toBe('PENDING');

    // Un autre membre ne modifie jamais, même dans la fenêtre.
    const fresh = await feed.createPost(author, post());
    const stranger = await newMember();
    await expect(
      feed.updatePost(stranger, fresh.post.id, { body: 'Une modification qui n’est pas la mienne.' }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHOR' });

    // Même règle sur un commentaire.
    const comment = await feed.createComment(stranger, {
      subjectType: 'POST',
      subjectId: fresh.post.id,
      body: 'Un commentaire que je vais corriger.',
    });
    await feed.updateComment(stranger, comment.comment.id, { body: 'Corrigé tout de suite.' });
    await prisma.$executeRaw`UPDATE comments SET created_at = created_at - interval '16 minutes' WHERE id = ${comment.comment.id}::uuid`;
    await expect(
      feed.updateComment(stranger, comment.comment.id, { body: 'Beaucoup trop tard.' }),
    ).rejects.toMatchObject({ code: 'EDIT_WINDOW_CLOSED' });
  }, TEST_TIMEOUT_MS);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE SUJET D'UN COMMENTAIRE DE GUIDE EST LA PAGE, PLUS LE GUIDE            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Décision du porteur : « Les commentaires concernent donc une page du guide. »
   * Deux choses se mesurent ici, et la seconde est celle qui compte :
   *
   *   · `GUIDE_PAGE` est ACCEPTÉ, et la visibilité reste celle du GUIDE — une
   *     page n'a pas de `status`, la publication est d'un bloc ;
   *   · `GUIDE` est REFUSÉ en 404. Sans ce refus, un client resté en arrière
   *     continuerait de poser des commentaires que plus aucun écran ne montre, et
   *     qu'aucun compteur ne compte : ils disparaîtraient en silence.
   */
  it('n’accepte un commentaire de guide que sur une PAGE, jamais sur le guide (05 §2)', async () => {
    const lecteur = await newMember('L0');
    const guideId = await publishedGuide();
    const pageId = await pageDeGuide(guideId);

    const cree = await feed.createComment(lecteur, {
      subjectType: 'GUIDE_PAGE',
      subjectId: pageId,
      body: 'Une question sur cette étape précise de la démarche.',
    });
    expect(cree.comment.id).toBeTruthy();
    const ligne = await prisma.comment.findUniqueOrThrow({ where: { id: cree.comment.id } });
    expect(ligne.subjectType).toBe('GUIDE_PAGE');
    expect(ligne.subjectId).toBe(pageId);

    // Et le fil de cette page le rend. `'id' in item` : la liste est une UNION
    // (un commentaire, ou un emplacement retiré), et un emplacement n'a pas d'id.
    const fil = await feed.comments(lecteur, {
      subjectType: 'GUIDE_PAGE',
      subjectId: pageId,
      sort: 'RECENT',
      limit: 20,
    });
    expect(
      fil.items.flatMap((item) => ('id' in item ? [item.id] : [])),
    ).toContain(cree.comment.id);

    // LE GUIDE, LUI, N'EST PLUS UN SUJET — ni en écriture…
    await expect(
      feed.createComment(lecteur, {
        subjectType: 'GUIDE',
        subjectId: guideId,
        body: 'Un commentaire posé sur le guide, comme avant les pages.',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // …ni en lecture : « liste vide » laisserait croire à un fil muet.
    await expect(
      feed.comments(lecteur, {
        subjectType: 'GUIDE',
        subjectId: guideId,
        sort: 'RECENT',
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Un guide NON PUBLIÉ ne se commente pas davantage par sa page : la
    // visibilité est celle du guide, et la page n'en a pas qui lui soit propre.
    const brouillon = await draftGuide();
    const pageBrouillon = await pageDeGuide(brouillon);
    await expect(
      feed.createComment(lecteur, {
        subjectType: 'GUIDE_PAGE',
        subjectId: pageBrouillon,
        body: 'Un commentaire sur la page d’un brouillon.',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Une page RETIRÉE non plus — son corps n'est plus lu par personne.
    await prisma.guidePage.update({
      where: { id: pageId },
      data: { deletedAt: new Date(), position: -1 },
    });
    await expect(
      feed.createComment(lecteur, {
        subjectType: 'GUIDE_PAGE',
        subjectId: pageId,
        body: 'Un commentaire sur une page retirée.',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await prisma.comment.deleteMany({ where: { subjectId: pageId } });
  }, TEST_TIMEOUT_MS);

  // ══ §2.5 : une seule profondeur, et le compteur qui suit ══════════════════

  it('n’accepte qu’une profondeur de réponse et tient `comment_count` (§2.5)', async () => {
    const author = await newMember();
    const first = await newMember('L0');
    const second = await newMember('L0');
    const published = await feed.createPost(author, post({ type: 'QUESTION' }));

    const root = await feed.createComment(first, {
      subjectType: 'POST',
      subjectId: published.post.id,
      body: 'Voici comment j’ai fait la démarche le mois dernier.',
    });
    const reply = await feed.createComment(second, {
      subjectType: 'POST',
      subjectId: published.post.id,
      body: 'Merci, et faut-il un rendez-vous ?',
      parentCommentId: root.comment.id,
    });

    // Une réponse À UNE RÉPONSE est refusée — le code de §4.
    await expect(
      feed.createComment(first, {
        subjectType: 'POST',
        subjectId: published.post.id,
        body: 'Oui, il faut un rendez-vous pris en ligne.',
        parentCommentId: reply.comment.id,
      }),
    ).rejects.toMatchObject({ code: 'DEPTH_EXCEEDED' });

    // Un parent qui porte sur un AUTRE sujet est un 404, pas une réponse muette.
    const elsewhere = await feed.createPost(author, post());
    await expect(
      feed.createComment(first, {
        subjectType: 'POST',
        subjectId: elsewhere.post.id,
        body: 'Une réponse rattachée au mauvais sujet.',
        parentCommentId: root.comment.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // §2.1 : « N réponses » = `comment_count`, réponses imbriquées comprises.
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: published.post.id } })).commentCount,
    ).toBe(2);
    const listed = await feed.comments(author, {
      subjectType: 'POST',
      subjectId: published.post.id,
      limit: 20,
      sort: 'RELEVANT',
    });
    expect(listed.items).toHaveLength(1);
    expect((listed.items[0] as { replies: unknown[] }).replies).toHaveLength(1);

    // La suppression décrémente — et ne descend jamais sous zéro.
    await feed.deleteComment(second, reply.comment.id);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: published.post.id } })).commentCount,
    ).toBe(1);
    await feed.deleteComment(first, root.comment.id);
    const emptied = await prisma.post.findUniqueOrThrow({ where: { id: published.post.id } });
    expect(emptied.commentCount).toBe(0);
    expect(
      (await feed.comments(author, { subjectType: 'POST', subjectId: published.post.id, limit: 20, sort: 'RELEVANT' }))
        .items,
    ).toHaveLength(0);
  }, TEST_TIMEOUT_MS);

  // ══ §2.1 : une réaction par membre, cliquer à nouveau la retire ═══════════

  it('ne compte qu’une réaction par membre, et la retire sur demande (§2.1)', async () => {
    const author = await newMember();
    const reader = await newMember('L0');
    const created = await feed.createPost(author, post({ type: 'VICTORY' }));

    await feed.reactToPost(reader, created.post.id);
    // Deux fois le même appel : idempotent, le compteur ne double pas.
    const twice = await feed.reactToPost(reader, created.post.id);
    expect(twice.reactionCount).toBe(1);
    expect(await prisma.postReaction.count({ where: { postId: created.post.id } })).toBe(1);

    const removed = await feed.unreactToPost(reader, created.post.id);
    expect(removed.reactionCount).toBe(0);
    expect(await prisma.postReaction.count({ where: { postId: created.post.id } })).toBe(0);
    // Retirer deux fois ne fait pas passer le compteur sous zéro.
    expect((await feed.unreactToPost(reader, created.post.id)).reactionCount).toBe(0);
  }, TEST_TIMEOUT_MS);

  // ══ §2.3 : le fil de réseau est fermé à ses membres ══════════════════════

  it('ne montre le fil d’un réseau qu’à ses membres, et jamais dans le fil global', async () => {
    const member = await newMember();
    const outsider = await newMember();
    const community = await newCommunity([member.userId]);

    const inNetwork = await feed.createPost(
      member,
      post({ communityId: community.id, body: 'Une publication réservée au réseau.' }),
    );

    // Elle n'est PAS dans le fil global — pas même pour son auteur.
    for (const reader of [member, outsider]) {
      expect(
        (await feed.feed(reader, feedQuerySchema.parse({ limit: 50 }))).items.map(
          (i) => (i as { id: string }).id,
        ),
      ).not.toContain(inNetwork.post.id);
    }

    // Le membre la voit dans le fil du réseau ; l'étranger obtient un 404.
    const network = await feed.feed(member, feedQuerySchema.parse({ communityId: community.id }));
    expect(network.items.map((i) => (i as { id: string }).id)).toContain(inNetwork.post.id);
    expect(network.meta.scopeKind).toBe('COMMUNITY');
    await expect(
      feed.feed(outsider, feedQuerySchema.parse({ communityId: community.id })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(feed.postDetail(outsider, inNetwork.post.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // Et on ne publie pas dans un réseau dont on n'est pas membre.
    await expect(
      feed.createPost(outsider, post({ communityId: community.id })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  }, TEST_TIMEOUT_MS);

  // ══ §2.4 : les images passent par le pipeline média ══════════════════════

  it('refuse une image dont les EXIF ne sont pas retirées (§2.4)', async () => {
    const author = await newMember();

    const make = async (over: { status?: 'PENDING' | 'READY'; exifStripped?: boolean }) => {
      const asset = await prisma.mediaAsset.create({
        data: {
          id: newId(),
          ownerUserId: author.userId,
          kind: 'POST',
          storageKey: `test/feed/${newId()}.jpg`,
          mime: 'image/jpeg',
          sizeBytes: BigInt(1024),
          status: over.status ?? 'READY',
          exifStripped: over.exifStripped ?? true,
        },
      });
      createdMediaIds.push(asset.id);
      return asset.id;
    };

    const clean = await make({});
    const withExif = await make({ exifStripped: false });
    const notScanned = await make({ status: 'PENDING' });

    const published = await feed.createPost(author, post({ mediaIds: [clean] }));
    expect(published.post.media).toHaveLength(1);

    await expect(
      feed.createPost(author, post({ mediaIds: [clean, withExif] })),
    ).rejects.toMatchObject({
      code: 'INVALID_ATTACHMENT',
      details: { reason: 'EXIF_NOT_STRIPPED' },
    });
    await expect(feed.createPost(author, post({ mediaIds: [notScanned] }))).rejects.toMatchObject({
      details: { reason: 'MEDIA_NOT_READY' },
    });

    // Et l'image d'un AUTRE membre n'est pas publiable : 404, pas 403.
    const stranger = await newMember();
    await expect(feed.createPost(stranger, post({ mediaIds: [clean] }))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  }, TEST_TIMEOUT_MS);

  /**
   * [RÈGLE DURE] Le GENRE du média est filtré — 00 §8.1.
   *
   * §8.1 range le justificatif d'activité pro en « Stocké, accès équipe
   * uniquement, **jamais affiché** ». Le trou que ce test ferme n'était pas une
   * fuite entre membres : `resolveMedia` vérifiait bien le propriétaire. C'est le
   * PROPRIÉTAIRE LUI-MÊME qui pouvait publier son propre justificatif, parce
   * qu'aucun genre n'était regardé — ni pour l'image d'une publication, ni pour
   * le fond d'une story.
   *
   * LES DEUX CHEMINS SONT ÉPROUVÉS. `createPost` (`mediaIds`) et `createStory`
   * (`backgroundAssetId`) appellent tous deux `resolveMedia`, et ne tester que
   * le premier laisserait croire le second couvert.
   *
   * LA PRÉMISSE EST VÉRIFIÉE D'ABORD : le même membre, avec un média `POST`
   * par ailleurs identique, publie. Sans cela le test passerait aussi si
   * `createPost` refusait tout.
   */
  it('[RÈGLE DURE] refuse de publier un média d’un autre genre, PROOF compris (§8.1)', async () => {
    const author = await newMember();

    const asset = async (kind: 'POST' | 'PROOF' | 'MESSAGE' | 'HOUSING' | 'AVATAR') => {
      const row = await prisma.mediaAsset.create({
        data: {
          id: newId(),
          ownerUserId: author.userId,
          kind,
          storageKey: `test/feed-genre/${newId()}.jpg`,
          mime: 'image/jpeg',
          sizeBytes: BigInt(1024),
          status: 'READY',
          exifStripped: true,
        },
      });
      createdMediaIds.push(row.id);
      return row.id;
    };

    // ── PRÉMISSE : le genre POST, lui, passe ────────────────────────────────
    const legitimate = await asset('POST');
    const published = await feed.createPost(author, post({ mediaIds: [legitimate] }));
    expect(published.post.media).toHaveLength(1);

    // ── LA RÈGLE : tout autre genre est refusé, et du MÊME 404 ──────────────
    //
    // 404 et non 422 : le genre est une propriété cachée de la ligne, et un refus
    // nommé apprendrait qu'un justificatif existe sous cet identifiant — le
    // chemin `/media/proof/…` daterait même son dépôt.
    for (const kind of ['PROOF', 'MESSAGE', 'HOUSING', 'AVATAR'] as const) {
      const foreign = await asset(kind);

      await expect(feed.createPost(author, post({ mediaIds: [foreign] }))).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      // Le fond de story passe par le même `resolveMedia` : même refus.
      //
      // `backgroundColor: undefined` est EXPLICITE : le schéma impose la couleur
      // OU l'image et jamais les deux (`createStorySchema`, refine), et le
      // gabarit `story()` pose une couleur. Sans cette remise à zéro le corps
      // serait un corps qu'aucune requête réelle ne peut former, et le test
      // vérifierait un chemin que la validation ferme en amont.
      await expect(
        feed.createStory(author, story({ backgroundColor: undefined, backgroundAssetId: foreign })),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }

    // Et un genre interdit GLISSÉ dans un lot par ailleurs licite ne passe pas
    // davantage : c'est la forme qu'aurait prise un contournement, le média
    // valide servant de laissez-passer aux autres.
    const smuggled = await asset('PROOF');
    await expect(
      feed.createPost(author, post({ mediaIds: [legitimate, smuggled] })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  }, TEST_TIMEOUT_MS);

  // ══ §7 : les trois tâches planifiées ═════════════════════════════════════

  it('recalcule le score toutes les 15 minutes, et pas à chaque vote (§2.6, §7)', async () => {
    const author = await newMember();
    const created = await feed.createStory(author, story());
    const storyId = created.story.id;

    for (let i = 0; i < 3; i += 1) {
      await feed.reactToStory(await newMember('L0'), storyId, { kind: 'USEFUL' });
    }
    await feed.reactToStory(await newMember('L0'), storyId, { kind: 'NOT_USEFUL' });

    // Les COMPTEURS ont bougé — ils s'affichent sous les boutons. Le SCORE, non :
    // §2.6 le fait recalculer par une tâche, et le classement du bandeau ne doit
    // pas sauter à chaque clic.
    const before = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
    expect(before.positiveCount).toBe(3);
    expect(before.negativeCount).toBe(1);
    expect(Number(before.score)).toBe(0);

    await feed.recomputeStoryScores();
    const after = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
    expect(Number(after.score)).toBe(2);
  }, TEST_TIMEOUT_MS);

  it('purge l’historique à 30 jours, SAUF les stories enregistrées (§2.6, §7)', async () => {
    const author = await newMember();
    const keeper = await newMember();
    const toPurge = await feed.createStory(author, story({ category: 'LOGEMENT' }));
    const toKeep = await feed.createStory(author, story({ category: 'SANTE' }));

    await prisma.bookmark.create({
      data: {
        id: newId(),
        userId: keeper.userId,
        subjectType: 'STORY',
        subjectId: toKeep.story.id,
      },
    });

    const old = new Date(Date.now() - 40 * 86_400_000);
    await prisma.story.updateMany({
      where: { id: { in: [toPurge.story.id, toKeep.story.id] } },
      data: { status: 'EXPIRED', expiresAt: old },
    });

    const result = await feed.purgeStoryHistory();
    expect(result.purged).toBeGreaterThanOrEqual(1);
    expect(result.keptForBookmark).toBeGreaterThanOrEqual(1);

    expect(await prisma.story.findUnique({ where: { id: toPurge.story.id } })).toBeNull();
    // Le signet d'un AUTRE membre protège la story : §2.6 le dit explicitement.
    expect(await prisma.story.findUnique({ where: { id: toKeep.story.id } })).not.toBeNull();
    expect((await feed.storyDetail(keeper, toKeep.story.id)).story.id).toBe(toKeep.story.id);
  }, TEST_TIMEOUT_MS);

  // ══ §6 : les événements consommés ════════════════════════════════════════

  it('applique `moderation.content_hidden` et reste idempotent (§6)', async () => {
    const author = await newMember();
    const reader = await newMember();
    const published = await feed.createPost(author, post());
    const storyCreated = await feed.createStory(author, story());
    const comment = await feed.createComment(reader, {
      subjectType: 'POST',
      subjectId: published.post.id,
      body: 'Un commentaire qui sera masqué par la modération.',
    });

    // Prémisse : tout est visible avant le masquage.
    expect(
      (await feed.feed(reader, feedQuerySchema.parse({ limit: 50 }))).items.map(
        (i) => (i as { id: string }).id,
      ),
    ).toContain(published.post.id);

    for (const subject of [
      { subjectType: 'POST', subjectId: published.post.id },
      { subjectType: 'STORY', subjectId: storyCreated.story.id },
      { subjectType: 'COMMENT', subjectId: comment.comment.id },
    ]) {
      const first = await feed.handleContentHidden(subject);
      expect(first.hidden).toBe(1);
      // Idempotent : le rejeu ne casse rien (la livraison est « au moins une fois »).
      await expect(feed.handleContentHidden(subject)).resolves.toMatchObject({ hidden: 1 });
    }

    expect(
      (await feed.feed(reader, feedQuerySchema.parse({ limit: 50 }))).items.map(
        (i) => (i as { id: string }).id,
      ),
    ).not.toContain(published.post.id);
    await expect(feed.postDetail(reader, published.post.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // L'AUTEUR, lui, voit encore sa publication masquée — 13 §2 : il doit
    // comprendre pourquoi elle ne paraît plus.
    expect((await feed.postDetail(author, published.post.id)).post.id).toBe(published.post.id);
    await expect(feed.storyDetail(reader, storyCreated.story.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // Un sujet qui n'appartient pas au fil est IGNORÉ sans lever : le rejouer dix
    // fois ne le rendrait pas nôtre.
    await expect(
      feed.handleContentHidden({ subjectType: 'GUIDE', subjectId: newId() }),
    ).resolves.toMatchObject({ hidden: 0 });
    // Une charge utile illisible ne fait pas tomber le gestionnaire non plus.
    await expect(feed.handleContentHidden({ nothing: true })).resolves.toMatchObject({
      hidden: 0,
    });
  }, TEST_TIMEOUT_MS);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UN COMMENTAIRE RETIRÉ LAISSE UN EMPLACEMENT — ET RIEN D'AUTRE            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « fais le reste aussi. » La colonne « ÉTATS » de A01C dessine
   * « Ce commentaire a été retiré par la modération. » ; jusqu'ici le commentaire
   * masqué ne quittait jamais le serveur et disparaissait sans trace.
   *
   * C'EST UN CHANGEMENT DE PRODUIT, donc le cas garde D'ABORD ce qu'il ne révèle
   * PAS. Les quatre disparitions ont des empreintes différentes et ce test les
   * sépare une par une — c'est le cœur du lot, pas un détail de couverture :
   *
   *   · MODÉRATION (`status = HIDDEN`) → emplacement visible ;
   *   · SUPPRESSION PAR L'AUTEUR (`deleted_at` + `REMOVED`) → aucune trace ;
   *   · BLOCAGE → aucune trace. RÈGLE DURE 08 §4 : un emplacement visible
   *     apprendrait au lecteur l'existence de quelqu'un qu'un blocage doit lui
   *     faire oublier, et ferait du fil un détecteur de blocage ;
   *   · les RÉPONSES d'une racine retirée → aucune trace, parce qu'une réponse
   *     paraphrase souvent ce qu'elle répond.
   */
  it('un commentaire RETIRÉ par la modération laisse un emplacement nu ; supprimé ou bloqué, rien', async () => {
    const auteur = await newMember('L1');
    const lecteur = await newMember('L1');
    const bloque = await newMember('L1');

    const publication = await feed.createPost(auteur, post({ body: 'Un fil à quatre voix.' }));
    const sujet = { subjectType: 'POST' as const, subjectId: publication.post.id };

    const modere = await feed.createComment(lecteur, { ...sujet, body: 'Le commentaire que la modération retirera.' });
    const garde = await feed.createComment(lecteur, { ...sujet, body: 'Le commentaire qui reste lisible.' });
    const supprime = await feed.createComment(lecteur, { ...sujet, body: 'Le commentaire que son auteur retirera.' });
    const duBloque = await feed.createComment(bloque, { ...sujet, body: 'Le commentaire de celui qui sera bloqué.' });

    // Une RÉPONSE sous la racine qui sera retirée, et une sous celle qui reste :
    // sans les deux, on ne saurait pas si la première disparaît pour la bonne
    // raison ou parce que les réponses ont cessé de sortir.
    const sousModere = await feed.createComment(auteur, {
      ...sujet,
      body: 'Une réponse sous la racine qui sera retirée.',
      parentCommentId: modere.comment.id,
    });
    const reponseModeree = await feed.createComment(auteur, {
      ...sujet,
      body: 'Une réponse qui sera elle-même retirée.',
      parentCommentId: garde.comment.id,
    });

    // PRÉMISSE : les six sont visibles avant quoi que ce soit, sinon tout ce qui
    // suit passerait sur une liste déjà vide.
    const avant = await feed.comments(lecteur, { ...sujet, limit: 20, sort: 'RECENT' });
    const idsDe = (page: Awaited<ReturnType<typeof feed.comments>>): string[] =>
      page.items.flatMap((r) =>
        'removed' in r ? [] : [r.id, ...r.replies.flatMap((x) => ('removed' in x ? [] : [x.id]))],
      );
    for (const attendu of [modere, garde, supprime, duBloque]) {
      expect(idsDe(avant)).toContain(attendu.comment.id);
    }
    expect(idsDe(avant)).toContain(sousModere.comment.id);
    expect(idsDe(avant)).toContain(reponseModeree.comment.id);

    // ── LES QUATRE DISPARITIONS, CHACUNE PAR SON CHEMIN RÉEL ───────────────
    await feed.handleContentHidden({ subjectType: 'COMMENT', subjectId: modere.comment.id });
    await feed.handleContentHidden({
      subjectType: 'COMMENT',
      subjectId: reponseModeree.comment.id,
    });
    await feed.deleteComment(lecteur, supprime.comment.id);
    await prisma.block.create({
      data: { id: newId(), blockerUserId: lecteur.userId, blockedUserId: bloque.userId },
    });

    const apres = await feed.comments(lecteur, { ...sujet, limit: 20, sort: 'RECENT' });

    // DEUX emplacements, pas plus : la racine modérée et la réponse modérée. Le
    // commentaire supprimé et celui du membre bloqué n'en laissent AUCUN.
    const emplacementsRacine = apres.items.filter((r) => 'removed' in r);
    const emplacementsReponse = apres.items.flatMap((r) =>
      'removed' in r ? [] : r.replies.filter((x) => 'removed' in x),
    );
    expect(emplacementsRacine, 'la racine retirée doit laisser UN emplacement').toHaveLength(1);
    expect(emplacementsReponse, 'la réponse retirée doit laisser UN emplacement').toHaveLength(1);

    // L'EMPLACEMENT NE PORTE QU'UNE CLÉ. Ni corps, ni auteur, ni date, ni
    // identifiant : c'est le contrat de `commentRemovedSchema`, et c'est ce qui
    // fait qu'il ne révèle rien ni directement ni par déduction.
    for (const vide of [...emplacementsRacine, ...emplacementsReponse]) {
      expect(Object.keys(vide)).toEqual(['removed']);
    }

    // LA RACINE RETIRÉE N'EMPORTE PAS SA RÉPONSE DANS LA LISTE : elle n'y est plus
    // du tout, ni lisible ni en emplacement.
    expect(idsDe(apres)).not.toContain(sousModere.comment.id);
    expect(
      apres.items.flatMap((r) => ('removed' in r ? [] : r.replies)),
      'une racine retirée ne rend aucune réponse',
    ).toHaveLength(1);

    // LE COMMENTAIRE LISIBLE EST TOUJOURS LÀ — sans lui, tout ce qui précède
    // serait satisfait par un service qui aurait cessé de rendre des commentaires.
    expect(idsDe(apres)).toEqual([garde.comment.id]);

    // ── LE TÉMOIN DU BLOCAGE, PAR LE CHEMIN DE LA FILE ────────────────────
    //
    // `handleUserBlocked` rejoue le filtre et LÈVE si quoi que ce soit du membre
    // bloqué traverse encore. Il lit maintenant la clause des LIGNES — celle qui
    // retient aussi les emplacements — donc un emplacement qui fuirait le ferait
    // échouer. C'est le garde-fou de la règle dure, pas une redite.
    await expect(
      feed.handleUserBlocked({ blockerUserId: lecteur.userId, blockedUserId: bloque.userId }),
    ).resolves.toMatchObject({ checked: 2 });

    // ET LE COMMENTAIRE DU MEMBRE BLOQUÉ RESTE VISIBLE À UN TIERS, retiré ou non :
    // le blocage est une relation entre deux personnes, pas une sanction.
    expect(
      idsDe(await feed.comments(auteur, { ...sujet, limit: 20, sort: 'RECENT' })),
    ).toContain(duBloque.comment.id);
  }, TEST_TIMEOUT_MS);

  it('recalcule le score des conseils de l’étape sur `journey.step_completed` (§6)', async () => {
    const author = await newMember();
    const stepDefinitionId = await newStepDefinition('Inscription universitaire');
    const advice = await feed.createStory(
      author,
      story({ category: undefined, stepDefinitionId }),
    );

    await feed.reactToStory(await newMember('L0'), advice.story.id, { kind: 'USEFUL' });
    await feed.reactToStory(await newMember('L0'), advice.story.id, { kind: 'USEFUL' });
    expect(
      Number((await prisma.story.findUniqueOrThrow({ where: { id: advice.story.id } })).score),
    ).toBe(0);

    // Un parcours avec une étape rattachée à cette définition.
    const template = await prisma.journeyTemplate.create({
      data: {
        id: newId(),
        code: `test-feed-step-evt-${Date.now()}`,
        nameFr: 'Travail',
        targetPhase: 'PRE_DEPARTURE',
        isActive: true,
        sortOrder: 902,
      },
    });
    createdTemplateIds.push(template.id);
    const version = await prisma.journeyTemplateVersion.create({
      data: { id: newId(), templateId: template.id, version: 1, status: 'PUBLISHED' },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: author.userId },
      select: { originCountryId: true },
    });
    const journey = await prisma.journey.create({
      data: {
        id: newId(),
        ownerUserId: author.userId,
        templateVersionId: version.id,
        title: 'Parcours de test',
        status: 'ACTIVE',
        originCountryId: user.originCountryId,
        destinationCityId: cityA.id,
        lastActivityAt: new Date(),
      },
    });
    const step = await prisma.journeyStep.create({
      data: {
        id: newId(),
        journeyId: journey.id,
        stepDefinitionId,
        title: 'S’inscrire à l’université',
        position: 1,
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    const result = await feed.handleJourneyStepCompleted({ journeyStepId: step.id });
    expect(result.updated).toBe(1);
    expect(
      Number((await prisma.story.findUniqueOrThrow({ where: { id: advice.story.id } })).score),
    ).toBe(2);

    // Idempotent : rejouer ne change rien, le recalcul est une fonction pure.
    await expect(feed.handleJourneyStepCompleted({ journeyStepId: step.id })).resolves.toMatchObject(
      { updated: 0 },
    );
    // Une étape ajoutée par le membre (sans définition) n'a aucun conseil.
    const custom = await prisma.journeyStep.create({
      data: {
        id: newId(),
        journeyId: journey.id,
        title: 'Une étape à moi',
        position: 2,
        status: 'DONE',
        isCustom: true,
        completedAt: new Date(),
      },
    });
    await expect(
      feed.handleJourneyStepCompleted({ journeyStepId: custom.id }),
    ).resolves.toMatchObject({ updated: 0 });
  }, TEST_TIMEOUT_MS);

  // ══ §8 : le gestionnaire de suppression de compte ════════════════════════

  it('supprime publications et stories à la suppression du compte, et ajuste les compteurs (§8)', async () => {
    const leaver = await newMember();
    const other = await newMember();

    const leaverPost = await feed.createPost(leaver, post());
    const otherPost = await feed.createPost(other, post());
    const leaverStory = await feed.createStory(leaver, story());

    // Le partant a réagi et commenté chez l'autre.
    await feed.reactToPost(leaver, otherPost.post.id);
    const leaverComment = await feed.createComment(leaver, {
      subjectType: 'POST',
      subjectId: otherPost.post.id,
      body: 'Un commentaire qui doit partir avec le compte.',
    });
    // Et un commentaire sur un GUIDE serait CONSERVÉ (§8) — il n'y a pas de
    // guide ici, la règle est vérifiée par le `subject_type` du `deleteMany`.
    const before = await prisma.post.findUniqueOrThrow({ where: { id: otherPost.post.id } });
    expect(before.reactionCount).toBe(1);
    expect(before.commentCount).toBe(1);

    const result = await feed.handleUserDeleted(leaver.userId);
    expect(result.posts).toBe(1);
    expect(result.stories).toBe(1);
    expect(result.comments).toBe(1);

    expect(await prisma.post.findUnique({ where: { id: leaverPost.post.id } })).toBeNull();
    expect(await prisma.story.findUnique({ where: { id: leaverStory.story.id } })).toBeNull();
    expect(await prisma.comment.findUnique({ where: { id: leaverComment.comment.id } })).toBeNull();

    // §8 : « Réactions : supprimées, COMPTEURS DÉCRÉMENTÉS. » C'est la moitié
    // qu'on oublie, et elle se voit sur la carte d'un autre membre.
    const after = await prisma.post.findUniqueOrThrow({ where: { id: otherPost.post.id } });
    expect(after.reactionCount).toBe(0);
    expect(after.commentCount).toBe(0);

    // Idempotent : le rejeu ne fait pas passer les compteurs sous zéro.
    await expect(feed.handleUserDeleted(leaver.userId)).resolves.toMatchObject({ posts: 0 });
    const twice = await prisma.post.findUniqueOrThrow({ where: { id: otherPost.post.id } });
    expect(twice.reactionCount).toBe(0);
  }, TEST_TIMEOUT_MS);

  // ══ §2.7 : la colonne droite ═════════════════════════════════════════════

  it('calcule les quatre blocs de la colonne droite, blocages exclus (§2.7)', async () => {
    const reader = await newMember('L1', { cityId: cityA.id });
    const organizer = await newMember('L1', { cityId: cityA.id });
    const newcomer = await newMember('L1', { cityId: cityA.id, phase: 'RECENT_ARRIVAL' });
    const blockedNewcomer = await newMember('L1', { cityId: cityA.id, phase: 'RECENT_ARRIVAL' });
    const contact = await newMember('L1', { cityId: cityA.id });

    // Un événement à venir dans la ville.
    const event = await prisma.event.create({
      data: {
        id: newId(),
        organizerUserId: organizer.userId,
        type: 'PICNIC',
        title: 'Pique-nique du dimanche',
        cityId: cityA.id,
        /**
         * DANS UNE MINUTE, ET NON DANS TROIS JOURS.
         *
         * §2.7 ne montre que les TROIS PROCHAINS événements de la ville. Sur une
         * base de développement partagée, les événements s'accumulent : celui de ce
         * cas, posé à trois jours, est passé quatrième et le cas tombait — sur
         * l'encombrement de la base, pas sur un défaut de la colonne.
         *
         * Le plus proche dans le temps est forcément dans les trois premiers. Une
         * minute suffit : il reste à VENIR, ce que le bloc exige, et aucun autre
         * cas ne pose d'événement dans cette fenêtre.
         */
        startsAt: new Date(Date.now() + 60_000),
        status: 'SCHEDULED',
      },
    });

    // Un contact en ligne — vu il y a deux minutes.
    const [a, b] =
      reader.userId < contact.userId
        ? [reader.userId, contact.userId]
        : [contact.userId, reader.userId];
    await prisma.connection.create({
      data: { id: newId(), userAId: a, userBId: b, origin: 'MANUAL' },
    });
    await prisma.user.update({
      where: { id: contact.userId },
      data: { lastSeenAt: new Date(Date.now() - 2 * 60_000) },
    });

    // Une alerte de vigilance épinglée pour la ville.
    const staff = await prisma.staffUser.create({
      data: {
        id: newId(),
        email: `moderation+${Date.now()}@test.local`,
        displayName: 'Modération de test',
        passwordHash: 'argon2id$test',
        totpSecretEncrypted: randomBytes(32),
        role: 'MODERATOR',
        isActive: true,
      },
    });
    createdStaffIds.push(staff.id);
    const alert = await prisma.scamAlert.create({
      data: {
        id: newId(),
        title: 'Fausses annonces de logement',
        body: 'Ne versez jamais de caution avant d’avoir visité.',
        severity: 'WARNING',
        cityId: cityA.id,
        isPinned: true,
        publishedAt: new Date(Date.now() - 60_000),
        createdByStaffId: staff.id,
      },
    });
    createdScamAlertIds.push(alert.id);

    feed.resetSidebarCache();
    const sidebar = (await feed.sidebar(reader)) as {
      cityEvents: { id: string }[];
      newArrivals: { items: { id: string }[]; canGreet: boolean };
      scamAlert: { id: string } | null;
      onlineContacts: { id: string }[];
    };

    expect(sidebar.cityEvents.map((e) => e.id)).toContain(event.id);
    expect(sidebar.newArrivals.items.map((m) => m.id)).toContain(newcomer.userId);
    expect(sidebar.newArrivals.items.map((m) => m.id)).toContain(blockedNewcomer.userId);
    // §2.7 : « bouton Saluer […] si L1 ».
    expect(sidebar.newArrivals.canGreet).toBe(true);
    expect(sidebar.scamAlert?.id).toBe(alert.id);
    expect(sidebar.onlineContacts.map((c) => c.id)).toContain(contact.userId);
    // Le lecteur ne se voit JAMAIS dans « nouveaux arrivants ».
    expect(sidebar.newArrivals.items.map((m) => m.id)).not.toContain(reader.userId);

    // Après un blocage, le nouvel arrivant bloqué disparaît de la colonne.
    await prisma.block.create({
      data: { id: newId(), blockerUserId: blockedNewcomer.userId, blockedUserId: reader.userId },
    });
    feed.resetSidebarCache();
    const afterBlock = (await feed.sidebar(reader)) as {
      newArrivals: { items: { id: string }[] };
    };
    expect(afterBlock.newArrivals.items.map((m) => m.id)).not.toContain(blockedNewcomer.userId);
    expect(afterBlock.newArrivals.items.map((m) => m.id)).toContain(newcomer.userId);

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ UN L0 PEUT SALUER — ÉCART ASSUMÉ AVEC §2.7 ET 08 §5.2                   ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * Ce cas gelait l'inverse : « Saluer » est un message privé, donc L1, donc le
     * bouton n'apparaissait pas à un compte non vérifié.
     *
     * Le porteur a demandé d'ouvrir la messagerie aux non-vérifiés ; la décision et
     * ce qu'elle coûte sont écrites sur `message.send` dans `capabilities.ts`.
     * `canGreet` en découle MÉCANIQUEMENT — il lit cette capacité — et c'est bien
     * ainsi : une seule source, pas une seconde règle à maintenir à côté.
     *
     * ⚠ CE QUE CET ÉCART A DE PARTICULIER, et c'est pourquoi il est écrit ici
     * plutôt que seulement dans la table : « Saluer » vise les NOUVEAUX ARRIVANTS,
     * et `permissionFor` rend `GREET` pour eux — ce qui veut dire que la
     * conversation ne part PAS en attente d'acceptation. Un compte non vérifié
     * peut donc écrire directement à la population la plus exposée, sans le filtre
     * de la demande. Remonté au porteur.
     */
    const pre = await newMember('L0', { cityId: cityA.id });
    feed.resetSidebarCache();
    expect(
      ((await feed.sidebar(pre)) as { newArrivals: { canGreet: boolean } }).newArrivals.canGreet,
    ).toBe(true);
  }, TEST_TIMEOUT_MS);

  // ══ §2.6 : l'ordre du bandeau et la ligne d'état ═════════════════════════

  it('ordonne le bandeau informations, conseils, découvertes (§2.6)', async () => {
    const reader = await newMember('L1', { cityId: cityNear.id });
    const informer = await newMember('L1', { cityId: cityNear.id });
    const adviser = await newMember('L1', { cityId: cityNear.id });
    const finder = await newMember('L1', { cityId: cityNear.id });

    // Publiées dans l'ordre INVERSE de celui attendu : sans classement, la
    // découverte sortirait en tête.
    const discovery = await feed.createStory(
      finder,
      story({ type: 'DECOUVERTE', category: 'LIEU', placeLabel: 'Marché du matin' }),
    );
    const advice = await feed.createStory(adviser, story({ type: 'CONSEIL', category: 'LOGEMENT' }));
    const information = await feed.createStory(
      informer,
      story({ type: 'INFORMATION', category: 'DEMARCHES' }),
    );

    const band = await feed.storyBand(reader, { cityId: cityNear.id });
    const authors = band.items.map((b) => (b as { author: { id: string } }).author.id);
    expect(authors.indexOf(informer.userId)).toBeLessThan(authors.indexOf(adviser.userId));
    expect(authors.indexOf(adviser.userId)).toBeLessThan(authors.indexOf(finder.userId));

    // Le filtre par type ne garde que le sien.
    const onlyAdvice = await feed.storyBand(reader, { type: 'CONSEIL' });
    const adviceIds = onlyAdvice.items.flatMap((b) =>
      (b as { stories: { id: string }[] }).stories.map((s) => s.id),
    );
    expect(adviceIds).toContain(advice.story.id);
    expect(adviceIds).not.toContain(information.story.id);
    expect(adviceIds).not.toContain(discovery.story.id);

    // La ligne d'état de §2.6 : « 1er des conseils Logement aujourd'hui · … ».
    await feed.reactToStory(await newMember('L0'), advice.story.id, { kind: 'USEFUL' });
    const detail = (await feed.storyDetail(reader, advice.story.id)) as {
      story: { stateLine: string; rank: number };
    };
    expect(detail.story.stateLine).toContain('des conseils Logement aujourd’hui');
    expect(detail.story.stateLine).toContain('1 trouve utile');
  }, TEST_TIMEOUT_MS);

  // ══ §2.6 : dix votes négatifs ouvrent un dossier, sans rien masquer ══════

  it('ouvre un dossier priorité 4 à 10 négatifs, sans masquer la story (§2.6)', async () => {
    const author = await newMember();
    const created = await feed.createStory(author, story());
    const storyId = created.story.id;

    for (let i = 0; i < 10; i += 1) {
      await feed.reactToStory(await newMember('L0'), storyId, { kind: 'NOT_USEFUL' });
    }

    const flagged = await prisma.domainEvent.findMany({
      where: { type: 'content.flagged', aggregateId: storyId },
    });
    expect(flagged).toHaveLength(1);
    expect((flagged[0]?.payload as Record<string, unknown>)['priority']).toBe(4);

    // « Le vote négatif n'a AUCUN effet de masquage » : la story reste ACTIVE et
    // visible, et c'est la moitié de la règle qu'on oublie.
    const row = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
    expect(row.status).toBe('ACTIVE');
    expect(row.moderationStatus).toBe('PENDING');
    expect((await feed.storyDetail(await newMember(), storyId)).story.id).toBe(storyId);

    // Un onzième vote négatif n'ouvre PAS un second dossier.
    await feed.reactToStory(await newMember('L0'), storyId, { kind: 'NOT_USEFUL' });
    expect(
      await prisma.domainEvent.count({ where: { type: 'content.flagged', aggregateId: storyId } }),
    ).toBe(1);
  }, TEST_TIMEOUT_MS);

  // ══ §2.4 : les limites de publication ════════════════════════════════════

  it('limite à 10 publications par heure (§2.4)', async () => {
    const author = await newMember();
    for (let i = 0; i < FEED_LIMITS.postsPerHour; i += 1) {
      await feed.createPost(author, post({ body: `Publication numéro ${i + 1} de la série.` }));
    }
    await expect(feed.createPost(author, post())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      details: { limit: 'feed.postsPerHour', max: FEED_LIMITS.postsPerHour },
    });

    // Supprimer ne remet PAS le compteur à zéro : sinon la limite ne limite rien.
    const mine = await prisma.post.findFirstOrThrow({ where: { authorUserId: author.userId } });
    await feed.deletePost(author, mine.id);
    await expect(feed.createPost(author, post())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  }, TEST_TIMEOUT_MS);
  // ── Le sondage et les guides d'une publication (§2.4) ──────────────────────

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE SONDAGE ET LES GUIDES — DESSINÉS DEPUIS LE DÉBUT, STOCKÉS DEPUIS PEU  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « la création de sondage, les guides […] ne marchent pas ».
   *
   * Ils étaient dessinés dans la maquette — « Créer un sondage », « Lier un
   * guide », et la carte de publication a son bloc de sondage — et la base ne
   * savait pas les porter : `polls.community_id` était OBLIGATOIRE, donc un
   * sondage ne pouvait appartenir qu'à un réseau, et `posts` n'avait aucune
   * relation vers un guide.
   *
   * ── CE QUE CE CAS MESURE ──────────────────────────────────────────────────
   *
   *   · la publication, le sondage et les guides naissent ENSEMBLE ;
   *   · les résultats sont MASQUÉS avant d'avoir voté — `voteCount` à `null`, et
   *     non à zéro : un zéro dirait « personne n'a voté » à qui n'a pas le droit
   *     de savoir ;
   *   · voter les RÉVÈLE, et le vote est modifiable ;
   *   · la borne de trois guides tient, et un guide non publié est ÉCARTÉ plutôt
   *     que de faire échouer la publication.
   *
   * ── MUTATIONS APPLIQUÉES ──────────────────────────────────────────────────
   *
   *   · `resultsVisible` posé à `true` en dur → le cas du masquage tombe ;
   *   · `assertPollAccess` rendant toujours sans vérifier → le vote d'un tiers sur
   *     un sondage de réseau fermé passerait (gardé par le module 07) ;
   *   · `resolveGuides` sans son filtre `status: 'PUBLISHED'` → le cas du guide
   *     non publié tombe ;
   *   · `.slice(0, postGuidesMax)` retiré → la borne tombe.
   */
  it('publie avec un sondage et des guides, masque les résultats, puis les révèle au vote', async () => {
    const auteur = await newMember('L1');
    const lecteur = await newMember('L1');

    const guideA = await publishedGuide();
    const guideB = await publishedGuide();

    const cree = await feed.createPost(
      auteur,
      {
        type: 'DISCUSSION',
        body: 'Quel jour vous arrange pour la permanence ?',
        poll: { question: 'Quel jour vous arrange ?', options: ['Samedi', 'Dimanche'], isMultiple: false, resultsAfterVote: true, isAnonymous: true },
        guideIds: [guideA, guideB],
      },
    );
    const postId = cree.post.id;

    // ── LA PUBLICATION PORTE LES DEUX ───────────────────────────────────────
    const vuAuteur = await feed.postDetail(auteur, postId);
    expect(vuAuteur.post.poll?.question).toBe('Quel jour vous arrange ?');
    expect(vuAuteur.post.poll?.options.map((o) => o.label)).toEqual(['Samedi', 'Dimanche']);
    expect(vuAuteur.post.guides.map((g) => g.id)).toEqual([guideA, guideB]);

    // ── LES RÉSULTATS SONT MASQUÉS TANT QU'ON N'A PAS VOTÉ ─────────────────
    //
    // `null` et NON zéro : la différence est toute la règle. Un `0` affirme un
    // fait — personne n'a voté — à quelqu'un qui n'a pas le droit de le savoir.
    const vuLecteur = await feed.postDetail(lecteur, postId);
    expect(vuLecteur.post.poll?.resultsVisible).toBe(false);
    expect(vuLecteur.post.poll?.totalVotes).toBeNull();
    expect(vuLecteur.post.poll?.options.map((o) => o.voteCount)).toEqual([null, null]);
    expect(vuLecteur.post.poll?.myOptionIds).toEqual([]);

    // ── VOTER LES RÉVÈLE ───────────────────────────────────────────────────
    const pollId = vuLecteur.post.poll?.id ?? '';
    const samedi = vuLecteur.post.poll?.options[0]?.id ?? '';
    const dimanche = vuLecteur.post.poll?.options[1]?.id ?? '';
    await communities.vote(pollId, lecteur.userId, [samedi]);

    const apresVote = await feed.postDetail(lecteur, postId);
    expect(apresVote.post.poll?.resultsVisible).toBe(true);
    expect(apresVote.post.poll?.totalVotes).toBe(1);
    expect(apresVote.post.poll?.myOptionIds).toEqual([samedi]);
    expect(apresVote.post.poll?.options.map((o) => o.voteCount)).toEqual([1, 0]);

    // ── ET LE VOTE EST MODIFIABLE (§2.3 du module 07) ──────────────────────
    await communities.vote(pollId, lecteur.userId, [dimanche]);
    const apresChangement = await feed.postDetail(lecteur, postId);
    expect(apresChangement.post.poll?.myOptionIds).toEqual([dimanche]);
    expect(apresChangement.post.poll?.options.map((o) => o.voteCount)).toEqual([0, 1]);
    expect(apresChangement.post.poll?.totalVotes).toBe(1);
  });

  it('écarte un guide non publié, et ne lie jamais plus de trois guides', async () => {
    const auteur = await newMember('L1');
    const publies = [await publishedGuide(), await publishedGuide(), await publishedGuide()];
    const brouillon = await draftGuide();

    /**
     * LE GUIDE NON PUBLIÉ EST ÉCARTÉ, PAS REFUSÉ, et la différence est un choix :
     * refuser ferait échouer toute la publication parce qu'un guide a été dépublié
     * entre le moment où le membre l'a choisi et celui où il appuie sur
     * « Publier » — un délai qui se compte en minutes dans un composeur.
     */
    const cree = await feed.createPost(
      auteur,
      { type: 'INFO', body: 'Trois guides utiles sur le logement.', guideIds: [publies[0]!, brouillon, publies[1]!] },
    );
    const vu = await feed.postDetail(auteur, cree.post.id);
    expect(vu.post.guides.map((g) => g.id)).toEqual([publies[0], publies[1]]);

    /**
     * LA BORNE EST TENUE DEUX FOIS — par `createPostSchema` à la frontière et par
     * le service. Ce cas éprouve LE SERVICE : il lui passe quatre identifiants
     * directement, ce que le schéma aurait refusé.
     */
    const quatre = await feed.createPost(
      auteur,
      {
        type: 'INFO',
        body: 'Quatre guides, dont un de trop.',
        guideIds: [publies[0]!, publies[1]!, publies[2]!, publies[0]!],
      },
    );
    const vuQuatre = await feed.postDetail(auteur, quatre.post.id);
    expect(vuQuatre.post.guides.length).toBeLessThanOrEqual(FEED_LIMITS.postGuidesMax);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES DEUX INTERRUPTEURS SONT DEVENUS DE VRAIS RÉGLAGES                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « non, fais de ça un réglage ». La maquette dessinait trois
   * interrupteurs ; un seul était porté par la base, et j'avais rendu les deux
   * autres inertes en expliquant que le produit imposait leurs règles. Il a
   * tranché autrement, et chacun est maintenant une colonne.
   *
   * ── CE QUE CE CAS GARDE, ET POURQUOI CHAQUE MOITIÉ COMPTE ────────────────
   *
   *   · `resultsAfterVote: false` révèle les comptes SANS avoir voté. Sans cette
   *     moitié, un réglage ignoré passerait au vert ;
   *   · `isAnonymous: false` NOMME les votants — et seulement quand les résultats
   *     sont visibles. Les deux conditions, pas l'une ou l'autre : sinon le
   *     réglage d'anonymat contournerait celui des résultats, et on saurait QUI a
   *     voté QUOI avant d'avoir le droit de savoir COMBIEN ;
   *   · les DÉFAUTS ne changent rien — c'est la moitié qui garantit qu'ajouter un
   *     réglage n'a pas changé le sens des sondages existants.
   *
   * ── MUTATIONS APPLIQUÉES ──────────────────────────────────────────────────
   *
   *   · `!poll.resultsAfterVote ||` retiré → le cas des résultats immédiats tombe ;
   *   · `nomme` calculé sur `!isAnonymous` seul → le cas « non anonyme mais
   *     résultats masqués » tombe, et LUI SEUL : c'est ce qui prouve que les deux
   *     conditions sont bien exigées ensemble ;
   *   · les défauts de la migration passés à `false` → le cas des défauts tombe.
   */
  it('les deux réglages du sondage décident de ce qui sort, et leurs défauts ne changent rien', async () => {
    const auteur = await newMember('L1');
    const lecteur = await newMember('L1');

    // ── 1. RÉSULTATS IMMÉDIATS, ET PAS DE NOMS ────────────────────────────
    const ouvert = await feed.createPost(auteur, {
      type: 'DISCUSSION',
      body: 'Résultats visibles tout de suite.',
      poll: {
        question: 'Quel jour vous arrange ?',
        options: ['Samedi', 'Dimanche'],
        isMultiple: false,
        resultsAfterVote: false,
        isAnonymous: true,
      },
    });
    const vuSansVote = await feed.postDetail(lecteur, ouvert.post.id);
    expect(vuSansVote.post.poll?.resultsVisible, 'les résultats devaient être visibles sans vote').toBe(true);
    expect(vuSansVote.post.poll?.totalVotes).toBe(0);
    expect(vuSansVote.post.poll?.options.every((o) => o.voteCount === 0)).toBe(true);
    /** Anonyme : personne n'est nommé, même avec les résultats sous les yeux. */
    expect(vuSansVote.post.poll?.options.every((o) => o.voters.length === 0)).toBe(true);

    // ── 2. NON ANONYME : LES VOTANTS SONT NOMMÉS, APRÈS LE VOTE ───────────
    const nomme = await feed.createPost(auteur, {
      type: 'DISCUSSION',
      body: 'Qui vient ?',
      poll: {
        question: 'Vous venez ?',
        options: ['Oui', 'Non'],
        isMultiple: false,
        resultsAfterVote: true,
        isAnonymous: false,
      },
    });
    const avantVote = await feed.postDetail(lecteur, nomme.post.id);
    /**
     * NON ANONYME, MAIS RÉSULTATS ENCORE MASQUÉS : aucun nom. C'est la moitié
     * qui prouve que les deux conditions sont exigées ENSEMBLE.
     */
    expect(avantVote.post.poll?.resultsVisible).toBe(false);
    expect(avantVote.post.poll?.options.every((o) => o.voters.length === 0)).toBe(true);

    const oui = avantVote.post.poll?.options[0]?.id ?? '';
    await communities.vote(avantVote.post.poll?.id ?? '', lecteur.userId, [oui]);

    const apresVote = await feed.postDetail(lecteur, nomme.post.id);
    expect(apresVote.post.poll?.resultsVisible).toBe(true);
    const votants = apresVote.post.poll?.options[0]?.voters ?? [];
    expect(votants.map((v) => v.id)).toEqual([lecteur.userId]);
    expect(apresVote.post.poll?.options[1]?.voters).toEqual([]);

    // ── 3. LES DÉFAUTS SONT L'ANCIEN COMPORTEMENT ─────────────────────────
    //
    // `createPollSchema` les pose à `true` ; on passe donc par le SCHÉMA, et non
    // par un objet écrit à la main — c'est le défaut du schéma qu'on éprouve.
    const parDefaut = createPollSchema.parse({
      question: 'Et sans rien préciser ?',
      options: ['A', 'B'],
    });
    expect(parDefaut.resultsAfterVote).toBe(true);
    expect(parDefaut.isAnonymous).toBe(true);

    const muet = await feed.createPost(auteur, {
      type: 'DISCUSSION',
      body: 'Sondage sans réglage.',
      poll: parDefaut,
    });
    const vuMuet = await feed.postDetail(lecteur, muet.post.id);
    expect(vuMuet.post.poll?.resultsVisible, 'le défaut doit masquer les résultats').toBe(false);
    expect(vuMuet.post.poll?.totalVotes).toBeNull();
    expect(vuMuet.post.poll?.options.every((o) => o.voters.length === 0)).toBe(true);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « PERTINENTS » / « RÉCENTS » — LES DEUX ONGLETS NE TRIAIENT RIEN         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La planche A01C les dessine depuis le début ; la route rendait TOUJOURS
   * l'ordre de la discussion. Le porteur : « pertinent/récents » à finaliser.
   *
   * CE CAS MESURE LES DEUX ORDRES SUR LE MÊME JEU, et c'est ce qui le rend
   * concluant : un seul ordre vérifié passerait au vert même si le paramètre était
   * ignoré, puisque l'un des deux EST l'ancien comportement.
   *
   * § 2.5 NE DÉFINIT AUCUNE PERTINENCE, et il n'existe aucune réaction de
   * commentaire. Le seul signal en base est le nombre de réponses : c'est lui que
   * « Pertinents » trie, et le cas le fixe pour que la définition ne dérive pas en
   * silence.
   */
  it('« Pertinents » remonte le fil le plus répondu, « Récents » le plus neuf', async () => {
    const auteur = await newMember('L1');
    const lecteur = await newMember('L1');

    const publication = await feed.createPost(auteur, post({ body: 'Trois fils, un seul répondu.' }));
    const sujet = { subjectType: 'POST' as const, subjectId: publication.post.id };

    const premier = await feed.createComment(lecteur, { ...sujet, body: 'Le premier commentaire.' });
    await feed.createComment(lecteur, { ...sujet, body: 'Le deuxième commentaire.' });
    const dernier = await feed.createComment(lecteur, { ...sujet, body: 'Le troisième commentaire.' });

    // Le PREMIER est celui qui a suscité des réponses — et c'est le plus ancien,
    // donc les deux ordres ne peuvent pas coïncider par hasard.
    await feed.createComment(auteur, {
      ...sujet,
      body: 'Une réponse au premier.',
      parentCommentId: premier.comment.id,
    });
    await feed.createComment(lecteur, {
      ...sujet,
      body: 'Une deuxième réponse au premier.',
      parentCommentId: premier.comment.id,
    });

    const pertinents = await feed.comments(lecteur, { ...sujet, limit: 20, sort: 'RELEVANT' });
    expect(
      lisible(pertinents.items[0]).id,
      'le fil le plus répondu doit venir en tête de « Pertinents »',
    ).toBe(premier.comment.id);

    const recents = await feed.comments(lecteur, { ...sujet, limit: 20, sort: 'RECENT' });
    expect(lisible(recents.items[0]).id, '« Récents » doit commencer par le plus neuf').toBe(
      dernier.comment.id,
    );
    expect(lisible(recents.items.at(-1)).id, 'et finir par le plus ancien').toBe(
      premier.comment.id,
    );

    // LES RÉPONSES RESTENT SOUS LEUR RACINE dans les deux ordres : §2.5 ne connaît
    // qu'une profondeur, et paginer un mélange couperait un fil en deux.
    expect(lisible(pertinents.items[0]).replies).toHaveLength(2);
    expect(lisible(recents.items.at(-1)).replies).toHaveLength(2);

    // ── LE CURSEUR EST LIÉ À SON TRI ────────────────────────────────────────
    //
    // Une page de « Pertinents » rejouée sur « Récents » rendrait une liste
    // cohérente EN APPARENCE et fausse en fait. La portée du curseur l'interdit,
    // et ce relevé le prouve plutôt que de le supposer.
    const page1 = await feed.comments(lecteur, { ...sujet, limit: 1, sort: 'RELEVANT' });
    expect(page1.nextCursor).not.toBeNull();
    await expect(
      feed.comments(lecteur, {
        ...sujet,
        limit: 1,
        sort: 'RECENT',
        cursor: page1.nextCursor as string,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    // ── ET IL PAGINE VRAIMENT ───────────────────────────────────────────────
    const page2 = await feed.comments(lecteur, {
      ...sujet,
      limit: 1,
      sort: 'RELEVANT',
      cursor: page1.nextCursor as string,
    });
    expect(lisible(page2.items[0]).id, 'la deuxième page ne doit pas répéter la première').not.toBe(
      lisible(page1.items[0]).id,
    );
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ENREGISTRER UNE PUBLICATION — le bouton était dessiné, la route manquait ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le bouton bookmark des publications marche ? » Il ne marchait
   * pas : seules les STORIES avaient des routes, alors que `BookmarkSubjectType`
   * énumère `POST` depuis le début.
   *
   * CE CAS MESURE AUSSI QUE LE SIGNET EST PERSONNEL. Un `bookmarked` calculé sur
   * la table entière plutôt que sur le lecteur allumerait le signet de tout le
   * monde dès qu'un seul membre enregistre — et ce serait invisible tant qu'un
   * seul membre teste.
   */
  it('enregistre une publication, et le signet n’appartient qu’à son poseur', async () => {
    const auteur = await newMember('L1');
    const lecteur = await newMember('L1');
    const publication = await feed.createPost(auteur, post({ body: 'À garder sous le coude.' }));

    const vuAvant = await feed.postDetail(lecteur, publication.post.id);
    expect(vuAvant.post.bookmarked, 'personne n’a encore enregistré').toBe(false);

    expect(await feed.bookmarkPost(lecteur, publication.post.id)).toEqual({ bookmarked: true });
    // IDEMPOTENT : l'écran peut rejouer — double clic, réseau lent.
    expect(await feed.bookmarkPost(lecteur, publication.post.id)).toEqual({ bookmarked: true });

    expect((await feed.postDetail(lecteur, publication.post.id)).post.bookmarked).toBe(true);
    expect(
      (await feed.postDetail(auteur, publication.post.id)).post.bookmarked,
      'le signet du lecteur ne doit pas allumer celui de l’auteur',
    ).toBe(false);

    expect(await feed.unbookmarkPost(lecteur, publication.post.id)).toEqual({ bookmarked: false });
    expect((await feed.postDetail(lecteur, publication.post.id)).post.bookmarked).toBe(false);
    // Retirer deux fois ne lève pas : c'est un geste sans effet, pas une erreur.
    expect(await feed.unbookmarkPost(lecteur, publication.post.id)).toEqual({ bookmarked: false });
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ MODIFIER UNE PUBLICATION AVEC CE QU'ELLE PORTE                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur veut une fenêtre de modification « avec tous ces artifacts
   * (images, guides, sondages) ». `updatePostSchema` n'acceptait QUE `body`.
   *
   * CE CAS MESURE LA DISTINCTION QUI COMPTE : absent ≠ vide. Un `mediaIds` absent
   * laisse les images ; `mediaIds: []` les retire. Sans elle, une fenêtre qui
   * n'enverrait que le texte effacerait les photos en silence.
   */
  it('modifie les images, les guides et le sondage — et « absent » ne touche à rien', async () => {
    const auteur = await newMember('L1');

    const image = async () => {
      const row = await prisma.mediaAsset.create({
        data: {
          id: newId(),
          ownerUserId: auteur.userId,
          kind: 'POST',
          storageKey: `test/feed/${newId()}.jpg`,
          mime: 'image/jpeg',
          sizeBytes: BigInt(1024),
          status: 'READY',
          exifStripped: true,
        },
      });
      createdMediaIds.push(row.id);
      return row.id;
    };

    const [a, b] = [await image(), await image()];
    const guide = await publishedGuide();
    const publie = await feed.createPost(auteur, {
      ...post({ body: 'Deux images, un guide, un sondage.' }),
      mediaIds: [a, b],
      guideIds: [guide],
      poll: {
        question: 'Quel jour ?',
        options: ['Samedi', 'Dimanche'],
        isMultiple: false,
        resultsAfterVote: true,
        isAnonymous: true,
      },
    });
    expect(publie.post.media).toHaveLength(2);
    expect(publie.post.guides).toHaveLength(1);
    expect(publie.post.poll).not.toBeNull();

    // ── ABSENT NE TOUCHE À RIEN ────────────────────────────────────────────
    const texteSeul = await feed.updatePost(auteur, publie.post.id, { body: 'Texte corrigé.' });
    expect(texteSeul.post.body).toBe('Texte corrigé.');
    expect(texteSeul.post.media, 'les images devaient survivre').toHaveLength(2);
    expect(texteSeul.post.guides, 'le guide devait survivre').toHaveLength(1);
    expect(texteSeul.post.poll, 'le sondage devait survivre').not.toBeNull();

    // ── UNE IMAGE EN MOINS, LE GUIDE DÉLIÉ, LE SONDAGE RETIRÉ ──────────────
    const ampute = await feed.updatePost(auteur, publie.post.id, {
      body: 'Texte corrigé.',
      mediaIds: [b],
      guideIds: [],
      poll: null,
    });
    expect(ampute.post.media).toHaveLength(1);
    expect(ampute.post.media[0]?.id, 'c’est la seconde image qui reste').toBe(b);
    expect(ampute.post.guides).toHaveLength(0);
    expect(ampute.post.poll).toBeNull();
  });

  /**
   * UN SONDAGE VOTÉ EST UN ENGAGEMENT PRIS ENVERS SES VOTANTS.
   *
   * Changer le libellé d'une option après coup RÉÉCRIRAIT ce que des membres ont
   * choisi ; le retirer effacerait leur voix. C'est la seule règle de ce lot qui
   * refuse un geste à l'auteur sur sa propre publication, et elle mérite donc
   * d'être fixée plutôt que laissée à la vigilance.
   */
  it('refuse de modifier ou de retirer un sondage qui a reçu un vote', async () => {
    const auteur = await newMember('L1');
    const votant = await newMember('L1');

    const publie = await feed.createPost(auteur, {
      ...post({ body: 'Un sondage que l’on va voter.' }),
      poll: {
        question: 'Quel jour ?',
        options: ['Samedi', 'Dimanche'],
        isMultiple: false,
        resultsAfterVote: true,
        isAnonymous: true,
      },
    });
    const sondage = publie.post.poll;
    expect(sondage).not.toBeNull();
    if (sondage === null) return;

    // TANT QUE PERSONNE N'A VOTÉ, le retrait passe — on le mesure d'abord, sinon
    // le refus d'après ne prouverait pas qu'il vient du VOTE.
    await expect(
      feed.updatePost(auteur, publie.post.id, { body: 'Un sondage.', poll: null }),
    ).resolves.toBeDefined();

    const avecSondage = await feed.updatePost(auteur, publie.post.id, {
      body: 'Un sondage.',
      poll: {
        question: 'Quel jour ?',
        options: ['Samedi', 'Dimanche'],
        isMultiple: false,
        resultsAfterVote: true,
        isAnonymous: true,
      },
    });
    const neuf = avecSondage.post.poll;
    expect(neuf).not.toBeNull();
    if (neuf === null) return;

    await communities.vote(neuf.id, votant.userId, [neuf.options[0]?.id ?? '']);

    await expect(
      feed.updatePost(auteur, publie.post.id, { body: 'Un sondage.', poll: null }),
    ).rejects.toMatchObject({ code: 'POLL_HAS_VOTES' });
    await expect(
      feed.updatePost(auteur, publie.post.id, {
        body: 'Un sondage.',
        poll: {
          question: 'Un autre jour ?',
          options: ['Lundi', 'Mardi'],
          isMultiple: false,
          resultsAfterVote: true,
          isAnonymous: true,
        },
      }),
    ).rejects.toMatchObject({ code: 'POLL_HAS_VOTES' });

    // ET LE SONDAGE EST INTACT : un refus qui aurait déjà supprimé serait pire
    // qu'une acceptation.
    const apres = await feed.postDetail(auteur, publie.post.id);
    expect(apres.post.poll?.question).toBe('Quel jour ?');
  });

});
