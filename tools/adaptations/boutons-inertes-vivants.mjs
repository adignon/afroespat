/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ VAGUE 1 / PHASE 1 — « BOUTONS, LIENS ET SECTIONS INERTES »                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Source des constats : l'audit du front (RAPPORT-FRONT). Chaque élément dessiné
 * qui ne faisait rien reçoit son vrai geste ici, ou disparaît. Appliquées avant
 * « l'en-tête global » (voir `tools/generate-screens.mjs`), comme les adaptations
 * des autres lots : elles lisent des cadres déjà branchés.
 *
 * Règles (AMORCAGE §3) : un motif est ancré sur la STRUCTURE, jamais sur une
 * mesure ; une coupe COMPTE ses balises ; aucune couleur n'est inventée.
 */
import { finElement } from './reseau-vivant.mjs';
import { NU, changerBalise, ouvranteAvant } from './outils-lot-e.mjs';

// ─── J11 · « Créer un parcours » ─────────────────────────────────────────────

/**
 * J11 (`/parcours`) dessinait DEUX gestes pour la même chose : le lien « Nouveau
 * parcours » (vivant) et, dans le bandeau, un `<button>` « Créer un parcours »
 * sans gestionnaire. Les cadres 390 px (J11 mobile, mobilevide) et les variantes
 * J01E n'ont pas ce bouton (relevé : une seule occurrence, 1440 px).
 */
const BI_J11_CREER = {
  screens: ['J11'],
  nom: 'BI_J11_CREER',
  why: 'Le bouton « Créer un parcours » du bandeau de /parcours n’avait aucun gestionnaire : il mène à /parcours/nouveau, comme « Nouveau parcours ».',
  provides: [],
  apply(jsx) {
    const at = jsx.indexOf('Créer un parcours</button>');
    if (at === -1) return { jsx, applied: false };
    const debut = ouvranteAvant(jsx, at, 'button');
    const neuf = changerBalise(
      jsx,
      debut,
      'Link',
      'href="/parcours/nouveau" data-parcours-creer=""',
      'textDecoration: "none", cursor: "pointer"',
    );
    return neuf === null ? { jsx, applied: false } : { jsx: neuf, applied: true };
  },
};

// ─── A01 · « Saluer » et « Parrains et contacts » ────────────────────────────

/**
 * « Saluer » (deux boutons du bloc « Nouveaux arrivants » de A01 1440 px) envoie
 * une demande de contact avec un mot d'accueil (`BoutonSaluer`, voir son en-tête).
 * Le cadre mobile ne dessine pas ce bloc (relevé de l'audit).
 */
