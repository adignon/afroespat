/**
 * Les écrans de `docs/template/01 Accès et Onboarding.dc.html`.
 *
 * UN FICHIER PAR MAQUETTE, et c'est une décision d'outillage plutôt que de goût :
 * les quatre-vingt-sept sections qui restent seront transcodées par plusieurs
 * personnes — ou plusieurs agents — en parallèle. Tant que les déclarations
 * vivaient dans un seul tableau, chacune de ces contributions se disputait le même
 * fichier, et chaque fusion demandait une résolution à la main. Un fichier par
 * maquette supprime le conflit au lieu de le résoudre.
 */

/**
 * Les huit sections partagent UN SEUL jeu de données et UN SEUL état, comme
 * dans la maquette : un unique `renderVals()` les sert toutes. Les séparer
 * donnerait huit copies de `seg()` et des barres de progression qui
 * divergeraient.
 */
export const screens = [
  { section: 'P01', frames: [1440, 390] },
  { section: 'P02', frames: [1440, 390] },
  // 560 px : la variante « Ressources », pas un mobile.
  { section: 'P03', frames: [1440, 560], names: ['Desktop', 'Ressources'] },
  { section: 'O01', frames: [1440, 390] },
  { section: 'O02', frames: [1440, 390] },
  { section: 'O03', frames: [1440, 390] },
  { section: 'O04', frames: [1440, 390] },
  /**
   * O05 n'a pas de cadre mobile : deux variantes de 700 px, « avec parcours »
   * et « sans parcours » — les deux atterrissages de §5, écran 6.
   *
   * ─── LE SEUL `donnees` DE CETTE MAQUETTE, ET POURQUOI IL EN FAUT UN ────────
   *
   * Cette maquette EMPLOIE le dialecte — 120 interpolations, 24 boucles — donc
   * ses cadres lisent presque tous leurs données sans qu'on déclare rien.
   * `AvecParcours` était l'exception : son `renderVals()` ne calcule aucune de
   * ses valeurs, et sa planche écrit « Mes études à Lyon », « ÉTAPE 1 SUR 12 »,
   * « Obtenir votre admission » en clair. Le cadre portait `(_props: …)`.
   *
   * CE QUI EST LIÉ : le nombre d'étapes. « ÉTAPE 1 SUR 12 » est un ENGAGEMENT —
   * la page s'intitule « Votre parcours est prêt » — et le 12 est faux depuis que
   * le modèle `STUDIES` est en version 3 : l'API répond 15, mesuré, et
   * `journeyTemplateVersionSchema` le dit en toutes lettres. C'est exactement le
   * défaut que `createAnnounce` a déjà corrigé sur l'écran PRÉCÉDENT (O03), qui
   * annonce le parcours avec son vrai nombre d'étapes. Les deux écrans se
   * contredisaient à une page d'intervalle : « (15 étapes) sera créé », puis
   * « ÉTAPE 1 SUR 12 ».
   *
   * ─── CE QUI A ÉTÉ LIÉ ENSUITE, ET CE QUI A CHANGÉ D'AVIS ─────────────────
   *
   * Ce commentaire affirmait que le titre du parcours et sa première étape ne
   * pouvaient PAS être liés : « le parcours est créé à l'écran 4, `POST /journeys`
   * rend `journey.title` et ses `steps`, mais la réponse est JETÉE — les lier
   * demande de retenir cette réponse dans l'état du flux, ce qui est un changement
   * de ce flux et non une liaison ».
   *
   * C'était vrai de ce chemin-là, et incomplet : `FinScreen` APPELLE DÉJÀ
   * `GET /journeys`, pour choisir entre les deux planches, et il jette tout le
   * reste de la réponse. Or `journeyListItemSchema` porte `title`, `doneCount`,
   * `stepCount` ET `currentStep.title`. Il n'y avait donc rien à retenir dans le
   * flux de l'onboarding : il y avait une réponse déjà reçue à ne plus jeter. Le
   * même schéma raconte d'ailleurs ce que coûte de ne pas le lire — c'est sur CET
   * écran que son `ApiShapeError` passait inaperçu.
   *
   * LE RANG VIENT DU PARCOURS, PLUS DU MODÈLE. « ÉTAPE 1 SUR 12 » lisait
   * `journeyStepCount`, c'est-à-dire le `stepCount` du MODÈLE de
   * `GET /journey-templates`. C'était juste et c'était une seconde source : la
   * phrase parle du parcours créé, et c'est `doneCount` / `stepCount` DU PARCOURS
   * qui la disent. Une étape franchie entre la création et cet écran — le membre
   * peut revenir sur cette URL — et les deux sources divergeaient.
   *
   * CE QUI RESTE DESSINÉ, UNE SEULE CHOSE : la DESCRIPTION de l'étape. La liste
   * s'arrête à `currentStep: { id, title }` ; la description vit dans
   * `journeyStepSchema` et ne sort que de `GET /journeys/:id` servi par
   * `journeyFullResponseSchema`. L'ajouter demande un SECOND aller-retour au
   * dernier écran de l'inscription, pour une phrase ; remonté au porteur avec le
   * chemin exact, plutôt que fait sans qu'il l'ait demandé.
   *
   * L'onboarding ne nomme d'ailleurs jamais son parcours — O03 n'a qu'une case à
   * cocher — donc le titre que l'API rend est celui que le serveur a composé, pas
   * celui du membre. C'est une question de produit, pas de transcodage, et elle est
   * remontée : la planche promet « Votre parcours est prêt » sous un nom que
   * personne n'a choisi.
   */
  {
    section: 'O05',
    frames: [700, 700],
    names: ['AvecParcours', 'SansParcours'],
    type: 'O05Data',
    donnees: [
      {
        noeud: '<span style="flex:1;font-size:16px;font-weight:700">Mes études à Lyon</span>',
        devient: '<span style="flex:1;font-size:16px;font-weight:700">{{ parcours.titre }}</span>',
        fois: 1,
        frames: ['AvecParcours'],
        why: 'Le titre du parcours qui vient d’être créé, de `GET /journeys` (`title`) — que `FinScreen` appelle déjà pour choisir sa planche, et dont il jetait le titre.',
      },
      {
        noeud:
          '<span style="background:#E0733A;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.8px;padding:5px 11px;border-radius:999px">ÉTAPE 1 SUR 12</span>',
        devient:
          '<span style="background:#E0733A;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.8px;padding:5px 11px;border-radius:999px">ÉTAPE {{ parcours.rang }} SUR {{ parcours.total }}</span>',
        fois: 1,
        frames: ['AvecParcours'],
        why: 'Le rang de l’étape en cours et le nombre d’étapes DU PARCOURS (`doneCount` + 1, `stepCount`) — et non le `stepCount` du MODÈLE, qui est une seconde source et divergerait dès la première étape franchie.',
      },
      {
        noeud:
          '<div style="font-size:19px;font-weight:700;letter-spacing:-0.4px;margin-top:12px">Obtenir votre admission</div>',
        devient:
          '<div style="font-size:19px;font-weight:700;letter-spacing:-0.4px;margin-top:12px">{{ parcours.etape }}</div>',
        fois: 1,
        frames: ['AvecParcours'],
        why: 'Le titre de l’étape EN COURS, de `currentStep.title` — celle que « Commencer » ouvre. La description qui la suit reste dessinée : la LISTE ne la porte pas (écart remonté).',
      },
    ],
  },
].map((s) => ({
  file: 'docs/template/01 Accès et Onboarding.dc.html',
  section: s.section,
  out: `apps/web/src/screens/${s.section.toLowerCase()}`,
  dataModule: '../onboarding/data',
  /**
   * O05 est le SEUL à élargir le type, et il l'ÉTEND : `O05Data extends
   * OnboardingVals`. `FinScreen` répand donc les mêmes valeurs dans ses deux
   * planches, et les sept autres sections ne changent pas de signature.
   */
  dataType: s.type ?? 'OnboardingVals',
  ...(s.donnees === undefined ? {} : { donnees: s.donnees }),
  frames: s.frames.map((width, i) => ({
    width,
    name: s.names?.[i] ?? (i === 0 ? 'Desktop' : 'Mobile'),
    // Deux cadres de MÊME largeur dans une section : il faut prendre le
    // second, pas rechercher la même ouverture deux fois.
    occurrence: s.frames.indexOf(width) === i ? 0 : i,
  })),
}));
