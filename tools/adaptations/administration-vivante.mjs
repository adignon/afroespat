/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « ADMINISTRATION VIVANTE » — D01 À D16                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette `10 Administration` est ENTIÈREMENT statique : aucune écriture
 * n'était branchée, « Continuer » de la connexion était inerte, et dix écrans
 * dessinaient des lignes d'exemple (« Joël K. », « Studio 390 € Lyon 2e »…).
 *
 * Ce que le générateur sait faire d'une maquette statique — interpoler quelques
 * nombres — ne suffit pas à rendre un éditeur de modèles ou un tableau paginé. Cette
 * adaptation fait donc ce que `CarteMonParcours` et `ParametresReseau` ont déjà fait :
 * elle GARDE ce que la maquette dessine du CHÂSSIS (le rail à neuf entrées, la place
 * du contenu) et pose, dans la zone de contenu de chaque planche, un composant React
 * propre (`components/admin/…`) écrit dans le langage visuel exact des planches
 * voisines — mêmes couleurs, mêmes rayons, mêmes tailles relevées dans les
 * `.generated.tsx`. AUCUNE couleur nouvelle, aucun rouge.
 *
 * ── CE QUI EST REMPLACÉ, ET CE QUI NE L'EST PAS ───────────────────────────────
 *
 *   · D01 : le contenu de la carte (champs et bouton) devient `ConnexionEquipe` ;
 *   · D02 : le contenu reste celui de la maquette (cinq cartes déjà liées) ;
 *   · D03 à D16 : la zone de contenu devient le composant de l'écran ;
 *   · TOUTES (D02 à D16) : la barre haute (recherche inerte, deux pastilles « Lyon » et
 *     « 30 derniers jours » sans geste, avatar « RA » en dur) devient `BarreAdmin` —
 *     une vraie recherche de membre, le nom de la session, la déconnexion.
 *
 * ── LE MOBILE, QUE LA MAQUETTE NE DESSINE PAS ─────────────────────────────────
 *
 * 10 Administration n'a QU'UN cadre de 1 440 px. Sous 1 024 px il débordait (relevé :
 * 603 px de large à 390). Le rail et la colonne reçoivent donc des repères
 * (`data-admin-rail`, `data-admin-main`) que `app/(admin)/admin.css` utilise pour
 * empiler le rail au-dessus du contenu, en bande défilante. AJOUT assumé.
 */
import { finElement } from './reseau-vivant.mjs';

/** Écran → composant de contenu. D02 n'y est pas : son contenu reste celui de la maquette. */
const CONTENUS = {
  D03: 'ContenuMembres',
  D04: 'ContenuFileModeration',
  D05: 'ContenuDossierModeration',
  D06: 'ContenuModeles',
  D07: 'ContenuEtapes',
  D08: 'ContenuVilles',
  D09: 'ContenuGuidesEquipe',
  D10: 'ContenuServices',
  D11: 'ContenuAlertes',
  D12: 'ContenuPagesAnnonces',
  D13: 'ContenuPartenaires',
  D14: 'ContenuMonetisation',
  D15: 'ContenuReglages',
  D16: 'ContenuImpact',
};

const TOUS = ['D02', ...Object.keys(CONTENUS)];

const BARRE_DEBUT =
  '<div style={{ height: "64px", display: "flex", alignItems: "center", gap: "8px", flexShrink: "0", position: "sticky"';
const CONTENU_DEBUT =
  '<div style={{ flexGrow: "1", display: "flex", flexDirection: "column", gap: "14px", overflow: "visible" }}>';
const RAIL_DEBUT = '<div style={{ width: "240px", flexShrink: "0", padding: "0 16px"';
const COLONNE_DEBUT = '<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", padding: "0 24px 24px 0" }}>';

const ADMIN_BARRE = {
  screens: TOUS,
  nom: 'ADMIN_BARRE',
  why: 'La barre haute de l’équipe devient `BarreAdmin` : recherche de membre, nom et rôle de la session, déconnexion. La maquette dessinait une recherche inerte, deux pastilles « Lyon » / « 30 derniers jours » sans geste et un avatar « RA » en dur.',
  provides: [],
  apply(jsx) {
    const debut = jsx.indexOf(BARRE_DEBUT);
    if (debut < 0) return { jsx, applied: false };
    const fin = finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    return { jsx: `${jsx.slice(0, debut)}<BarreAdmin />${jsx.slice(fin)}`, applied: true };
  },
};

const ADMIN_REPERES = {
  screens: TOUS,
  nom: 'ADMIN_REPERES',
  why: 'Pose `data-admin-rail` et `data-admin-main` sur le rail et la colonne : c’est par eux que `admin.css` rend l’application d’équipe lisible sous 1 024 px, que la maquette ne dessine pas.',
  provides: [],
  apply(jsx) {
    const rail = jsx.indexOf(RAIL_DEBUT);
    const colonne = jsx.indexOf(COLONNE_DEBUT);
    if (rail < 0 || colonne < 0) return { jsx, applied: false };
    let out = jsx.replace(RAIL_DEBUT, `<div data-admin-rail="" style={{ width: "240px", flexShrink: "0", padding: "0 16px"`);
    out = out.replace(COLONNE_DEBUT, COLONNE_DEBUT.replace('<div style=', '<div data-admin-main="" style='));
    return { jsx: out, applied: true };
  },
};

