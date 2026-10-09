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
/**
 * ╔═════════════════════════════════════════════════════════════════════════╗
 * ║ LA NAVIGATION DE CETTE MAQUETTE — DIX LIENS MORTS, SIX BRANCHÉS            ║
 * ╚═════════════════════════════════════════════════════════════════════════╝
 *
 * LES DESTINATIONS SONT RECOPIÉES, PAS DÉDUITES, et cette maquette rend la chose
 * facile : elle ÉCRIT la route de chaque écran à côté de son titre, en 13 px
 * (`/connexion`, `/p/:slug`, `/bienvenue/phase`, `/bienvenue/lieu`,
 * `/bienvenue/objectif`, `/bienvenue/fin`). Les six sont vérifiées une par une
 * dans `apps/web/src/app/(onboarding)/`, et l'ordre du flux est celui de
 * `NEXT_PATH` dans `screens/onboarding/use-onboarding-flow.ts`, qui est la table
 * que l'application EXÉCUTE — pas une table recopiée à côté d'elle.
 *
 * ── « PASSER CETTE ÉTAPE » — TROIS LIENS, TROIS DESTINATIONS DIFFÉRENTES ────
 *
 * T5 §3 le décrit dans le cadre commun des six écrans : « bouton “Continuer” fixé
 * en bas et lien “Passer cette étape” sous lui (sauf O01 sur mobile, où le
 * téléphone est déjà validé) ». 01-identite §5 dit la règle : « Six écrans, tous
 * “passables” sauf le téléphone ».
 *
 * Il mène donc à L'ÉCRAN SUIVANT, et c'est un libellé IDENTIQUE sur trois écrans
 * pour trois adresses distinctes — exactement le cas que l'en-tête de `markLinks`
 * prend pour justifier le bornage par écran. Chaque destination est celle que le
 * bouton « Continuer » du MÊME écran emploie, c'est-à-dire `NEXT_PATH[step]` avec
 * le `step` que la page passe à `useOnboardingFlow` (O01 → 2, O02 → 3, O03 → 4) :
 *
 *   O01 `useOnboardingFlow(2)` → NEXT_PATH[2] = /bienvenue/lieu
 *   O02 `useOnboardingFlow(3)` → NEXT_PATH[3] = /bienvenue/objectif
 *   O03 `useOnboardingFlow(4)` → NEXT_PATH[4] = /bienvenue/profil
 *
 * CE QUE « PASSER » NE FAIT PAS, et il faut l'écrire : il n'enregistre PAS
 * l'avancement. « Continuer » appelle `advanceOnboarding(step)` avant de pousser
 * l'URL ; un lien ne peut pas. Un membre qui passe trois écrans puis revient plus
 * tard reprend donc à l'écran qu'il avait VALIDÉ, non à celui qu'il avait atteint.
 * Ce n'est pas un défaut introduit ici — aucune garde ne bloque le saut, mesuré :
 * `(onboarding)/layout.tsx` ne monte que `SessionBoot`, et aucune des cinq pages
 * de `/bienvenue` ne redirige selon `onboarding.step`. Et c'est le comportement
 * que `markLinks` IMPOSE : il refuse `action` sur une balise `<a>`. Le jour où le
 * porteur voudra que « Passer » enregistre, il faudra un `<button>` — ce qui
 * change le dessin, donc c'est son arbitrage. REMONTÉ.
 *
 * ── P01 : DEUX LIENS BRANCHÉS, DEUX REFUSÉS, ET C'EST LE MÊME ÉCRAN ────────
 *
 * La case de consentement écrit quatre liens, deux par largeur : « conditions
 * d'utilisation » / « politique de confidentialité » sur 1440 px, « conditions » /
 * « confidentialité » sur 390 px — la maquette raccourcit les deux libellés au
 * téléphone, ce sont donc quatre discriminants distincts et non deux écrits deux
 * fois.
 *
 * LA CONFIDENTIALITÉ EST BRANCHÉE : `/p/confidentialite`, et le slug n'est PAS
 * déduit du mot. Il est lu dans la table `SLUGS` de
 * `app/(onboarding)/p/[slug]/page.tsx`, qui est une liste FERMÉE de deux entrées
 * (`confidentialite`, `ressources`) — tout autre slug rend `404`.
 *
 * ╔═════════════════════════════════════════════════════════════════════════╗
 * ║ LES CONDITIONS D'UTILISATION RESTENT MORTES, ET C'EST LE REFUS LE PLUS      ║
 * ║ COÛTEUX DE CE LOT : IL EST SUR L'ÉCRAN PAR LEQUEL TOUT MEMBRE ENTRE         ║
 * ╚═════════════════════════════════════════════════════════════════════════╝
 *
 * `/p/cgu` RÉPOND 404. La ligne existe en base (`static_pages` porte `cgu` et
 * `confidentialite`, publiées), mais aucune route ne la sert, et `SLUGS` ne la
 * porte pas — délibérément : l'en-tête de ce fichier-là explique que la SEULE
 * planche de document que la maquette dessine est la politique de confidentialité,
 * et que brancher `cgu` dessus afficherait « Politique de confidentialité » à qui
 * demande les conditions. Sur un écran que le membre consulte AVANT d'accepter,
 * c'est un faux document avec son titre et ses pastilles de version.
 *
 * Écrire `vers: '/p/cgu'` produirait donc un lien qui a l'air vivant et rend 404 ;
 * écrire `vers: '/p/confidentialite'` enverrait les deux liens au même document, ce
 * qui est précisément la dérive que l'en-tête de `markLinks` interdit (« “Voir
 * tout” est écrit sur une dizaine d'écrans et ne mène pas deux fois au même
 * endroit »). Les deux liens restent donc morts, et le manque est REMONTÉ : il
 * faut la route `GET /pages/:slug` et une planche de conditions.
 *
 * ── P03 : LES DEUX LIENS RESTENT MORTS, ET AUCUN NE PEUT ÊTRE DÉCLARÉ ──────
 *
 * 1. LE SOMMAIRE (`<sc-for list="{{ toc }}" as="t">`, cinq entrées). Ce sont de
 *    vrais `<a href="#">`, et la destination devrait être une donnée
 *    (`vers: '{{ t.href }}'`). Mais il n'y a RIEN À VISER : la maquette n'écrit
 *    que DEUX `<h2>` dans le corps du document (« 1. Ce que nous collectons »,
 *    « 2. Où sont vos données ») pour CINQ entrées de sommaire — « Vos droits »,
 *    « Durées de conservation » et « Nous contacter » ne correspondent à aucune
 *    section dessinée — et AUCUN de ces deux titres ne porte d'ancre. Une
 *    destination inventée changerait l'URL sans rien déplacer à l'écran, ce qui
 *    est un lien qui marche et qui ne va nulle part : pire qu'un lien mort.
 *    Le générateur ne sait d'ailleurs pas ajouter d'`id` : il n'en pose que sur
 *    les titres de fenêtre (`titleFor`), et `donnees` ne lie que du contenu.
 *
 * 2. « VOIR NOS SOUS-TRAITANTS ». 00-fondations §8.2 dit où ils vivent : « Les
 *    sous-traitants hors UE (Twilio, Stripe, Anthropic, Didit) sont listés DANS LA
 *    POLITIQUE DE CONFIDENTIALITÉ » — c'est-à-dire dans une section de la page
 *    qu'on est en train de lire, et que la maquette ne dessine pas. Même impasse
 *    que le sommaire, et pour la même raison. REMONTÉ.
 *
 * Ces deux manques ont la MÊME cause que l'écart déjà consigné dans
 * `p/[slug]/page-screen.tsx` : le corps du document est transcodé de la maquette
 * parce qu'aucune route ne le sert. Le jour où `GET /pages/:slug` existera, le
 * sommaire et ses ancres viendront avec le document — pas d'ici.
 *
 * ── CE QU'AUCUNE DÉCLARATION NE PEUT ATTRAPER : LE BOUTON RETOUR ───────────
 *
 * O01, O02 et O03 dessinent, en haut à gauche de leur cadre d'ordinateur, un
 * `<span style="width:44px;height:44px;border-radius:999px;background:#EEF2F0;…">`
 * qui contient un chevron vers la gauche. T5 §3 le nomme — « bouton retour » — et
 * c'est une affordance que le compteur ne voit pas, puisque ce n'est pas un lien.
 *
 * IL N'EST PAS PROMU, pour deux raisons qui se cumulent et qu'il vaut mieux écrire
 * que combler :
 *
 *   · UN RETOUR N'EST PAS UNE DESTINATION. C'est `history.back()`, donc un
 *     `action`, donc un gestionnaire — et `onBack` n'existe NULLE PART dans
 *     `use-onboarding-flow.ts` (vérifié : il n'expose que `onSubmit`,
 *     `onContinue`, `onResend`, `onChangeNumber`). L'écrire serait ajouter un
 *     comportement, pas déclarer un lien ;
 *   · ET LE RETOUR DE O01 SORT DU FLUX. L'écran d'avant est P02, le code SMS, sur
 *     une session DÉJÀ ouverte. Y renvoyer un membre est une décision de produit,
 *     pas de transcodage.
 *
 * REMONTÉ AU PORTEUR avec le chemin exact. C'est le seul contrôle de ce lot dont
 * on sait nommer la cible (T5 écrit « retour ») sans savoir où elle mène.
 */

