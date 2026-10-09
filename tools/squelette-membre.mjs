/**
 * ─── LE SQUELETTE DU DOMAINE MEMBRE : LE RAIL ET LE PANNEAU DE SECTION ──────
 *
 * Ce fichier ne déclare AUCUN écran. Il déclare la NAVIGATION QUE TOUS LES
 * ÉCRANS MEMBRE DESSINENT, pour que les sept modules (`03-accueil` …
 * `09-messages`) la reprennent au lieu de la recopier sept fois.
 *
 * IL N'EST PAS DANS `tools/screens/` À DESSEIN : le générateur importe tout
 * `tools/screens/*.mjs` et EXIGE de chacun un export `screens` qui soit un
 * tableau (voir l'assemblage de `SCREENS`). Un module d'outillage posé là
 * arrêterait la génération de tout le dépôt.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA MAQUETTE DESSINE DEUX RAILS DIFFÉRENTS, ET C'EST TOUTE LA DIFFICULTÉ     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré sur les 64 `<nav>` des sept maquettes membre, et non supposé — le
 * conteneur, lui, est RIGOUREUSEMENT identique partout (même empreinte sur les
 * sept fichiers), ce qui est précisément ce qui rend `dans` utilisable :
 *
 *   · 13 navs en BOUCLE (`03 Accueil v2.dc.html`) : UN `<a href="#">` dans un
 *     `<sc-for list="{{ rail }}" as="r">`, dont le libellé est `{{ r.label }}`.
 *     Ce sont de VRAIS liens, et ils sont MORTS — ils comptent dans les 207.
 *
 *   · 51 navs LITTÉRAUX (Parcours, Entraide, Services, Agenda, Compte,
 *     Messages) : CINQ `<span>` avec leurs cinq libellés écrits en clair. Ce ne
 *     sont pas des liens cassés : CE NE SONT PAS DES LIENS. Ils ne comptent donc
 *     dans aucun `href="#"`, et c'est pour cela que le récapitulatif ne les
 *     voyait pas — alors que c'est EXACTEMENT ce que le porteur a vu en cliquant.
 *
 * ── POURQUOI LE DISCRIMINANT N'EST PAS LE MÊME DES DEUX CÔTÉS ───────────────
 *
 * Dans un nav littéral, les cinq libellés sont écrits : `texte` suffit, et c'est
 * le discriminant le plus lisible. Dans un nav en boucle, il n'y a AUCUN texte à
 * distinguer — il y a un `{{ r.label }}` pour cinq entrées au rendu. C'est la
 * raison pour laquelle aucun lien du rail ne marchait : un mécanisme indexé sur
 * le texte ne peut rien y faire. La destination doit donc VOYAGER AVEC LA DONNÉE
 * (`vers: '{{ r.href }}'`), comme `r.bg`, `r.icon` et `r.label` le font déjà.
 *
 * ── LE MARQUEUR EST L'ICÔNE, PAS LE LIBELLÉ ────────────────────────────────
 *
 * `markLinks` remonte du marqueur jusqu'à la PREMIÈRE balise promouvable qui le
 * contient. Pour le panneau, `{{ m.label }}` est enfermé dans un
 * `<span style="flex:1;…">` : la remontée s'arrêterait sur CE span et promouvrait
 * le libellé au lieu du lien, ce qui déplacerait la zone cliquable sans rien dire.
 * `{{ m.icon }}` est posé dans un `<path>` sous un `<svg>` — deux balises non
 * promouvables — donc la remontée atteint le `<a>`. Vérifié présent EXACTEMENT UNE
 * FOIS dans chacun des 13 navs en boucle, et le défaut `fois: 1` de `markLinks`
 * le recompte à chaque génération.
 *
 * ── CE QUE CE FICHIER NE TOUCHE PAS, ET POURQUOI ───────────────────────────
 *
 * LE BOUTON DU BAS DU RAIL reste tel quel, sur les 65 cadres. `T5 §0` le nomme —
 * « un bouton réglages en bas » — et le dépôt lui pose déjà son nom accessible
 * (`A11Y_ANNOTATIONS`, `aria-label="Réglages"`). Mais IL N'EXISTE AUCUNE ROUTE
 * `/compte` : `apps/web/src/app/(app)/compte/` n'a que des sous-pages (`profil`,
 * `securite`, `notifications`…) et pas de `page.tsx`. Choisir laquelle serait
 * décider à la place du porteur quel écran EST « Réglages ». Un lien qui mène au
 * mauvais endroit est pire qu'un lien mort, donc il reste mort et c'est REMONTÉ.
 *
 * L'EN-TÊTE DE RECHERCHE reste telle quelle, et ce n'est pas un oubli : son
 * balisage n'est PAS uniforme (trois formes distinctes de la pastille de
 * recherche selon la maquette, et `04 Parcours.dc.html` dessine une barre haute
 * dont le conteneur n'existe nulle part ailleurs). Une déclaration unique y
 * promouvrait donc un élément DIFFÉRENT selon l'écran — un changement de dessin
 * silencieux. S'y ajoute que ses quatre contrôles en icône seule (ajouter,
 * messagerie, notifications, avatar) ne portent NI texte NI `aria-label` dans la
 * maquette : les promouvoir demanderait d'INVENTER leur nom. Remonté, pas comblé.
 */

