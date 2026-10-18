/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « PARCOURS VIVANT » — LE MODULE J (J01 À J11) PREND DE VRAIS CONTRÔLES   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Constat du porteur (audit du module Parcours) : l'API expose vingt-trois routes sur
 * vingt-quatre, le front n'en appelait que quatre, et AUCUN champ de saisie n'existait
 * dans tout le module — chaque « champ » était un `<div>` dessiné, chaque bouton sans
 * geste, et une quinzaine de valeurs (« Amina D. », « Études · 82 % », « 9 aides
 * reçues », « Mes études à Lyon »…) étaient écrites en dur dans les planches.
 *
 * ── CE QUE FONT CES ADAPTATIONS ────────────────────────────────────────────────
 *
 * Le CHROME des cadres reste celui de la maquette, transcodé : rail, barre haute, carte
 * « Mon parcours » du panneau de gauche (déjà liée par `donnees`), barre basse mobile.
 * Ce qui change, c'est le CONTENU de `<main>` (et de `<aside>` sur ordinateur), que
 * l'on remplace par un composant React propre de `apps/web/src/components/parcours/` :
 * la maquette ne dessine ni champ, ni état de chargement, ni erreur, ni liste de
 * longueur variable — autant de choses qu'une image ne peut pas contenir. Chaque
 * composant est marqué AJOUT dans son en-tête et reprend la géométrie, les rayons et
 * les teintes des planches voisines (voir `components/parcours/ui.tsx` pour les
 * relevés). Même procédé que `parametres-reseau.tsx` et `carte-mon-parcours.tsx`.
 *
 * ── LES RÈGLES QUE LE REMPLACEMENT TIENT ───────────────────────────────────────
 *
 *   · une coupe COMPTE ses balises (`finElement`, piège n° 3) et se refuse si le
 *     bilan ne retombe pas à zéro ;
 *   · la balise ouvrante de `<main>` est CONSERVÉE : sa géométrie (largeur max, gap,
 *     `display: contents` sur mobile) est celle de la maquette ;
 *   · sur mobile, la coupe s'arrête AVANT la barre basse (le premier `<a href="/accueil">`
 *     du cadre), qui reste celle de la maquette ;
 *   · le composant choisi dépend de la SECTION, et — pour J01E — de ce que le cadre
 *     dessine (« ET MAINTENANT ? » = parcours abouti) ; un motif introuvable le DIT
 *     (`applied: false`).
 *
 * ── ÉCARTS À LA MAQUETTE, REMONTÉS ─────────────────────────────────────────────
 *
 *   · le glisser-déposer de J01 « Modifier les étapes » devient des flèches haut/bas
 *     (même route `PUT …/steps/order`, accessible au clavier) ;
 *   · les feuilles J03/J04/J05I/J07X/J08A sont rendues par `FeuillesParcours`, dans le
 *     châssis de `FenetreEcrire`, et non plus par les planches transcodées ;
 *   · la discussion de J01D, l'export (`/parcours/:id/export`), « La procédure a
 *     évolué », « Où en êtes-vous ? », « Signaler une erreur dans ce modèle » et la page
 *     des invitations n'existent pas dans la maquette : ce sont des AJOUTS.
 */
import { finElement } from './reseau-vivant.mjs';

/** Le composant à poser par section, ordinateur puis mobile. `vide` / `abouti` pour J01E. */
const VUES = {
  J02: { nom: 'VueCreer', props: '' },
  J01: { nom: 'VueParcours', props: '' },
  J01M: { nom: 'VueParcours', props: '' },
  J01S: { nom: 'VueEtape', props: '' },
  J01D: { nom: 'VueDiscussion', props: '' },
  J05: { nom: 'VueEquipe', props: '' },
  J06: { nom: 'VueDocuments', props: '' },
  J07: { nom: 'VueHistorique', props: '' },
  J08: { nom: 'VueReglages', props: '' },
  J09: { nom: 'VuePublics', props: '' },
  J09F: { nom: 'VueFichePublique', props: '' },
};

/** Les colonnes de droite à garder (remplacées par `ColonneParcours`) ou à vider. */
const ASIDE_GARDE = new Set(['J01', 'J01M', 'J01S', 'J01D', 'J05', 'J07', 'J08']);
const ASIDE_VIDE = new Set(['J09', 'J02']);
/** Les écrans plein cadre, sans barre basse mobile, que l'on remplace quand même. */
const SANS_BARRE = new Set(['J02', 'J01D']);