const BI_A01_SALUER = {
  screens: ['A01'],
  nom: 'BI_A01_SALUER',
  why: '« Saluer » ne faisait rien : il envoie une demande de contact (états : envoi, envoyée, déjà en contact, en attente, erreur du serveur).',
  provides: ['arrivals'],
  apply(jsx) {
    const re = /<button style=\{\{ ([^}]*) \}\}>Saluer<\/button>/g;
    let compte = 0;
    const out = jsx.replace(re, (_m, style) => {
      compte += 1;
      return `<BoutonSaluer handle={a.handle} nom={a.name} style={{ ${style} }} />`;
    });
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * La carte « PARRAINS ET CONTACTS » : après la boucle des contacts en ligne, les
 * parrains disponibles et les suggestions de contact quand personne n'est en
 * ligne, ou l'état vide honnête (`SuggestionsParrains`).
 */
const BI_A01_PARRAINS = {
  screens: ['A01'],
  nom: 'BI_A01_PARRAINS',
  why: 'La carte « Parrains et contacts » restait un titre seul quand personne n’est en ligne : elle lit /mentors et /me/connection-suggestions, avec lien profil et état vide.',
  provides: ['online'],
  apply(jsx) {
    const titre = jsx.indexOf('>PARRAINS ET CONTACTS</div>');
    if (titre === -1) return { jsx, applied: false };
    const boucle = jsx.indexOf('))}</div>', titre);
    if (boucle === -1) return { jsx, applied: false };
    const at = boucle + '))}'.length;
    return {
      jsx: jsx.slice(0, at) + '<SuggestionsParrains actif={(online ?? []).length === 0} />' + jsx.slice(at),
      applied: true,
    };
  },
};

// ─── K09 · les sanctions et « Contester » ────────────────────────────────────

/**
 * K09 dessinait, aux DEUX largeurs, des cartes de sanction écrites en dur (une
 * « Avertissement · Pas de publicité sans accord · 3 mars 2026 » avec un
 * « Contester » mort, une autre alimentée par la seule dernière sanction) et, sur
 * ordinateur, une carte de contestation détachée. On COUPE ces cartes sœurs —
 * ouvrantes `background #fff / border #E6EBE9 / borderRadius 22px / padding NNpx`,
 * fermées en comptant les balises — et on pose `SanctionsListe` à leur place :
 * une carte par sanction du serveur, son formulaire dedans, son état vide.
 */
const CARTE_SANCTION = /<div style=\{\{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "\d+px", flexShrink: "0" \}\}>/y;

const BI_K09_LISTE = {
  screens: ['K09'],
  nom: 'BI_K09_LISTE',
  why: 'Les cartes de sanction étaient écrites en dur et « Contester » n’avait aucun geste : une carte par sanction du serveur, avec son recours (états, bornes de packages/shared, « Recours en cours »).',
  provides: ['sanctions', 'onRecharger'],
  apply(jsx) {
    const premiere = new RegExp(CARTE_SANCTION.source).exec(jsx);
    if (premiere === null || !jsx.slice(premiere.index, premiere.index + 900).includes('Avertissement')) {
      return { jsx, applied: false };
    }
    const mobile = !jsx.includes('data-zone="contenu"');
    let fin = premiere.index;
    for (;;) {
      CARTE_SANCTION.lastIndex = fin;
      if (CARTE_SANCTION.exec(jsx) === null) break;
      const suite = finElement(jsx, fin);
      if (suite === -1) return { jsx, applied: false };
      fin = suite;
    }
    const liste = `<SanctionsListe sanctions={sanctions} compact={${mobile}} onRecharger={onRecharger ?? (() => undefined)} />`;
    return { jsx: jsx.slice(0, premiere.index) + liste + jsx.slice(fin), applied: true };
  },
};

// ─── A14 · le bandeau d'étapes ───────────────────────────────────────────────

/**
 * « 1 · Écrire / 2 · Rattacher / 3 · Publier » (A14, 1440 px) : trois `<button>`
 * sans gestionnaire. Ils deviennent la navigation entre étapes : retour sur une
 * étape franchie, étape courante marquée, étapes futures inactives (les prises
 * `current`, `locked`, `onGo` viennent de `webFrameFor`). Les cadres mobiles ne
 * dessinent pas ce bandeau (relevé : une seule occurrence).
 */
const BI_A14_BANDEAU = {
  screens: ['A14'],
  nom: 'BI_A14_BANDEAU',
  why: 'Le bandeau d’étapes de la création de story n’avait aucun geste : retour sur les étapes franchies, étape courante marquée, étapes futures inactives.',
  provides: ['w'],
  apply(jsx) {
    const re =
      /<button style=\{\{ (border: "none", background: "none", padding: "0", font: "inherit", textAlign: "left", cursor: "pointer", )(display: "flex", flexDirection: "column", gap: "8px") \}\}>(<span style=\{\{ height: "5px", borderRadius: "999px", background: s\.bar \}\}><\/span>)/;
    const m = re.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const neuf =
      `<button type="button" onClick={s.onGo} aria-current={s.current ? "step" : undefined} ` +
      `aria-disabled={s.locked && !s.current ? "true" : undefined} data-etape-bandeau="" ` +
      `style={{ border: "none", background: "none", padding: "0", font: "inherit", textAlign: "left", ` +
      `cursor: s.locked ? "default" : "pointer", ${m[2]} }}>${m[3]}`;
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

// ─── K04 · « Retirer » un numéro : la mention du dernier numéro ───────────────

/**
 * Le cadre mobile de K04 dessine « Dernier numéro, non retirable » à la place du
 * bouton quand il ne reste qu'un numéro ; le cadre d'ordinateur laissait un
 * « Retirer » grisé SANS dire pourquoi. Le garde-fou est le même des deux côtés :
 * le serveur refuse (`LAST_PHONE`, verrou sérialisé), le front prévient avec la
 * phrase de la maquette (`t.dernier`, voir `LigneTelephone`).
 */
const BI_K04_DERNIER = {
  screens: ['K04'],
  nom: 'BI_K04_DERNIER',
  why: 'Sur ordinateur, le dernier numéro gardait un « Retirer » grisé sans explication : la mention de la maquette mobile le remplace.',
  provides: ['telephones'],
  apply(jsx) {
    if (jsx.includes('Dernier numéro, non retirable')) return { jsx, applied: false };
    const re = /<button type="button" onClick=\{t\.onRetirer\} disabled=\{[^}]*\} data-securite-retirer="" style=\{\{ [^}]*\}\}>Retirer<\/button>/;
    const m = re.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const neuf =
      '{t.dernier ? (<span style={{ fontSize: "12px", color: "#8A958F" }} data-securite-dernier="">Dernier numéro, non retirable</span>) : (' +
      m[0] +
      ')}';
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

export const ADAPTATIONS_BOUTONS_INERTES = [
  BI_K04_DERNIER,
  BI_J11_CREER,
  BI_A01_SALUER,
  BI_A01_PARRAINS,
  BI_K09_LISTE,
  BI_A14_BANDEAU,
];
export const AJOUTS_BOUTONS_INERTES = {
  SanctionsListe: '@/components/compte/sanctions-liste',
  BoutonSaluer: '@/components/accueil-voisins',
  SuggestionsParrains: '@/components/accueil-voisins',
};
void NU;