/**
 * Le conteneur du rail, VERBATIM. Il borne la recherche des cinq libellés, et
 * c'est indispensable : « Accueil » est aussi écrit dans des fils d'Ariane, et
 * « Services » comme titre de page. Même rôle que le `dans` du rail d'équipe.
 *
 * `markLinks` exige qu'il figure EXACTEMENT UNE FOIS par cadre — ce qui tient,
 * puisqu'un écran ne dessine qu'un rail.
 */
export const NAV_MEMBRE =
  '<nav style="width:76px;background:#0F5C48;border-radius:22px;padding:12px 8px;' +
  'display:flex;flex-direction:column;gap:4px;flex-shrink:0;align-self:stretch">';

/**
 * ─── LES CINQ ENTRÉES, AVEC LEUR DESTINATION ────────────────────────────────
 *
 * L'ordre est celui de la maquette, et les routes sont VÉRIFIÉES une par une
 * dans `apps/web/src/app/(app)/`.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « SERVICES » EST UNE DÉCISION DE PRODUIT, PRISE PAR DÉFAUT ET REMONTÉE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les quatre autres entrées ont leur route d'accueil : `/accueil`, `/parcours`,
 * `/entraide`, `/agenda` existent et répondent. « Services » N'EN A PAS :
 *
 *   · il n'existe aucun `app/(app)/services/page.tsx` — seulement `logement`,
 *     `emploi`, `annuaire`, `alertes`, `mes-annonces` ;
 *   · la maquette ne dessine AUCUNE planche « Services — accueil » : sa première
 *     planche du module est S01, « Logement — liste ».
 *
 * On déclare donc `/services/logement`, PARCE QUE C'EST LA PREMIÈRE PLANCHE QUE
 * LA MAQUETTE DESSINE — et non parce que le logement primerait l'emploi, ce qui
 * n'est pas à nous d'arbitrer. Le porteur peut vouloir une page d'accueil de
 * module, ou un autre premier service : c'est son arbitrage, et il est remonté.
 */
const ENTREES_RAIL = [
  ['Accueil', '/accueil'],
  ['Parcours', '/parcours'],
  ['Entraide', '/entraide'],
  ['Services', '/services/logement'],
  ['Agenda', '/agenda'],
];

/**
 * ─── LES SEPT ENTRÉES DU PANNEAU DE SECTION « COMMUNAUTÉ » ──────────────────
 *
 * Elles sont déclarées ICI pour être LUES par l'humain qui relit cette table,
 * mais ce n'est PAS d'ici qu'elles atteignent le cadre : dans une boucle, la
 * destination est une DONNÉE, et c'est `apps/web/src/screens/a01/data.ts` (et son
 * jumeau `screens/reseaux/chrome.ts`) qui la porte, champ `href`, à côté de
 * `label`, `icon` et `count`.
 *
 * Les sept routes sont vérifiées dans `app/(app)/` : `/accueil`, `/guides`,
 * `/entraide`, `/reseaux`, `/parrainage`, `/villes`, `/agenda`.
 *
 * La TABLE RESTE ÉCRITE ICI quand même, et c'est délibéré : c'est le seul endroit
 * où le rail et le panneau se lisent côte à côte, et c'est ce qui fait voir que
 * « Fil d'actualité » et « Événements » du panneau mènent aux mêmes pages que
 * « Accueil » et « Agenda » du rail — ce qui est juste, et surprend à la lecture.
 */
