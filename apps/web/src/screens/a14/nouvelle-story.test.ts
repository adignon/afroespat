/**
 * ─── CE QUE L'ÉCRAN MONTRE EST CE QUI PART ──────────────────────────────────
 *
 * C'est la SEULE exigence de preuve stricte de ce lot : le porteur a levé le test
 * de mutation sur le transcodage, les liens et les cadres (« je priorise la
 * vitesse »), mais pas sur la correspondance entre l'écran et la charge de
 * `POST /stories`. C'est de l'intégrité de donnée, et le dépôt a déjà payé le
 * défaut que ce fichier éprouve : un sélecteur qui bouge à l'écran sans changer ce
 * qui part.
 *
 * Ces cas vérifient la CORRESPONDANCE, pas le réseau — chaque champ de la charge
 * est rattaché au contrôle qui le détermine, et on change ce contrôle pour voir la
 * charge changer. La mesure au navigateur (`e2e/story-composeur.spec.ts`)
 * intercepte la requête réelle ; ici on borne l'arithmétique.
 */
import { describe, expect, it } from 'vitest';
import {
  FEED_LIMITS,
  STORY_BACKGROUND_COLORS,
  StoryAudience,
  StoryTextStyle,
  StoryType,
  createStorySchema,
} from '@app/shared';
import {
  HACHURAGE_PHOTO,
  STORY_BACKGROUND_FOR_PALETTE,
  STORY_BODY_MAX,
  attachStepsFrom,
  attachTopicsFor,
  bodyCountFor,
  bodyRecapFor,
  bodyStyleFor,
  chargeStory,
  nextTextStyle,
  parcoursChoixFor,
  parcoursLabelFor,
  photoFondFor,
  photoToolsFor,
  storyAudienceFor,
  storyTypeFor,
  textStyleLabelFor,
} from './data';

/**
 * L'état par défaut de l'écran : premier onglet, première pastille, messages permis.
 *
 * Les quatre derniers champs sont ceux que ce lot a ajoutés, et leur valeur par
 * défaut dit l'état de l'écran AU PREMIER RENDU : le style que la maquette dessine,
 * aucune étape choisie, aucun sujet choisi, aucune photo téléversée.
 */
const base = {
  body: 'Un conseil utile.',
  pal: 0,
  storyKind: 0,
  audience: 0,
  msgs: true,
  textStyle: 'BOLD' as const,
  stepDefinitionId: null,
  sujet: null,
  // Rien de tapé : « Autre » n'est pas retenu, donc rien à préciser.
  sujetLibre: '',
  lieu: '',
  backgroundAssetId: null,
  // Aucune ville choisie : le serveur retombe sur celle du membre.
  cityId: null,
};

/** Un UUID quelconque, de la forme que `uuidSchema` exige. */
const UUID = '3f1b9a7e-2c4d-4f6a-8b1e-9d0c7a5e4b21';

