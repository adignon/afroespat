import type { PrismaClient } from '../../generated/client/index.js';
import { newId } from '../uuid.js';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ DES STORIES DE DÉMONSTRATION — ET POURQUOI ELLES SONT UN OPT-IN           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Créé les dummies de stories. »
 *
 * CE QUE C'EST : de quoi voir A01 et A13 vivre sur une base neuve. Une story
 * expire au bout de vingt-quatre heures (04 §2.6), donc une base qui dort une
 * nuit redevient vide, et les deux écrans qui en dépendent n'ont plus rien à
 * montrer. Recharger le seed les refait.
 *
 * CE QUE CE N'EST PAS : des données de départ. `seed/index.ts` écrit en tête
 * qu'il charge T3 — pays, villes, langues, compétences, modèles de parcours. Des
 * stories ne sont pas un référentiel : ce sont des CONTENUS, signés par des
 * membres qui n'existent pas. Elles suivent donc exactement la doctrine de
 * `pilot-city.ts` : un interrupteur explicite, jamais un défaut, refusé en
 * production.
 *
 *     SEED_DEMO_STORIES=true pnpm db:seed
 *
 * ── LES AUTEURS ────────────────────────────────────────────────────────────
 *
 * Quatre membres de démonstration, reconnaissables à leur pseudo (`demo-…`) et
 * SANS NUMÉRO DE TÉLÉPHONE : `phone_numbers` est une table à part, et ne pas y
 * écrire suffit à rendre ces comptes inconnectables. Personne ne peut donc
 * ouvrir une session sur un compte de démonstration, ce qui serait une porte
 * dérobée — et ces comptes restent de vrais membres pour tout le reste, parce
 * que le fil les lit comme les autres.
 *
 * ── CE QUI EST VRAI, ET CE QUI EST ÉCRIT ───────────────────────────────────
 *
 * Les textes sont inventés. Ils ne prétendent pas être des conseils vérifiés :
 * ils sont écrits au ras de ce que la maquette montre, sans lien, sans numéro et
 * sans montant — la règle de §2.6, celle-là même que le composeur applique aux
 * membres. Les fonds sortent de `STORY_BACKGROUND_COLORS` et les sujets de
 * `STORY_SUBJECTS` : aucune valeur inventée ne traverse la base.
 */

/** L'interrupteur, et les mêmes mots que `pilot-city.ts` accepte. */
const TRUTHY = new Set(['1', 'true', 'yes', 'oui', 'on']);

export function demoStoriesAsked(env: Readonly<Record<string, string | undefined>>): boolean {
  const optIn = env['SEED_DEMO_STORIES']?.trim().toLowerCase();
  if (optIn === undefined || !TRUTHY.has(optIn)) return false;
  if (env['NODE_ENV'] === 'production') {
    throw new Error(
      'Semer des stories de démonstration est refusé en production : ce sont des ' +
        'contenus signés par des membres fictifs, pas des données de départ.',
    );
  }
  return true;
}

interface AuteurDemo {
  readonly handle: string;
  readonly displayName: string;
  /** Le pays d'origine, par son code — résolu à l'exécution. */
  readonly originIso2: string;
}

const AUTEURS: readonly AuteurDemo[] = [
  { handle: 'demo-amina', displayName: 'Amina Diallo', originIso2: 'BJ' },
  { handle: 'demo-kofi', displayName: 'Kofi Mensah', originIso2: 'TG' },
  { handle: 'demo-awa', displayName: 'Awa Konaté', originIso2: 'BJ' },
  { handle: 'demo-samuel', displayName: 'Samuel Adjovi', originIso2: 'BJ' },
];

interface StoryDemo {
  readonly auteur: string;
  readonly type: 'CONSEIL' | 'INFORMATION' | 'DECOUVERTE';
  readonly body: string;
  readonly backgroundColor: string;
  readonly textStyle: 'BOLD' | 'SERIF' | 'MONO';
  readonly category: string;
  readonly placeLabel?: string;
}

/**
 * Quatorze stories, réparties sur les trois types et sur les quatre auteurs.
 *
 * LE NOMBRE COMPTE : A13 dessine une carte à gauche et une à droite, et la
 * traversée boucle sur le ruban FILTRÉ PAR TYPE. En dessous de trois stories
 * d'un même type, on ne voit pas qu'elle boucle. Chaque type en a donc au moins
 * quatre, et les fonds sont volontairement différents d'une voisine à l'autre —
 * c'est ce qui rend visible que les vignettes lisent leur contenu.
 */