export const ENTREES_PANNEAU = [
  ["Fil d'actualité", '/accueil'],
  ['Guides & Démarches', '/guides'],
  ["Fil d'entraide", '/entraide'],
  ['Réseaux', '/reseaux'],
  ['Parrainage', '/parrainage'],
  ['Villes & Membres', '/villes'],
  ['Événements', '/agenda'],
];

/**
 * LE RAIL LITTÉRAL — cinq `<span>` promus en cinq `<a>`, un par libellé.
 *
 * `frames` est OBLIGATOIRE et sans défaut : le rail n'est que sur les cadres
 * d'ordinateur, et appliquer ces liens à un cadre mobile ferait échouer le
 * `dans` (« le conteneur figure 0 fois »). Le faire déclarer écran par écran est
 * ce qui garde le refus parlant plutôt que de le rendre probable.
 *
 * LA SURBRILLANCE N'EST PAS TOUCHÉE, et il faut dire pourquoi plutôt que de le
 * laisser croire à un oubli : dans ces 51 navs, LA MAQUETTE PEINT DÉJÀ LA BONNE
 * ENTRÉE, planche par planche — « Agenda » sur les quatre cadres d'agenda,
 * « Entraide » sur les dix d'entraide, « Parcours » sur les treize de parcours,
 * « Services » sur les dix de services, et AUCUNE sur Compte, Messages et
 * Recherche, dont aucune des cinq entrées ne désigne la page. C'est mesuré sur
 * les 51 cadres. Y toucher serait réécrire un dessin juste.
 */
export const railLitteral = (frames) =>
  ENTREES_RAIL.map(([texte, vers]) => ({
    dans: NAV_MEMBRE,
    texte,
    vers,
    frames,
    why:
      `L’entrée « ${texte} » du rail membre mène à ${vers} (T5 §0 : « rail vertical 76 px à ` +
      'gauche — Accueil, Parcours, Entraide, Services, Agenda »). La maquette la dessine en ' +
      '<span> : ce n’était pas un lien cassé, ce n’était pas un lien.',
  }));

/**
 * LE RAIL EN BOUCLE — un seul `<a href="#">` à ré-adresser, cinq destinations au
 * rendu, portées par `r.href`.
 *
 * Le marqueur est l'ICÔNE et non le libellé : voir l'en-tête. La destination
 * passe EN DIALECTE, donc `markLinks` la pose avant `transcode`, qui en fait
 * `href={r.href}` — évalué DANS la boucle, une adresse par entrée.
 *
 * ── DE QUEL CÔTÉ DU TROU DE `styleToJsx` ON SE PLACE ───────────────────────
 *
 * Le lot de base a fermé un trou : une interpolation posée en position de
 * DÉCLARATION dans un attribut `style` (`style="…;{{ m.bord }}"`) était sautée en
 * silence, et elle arrête désormais la génération. Cette destination-ci n'est pas
 * concernée, et ce n'est pas par chance : elle est en position de VALEUR
 * D'ATTRIBUT (`href="{{ r.href }}"`), pas dans un `style`. Le rail et le panneau
 * sont truffés d'interpolations (`background:{{ r.bg }}`, `color:{{ r.fg }}`) et
 * toutes sont des VALEURS de paires — donc du bon côté elles aussi.
 */
export const railBoucle = (frames) => [
  {
    dans: NAV_MEMBRE,
    marqueur: '{{ r.icon }}',
    vers: '{{ r.href }}',
    frames,
    why:
      'Les cinq entrées du rail sont UNE entrée de maquette dans `<sc-for as="r">` : la ' +
      'destination ne peut pas être distinguée par le texte, qui est `{{ r.label }}`. Elle ' +
      'voyage donc avec la donnée (`r.href`), comme `r.bg` et `r.icon`.',
  },
];