export const AJOUTS_PARCOURS_VIVANT = {
  VueCreer: '@/components/parcours/vue-creer',
  VueParcours: '@/components/parcours/vue-parcours',
  VueEtape: '@/components/parcours/vue-etape',
  VueDiscussion: '@/components/parcours/vue-discussion',
  VueEquipe: '@/components/parcours/vue-equipe',
  VueDocuments: '@/components/parcours/vue-documents',
  VueHistorique: '@/components/parcours/vue-historique',
  VueReglages: '@/components/parcours/vue-reglages',
  VuePublics: '@/components/parcours/vue-publics',
  VueFichePublique: '@/components/parcours/vue-publics',
  VueAbouti: '@/components/parcours/vue-abouti',
  LienParcours: '@/components/parcours/commun',
  VueListe: '@/components/parcours/vue-liste',
  Invitations: '@/components/parcours/vue-liste',
  ColonneParcours: '@/components/parcours/colonne',
  PanneauPublics: '@/components/parcours/panneau',
  PanneauRappels: '@/components/parcours/panneau',
};

const OUVRANTE_MAIN = /<main\b[^>]*>/;

/**
 * Remplace le contenu de `<main>` ; `null` quand les balises ne s'équilibrent pas.
 *
 * ⚠ Au moment où une adaptation s'exécute, le repère `<main>` n'a PAS encore été posé
 * sur les cadres où la maquette n'en écrit pas (« Repère `main` ajouté : la maquette
 * n'en a pas » est la dernière étape) : c'est le cas de presque tous les cadres
 * mobiles. Sans `<main>`, tout le JSX est le contenu à remplacer — jusqu'à la barre
 * basse (le premier `<a href="/accueil">`), qui reste celle de la maquette.
 */
function remplacerMain(jsx, composant, mobile) {
  const m = OUVRANTE_MAIN.exec(jsx);
  let interieurDebut = 0;
  let fermante = jsx.length;
  if (m !== null) {
    const debut = m.index;
    const fin = finElement(jsx, debut);
    if (fin < 0) return null;
    interieurDebut = debut + m[0].length;
    fermante = fin - '</main>'.length;
    if (!jsx.startsWith('</main>', fermante)) return null;
  }

  let interieurFin = fermante;
  if (mobile) {
    // La barre basse de la maquette reste : on coupe juste avant elle.
    const nav = jsx.indexOf('<a href="/accueil"', interieurDebut);
    if (nav >= 0 && nav < fermante) {
      const bloc = jsx.lastIndexOf('<div style={{', nav);
      if (bloc >= interieurDebut) interieurFin = bloc;
    }
  }
  return jsx.slice(0, interieurDebut) + composant + jsx.slice(interieurFin);
}

function remplacerAside(jsx, composant) {
  const m = /<aside\b[^>]*>/.exec(jsx);
  if (m === null) return jsx;
  const fin = finElement(jsx, m.index);
  if (fin < 0) return jsx;
  const fermante = fin - '</aside>'.length;
  if (!jsx.startsWith('</aside>', fermante)) return jsx;
  return jsx.slice(0, m.index + m[0].length) + composant + jsx.slice(fermante);
}