const ADMIN_CONTENU = {
  screens: Object.keys(CONTENUS),
  nom: 'ADMIN_CONTENU',
  why: 'La zone de contenu de D03 à D16 devient le composant de l’écran (`components/admin/…`) : lecture ET écriture réelles, états de chargement / vide / erreur / succès. Le rail et le titre de la maquette restent ceux du générateur.',
  provides: [],
  apply(jsx, ctx) {
    const section = ctx?.section;
    const nom = CONTENUS[section];
    if (nom === undefined) return { jsx, applied: false };
    const debut = jsx.indexOf(CONTENU_DEBUT);
    if (debut < 0) return { jsx, applied: false };
    const fin = finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    return { jsx: `${jsx.slice(0, debut)}${CONTENU_DEBUT}<${nom} /></div>${jsx.slice(fin)}`, applied: true };
  },
};

const ADMIN_CONNEXION = {
  screens: ['D01'],
  nom: 'ADMIN_CONNEXION',
  why: 'La carte de connexion d’équipe : mot de passe puis code TOTP, enrôlement forcé. La maquette dessinait trois cartes de saisie inertes ; `ConnexionEquipe` en est une seule, à trois états.',
  provides: [],
  apply(jsx) {
    // Le contenu de la carte : du bloc logo + titre jusqu'au bouton « Continuer » (le dernier
    // bouton de chacune des trois planches). La carte elle-même (fond, trait, rayon) reste.
    const debut = jsx.indexOf('<div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "38px", height: "38px"');
    const bouton = jsx.lastIndexOf('</button>');
    if (debut < 0 || bouton < debut) return { jsx, applied: false };
    const fin = bouton + '</button>'.length;
    return { jsx: `${jsx.slice(0, debut)}<ConnexionEquipe />${jsx.slice(fin)}`, applied: true };
  },
};


/**
 * ── D02 : AUCUN NOMBRE INVENTÉ SUR LE TABLEAU DE BORD ─────────────────────────
 *
 * Sept cartes de D02 ne sont pas liées à l'API (voir `screens/administration/data.ts`) et
 * la maquette y dessine des nombres d'exemple (« 27,4 % », « 3 420 € », « 148 »…). Vues
 * sur un vrai tableau de bord, elles se lisent comme des mesures — et c'est faux : une
 * base neuve affichait « MRR 3 420 € » à côté de « Inscrits — ». Elles prennent donc le
 * même tiret que les cartes liées en attente, et le bandeau d'alertes, qui n'a pas de
 * source, dit qu'il n'a pas de mesure plutôt que de lister trois alertes d'exemple.
 * La ligne d'objectif (30 %) est une règle de la spec : elle reste.
 */
const D02_FIXES = [
  ['>File</span><strong>46</strong>', '>File</span><strong>—</strong>'],
  ['>SLA respecté</span><strong>93 %</strong>', '>SLA respecté</span><strong>—</strong>'],
  ['>MRR</span><strong>3 420 €</strong>', '>MRR</span><strong>—</strong>'],
  ['>Mobile Money</span><strong>58 %</strong>', '>Mobile Money</span><strong>—</strong>'],
  ['>Affiliation</span><strong>610 €</strong>', '>Affiliation</span><strong>—</strong>'],
  ['>En cours</span><strong>148</strong>', '>En cours</span><strong>—</strong>'],
  ['>Note</span><strong>4,7</strong>', '>Note</span><strong>—</strong>'],
  ['>Ce mois</span><strong>94</strong>', '>Ce mois</span><strong>—</strong>'],
  ['>Présences</span><strong>2 310</strong>', '>Présences</span><strong>—</strong>'],
  ['>Actifs</span><strong>72</strong>', '>Actifs</span><strong>—</strong>'],
  ['>Intérêt</span><strong>31</strong>', '>Intérêt</span><strong>—</strong>'],
  ['>27,4 %</span>', '>—</span>'],
];