/**
 * LE PANNEAU DE SECTION EN BOUCLE — sept entrées, une entrée de maquette.
 *
 * Pas de `dans` ici, et c'est un choix mesuré : le conteneur du panneau est un
 * `<div style="display:flex;flex-direction:column;gap:2px">` que la maquette
 * dessine DEUX FOIS par cadre (le panneau, et le bloc « VOS RACCOURCIS » juste
 * dessous). Un `dans` échouerait donc sur le compte « exactement une fois ».
 * `{{ m.icon }}` est en revanche propre au panneau — `m` n'est la variable
 * d'aucune autre boucle de ces cadres — et `fois: 1` le recompte.
 *
 * LA SURBRILLANCE DIT DÉJÀ LA VÉRITÉ ICI, et pour une raison qui vaut d'être
 * écrite : contrairement au rail, la maquette a PARAMÉTRÉ ce panneau —
 * `panel(active)`, avec `panelFil: panel(0)`, `panelGuides: panel(1)`,
 * `panelReseaux: panel(3)`, `panelVilles: panel(5)`. Chaque écran reçoit donc la
 * variante qui le désigne, et c'est vérifié cadre par cadre : A01/A02 → `panelFil`,
 * A03/A04/A06 → `panelGuides`, A07–A10 → `panelReseaux`, A11/A12 → `panelVilles`.
 */
export const panneauBoucle = (frames) => [
  {
    marqueur: '{{ m.icon }}',
    vers: '{{ m.href }}',
    frames,
    why:
      'Les sept entrées du panneau COMMUNAUTÉ sont UNE entrée de maquette dans ' +
      '`<sc-for as="m">`. Même raison que le rail : la destination est une donnée ' +
      '(`m.href`), déclarée avec les sept routes dans `ENTREES_PANNEAU`.',
  },
];

/** Le squelette d'un cadre en boucle : le rail ET le panneau de section. */
export const squeletteBoucle = (frames) => [...railBoucle(frames), ...panneauBoucle(frames)];

/**
 * ─── QUELS CADRES D'UN ÉCRAN PORTENT LE RAIL ────────────────────────────────
 *
 * Les cadres dont le NOM porte « Desktop ». C'est une règle sur les noms, donc
 * elle mérite qu'on dise pourquoi elle est sûre ici :
 *
 *   · LE RAIL N'EST QUE SUR L'ORDINATEUR. Mesuré sur les 65 cadres qui le
 *     dessinent : tous portent « Desktop » (`Desktop`, `AuteurDesktop`,
 *     `DesktopVide`, `BloqueDesktop`, `DesktopPanneau`…), aucun cadre mobile ne
 *     le dessine. En mobile la maquette met une barre d'onglets basse à la place,
 *     qui n'est pas le même contrôle et ne relève pas de cette table.
 *
 *   · UN FAUX POSITIF NE PEUT PAS PASSER EN SILENCE, et c'est ce qui rend la
 *     règle acceptable plutôt que commode. Le `dans` de `markLinks` exige son
 *     conteneur EXACTEMENT UNE FOIS dans le cadre : un cadre d'ordinateur SANS
 *     rail — une planche de fenêtre, un onglet — le compte à ZÉRO et ARRÊTE la
 *     génération en nommant l'écran et le cadre. D'où `squelette: false` sur les
 *     écrans concernés, déclaré et motivé un par un dans chaque module.
 */