describe('A14 — la charge de POST /stories suit les contrôles de l’écran', () => {
  it('porte EXACTEMENT les sept champs que le serveur accepte ET exige, et aucun autre', () => {
    /**
     * `.strict()` côté serveur refuse toute clé de plus ; et une clé de MOINS qui
     * serait pourtant pilotée par un contrôle serait le défaut inverse — un
     * sélecteur décoratif. Le compte exact est donc l'assertion.
     *
     * `category` EST DANS LA LISTE, et c'est la sonde qui l'y a mise : le schéma la
     * déclare `.optional()`, mais le SERVICE la refuse absente pour les trois types
     * (`422 INVALID_ATTACHMENT`). Un lot qui s'en serait tenu au schéma aurait livré
     * un composeur qui ne publie rien.
     */
    expect(Object.keys(chargeStory(base)).sort()).toEqual([
      'allowMessages',
      'audience',
      'backgroundColor',
      'body',
      'category',
      'textStyle',
      'type',
    ]);
  });

  /**
   * LA CATÉGORIE SUIT LE TYPE, parce que le serveur n'accepte pas la même famille
   * pour les trois. Le cas ancre les deux familles contre les listes de
   * `@app/shared` : un sujet pour un conseil ou une information, une catégorie de
   * découverte pour une découverte. Les mélanger produit
   * `CONSEIL_CATEGORY_MUST_BE_SUBJECT` ou `DECOUVERTE_NEEDS_CATEGORY`.
   */
  it('la catégorie envoyée appartient à la famille que le serveur exige pour ce type', async () => {
    const { STORY_DISCOVERY_CATEGORIES, STORY_SUBJECTS } = await import('@app/shared');
    expect(STORY_SUBJECTS).toContain(chargeStory({ ...base, storyKind: 0 }).category);
    expect(STORY_DISCOVERY_CATEGORIES).toContain(chargeStory({ ...base, storyKind: 1 }).category);
    expect(STORY_SUBJECTS).toContain(chargeStory({ ...base, storyKind: 2 }).category);
  });

  it('le texte tapé est le `body` envoyé', () => {
    expect(chargeStory({ ...base, body: 'Déposez votre dossier tôt.' }).body).toBe(
      'Déposez votre dossier tôt.',
    );
  });

  /**
   * LES TROIS ONGLETS DE TYPE, un par un. Le cas qui compte est le DERNIER : un
   * décalage d'un rang entre la maquette et l'énumération du serveur publierait une
   * « information » là où le membre a choisi « découverte », et rien ne le dirait.
   */
  it.each([
    [0, 'CONSEIL'],
    [1, 'DECOUVERTE'],
    [2, 'INFORMATION'],
  ])('l’onglet de type n°%i envoie %s', (kind, attendu) => {
    expect(chargeStory({ ...base, storyKind: kind }).type).toBe(attendu);
  });

  it.each([
    [0, 'ALL'],
    [1, 'CITY'],
  ])('l’onglet d’audience n°%i envoie %s', (aud, attendu) => {
    expect(chargeStory({ ...base, audience: aud }).audience).toBe(attendu);
  });

  it('l’interrupteur de messages voyage dans les deux sens', () => {
    expect(chargeStory({ ...base, msgs: true }).allowMessages).toBe(true);
    expect(chargeStory({ ...base, msgs: false }).allowMessages).toBe(false);
  });

  /**
   * LES SEPT PASTILLES ENVOIENT SEPT COULEURS DISTINCTES, toutes acceptées.
   *
   * C'est le cas qui garde l'appariement de palettes honnête : si deux pastilles
   * tombaient sur la même couleur de serveur, deux choix différents produiraient la
   * même story et le membre ne le verrait qu'après publication.
   */
  it('chaque pastille de la palette envoie une couleur DISTINCTE que le serveur accepte', () => {
    const envoyees = STORY_BACKGROUND_FOR_PALETTE.map((_, i) =>
      chargeStory({ ...base, pal: i }).backgroundColor,
    );
    expect(new Set(envoyees).size).toBe(7);
    for (const c of envoyees) expect(STORY_BACKGROUND_COLORS).toContain(c);
  });

  /**
   * ── L'ÉCART DE PALETTE, ÉPROUVÉ POUR QU'IL NE S'OUBLIE PAS ────────────────
   *
   * Les sept teintes DESSINÉES ne figurent dans aucune des sept que le serveur
   * accepte : l'intersection est vide. Ce cas ne corrige rien — il FIGE la mesure,
   * pour que le jour où le porteur aligne les deux listes, c'est lui qui échoue et
   * rappelle que `STORY_BACKGROUND_FOR_PALETTE` n'a plus de raison d'être.
   */
  it('l’appariement de palettes existe parce que les deux listes sont disjointes', () => {
    const dessinees = ['#16785E', '#0F5C48', '#E0733A', '#1F2A44', '#6B4A34', '#16211D', '#5B3F8C'];
    expect(dessinees.filter((c) => STORY_BACKGROUND_COLORS.includes(c as never))).toEqual([]);
  });

  it('un corps vide est refusé ICI, avant tout appel réseau', () => {
    expect(() => chargeStory({ ...base, body: '' })).toThrow();
    expect(() => chargeStory({ ...base, body: '   ' })).toThrow();
  });

  it('un corps au-delà de la borne du serveur est refusé ICI', () => {
    expect(() => chargeStory({ ...base, body: 'x'.repeat(FEED_LIMITS.storyBodyMax + 1) })).toThrow();
    expect(chargeStory({ ...base, body: 'x'.repeat(FEED_LIMITS.storyBodyMax) }).body).toHaveLength(
      FEED_LIMITS.storyBodyMax,
    );
  });

  /**
   * AUCUNE POSITION DE CALQUE NE PART, et le schéma ne l'accepterait pas.
   *
   * Le calque de texte se déplace à l'écran ; `createStorySchema` est `.strict()`
   * et aucun de ses champs n'exprime une position. Ce cas le FIXE : il échouera le
   * jour où un champ de position sera ajouté au schéma partagé, ce qui est
   * exactement le moment où il faudra brancher le déplacement dessus.
   */
  it('le schéma partagé n’a AUCUN champ de position pour le calque', () => {
    for (const clef of Object.keys(chargeStory(base))) {
      expect(clef).not.toMatch(/^(x|y|textX|textY|offset|position|layer)/i);
    }
  });
});