const D02_SANS_INVENTION = {
  screens: ['D02'],
  nom: 'D02_SANS_INVENTION',
  why: 'Les sept cartes de D02 que l’API ne sert pas prennent un tiret au lieu des nombres d’exemple de la maquette ; la courbe, les trois villes et les trois alertes d’exemple disparaissent au profit d’une phrase « pas encore de mesure ».',
  provides: [],
  apply(jsx) {
    let out = jsx;
    for (const [de, vers] of D02_FIXES) {
      if (out.split(de).length !== 2) return { jsx, applied: false };
      out = out.replace(de, vers);
    }
    // « +2,1 pts » : un écart sans historique n'existe pas.
    out = out.replace(/<span style=\{\{ fontSize: "13px", color: "#16785E", fontWeight: "700" \}\}>\+2,1 pts<\/span>/, '');
    // La courbe d'exemple (on garde la ligne d'objectif, pointillée).
    out = out.replace(/<polyline fill="none" stroke="#16785E"[^>]*\/>/, '');
    // Les trois villes d'exemple.
    out = out.replace(
      /<div style=\{\{ display: "flex", gap: "8px", marginTop: "6px" \}\}>(<span style=\{\{ background: "#F2F5F4"[\s\S]*?<\/span>){3}<\/div>/,
      '<div style={{ marginTop: "6px", fontSize: "12px", color: "#5D6B66" }}>Pas encore de mesure par ville.</div>',
    );
    // Les trois alertes d'exemple : de la première à la fin de la carte.
    const marque = '>ALERTES</div>';
    const a = out.indexOf(marque);
    if (a < 0) return { jsx: out, applied: false };
    const premiere = out.indexOf('<div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px 0"', a);
    const fermeture = out.indexOf('</div></div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)"', premiere);
    if (premiere < 0 || fermeture < 0) return { jsx: out, applied: false };
    out = `${out.slice(0, premiere)}<div style={{ marginTop: "10px", fontSize: "13px", color: "#5D6B66" }}>Aucune alerte mesurée pour l’instant.</div>${out.slice(fermeture + '</div>'.length)}`;
    // Repères pour `admin.css` : D02 dessine une rangée 2fr/1fr et deux rangées de cinq cartes,
    // que la maquette ne fait pas tenir sous 1 024 px (relevé : 583 px de large à 390).
    out = out.replace('<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr"', '<div data-admin-d02-haut="" style={{ display: "grid", gridTemplateColumns: "2fr 1fr"');
    out = out.split('<div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)"').join('<div data-admin-d02-cartes="" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)"');
    return { jsx: out, applied: true };
  },
};

/**
 * ── P03 : LE DOCUMENT LÉGAL VIENT DE L'API ───────────────────────────────────
 *
 * Le cadre « Desktop » de P03 écrit « Politique de confidentialité · Version 3 · En
 * vigueur depuis le 1er septembre 2026 » en dur, avec un sommaire de cinq `href="#"` qui
 * ne visaient rien. Le conteneur (sommaire + carte) devient `DocumentLegal`, qui en garde
 * le dessin et lit le contenu de `GET /pages/:slug`. La variante « Ressources » (560 px)
 * n'a pas ce conteneur : « introuvable sur ce cadre » est attendu (piège 7).
 */
const P03_DOCUMENT = {
  screens: ['P03'],
  nom: 'P03_DOCUMENT',
  why: 'Le document de P03 (sommaire + carte) vient de `GET /pages/:slug` : titre, version, date et corps de `static_pages`, au lieu de la politique de confidentialité écrite en dur « Version 3 ».',
  provides: [],
  apply(jsx) {
    const marque = '<div style={{ flex: "1", display: "flex", gap: "48px", justifyContent: "center", padding: "48px 40px", overflow: "hidden" }}>';
    const debut = jsx.indexOf(marque);
    if (debut < 0) return { jsx, applied: false };
    const fin = finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    let out = `${jsx.slice(0, debut)}<DocumentLegal />${jsx.slice(fin)}`;
    // Le sommaire (`toc`) n'est plus lu : sans ceci, la déstructuration resterait inutilisée.
    out = out.replace(/\n  const \{ toc \} = props;\n/, '\n').replace('(props: OnboardingVals)', '(_props: OnboardingVals)');
    return { jsx: out, applied: true };
  },
};

export const ADAPTATIONS_ADMIN_VIVANTE = [ADMIN_CONNEXION, ADMIN_CONTENU, ADMIN_BARRE, ADMIN_REPERES, D02_SANS_INVENTION, P03_DOCUMENT];

export const AJOUTS_ADMIN_VIVANTE = {
  BarreAdmin: '@/components/admin/barre-admin',
  ConnexionEquipe: '@/components/admin/connexion-equipe',
  DocumentLegal: '@/components/document-legal',
  ...Object.fromEntries(
    Object.entries({
      ContenuMembres: 'membres',
      ContenuFileModeration: 'file-moderation',
      ContenuDossierModeration: 'dossier-moderation',
      ContenuModeles: 'modeles',
      ContenuEtapes: 'etapes',
      ContenuVilles: 'villes',
      ContenuGuidesEquipe: 'guides-equipe',
      ContenuServices: 'services',
      ContenuAlertes: 'alertes',
      ContenuPagesAnnonces: 'pages-annonces',
      ContenuPartenaires: 'partenaires',
      ContenuMonetisation: 'monetisation',
      ContenuReglages: 'reglages',
      ContenuImpact: 'impact',
    }).map(([nom, fichier]) => [nom, `@/components/admin/ecrans/${fichier}`]),
  ),
};