export const cadresDuRail = (frames) =>
  frames.map((f) => f.name).filter((n) => n.includes('Desktop'));

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LA BARRE D'ONGLETS BASSE DU MOBILE — LE TROISIÈME JEU DE DESTINATIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── D'OÙ CE BLOC VIENT, ET POURQUOI IL EST ICI MAINTENANT ───────────────────
 *
 * Il vivait dans `tools/barre-basse.mjs`, posé à part par le lot de Parcours,
 * Entraide, Services et Agenda — qui a écrit lui-même, dans son en-tête : « CE
 * FICHIER DEVRAIT ÊTRE DANS `tools/squelette-membre.mjs`. C'est là qu'il
 * appartient, à côté de `railLitteral` : même nature, même emploi, mêmes sept
 * modules. Il est posé à part parce que ce lot n'a mandat que sur […] et qu'un
 * autre lot travaille en parallèle dans `squelette-membre.mjs`. Les deux fichiers
 * sont à fusionner. » La fusion est faite ici, et `tools/barre-basse.mjs` a
 * disparu : les cinq modules qui l'employaient importent cette table.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LA MESURE A DÉMENTI, ET LA PHRASE EXACTE QUI A ÉGARÉ               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Quelques lignes plus haut, `cadresDuRail` écrit : « En mobile la maquette met
 * une barre d'onglets basse à la place, qui n'est pas le même contrôle et ne
 * relève pas de cette table. » La phrase est EXACTE — ce n'est pas le même
 * contrôle — mais elle a été lue comme « il n'y a rien à faire là », et c'était
 * faux. Compté sur les cadres produits :
 *
 *   · LA BARRE EXISTE SUR 54 CADRES du dépôt, rigoureusement la même partout :
 *     un `<div>` en grille de cinq colonnes, cinq lignes de 54 px, chacune un
 *     `<div>` avec son icône et son libellé en clair ;
 *   · CES CINQ LIGNES SONT DES `<div>`. Ce ne sont pas des liens cassés : CE NE
 *     SONT PAS DES LIENS. Aucun `href="#"`, donc le récapitulatif
 *     « ── NAVIGATION ── » n'en voit AUCUNE — exactement comme il ne voyait pas
 *     les 51 rails littéraux ;
 *   · ET SES CINQ ENTRÉES NE SONT PAS CELLES DU RAIL. Le rail d'ordinateur dit
 *     « Accueil, Parcours, Entraide, Services, Agenda » ; la barre basse dit
 *     « Accueil, Parcours, Entraide, Services, COMPTE ». Pas d'Agenda en bas, et
 *     un Compte. Une table unique pour les deux aurait donc envoyé « Compte » sur
 *     `/agenda`, et rien ne l'aurait signalé : les deux contrôles ont cinq
 *     entrées, et seul le cinquième libellé les distingue. C'est la raison pour
 *     laquelle `ENTREES_BARRE_BASSE` existe À CÔTÉ de `ENTREES_RAIL` et non à sa
 *     place.
 *
 * Sur un téléphone, c'est LA navigation : il n'y a pas de rail. Les cadres
 * mobiles de sept modules membre n'avaient donc aucune sortie, et c'est
 * précisément la phrase du porteur — « Aucun sous lien aussi ne fonctionne ».
 *
 * ─── POURQUOI LE MARQUEUR EST `</svg>Libellé</div>` ─────────────────────────
 *
 * `markLinks` remonte du marqueur jusqu'à la PREMIÈRE balise promouvable qui le
 * contient. Le libellé est un enfant TEXTE direct de la ligne, posé juste après le
 * `</svg>` de son icône : la remontée traverse `<path>` et `<svg>`, qui ne sont pas
 * promouvables, et atteint la ligne — donc la zone cliquable fait les 54 px de la
 * ligne, pas la largeur du mot. Le marqueur porte le libellé ET sa fermeture, ce
 * qui le rend unique dans le cadre : « Parcours » est aussi écrit dans des titres
 * et des pastilles, mais jamais collé à un `</svg>` et suivi d'un `</div>`.
 *
 * `fois: 1` est le défaut, et il recompte à chaque génération : le jour où un
 * cadre dessinera deux barres, la génération s'arrêtera en le nommant.
 *
 * ─── « COMPTE » N'EST PAS POSÉ, ET C'EST UN REFUS ──────────────────────────
 *
 * IL N'EXISTE AUCUNE ROUTE `/compte` : `apps/web/src/app/(app)/compte/` n'a que
 * des sous-pages (`profil`, `securite`, `notifications`, `abonnement`,
 * `verification`, `donnees`, `contacts`, `sanctions`, `enregistres`) et PAS de
 * `page.tsx` — vérifié, pas supposé. Choisir laquelle EST « Compte » serait décider
 * à la place du porteur. C'est le même refus que le bouton réglages du bas du rail,
 * et pour la même raison : un lien qui mène au mauvais endroit est pire qu'un lien
 * mort, parce que le lien mort se voit. La cinquième entrée reste donc inerte, et
 * `apps/web/e2e/sous-liens.spec.ts` comme `apps/web/e2e/accueil-sous-liens.spec.ts`
 * MESURENT cette absence — le jour où le porteur tranche, les deux rougiront et lui
 * feront nommer sa décision.
 */

/**
 * Les quatre entrées QUI ONT UNE ROUTE, dans l'ordre où la maquette les dessine.
 *
 * « SERVICES » REPREND L'ARBITRAGE DÉJÀ PRIS ET DÉJÀ REMONTÉ pour `ENTREES_RAIL` :
 * il n'existe pas de `app/(app)/services/page.tsx`, et la première planche que la
 * maquette dessine pour ce module est S01 « Logement — liste ». On déclare donc
 * `/services/logement`, par défaut et non par préférence du logement sur l'emploi.
 * Si le porteur tranche autrement, les deux tables changent ensemble.
 */