/**
 * « Passer cette étape » — écrit UNE fois, appelé trois fois avec sa destination.
 *
 * Le lien n'est dessiné que sur le cadre d'ORDINATEUR : T5 §3 l'écrit pour O01, et
 * c'est mesuré sur les trois cadres mobiles, qui n'en portent aucun. `frames` le
 * borne donc, et un oubli ne passerait pas — `fois` compte à 1 par cadre.
 */
const passer = (vers, ecranSuivant, etape) => ({
  texte: 'Passer cette étape',
  vers,
  frames: ['Desktop'],
  why:
    `Passer cette étape mène à l'écran suivant, ${ecranSuivant} : ${vers}. C'est ` +
    `NEXT_PATH[${etape}] de \`use-onboarding-flow.ts\`, la même adresse que le bouton ` +
    '« Continuer » de cet écran pousse — recopiée de la table que l’application exécute, ' +
    'pas déduite du libellé. (Un lien ne peut pas appeler `advanceOnboarding` : écart ' +
    'remonté dans l’en-tête ci-dessus.)',
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE BOUTON RETOUR — DESSINÉ SUR QUATRE ÉCRANS, INERTE SUR LES QUATRE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le bouton back ne marche pas dans l'onboarding. »
 *
 * UN LOT PRÉCÉDENT L'AVAIT REFUSÉ, honnêtement et en le remontant : « un retour
 * est `history.back()`, donc une action, et `onBack` n'existe nulle part dans
 * `use-onboarding-flow.ts`. De plus le retour d'O01 sort du flux — l'écran d'avant
 * est P02, le code SMS, sur une session déjà ouverte. Décision de produit. » Le
 * porteur vient de la prendre.
 *
 * ── LE MARQUEUR EST BORNÉ, ET IL LE FAUT ──────────────────────────────────
 *
 * `m15 18-6-6 6-6` est le chevron gauche de TOUT le produit : il figure sur
 * trente-cinq écrans. Sans `screens`, cette déclaration promouvrait le bouton
 * retour du fil, des messages, des réseaux… et leur poserait un `onBack` que
 * leurs jeux de données ne portent pas. C'est exactement la dérive que
 * `BUTTON_ACTIONS` a déjà payée avec « Continuer ». Dans CHACUN des quatre cadres
 * d'onboarding, en revanche, il est unique — compté, une occurrence par cadre.
 *
 * ── CE QUE « RETOUR » FAIT, ÉCRAN PAR ÉCRAN ───────────────────────────────
 *
 * `onBack` remonte d'une étape quand il y en a une (O02 → O01, O03 → O02,
 * O04 → O03). Sur O01 il n'y en a pas : l'écran d'avant est le code SMS, sur une
 * session déjà ouverte, et y renvoyer serait redemander une vérification faite.
 * Le flux emploie alors l'HISTORIQUE DU NAVIGATEUR — ce qu'un chevron gauche
 * signifie littéralement — ce qui ramène le membre d'où il vient, et ne fait rien
 * s'il est arrivé par une URL directe. C'est le comportement d'aujourd'hui dans ce
 * dernier cas : aucune régression possible.
 *
 * Seul le cadre d'ORDINATEUR le dessine : les cadres de 390 px n'ont pas ce
 * bouton, et on n'en ajoute pas.
 */
const retour = {
  marqueur: 'm15 18-6-6 6-6',
  action: 'onBack',
  nom: 'Retour',
  frames: ['Desktop'],
  why:
    'Le bouton retour de l’en-tête d’onboarding remonte d’une étape. La maquette le dessine en ' +
    '<span> : ce n’était ni un bouton ni un lien, et il ne répondait à rien sur les quatre écrans.',
};

/**
 * ── LE GARDE-FOU DEVIENT DUR SUR LES CINQ ÉCRANS DE L'ONBOARDING ──────────
 *
 * `navigationDeclaree: true` fait passer le garde-fou de « ⚠ » à « REFUS » pour un
 * écran : le jour où le designer ajoute un `<a href="#">` à O01, la génération
 * S'ARRÊTE au lieu de produire un lien qui a l'air de marcher. C'est l'étape 6 de
 * la consigne de `markLinks`, et elle ne se pose QUE quand il ne reste plus un
 * seul lien mort sur l'écran — compté, cadre par cadre.
 *
 *   O01, O02, O03  — zéro, depuis que « Passer cette étape » est adressé ;
 *   O05            — zéro, depuis que « Aller à l'accueil » est adressé ;
 *   O04            — zéro, et il l'ÉTAIT DÉJÀ. Sa planche ne dessine aucun lien ;
 *                    personne n'avait posé le drapeau. Le poser ne change pas un
 *                    octet de son cadre produit — le drapeau ne touche que le
 *                    garde-fou — et ferme le trou avant qu'il s'ouvre.
 *
 * P01 ET P03 NE L'ONT PAS, et ce n'est pas un oubli : il leur reste deux liens
 * morts chacun, et les quatre sont des manques de ROUTE ou de PLANCHE, pas de
 * déclaration. Le poser ferait échouer la génération — « et pas seulement pour
 * vous », dit la consigne. Ils l'auront quand `/p/cgu` existera.
 *
 * P02 ne l'a pas non plus, et pour la raison inverse : il n'a plus aucun
 * `href="#"` (son lot précédent les a tous traités) mais il n'est pas de ce lot-ci,
 * et poser un drapeau sur l'écran d'un autre lot serait décider pour lui.
 */
export const screens = [
  {
    section: 'P01',
    frames: [1440, 390],
    liens: [
      {
        texte: 'politique de confidentialité',
        vers: '/p/confidentialite',
        frames: ['Desktop'],
        why:
          'Le document de confidentialité, P03 : `/p/confidentialite`. Le slug est RECOPIÉ de ' +
          'la table fermée `SLUGS` de `app/(onboarding)/p/[slug]/page.tsx` — les deux seules ' +
          'valeurs servies sont `confidentialite` et `ressources`.',
      },
      {
        texte: 'confidentialité',
        vers: '/p/confidentialite',
        frames: ['Mobile'],
        why:
          'Le même document, au libellé que la maquette raccourcit à 390 px ' +
          '(« confidentialité » et non « politique de confidentialité »). Même slug, même source.',
      },
    ],
  },
  { section: 'P02', frames: [1440, 390] },
  // 560 px : la variante « Ressources », pas un mobile.
  { section: 'P03', frames: [1440, 560], names: ['Desktop', 'Ressources'] },
  {
    section: 'O01',
    frames: [1440, 390],
    liens: [passer('/bienvenue/lieu', 'O02', 2), retour],
    navigationDeclaree: true,
  },
  {
    section: 'O02',
    frames: [1440, 390],
    liens: [passer('/bienvenue/objectif', 'O03', 3), retour],
    navigationDeclaree: true,
  },
  {
    section: 'O03',
    frames: [1440, 390],
    liens: [passer('/bienvenue/profil', 'O04', 4), retour],
    navigationDeclaree: true,
  },
  { section: 'O04', frames: [1440, 390], liens: [retour], navigationDeclaree: true },
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
    navigationDeclaree: true,
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LA PLANCHE DE O05 CENTRE SON CONTENU — ET ON LE JETAIT               ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « La page "Votre parcours est prêt" est mal affiché. »
     *
     * Sa planche écrit `display:flex;flex-direction:column;align-items:center;
     * justify-content:center;padding:40px`. Le conteneur était retiré EN BLOC —
     * à raison pour les 700 × 900 px de l'image, à tort pour le CENTRAGE et le
     * retrait, qui sont du dessin. Résultat mesurable : un bloc de 520 px collé
     * en haut à gauche d'un écran large, au lieu d'être posé au milieu.
     *
     * `keepFrameStyle` garde donc ce que `PLANK_ONLY` ne retire pas — fond,
     * direction, centrage, retrait — et `coqueRemplitLaHauteur` fait remplir la
     * hauteur à la coque, sans quoi « centrer verticalement » n'a rien contre
     * quoi se résoudre.
     */
    keepFrameStyle: true,
    coqueRemplitLaHauteur: ['AvecParcours', 'SansParcours'],
    /**
     * « Aller à l'accueil » — le dernier lien de l'inscription, et LA PREMIÈRE CHOSE
     * QUE LA MESURE A DÉMENTIE DANS CE LOT.
     *
     * La déclaration visait d'abord la planche SANS PARCOURS, parce que c'est elle
     * que T5 §3 décrit avec un « bouton “Aller à l'accueil” ». Le garde-fou `fois` de
     * `markLinks` a arrêté la génération en nommant le libellé : « désigne 0
     * élément(s) promouvable(s) ». C'est l'INVERSE :
     *
     *   · AVEC PARCOURS — un `<a href="#">` de 14 px sous le bouton « Commencer ».
     *     C'est LUI le lien mort, et c'est lui qui est branché ici ;
     *   · SANS PARCOURS — les MÊMES MOTS, mais un `<button>` primaire vert de 52 px.
     *     Ce n'est pas un lien, donc le compteur ne l'a jamais vu, et il est mort
     *     lui aussi (aucun `onClick`, et `BUTTON_ACTIONS` ne le déclare pas).
     *
     * ⚠ ET IL N'EST DÉLIBÉRÉMENT PAS PROMU, pour une raison de DESSIN qui vaut d'être
     * écrite : `markLinks` neutralise `color`, `text-decoration` et `cursor`, mais PAS
     * `display`. Un `<button>` est `inline-block`, un `<a>` est `inline` — et ce
     * bouton-là ne déclare pas son `display`. Le promouvoir ferait donc ignorer son
     * `width:100%` et son `height:52px`, et la barre pleine largeur se réduirait à la
     * taille de son texte. Un déplacement de dessin silencieux, exactement ce que le
     * préfixe du style existe pour éviter ailleurs. REMONTÉ : ce bouton a besoin d'un
     * `onClick`, pas d'une promotion.
     *
     * (Les quatre onglets de barre basse branchés par ce lot n'ont pas ce problème :
     * leur `<div>` DÉCLARE `display:flex`, qui surcharge l'`inline` du `<a>`.)
     *
     * `/accueil` est la route A01, et c'est celle que `use-onboarding-flow.ts` pousse
     * déjà en fin de flux (`NEXT_PATH[step] ?? '/accueil'`).
     */
    liens: [
      {
        texte: "Aller à l'accueil",
        vers: '/accueil',
        frames: ['AvecParcours'],
        why:
          'Le fil d’actualité, A01 : `/accueil` (T5 §11). Même destination que celle que ' +
          '`use-onboarding-flow.ts` pousse quand le flux se termine.',
      },
    ],
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
        why: 'Le titre de l’étape EN COURS, de `currentStep.title` — celle que « Commencer » ouvre.',
      },
      {
        noeud:
          '<p style="margin:6px 0 0;font-size:14px;color:#5D6B66;line-height:1.55">Campus France, choix des formations, lettre de motivation.</p>',
        devient:
          '<p style="margin:6px 0 0;font-size:14px;color:#5D6B66;line-height:1.55">{{ parcours.description }}</p>',
        fois: 1,
        frames: ['AvecParcours'],
        why:
          'La description de l’étape en cours, de `currentStep.description`. C’était la DERNIÈRE ' +
          'valeur dessinée de cette planche, et le porteur l’a vue : la phrase de la maquette ' +
          'parle de Campus France, et elle s’affichait sous l’étape d’un regroupement familial. ' +
          'La liste la porte depuis ce lot — la colonne est sur la ligne qu’elle lit déjà.',
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
  ...(s.liens === undefined ? {} : { liens: s.liens }),
  ...(s.navigationDeclaree === undefined ? {} : { navigationDeclaree: s.navigationDeclaree }),
  /**
   * CES DEUX CLÉS DOIVENT ÊTRE RECOPIÉES, et leur absence était un piège
   * silencieux : cette projection ne garde QUE ce qu'elle nomme. `keepFrameStyle`
   * déclaré sur O05 n'atteignait donc pas le générateur, qui le voyait
   * `undefined` — aucune erreur, aucun avertissement, simplement une coque qui ne
   * se construisait pas et un contenu collé en haut à gauche.
   */
  ...(s.keepFrameStyle === undefined ? {} : { keepFrameStyle: s.keepFrameStyle }),
  ...(s.coqueRemplitLaHauteur === undefined
    ? {}
    : { coqueRemplitLaHauteur: s.coqueRemplitLaHauteur }),
  frames: s.frames.map((width, i) => ({
    width,
    name: s.names?.[i] ?? (i === 0 ? 'Desktop' : 'Mobile'),
    // Deux cadres de MÊME largeur dans une section : il faut prendre le
    // second, pas rechercher la même ouverture deux fois.
    occurrence: s.frames.indexOf(width) === i ? 0 : i,
  })),
}));