const STORIES: readonly StoryDemo[] = [
  {
    auteur: 'demo-amina',
    type: 'CONSEIL',
    body: 'Demandez votre attestation de logement AVANT de signer : sans elle, le dossier repart à zéro et vous perdez deux semaines.',
    backgroundColor: '#1B4332',
    textStyle: 'BOLD',
    category: 'LOGEMENT',
  },
  {
    auteur: 'demo-kofi',
    type: 'CONSEIL',
    body: 'Prenez vos rendez-vous en préfecture tôt le matin : les créneaux rouvrent la nuit et partent en quelques minutes.',
    backgroundColor: '#2D6A4F',
    textStyle: 'BOLD',
    category: 'DEMARCHES',
  },
  {
    auteur: 'demo-awa',
    type: 'CONSEIL',
    body: 'Faites traduire vos diplômes dès l’arrivée. Beaucoup d’employeurs refusent un dossier tant que la traduction officielle manque.',
    backgroundColor: '#B7791F',
    textStyle: 'SERIF',
    category: 'EMPLOI',
  },
  {
    auteur: 'demo-samuel',
    type: 'CONSEIL',
    body: 'Gardez une copie numérique de chaque récépissé. Les guichets les redemandent, et un original perdu se remplace très lentement.',
    backgroundColor: '#1D3557',
    textStyle: 'MONO',
    category: 'DEMARCHES',
  },
  {
    auteur: 'demo-amina',
    type: 'CONSEIL',
    body: 'Ouvrez votre compte bancaire avec l’attestation d’hébergement : elle est acceptée partout, contrairement à ce qu’on entend.',
    backgroundColor: '#5B3A70',
    textStyle: 'BOLD',
    category: 'ARGENT',
  },
  {
    auteur: 'demo-kofi',
    type: 'INFORMATION',
    body: 'Le guichet des titres de séjour reçoit sans rendez-vous le mercredi matin. Arrivez avant l’ouverture, la file se forme tôt.',
    backgroundColor: '#22333B',
    textStyle: 'BOLD',
    category: 'DEMARCHES',
    placeLabel: 'Préfecture — service étrangers',
  },
  {
    auteur: 'demo-awa',
    type: 'INFORMATION',
    body: 'La permanence d’aide aux démarches a changé d’adresse. Elle se tient désormais à la maison de quartier, même horaire.',
    backgroundColor: '#1B4332',
    textStyle: 'BOLD',
    category: 'DEMARCHES',
    placeLabel: 'Maison de quartier',
  },
  {
    auteur: 'demo-samuel',
    type: 'INFORMATION',
    body: 'La ligne de bus qui dessert le campus est déviée toute la semaine. Comptez un quart d’heure de plus le matin.',
    backgroundColor: '#9C2A2A',
    textStyle: 'BOLD',
    category: 'TRANSPORT',
  },
  {
    auteur: 'demo-amina',
    type: 'INFORMATION',
    body: 'La bibliothèque universitaire ouvre ses salles de travail le dimanche pendant les examens. Entrée avec la carte étudiante.',
    backgroundColor: '#1D3557',
    textStyle: 'SERIF',
    category: 'ETUDES',
  },
  {
    auteur: 'demo-kofi',
    type: 'DECOUVERTE',
    body: 'Une épicerie du pays a ouvert près de la gare. On y trouve le piment, l’attiéké et la farine de maïs.',
    backgroundColor: '#B7791F',
    textStyle: 'BOLD',
    category: 'LIEU',
    placeLabel: 'Épicerie près de la gare',
  },
  {
    auteur: 'demo-awa',
    type: 'DECOUVERTE',
    body: 'Le salon de coiffure du quartier travaille les cheveux crépus sans rendez-vous le samedi. Accueil en français et en fon.',
    backgroundColor: '#5B3A70',
    textStyle: 'BOLD',
    category: 'LIEU',
    placeLabel: 'Salon du quartier',
  },
  {
    auteur: 'demo-samuel',
    type: 'DECOUVERTE',
    body: 'Un concert de musique ouest-africaine se tient chaque premier vendredi du mois, dans une salle associative du centre.',
    backgroundColor: '#2D6A4F',
    textStyle: 'SERIF',
    category: 'SORTIE',
    placeLabel: 'Salle associative du centre',
  },
  {
    auteur: 'demo-amina',
    type: 'DECOUVERTE',
    body: 'On trouve de la pâte d’arachide et du gari au marché couvert, le mardi et le vendredi, côté des producteurs.',
    backgroundColor: '#22333B',
    textStyle: 'BOLD',
    category: 'PRODUIT',
    placeLabel: 'Marché couvert',
  },
  {
    auteur: 'demo-kofi',
    type: 'DECOUVERTE',
    body: 'Le terrain du parc accueille un tournoi de football de la diaspora le dimanche après-midi. Tout le monde peut venir jouer.',
    backgroundColor: '#9C2A2A',
    textStyle: 'BOLD',
    category: 'SORTIE',
    placeLabel: 'Parc municipal',
  },
];