function unePourSection(section) {
  return {
    screens: [section],
    nom: `PV_${section}`,
    why: `Le contenu de ${section} (champs, gestes, listes réelles) remplace le dessin : la maquette ne contient ni champ de saisie, ni état de chargement, ni valeur dynamique.`,
    provides: [],
    apply(jsx) {
      const mobile = !jsx.includes('<RailSurvol');
      // J09 dessine DEUX écrans : la liste, et la fiche d'un parcours public (mobile seul).
      const fiche = section === 'J09' && jsx.includes('Parcours de {membre.prenom}');
      const choix = VUES[fiche ? 'J09F' : section];
      if (choix === undefined) return { jsx, applied: false };
      let props = `compact={${mobile ? 'true' : 'false'}}`;
      let nom = choix.nom;
      if (section === 'J01' && mobile && jsx.includes('rotate(-1.2deg)')) props += ' edition';
      // Un cadre mobile n'est remplacé que s'il dessine la barre basse, ou s'il est l'un
      // des deux écrans plein cadre sans barre (J02 et la fiche publique) : les feuilles
      // d'une même section (invitation, export, arrêt) ne sont pas des pages.
      if (mobile && !jsx.includes('<a href="/accueil"') && !SANS_BARRE.has(section) && !fiche) {
        return { jsx, applied: false };
      }
      const neuf = remplacerMain(jsx, `<${nom} ${props} />`, mobile);
      if (neuf === null) return { jsx, applied: false };
      let out = neuf;
      if (!mobile && ASIDE_GARDE.has(section)) out = remplacerAside(out, '<ColonneParcours />');
      if (!mobile && ASIDE_VIDE.has(section)) out = remplacerAside(out, '');
      return { jsx: out, applied: true };
    },
  };
}

/** J01E : « vide » (aucun parcours) et « abouti » (aucun actif, un terminé) — deux dessins. */
const PV_J01E = {
  screens: ['J01E'],
  nom: 'PV_J01E',
  why: 'Les états « aucun parcours » et « parcours abouti » lisent les vrais parcours (la maquette écrivait « Études · 82 % » et « Travail · 46 % » en dur).',
  provides: [],
  apply(jsx) {
    const mobile = !jsx.includes('<RailSurvol');
    const abouti = jsx.includes('ET MAINTENANT') || jsx.includes('Parcours abouti') || jsx.includes('abouti');
    const composant = abouti
      ? `<VueAbouti compact={${mobile}} />`
      : `<VueListe compact={${mobile}} vide />`;
    if (mobile && !jsx.includes('<a href="/accueil"')) return { jsx, applied: false };
    const neuf = remplacerMain(jsx, composant, mobile);
    if (neuf === null) return { jsx, applied: false };
    const out = mobile ? neuf : remplacerAside(neuf, abouti ? '<ColonneParcours />' : '');
    return { jsx: out, applied: true };
  },
};

/**
 * J11 « Mes parcours » : la liste est DÉJÀ liée (`actifs`, extraite dans `CarteParcours`,
 * que le profil public réemploie) — on n'y touche pas. On y AJOUTE les invitations
 * reçues (§3.4), en tête ; et l'état sans parcours (`MobileVide`, aucune boucle) prend
 * la vue complète, sans les deux cartes d'exemple de la maquette.
 */
const PV_J11 = {
  screens: ['J11'],
  nom: 'PV_J11',
  why: 'Mes parcours : les invitations en attente (accepter / refuser) s’ajoutent en tête, et l’état vide ne montre plus de parcours inventés.',
  provides: [],
  apply(jsx) {
    const mobile = !jsx.includes('<RailSurvol');
    if (jsx.includes('(actifs ?? [])') || jsx.includes('{{ actifs }}')) {
      const m = OUVRANTE_MAIN.exec(jsx);
      if (m !== null) {
        const apres = m.index + m[0].length;
        return { jsx: jsx.slice(0, apres) + '<Invitations />' + jsx.slice(apres), applied: true };
      }
      // Pas encore de repère `main` : les invitations viennent en tête du contenu.
      return { jsx: '<Invitations />' + jsx, applied: true };
    }
    if (mobile && !jsx.includes('<a href="/accueil"')) return { jsx, applied: false };
    const neuf = remplacerMain(jsx, `<VueListe compact={${mobile}} vide />`, mobile);
    return neuf === null ? { jsx, applied: false } : { jsx: neuf, applied: true };
  },
};

/**
 * J10 « Vous y êtes arrivé·e ! » : la planche plein cadre est GARDÉE (elle est déjà liée
 * à la durée et aux étapes). On lui donne ses destinations : les trois propositions de
 * §3.9 deviennent des liens, « Voir mon parcours » mène à `/parcours/:id`.
 */
const CARTES_J10 = [
  ['Devenir parrain', '/parrainage/devenir'],
  ['Écrire un guide', '/guides/nouveau'],
  ['Organiser une rencontre', '/agenda/nouveau'],
];