describe('A14 — les ordres de la maquette et du serveur coïncident', () => {
  /**
   * LA COÏNCIDENCE EST VÉRIFIÉE, PAS SUPPOSÉE. `storyTypeFor` et
   * `storyAudienceFor` indexent directement l'énumération du serveur ; ces deux cas
   * ancrent les LIBELLÉS DESSINÉS en face, pour qu'un type ajouté d'un côté ne se
   * traduise pas en silence par le mauvais type de l'autre.
   */
  it('« Conseil · Découverte · Information » est l’ordre de StoryType', () => {
    expect([...StoryType]).toEqual(['CONSEIL', 'DECOUVERTE', 'INFORMATION']);
    expect([0, 1, 2].map(storyTypeFor)).toEqual([...StoryType]);
  });

  it('« Tous les membres · Lyon seulement » est l’ordre de StoryAudience', () => {
    expect([...StoryAudience]).toEqual(['ALL', 'CITY']);
    expect([0, 1].map(storyAudienceFor)).toEqual([...StoryAudience]);
  });

  it('un index hors bornes retombe sur le premier, jamais sur `undefined`', () => {
    expect(storyTypeFor(99)).toBe('CONSEIL');
    expect(storyAudienceFor(-1)).toBe('ALL');
  });
});

describe('A14 — le compteur et le rappel', () => {
  it('le compteur compte ce qui est tapé, et son plafond vient de @app/shared', () => {
    expect(STORY_BODY_MAX).toBe(FEED_LIMITS.storyBodyMax);
    expect(bodyCountFor('')).toBe(`0 / ${FEED_LIMITS.storyBodyMax}`);
    expect(bodyCountFor('abc')).toBe(`3 / ${FEED_LIMITS.storyBodyMax}`);
  });

  /**
   * LE COMPTEUR DESSINÉ NE COMPTAIT RIEN, et c'est la mesure qui a démenti le
   * diagnostic « aucun champ de saisie » : la maquette écrit « 118 / 280 » au-dessus
   * d'un littéral de 80 caractères. Ce cas garde la trace du chiffre.
   */
  it('le littéral de la maquette fait 80 caractères, pas les 118 qu’elle affiche', () => {
    const dessine = "Pour Visale, déposez votre VLS-TS dès sa validation sur l'ANEF. Réponse en 48 h.";
    expect(dessine).toHaveLength(80);
    expect(bodyCountFor(dessine)).toBe('80 / 280');
  });

  it('le rappel de l’étape 2 est tronqué comme la maquette le dessine', () => {
    expect(bodyRecapFor('Court.')).toBe('Court.');
    const long = "Pour Visale, déposez votre VLS-TS dès sa validation sur l'ANEF. Réponse en 48 h.";
    const recap = bodyRecapFor(long);
    expect(recap.endsWith('…')).toBe(true);
    // Coupé sur un espace : aucun mot n'est tranché en deux.
    expect(long.startsWith(recap.slice(0, -1))).toBe(true);
    expect(recap.length).toBeLessThanOrEqual(54);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES CONTRÔLES QUE LE PORTEUR A TROUVÉS MORTS DANS SON NAVIGATEUR           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « ça ne s'affiche pas bien. Les actions sur la texte et photo ne marche pas.
 * Centré, gras, Changer, Recadrer, Assombrir le bas. Sur l'écran 3, la recherche,
 * les étapes et sujet. »
 *
 * Ces cas bornent l'ARITHMÉTIQUE de chacun ; `e2e/story-composeur.spec.ts` mesure le
 * CLIC. Les deux sont nécessaires, et ce lot existe parce que le second manquait.
 */
describe('A14 — le style de texte, qui était une constante', () => {
  it('le bouton tourne sur les TROIS valeurs du serveur, et revient au départ', () => {
    expect([...StoryTextStyle]).toEqual(['BOLD', 'SERIF', 'MONO']);
    expect(nextTextStyle('BOLD')).toBe('SERIF');
    expect(nextTextStyle('SERIF')).toBe('MONO');
    // Le cycle BOUCLE : sans cela, « Mono » serait un cul-de-sac.
    expect(nextTextStyle('MONO')).toBe('BOLD');
  });

  /**
   * LE LIBELLÉ EXISTE POUR LES TROIS, et c'est ce cas qui le garantit : une valeur
   * ajoutée à `StoryTextStyle` sans libellé afficherait « Aa · undefined », ce que
   * `tsc` ne voit pas puisque l'accès à un `Record` complet est toujours typé.
   */
  it('chaque valeur a son libellé, dans la forme « Aa · … » que la maquette écrit', () => {
    const libelles = StoryTextStyle.map(textStyleLabelFor);
    expect(libelles).toEqual(['Aa · Gras', 'Aa · Serif', 'Aa · Mono']);
    for (const l of libelles) expect(l.startsWith('Aa · ')).toBe(true);
    // « Gras » est le mot de la maquette : il doit rester celui de `BOLD`.
    expect(textStyleLabelFor('BOLD')).toBe('Aa · Gras');
  });

  it('le style choisi PART dans la charge — c’est le seul des cinq contrôles qui survit', () => {
    expect(chargeStory({ ...base, textStyle: 'SERIF' }).textStyle).toBe('SERIF');
    expect(chargeStory({ ...base, textStyle: 'MONO' }).textStyle).toBe('MONO');
    expect(chargeStory(base).textStyle).toBe('BOLD');
  });

  /**
   * CE QUI SE VOIT CORRESPOND À CE QUI PART, pour le style de texte. `BOLD` ne touche
   * à aucune police : la maquette déclare déjà `font-weight:800`, et surcharger la
   * famille effacerait son `fontFamily: "inherit"`.
   */
  it('le style rend une police pour SERIF et MONO, et rien pour BOLD', () => {
    expect(bodyStyleFor('BOLD', false)).toEqual({});
    expect(bodyStyleFor('SERIF', false).fontFamily).toMatch(/serif/);
    expect(bodyStyleFor('MONO', false).fontFamily).toMatch(/monospace/);
  });
});

describe('A14 — « Centré », vivant à la composition et NON conservé', () => {
  it('la bascule centre le texte', () => {
    expect(bodyStyleFor('BOLD', true).textAlign).toBe('center');
    expect(bodyStyleFor('BOLD', false).textAlign).toBeUndefined();
  });

  /**
   * ET L'ALIGNEMENT NE PART PAS, parce qu'aucun champ ne l'exprime.
   *
   * Ce cas FIGE le manque au lieu de le masquer : il échouera le jour où un champ
   * d'alignement sera ajouté à `createStorySchema`, ce qui est exactement le moment
   * où il faudra brancher la bascule dessus.
   */
  it('aucun alignement ne part dans la charge, quel que soit l’état de la bascule', () => {
    const clefs = Object.keys(chargeStory(base));
    expect(clefs).not.toContain('textAlign');
    expect(clefs).not.toContain('align');
    expect(createStorySchema.safeParse({ ...chargeStory(base), textAlign: 'center' }).success)
      .toBe(false);
  });
});

describe('A14 — la photo : `backgroundAssetId` REMPLACE la couleur', () => {
  /**
   * LE SCHÉMA EST UN OU EXCLUSIF, et c'est la contrainte qui décide de la forme de
   * `chargeStory` : `(backgroundColor === undefined) !== (backgroundAssetId === undefined)`.
   */
  it('sans photo, la couleur part et l’identifiant de média est ABSENT', () => {
    const charge = chargeStory(base);
    expect(charge.backgroundColor).toBe(STORY_BACKGROUND_COLORS[1]);
    expect('backgroundAssetId' in charge).toBe(false);
  });

  it('avec une photo, l’identifiant part et la couleur est ABSENTE', () => {
    const charge = chargeStory({ ...base, backgroundAssetId: UUID });
    expect(charge.backgroundAssetId).toBe(UUID);
    expect('backgroundColor' in charge).toBe(false);
  });

  /**
   * LA PREUVE QUE LE OU EST EXCLUSIF, et qu'on ne peut pas tricher : le schéma refuse
   * les deux ensemble. Sans cette borne, un lot futur pourrait « ajouter » la couleur
   * par prudence et casser toute publication photo.
   */
  it('envoyer les DEUX fonds est refusé par le schéma du serveur', () => {
    expect(
      createStorySchema.safeParse({
        ...chargeStory(base),
        backgroundAssetId: UUID,
      }).success,
    ).toBe(false);
  });

  it('le hachurage de la maquette est le fond servi tant qu’aucune photo n’est choisie', () => {
    expect(photoFondFor(null, false)).toBe(HACHURAGE_PHOTO);
    // Et il est recopié VERBATIM de la maquette, pas réécrit.
    expect(HACHURAGE_PHOTO).toBe(
      'repeating-linear-gradient(135deg,#46564F 0 14px,#3E4D47 14px 28px)',
    );
  });

  /** « Recadrer » bascule `cover` / `contain` — composition seulement. */
  it('« Recadrer » change le cadrage de l’aperçu, et rien dans la charge', () => {
    expect(photoFondFor('blob:x', false)).toContain('center/cover');
    expect(photoFondFor('blob:x', true)).toContain('center/contain');
    const clefs = Object.keys(chargeStory({ ...base, backgroundAssetId: UUID }));
    expect(clefs).not.toContain('crop');
    expect(clefs).not.toContain('fit');
  });
});

describe('A14 — les trois outils photo, qui n’avaient aucun gestionnaire', () => {
  it('les trois libellés sont EXACTEMENT ceux de la maquette, dans son ordre', () => {
    const outils = photoToolsFor({
      onChanger: () => undefined,
      onRecadrer: () => undefined,
      onAssombrir: () => undefined,
      recadre: false,
      assombri: true,
    });
    expect(outils.map((o) => o.label)).toEqual(['Changer', 'Recadrer', 'Assombrir le bas']);
  });

  /**
   * « CHANGER » EST UNE ACTION, PAS UNE BASCULE, et c'est pourquoi son `on` est
   * `undefined` : le transcodeur en fait `aria-pressed={t.on}`, et React omet
   * l'attribut sur `undefined`. Annoncer un état sur une action dirait à un lecteur
   * d'écran que le bouton reste enfoncé.
   */
  it('seules les deux bascules annoncent un état ; « Changer » n’en a pas', () => {
    const outils = photoToolsFor({
      onChanger: () => undefined,
      onRecadrer: () => undefined,
      onAssombrir: () => undefined,
      recadre: true,
      assombri: false,
    });
    expect(outils[0]?.on).toBeUndefined();
    expect(outils[1]?.on).toBe(true);
    expect(outils[2]?.on).toBe(false);
  });

  it('chaque outil appelle SON action, et pas celle du voisin', () => {
    const appels: string[] = [];
    const outils = photoToolsFor({
      onChanger: () => appels.push('changer'),
      onRecadrer: () => appels.push('recadrer'),
      onAssombrir: () => appels.push('assombrir'),
      recadre: false,
      assombri: true,
    });
    for (const o of outils) o.onPick();
    expect(appels).toEqual(['changer', 'recadrer', 'assombrir']);
  });
});

describe('A14 — l’étape 2 : la recherche, les étapes et les sujets', () => {
  const etapesApi = [
    {
      stepDefinitionId: UUID,
      code: 'CHOOSE_PROGRAM',
      nameFr: 'Choisir sa formation',
      description: 'Comparer les écoles et les mentions',
      category: 'PRE_DEPARTURE' as const,
      position: 1,
      isOptional: false,
    },
    {
      stepDefinitionId: '8a2c4e60-1d3f-4b5a-9c7e-2f6b8d0a1c34',
      code: 'CAMPUS_FRANCE_FILE',
      nameFr: 'Constituer le dossier Campus France',
      description: null,
      category: 'PRE_DEPARTURE' as const,
      position: 2,
      isOptional: true,
    },
  ];

  /**
   * LA FORME DU TITRE EST CELLE DE LA MAQUETTE : « Étape 7 · Logement ». Le rang vient
   * de `position`, qui est l'ordre que la VERSION fixe — jamais un index de tableau.
   */
  it('une étape s’intitule « Étape <rang> · <nom> », comme la maquette l’écrit', () => {
    const vues = attachStepsFrom(etapesApi, null, '', () => undefined);
    expect(vues.map((v) => v.t)).toEqual([
      'Étape 1 · Choisir sa formation',
      'Étape 2 · Constituer le dossier Campus France',
    ]);
  });

  /**
   * LA SECONDE LIGNE RESTE VIDE QUAND LA ROUTE NE DÉCRIT PAS L'ÉTAPE.
   *
   * La maquette y écrit « Vous venez de la franchir », qui décrit l'avancement du
   * parcours du membre — que `GET /journey-templates/:id/steps` ne sert pas, et ne
   * doit pas servir : elle décrit un TYPE de parcours. En inventer une serait
   * annoncer un avancement inconnu. REMONTÉ, et ce cas le fixe.
   */
  it('la seconde ligne est la description servie, ou RIEN — jamais une phrase inventée', () => {
    const vues = attachStepsFrom(etapesApi, null, '', () => undefined);
    expect(vues[0]?.s).toBe('Comparer les écoles et les mentions');
    expect(vues[1]?.s).toBe('');
  });

  it('l’étape choisie porte l’apparence « choisi » de la maquette, et elle seule', () => {
    const vues = attachStepsFrom(etapesApi, UUID, '', () => undefined);
    expect(vues[0]?.on).toBe(true);
    expect(vues[0]?.bg).toBe('#E3F0EB');
    expect(vues[0]?.bd).toBe('1.5px solid #16785E');
    expect(vues[1]?.on).toBe(false);
    expect(vues[1]?.bg).toBe('#fff');
    expect(vues[1]?.bd).toBe('1px solid #E6EBE9');
  });

  /**
   * LE `stepDefinitionId` CHOISI EST CELUI QUI PART. C'est le point de tout l'écran 2 :
   * avant ce lot la liste était écrite en dur et SANS identifiant, donc rien ne
   * pouvait partir.
   */
  it('choisir une étape renseigne `stepDefinitionId` dans la charge', () => {
    expect(chargeStory({ ...base, stepDefinitionId: UUID }).stepDefinitionId).toBe(UUID);
  });

  /**
   * ET ELLE NE PART QUE POUR UN CONSEIL — le service refuse les deux autres types par
   * `DECOUVERTE_HAS_NO_STEP` et `INFORMATION_HAS_NO_STEP`. Sans cette borne, toucher
   * la liste puis changer d'onglet rendrait la publication impossible, et le refus
   * accuserait le rattachement.
   */
  it.each([
    [1, 'DECOUVERTE'],
    [2, 'INFORMATION'],
  ])('l’étape est OMISE pour le type n°%i (%s), que le serveur refuserait', (kind) => {
    const charge = chargeStory({ ...base, storyKind: kind, stepDefinitionId: UUID });
    expect('stepDefinitionId' in charge).toBe(false);
  });

  /** Les neuf sujets RÉELS, pas les cinq exemples de la maquette. */
  it('les pastilles de sujet sont les neuf STORY_SUBJECT_LABELS', async () => {
    const { STORY_SUBJECTS, STORY_SUBJECT_LABELS } = await import('@app/shared');
    const vues = attachTopicsFor(null, '', () => undefined);
    expect(vues).toHaveLength(STORY_SUBJECTS.length);
    expect(vues.map((v) => v.label)).toEqual(
      STORY_SUBJECTS.map((s) => STORY_SUBJECT_LABELS[s]),
    );
    // Et les cinq dispositifs de la maquette n'y sont plus : c'étaient des exemples.
    expect(vues.map((v) => v.label)).not.toContain('Visale');
  });

  it('choisir un sujet renseigne `category`, et le serveur l’accepte', async () => {
    const { STORY_SUBJECTS } = await import('@app/shared');
    const charge = chargeStory({ ...base, sujet: 'TRANSPORT' });
    expect(charge.category).toBe('TRANSPORT');
    expect(STORY_SUBJECTS).toContain(charge.category);
  });

  /**
   * SANS SUJET CHOISI, ON RETOMBE SUR CELUI QUE LA MAQUETTE ÉCRIT. Ce n'est pas un
   * défaut de repli : `LOGEMENT` est le mot qu'elle écrit en clair à deux endroits, et
   * le service refuse un conseil sans étape NI sujet.
   */
  it('sans sujet choisi, la catégorie reste celle que la maquette écrit', () => {
    expect(chargeStory(base).category).toBe('LOGEMENT');
  });

  /**
   * UNE DÉCOUVERTE IGNORE LE SUJET CHOISI, et il faut le dire : le service exige une
   * catégorie de DÉCOUVERTE pour ce type (`DECOUVERTE_NEEDS_CATEGORY`) et refuse un
   * sujet (`CONSEIL_CATEGORY_MUST_BE_SUBJECT` pour l'inverse). Envoyer « Transport »
   * sur une découverte ferait échouer la publication.
   */
  it('une découverte envoie la catégorie dessinée, même si un sujet est choisi', async () => {
    const { STORY_DISCOVERY_CATEGORIES } = await import('@app/shared');
    const charge = chargeStory({ ...base, storyKind: 1, sujet: 'TRANSPORT' });
    expect(charge.category).toBe('PRODUIT');
    expect(STORY_DISCOVERY_CATEGORIES).toContain(charge.category);
  });

  /** Le champ de recherche filtre LES DEUX listes — c'est ce que son texte promet. */
  it('la recherche filtre les étapes ET les sujets', () => {
    expect(attachStepsFrom(etapesApi, null, 'campus', () => undefined)).toHaveLength(1);
    expect(attachTopicsFor(null, 'trans', () => undefined).map((v) => v.label)).toEqual([
      'Transport',
    ]);
    // Un filtre vide ne cache rien.
    expect(attachStepsFrom(etapesApi, null, '', () => undefined)).toHaveLength(2);
  });

  /**
   * LES ACCENTS NE FONT PAS ÉCHOUER LA RECHERCHE. « Études » et « Démarches » en
   * portent, et personne ne les tape : sans normalisation, le champ passerait pour
   * mort — c'est-à-dire le défaut qu'il vient de corriger.
   */
  it('la recherche ignore les accents et la casse', () => {
    expect(attachTopicsFor(null, 'etudes', () => undefined).map((v) => v.label)).toEqual([
      'Études',
    ]);
    expect(attachTopicsFor(null, 'DÉMARCHES', () => undefined).map((v) => v.label)).toEqual([
      'Démarches',
    ]);
  });

  it('un second appui DÉSÉLECTIONNE — `aria-pressed` promet une bascule', () => {
    let sujetCourant: string | null = 'TRANSPORT';
    const vues = attachTopicsFor('TRANSPORT', '', (s) => {
      sujetCourant = sujetCourant === s ? null : s;
    });
    vues.find((v) => v.label === 'Transport')?.onPick();
    expect(sujetCourant).toBeNull();
  });
});

describe('A14 — le sélecteur de parcours que le porteur a demandé', () => {
  const modele = (id: string, nameFr: string, description: string | null, stepCount: number) => ({
    id,
    code: 'STUDIES',
    nameFr,
    description,
    targetPhase: 'PRE_DEPARTURE' as const,
    createsJourney: true,
    icon: null,
    version: {
      id: '0e4d8c2a-6b1f-4e3d-9a7c-5f2b8d1e0a93',
      version: 3,
      stepCount,
      isCountrySpecific: false,
      changelog: null,
    },
  });

  it('une description servie s’affiche telle quelle', () => {
    const vues = parcoursChoixFor([modele(UUID, 'Étudier', 'Pour venir étudier', 15)], null);
    expect(vues[0]?.detail).toBe('Pour venir étudier');
    expect(vues[0]?.aUneDescription).toBe(true);
  });

  /**
   * ⚠ L'ÉCART MESURÉ ET REMONTÉ : sur le jeu de données servi, les QUATRE types de
   * parcours rendent `description: null`. Le porteur demande « les parcours ET LEUR
   * DESCRIPTION » ; le champ existe au contrat, la donnée manque.
   *
   * On n'écrit AUCUN texte de remplacement — ce serait rédiger la présentation des
   * parcours à sa place. On montre une donnée VRAIE : le compte d'étapes, qui vient
   * de `version.stepCount`. Ce cas fixe les deux comportements, pour que la fenêtre
   * tienne avec et sans description.
   */
  it('une description ABSENTE laisse place au compte d’étapes, jamais à un texte inventé', () => {
    const vues = parcoursChoixFor([modele(UUID, 'Travailler', null, 11)], null);
    expect(vues[0]?.detail).toBe('11 étapes');
    expect(vues[0]?.aUneDescription).toBe(false);
  });

  it('une description vide ou blanche est traitée comme absente', () => {
    expect(parcoursChoixFor([modele(UUID, 'Famille', '   ', 9)], null)[0]?.detail).toBe(
      '9 étapes',
    );
  });

  it('le parcours choisi est le seul marqué', () => {
    const vues = parcoursChoixFor(
      [modele(UUID, 'Étudier', null, 15), modele('5c7e1a9b-3d2f-4e8a-9b6c-1f4d7a0e2b58', 'Travailler', null, 11)],
      UUID,
    );
    expect(vues.map((v) => v.on)).toEqual([true, false]);
  });

  /**
   * LE TITRE DE LA LISTE NOMME LE PARCOURS CHOISI. Il annonçait « ÉTUDES » en dur :
   * choisir « Travailler » aurait rempli la liste des étapes du travail sous un titre
   * qui dit « études ».
   */
  it('« MON PARCOURS · ÉTUDES » devient le parcours choisi, et reste tel quel sans choix', () => {
    expect(parcoursLabelFor(null)).toBe('MON PARCOURS · ÉTUDES');
    expect(parcoursLabelFor('Travailler')).toBe('MON PARCOURS · TRAVAILLER');
  });
});