/** Vingt-quatre heures, en millisecondes — la durée de vie d'une story (§2.6). */
const VINGT_QUATRE_HEURES = 24 * 60 * 60 * 1000;

export interface DemoStoriesResult {
  readonly auteurs: number;
  readonly stories: number;
  readonly ville: string;
}

/**
 * Sème les stories de démonstration. IDEMPOTENT.
 *
 * ── CE QUI EST RÉÉCRIT À CHAQUE PASSAGE, ET CE QUI NE L'EST PAS ────────────
 *
 * `expiresAt` est RAFRAÎCHI : c'est tout l'intérêt de recharger, puisque la
 * veille a expiré. `positive_count`, `negative_count` et `score` ne le sont PAS —
 * ce sont les votes de qui essaie l'application, et les écraser effacerait ce
 * qu'il vient de faire. Même règle que `isActive` sur les villes : on crée ce
 * qui manque, on ne reprend pas ce que le produit a écrit.
 *
 * ── LA VILLE ───────────────────────────────────────────────────────────────
 *
 * La première ville ACTIVE, par ordre alphabétique. Aucune ville active : rien
 * n'est semé et on le dit — une story a besoin d'une ville (colonne obligatoire),
 * et en inventer une ouvrirait une ville par effet de bord. Les stories sont
 * d'audience `ALL`, donc visibles depuis n'importe quelle ville : la ville porte
 * leur origine, pas leur portée.
 */
export async function seedDemoStories(prisma: PrismaClient): Promise<DemoStoriesResult | null> {
  const ville = await prisma.city.findFirst({
    where: { isActive: true, mergedIntoCityId: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  if (ville === null) return null;

  const pays = new Map<string, string>();
  for (const iso2 of new Set(AUTEURS.map((a) => a.originIso2))) {
    const row = await prisma.country.findUnique({ where: { iso2 }, select: { id: true } });
    if (row !== null) pays.set(iso2, row.id);
  }

  const idParHandle = new Map<string, string>();
  for (const auteur of AUTEURS) {
    const originCountryId = pays.get(auteur.originIso2);
    if (originCountryId === undefined) continue;
    const existant = await prisma.user.findUnique({
      where: { handle: auteur.handle },
      select: { id: true },
    });
    if (existant !== null) {
      idParHandle.set(auteur.handle, existant.id);
      continue;
    }
    const cree = await prisma.user.create({
      data: {
        id: newId(),
        handle: auteur.handle,
        displayName: auteur.displayName,
        phase: 'SETTLED',
        // L1 : le niveau qu'exige la publication d'une story (01 §2.4).
        verificationLevel: 'L1',
        originCountryId,
        cityId: ville.id,
        plan: 'FREE',
        status: 'ACTIVE',
        onboardingStep: 6,
      },
      select: { id: true },
    });
    idParHandle.set(auteur.handle, cree.id);
  }

  const maintenant = new Date();
  const expiresAt = new Date(maintenant.getTime() + VINGT_QUATRE_HEURES);
  let posees = 0;

  for (const story of STORIES) {
    const authorUserId = idParHandle.get(story.auteur);
    if (authorUserId === undefined) continue;

    // Pas de clé naturelle sur `stories` : le couple (auteur, corps) identifie
    // une story de démonstration, et il est unique dans cette liste.
    const existante = await prisma.story.findFirst({
      where: { authorUserId, body: story.body },
      select: { id: true },
    });

    if (existante !== null) {
      await prisma.story.update({
        where: { id: existante.id },
        // Rendue de nouveau visible, et RIEN d'autre : ni les compteurs, ni le
        // score, qui appartiennent à qui a voté depuis.
        data: { expiresAt, status: 'ACTIVE', deletedAt: null },
      });
      posees += 1;
      continue;
    }

    await prisma.story.create({
      data: {
        id: newId(),
        authorUserId,
        type: story.type,
        body: story.body,
        backgroundColor: story.backgroundColor,
        textStyle: story.textStyle,
        cityId: ville.id,
        category: story.category,
        ...(story.placeLabel === undefined ? {} : { placeLabel: story.placeLabel }),
        expiresAt,
        audience: 'ALL',
        allowMessages: true,
        status: 'ACTIVE',
        // CLEARED, et non PENDING : la modération ne tournera jamais sur ces
        // contenus — `storyVisibilityWhere` n’écarte que FLAGGED, mais laisser
        // PENDING ferait croire à une file en attente qui n’existe pas.
        moderationStatus: 'CLEARED',
      },
    });
    posees += 1;
  }

  return { auteurs: idParHandle.size, stories: posees, ville: ville.name };
}