const ENTREES_BARRE_BASSE = [
  ['Accueil', '/accueil'],
  ['Parcours', '/parcours'],
  ['Entraide', '/entraide'],
  ['Services', '/services/logement'],
];

/**
 * LES CADRES SONT OBLIGATOIRES ET SANS DÉFAUT, comme pour `railLitteral` : la
 * barre n'est que sur les planches mobiles, et l'appliquer à un cadre
 * d'ordinateur ferait tomber le compte à zéro — donc ARRÊTERAIT la génération en
 * nommant l'écran et le cadre. Le faire déclarer écran par écran est ce qui garde
 * le refus parlant plutôt que de le rendre probable.
 */
export const barreBasse = (frames) =>
  ENTREES_BARRE_BASSE.map(([libelle, vers]) => ({
    marqueur: `</svg>${libelle}</div>`,
    vers,
    frames,
    why:
      `L’onglet « ${libelle} » de la barre basse du mobile mène à ${vers}. La maquette le ` +
      'dessine en <div> : ce n’était pas un lien cassé, ce n’était pas un lien — et sur un ' +
      'téléphone c’est LA navigation, puisqu’il n’y a pas de rail.',
  }));

/**
 * ─── LA MÊME BARRE, QUAND LA MAQUETTE L'ÉCRIT EN BOUCLE ─────────────────────
 *
 * UN SEUL CADRE DU DÉPÔT est dans ce cas, et c'est le cadre mobile de A01 :
 * `03 Accueil v2.dc.html` construit sa barre par `<sc-for list="{{ mBottom }}"
 * as="b">`, une entrée de maquette pour cinq lignes au rendu. Les 53 autres
 * l'écrivent en clair.
 *
 * `barreBasse` ne peut donc rien y faire : il n'y a AUCUN libellé à distinguer,
 * le marqueur serait `</svg>{{ b.label }}</div>` pour les cinq. La destination
 * voyage avec la DONNÉE (`b.href`, dans `apps/web/src/screens/a01/data.ts`),
 * exactement comme pour le rail en boucle de cette même maquette — et c'est là,
 * dans la donnée, que « Compte » vaut `undefined`.
 *
 * `dans` borne la recherche au conteneur de la barre : « Accueil », « Parcours »
 * et « Entraide » sont aussi écrits dans la barre d'onglets de SECTION, juste
 * au-dessus, et le marqueur d'icône seul ne les distinguerait pas.
 */
export const BARRE_BASSE_EN_BOUCLE =
  '<div style="position:relative;flex-shrink:0;background:#fff;border-top:1px solid #E6EBE9;' +
  'padding:6px 8px 24px;display:grid;grid-template-columns:repeat(5,1fr)">';

export const barreBasseBoucle = (frames) => [
  {
    dans: BARRE_BASSE_EN_BOUCLE,
    marqueur: '{{ b.icon }}',
    vers: '{{ b.href }}',
    frames,
    why:
      'Les cinq entrées de la barre basse sont UNE entrée de maquette dans `<sc-for as="b">` ' +
      'sur le cadre mobile de A01 : la destination ne peut pas être distinguée par le texte, ' +
      'qui est `{{ b.label }}`. Elle voyage donc avec la donnée (`b.href`), comme `b.icon` — et ' +
      '« Compte » y vaut `undefined`, faute de route.',
  },
];

/**
 * Les cadres d'un écran qui dessinent la barre basse : ceux dont le nom porte
 * « Mobile ».
 *
 * MÊME RÈGLE, MÊME SÛRETÉ que `cadresDuRail` : c'est une règle sur les noms, et un
 * faux positif ne peut pas passer en silence — un cadre mobile SANS barre compte
 * le marqueur à zéro et refuse. Les cadres de FENÊTRE sont donc exclus à la main
 * par chaque module (une feuille ne dessine pas la barre : elle se pose
 * par-dessus), et un oubli s'arrête au lieu de dériver.
 */
export const cadresDeLaBarre = (frames) =>
  frames.map((f) => f.name).filter((n) => n.includes('Mobile'));