const PV_J10 = {
  screens: ['J10'],
  nom: 'PV_J10',
  why: 'Les trois propositions de fin de parcours et « Voir mon parcours » étaient des href="#" ou des <div> : ils mènent maintenant à leur page.',
  provides: [],
  apply(jsx) {
    let out = jsx;
    let fait = false;
    for (const [texte, vers] of CARTES_J10) {
      const at = out.indexOf(`>${texte}</div>`);
      if (at < 0) continue;
      const debut = out.lastIndexOf('<div style={{', at);
      const fin = finElement(out, debut);
      if (debut < 0 || fin < 0) continue;
      const bloc = out.slice(debut, fin);
      const ouvrante = /^<div style=\{\{ ([^}]*) \}\}>/.exec(bloc);
      if (ouvrante === null) continue;
      // Le <div> de la carte est ouvrant+fermant jumeaux : on change son nom, pas son dessin.
      const neuf =
        `<Link href="${vers}" style={{ ${ouvrante[1]}, textDecoration: "none", color: "inherit" }}>` +
        bloc.slice(ouvrante[0].length, bloc.length - '</div>'.length) +
        '</Link>';
      out = out.slice(0, debut) + neuf + out.slice(fin);
      fait = true;
    }
    const lien = /<a href="#" style=\{\{ ([^}]*) \}\}>Voir mon parcours<\/a>/.exec(out);
    if (lien !== null) {
      out =
        out.slice(0, lien.index) +
        `<LienParcours suffixe="" style={{ ${lien[1]} }}>Voir mon parcours</LienParcours>` +
        out.slice(lien.index + lien[0].length);
      fait = true;
    }
    return { jsx: out, applied: fait };
  },
};

/**
 * LE PANNEAU DE GAUCHE des dix planches d'ordinateur : trois valeurs écrites en dur.
 *
 *   · le badge « 4 » à côté de « Discussion » (aucun compteur de non-lus de parcours
 *     n'existe côté serveur : le badge disparaît plutôt que de mentir) ;
 *   · la carte « PARCOURS PUBLICS » (cinq membres inventés) → `PanneauPublics` ;
 *   · la carte « RAPPELS » (trois rappels inventés) → `PanneauRappels` ;
 *   · la ligne « Étape 0 : · échéance sans échéance » d'un panneau SANS parcours est
 *     masquée (elle n'a pas de sens quand il n'y a pas d'étape).
 */
const CARTE_PANNEAU = '<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "14px" }}>';

function remplacerCarte(jsx, titre, composant) {
  const at = jsx.indexOf(`>${titre}</div>`);
  if (at < 0) return jsx;
  const debut = jsx.lastIndexOf(CARTE_PANNEAU, at);
  if (debut < 0) return jsx;
  const fin = finElement(jsx, debut);
  if (fin < 0) return jsx;
  return jsx.slice(0, debut) + composant + jsx.slice(fin);
}

const PV_PANNEAU = {
  screens: ['J01', 'J01M', 'J01S', 'J01D', 'J02', 'J05', 'J06', 'J07', 'J08', 'J09', 'J11', 'J01E'],
  nom: 'PV_PANNEAU',
  why: 'Le panneau de gauche écrivait en dur le compteur de discussion, cinq parcours publics et trois rappels : ils viennent maintenant du serveur (ou disparaissent).',
  provides: [],
  apply(jsx) {
    if (!jsx.includes('<RailSurvol')) return { jsx, applied: false };
    let out = jsx;
    out = out.replace(/(>Discussion<\/span>)<span style=\{\{[^}]*\}\}>4<\/span>/, '$1');
    out = remplacerCarte(out, 'PARCOURS PUBLICS', '<PanneauPublics />');
    out = remplacerCarte(out, 'RAPPELS', '<PanneauRappels />');
    out = out.replace(
      /(<div style=\{\{[^}]*\}\}>)(Étape \{panneau\.rang\} : \{panneau\.etape\} · échéance \{panneau\.echeance\})(<\/div>)/,
      '{panneau.etape === "" ? null : ($1$2$3)}',
    );
    return { jsx: out, applied: out !== jsx };
  },
};

export const ADAPTATIONS_PARCOURS_VIVANT = [
  PV_PANNEAU,
  ...Object.keys(VUES).filter((s) => s !== 'J09F').map(unePourSection),
  PV_J01E,
  PV_J11,
  PV_J10,
];
