/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « ENTRAIDE ET PARRAINAGE VIVANTS » — H01 À H10                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * L'API de l'entraide (16 routes) et du parrainage (toutes) était complète ; les
 * écrans ne faisaient que LIRE. Ce fichier branche les gestes, en posant des
 * composants React propres (`components/entraide/*`, marqués AJOUT dans leur
 * en-tête) à la place des régions que la maquette ne dessine que comme une image.
 *
 * Elles s'appliquent APRÈS toutes les autres (comme `profil-vivant.mjs`) : leurs
 * motifs lisent des cadres déjà branchés. Chacune est déclarée pour les écrans qui
 * en ont besoin ; « introuvable » sur un cadre qui ne dessine pas le motif est le
 * piège n° 7, pas un défaut.
 */
import { finElement } from './reseau-vivant.mjs';

const TOUS_H = ['H01', 'H02', 'H03', 'H04', 'H05', 'H06', 'H07', 'H08', 'H09', 'H10'];

/**
 * ── 1. LE « SIGNALER » DU BANDEAU ANTI-PAIEMENT, SUR LES DIX ÉCRANS ──────────
 *
 * `<a href="#">Signaler</a>` à la suite de « Si on vous demande de l'argent,
 * signalez » : deux fois par cadre d'ordinateur (le rail et sa carte de règle). Il
 * devient `SignalerArgent`, qui ouvre la fenêtre de signalement du produit. H02 et
 * H06 passent leur sujet (la demande, le parrain) par `signalement`, les autres
 * demandent d'abord quel membre.
 */
const signalerPour = (screens, nom, sujet, provides) => ({
  screens,
  nom,
  why: 'Le « Signaler » du bandeau anti-paiement (§2.7) ouvre la fenêtre de signalement (`POST /reports`) au lieu d’être un lien `href="#"` mort.',
  provides,
  apply(jsx) {
    const motif = /<a href="#" style=\{\{ ([^}]*) \}\}>Signaler<\/a>/g;
    let compte = 0;
    const out = jsx.replace(motif, (_t, style) => {
      compte += 1;
      return `<SignalerArgent style={{ ${style} }}${sujet === null ? '' : ` sujet={${sujet}}`} />`;
    });
    return { jsx: out, applied: compte > 0 };
  },
});

/** H02 et H06 ont un sujet précis (la demande, le parrain) ; les autres demandent QUI. */
const SIGNALER = signalerPour(
  ['H01', 'H03', 'H04', 'H05', 'H07', 'H08', 'H09', 'H10'],
  'H_SIGNALER',
  null,
  [],
);
const SIGNALER_H02 = signalerPour(['H02'], 'H02_SIGNALER', 'action.signalement', ['action']);
const SIGNALER_H06 = signalerPour(['H06'], 'H06_SIGNALER', 'parrain.signalement', ['parrain']);

/**
 * ── 2. H03 · LE COMPOSEUR A DE VRAIS CHAMPS ─────────────────────────────────
 *
 * Ordinateur : la carte blanche entière (`borderRadius: 22px; padding: 24px`).
 * Mobile : le corps et la barre d'action, frères dans le `<main>`. Dans les deux
 * cas la région est REMPLACÉE par `FormulaireDemande`, qui reprend le dessin.
 */
const H03_FORMULAIRE = {
  screens: ['H03'],
  nom: 'H03_FORMULAIRE',
  why: 'Le composeur « Publier une demande » devient un formulaire réel (titre, description, type, ville, échéance, parcours d’origine) qui envoie `POST /help`.',
  provides: ['avertissement'],
  apply(jsx) {
    const bureau =
      '<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "24px", flexShrink: "0" }}>';
    const i = jsx.indexOf(bureau);
    if (i >= 0) {
      const fin = finElement(jsx, i);
      if (fin < 0) return { jsx, applied: false };
      return {
        jsx:
          jsx.slice(0, i) +
          '<FormulaireDemande variante="bureau" avertissement={avertissement} />' +
          jsx.slice(fin),
        applied: true,
      };
    }
    const corps = '<div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px"';
    const j = jsx.indexOf(corps);
    if (j < 0) return { jsx, applied: false };
    const finCorps = finElement(jsx, j);
    if (finCorps < 0 || !jsx.slice(finCorps).startsWith('<div style={{ flexShrink: "0", background: "#fff", borderTop')) {
      return { jsx, applied: false };
    }
    const finPied = finElement(jsx, finCorps);
    if (finPied < 0) return { jsx, applied: false };
    return {
      jsx:
        jsx.slice(0, j) +
        '<FormulaireDemande variante="mobile" avertissement={avertissement} />' +
        jsx.slice(finPied),
      applied: true,
    };
  },
};

/**
 * ── 3. H02 · LES GESTES DE LA DEMANDE ───────────────────────────────────────
 *
 * Huit remplacements, tous sous condition (chaque région ne s'affiche que pour
 * celui à qui elle s'adresse). Voir `components/entraide/demande-vivante.tsx`.
 */
function remplacerElement(jsx, debutMotif, neuf) {
  const i = jsx.indexOf(debutMotif);
  if (i < 0) return null;
  const fin = finElement(jsx, i);
  if (fin < 0) return null;
  return jsx.slice(0, i) + neuf + jsx.slice(fin);
}

const H02_GESTES = {
  screens: ['H02'],
  nom: 'H02_GESTES',
  why: 'H02 : pastilles et menu, actions de l’auteur (modifier, résoudre, rouvrir, supprimer), réponse et réponse privée, « ça m’a aidé », modifier/supprimer sa réponse, après-résolution — au lieu de pastilles et boutons dessinés sans geste.',
  provides: ['action', 'demande'],
  apply(jsx) {
    let out = jsx;
    let n = 0;
    const essai = (r) => {
      if (r !== null) {
        out = r;
        n += 1;
      }
    };
    // Carte de la demande : le trait orange n'est que pour une demande issue d'un parcours.
    for (const [rayon, retrait] of [['22px', '22px'], ['20px', '16px']]) {
      const vieux = `<div style={{ background: "#FFFBF8", border: "1.5px solid #E0733A", borderRadius: "${rayon}", padding: "${retrait}"`;
      if (out.includes(vieux)) {
        out = out.replace(
          vieux,
          `<div style={{ background: action.deParcours ? "#FFFBF8" : "#fff", border: action.deParcours ? "1.5px solid #E0733A" : "1px solid #E6EBE9", borderRadius: "${rayon}", padding: "${retrait}"`,
        );
        n += 1;
      }
    }
    // Pastilles + « ··· » (ordinateur).
    {
      const d = '<div style={{ display: "flex", gap: "6px" }}><span style={{ background: "#E0733A"';
      essai(remplacerElement(out, d, '<EnteteDemande action={action} />'));
    }
    // Pastille seule (téléphone), puis le rond « ··· » de la barre haute en menu.
    {
      const m = /<span style=\{\{ background: "#E0733A"[^}]*\}\}>Depuis un parcours<\/span>/.exec(out);
      if (m !== null && !out.includes('<EnteteDemande')) {
        out = out.slice(0, m.index) + '<EnteteDemande action={action} sansMenu />' + out.slice(m.index + m[0].length);
        n += 1;
        const rond = /<span style=\{\{ (width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0"[^}]*)\}\}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h\.01M12 12h\.01M19 12h\.01" \/><\/svg><\/span>/.exec(out);
        if (rond !== null) {
          out =
            out.slice(0, rond.index) +
            `<MenuDemande action={action} rondStyle={{ ${rond[1]} }} />` +
            out.slice(rond.index + rond[0].length);
          n += 1;
        }
      }
    }
    // Actions de l'auteur (ordinateur).
    {
      const d = '<div style={{ display: "flex", gap: "8px", marginTop: "14px" }}><button style={{ height: "44px"';
      essai(remplacerElement(out, d, '<ActionsAuteur action={action} />'));
    }
    // Compteur de réponses.
    if (out.includes('{demande.nbReponses} RÉPONSES · VUE AUTEUR')) {
      out = out.replace(
        '{demande.nbReponses} RÉPONSES · VUE AUTEUR',
        '{demande.nbReponses} {demande.nbReponses > 1 ? "RÉPONSES" : "RÉPONSE"}{action.estAuteur ? " · VUE AUTEUR" : ""}',
      );
      n += 1;
    }
    // Pastilles de chaque réponse.
    {
      const debut = out.indexOf('{r.marquee ? (<>');
      const finMotif = 'Ça m’a aidé</span></>) : null}';
      const second = debut < 0 ? -1 : out.indexOf(finMotif, out.indexOf(finMotif, debut) + 1);
      if (debut >= 0 && second > debut) {
        out = out.slice(0, debut) + '<ActionsReponse reponse={r.action} />' + out.slice(second + finMotif.length);
        n += 1;
      }
    }
    // Typo de la planche mobile : « 0 14pxpx ».
    out = out.replace('padding: "0 14pxpx"', 'padding: "0 14px"');
    // Après résolution (ordinateur).
    essai(remplacerElement(out, '<div style={{ background: "#E3F0EB", borderRadius: "22px", padding: "18px 20px" }}><div style={{ fontSize: "10.5px"', '<ApresResolution action={action} />'));
    // Colonne de droite : répondre.
    {
      const lib = out.indexOf('VUE D’UN AUTRE MEMBRE');
      if (lib >= 0) {
        const debut = out.lastIndexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px"', lib);
        const fin = debut < 0 ? -1 : finElement(out, debut);
        if (fin > 0) {
          out = out.slice(0, debut) + '<RepondreDemande action={action} />' + out.slice(fin);
          n += 1;
        }
      }
    }
    // Barre du bas (téléphone) + après résolution posé avant elle.
    {
      const pied = '<div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><div style={{ flex: "1", height: "44px"';
      const i = out.indexOf(pied);
      if (i >= 0) {
        const fin = finElement(out, i);
        const corpsFerme = out.lastIndexOf('</div>', i);
        out =
          out.slice(0, corpsFerme) +
          '<ApresResolution action={action} />' +
          out.slice(corpsFerme, i) +
          '<BarreReponse action={action} />' +
          out.slice(fin);
        n += 1;
      }
    }
    return { jsx: out, applied: n > 0 };
  },
};

/**
 * ── 4. H06 · LA FICHE D'UN PARRAIN ──────────────────────────────────────────
 *
 * Les quatre pastilles « Études · Logement · Français · Fon » étaient écrites en dur
 * pour tous les parrains : elles deviennent les types de parcours que CE parrain
 * connaît (la rangée disparaît s'il n'en a déclaré aucun). « Demander comme
 * parrain » ouvre la feuille de demande.
 */
const H06_FICHE = {
  screens: ['H06'],
  nom: 'H06_FICHE',
  why: 'H06 : les types de parcours du parrain remplacent les pastilles en dur, et « Demander comme parrain » ouvre la feuille de demande (`POST /mentorships`).',
  provides: ['parrain'],
  apply(jsx) {
    let out = jsx;
    let n = 0;
    const premier = out.indexOf('>Études</span>');
    if (premier >= 0) {
      const span = out.lastIndexOf('<span style={{', premier);
      const style = /style=\{\{ ([^}]*) \}\}/.exec(out.slice(span, premier + 1))[1];
      const conteneur = out.lastIndexOf('<div style={{', span);
      const fin = finElement(out, conteneur);
      const ouvre = out.slice(conteneur, out.indexOf('>', conteneur) + 1);
      if (fin > 0) {
        out =
          out.slice(0, conteneur) +
          `{parrain.types.length > 0 ? (${ouvre}{parrain.types.map((t) => (<span key={t} style={{ ${style} }}>{t}</span>))}</div>) : null}` +
          out.slice(fin);
        n += 1;
      }
    }
    const debut = out.lastIndexOf('<button', out.indexOf('Demander comme'));
    if (debut >= 0) {
      const fin = finElement(out, debut);
      const ms = /style=\{\{ ([^}]*) \}\}/.exec(out.slice(debut, out.indexOf('>', debut) + 1));
      if (fin > 0 && ms !== null) {
        out =
          out.slice(0, debut) +
          `<BoutonDemander handle={parrain.handle} nom={parrain.nom} complet={parrain.complet} libelle={\`Demander comme \${parrain.appellation}\`} style={{ ${ms[1]} }} />` +
          out.slice(fin);
        n += 1;
      }
    }
    return { jsx: out, applied: n > 0 };
  },
};

/**
 * ── 5. H05, H07, H08, H09, H10 · LES LISTES ET FORMULAIRES SE CHARGENT EUX-MÊMES ──
 *
 * Ces cinq planches dessinent leurs cartes, leurs filtres et leur formulaire comme
 * une image : trois parrains écrits en dur, trois parrainages, des demandes « Un lit
 * et une table… » servies à tout le monde. On ne les recoud pas carte par carte
 * (une carte oubliée ne se voit pas) : la région sous l'en-tête de la colonne
 * centrale (ordinateur) ou le dernier bloc du `<main>` (téléphone) est REMPLACÉE par
 * un composant qui reprend le dessin et branche l'API. L'en-tête, le rail, le
 * panneau, la colonne de droite et la barre basse restent ceux de la maquette.
 */
function regionPrincipale(jsx, comp) {
  const main = jsx.indexOf('<main');
  // Le cadre du TÉLÉPHONE n'a pas encore son `<main>` au moment des adaptations
  // (le générateur le pose après) : ses blocs sont alors des frères à la racine.
  const mobile = main < 0;
  const ouvreFin = mobile ? 0 : jsx.indexOf('>', main) + 1;
  // Les enfants directs, dans l'ordre, jusqu'à `</main>` (ou la fin du fragment).
  const enfants = [];
  let curseur = ouvreFin;
  for (;;) {
    const debut = jsx.indexOf('<', curseur);
    if (debut < 0 || jsx.startsWith('</', debut)) {
      if (debut < 0 && !mobile) return null;
      break;
    }
    const fin = finElement(jsx, debut);
    if (fin < 0) return null;
    enfants.push([debut, fin]);
    curseur = fin;
  }
  const fermeture = curseur;
  if (enfants.length < 2) return null;
  if (mobile) {
    // Le corps est le dernier enfant qui GRANDIT (`flexGrow: "1"`) : la barre basse
    // qui suit n'est pas la région à remplacer.
    const corps = enfants.filter(([d]) => jsx.slice(d, jsx.indexOf('>', d)).includes('flexGrow: "1"'));
    if (corps.length === 0) return null;
    const [d, f] = corps[corps.length - 1];
    // Le conteneur garde le dessin du corps de la planche (retrait 12/16 px, colonne,
    // écart 12) : sans lui, les cartes toucheraient les bords de l'écran.
    const corpsDessine = jsx.slice(d, jsx.indexOf('>', d) + 1);
    const padding = /padding: "([^"]*)"/.exec(corpsDessine)?.[1] ?? '12px 16px';
    return (
      jsx.slice(0, d) +
      `<div style={{ flexGrow: "1", padding: "${padding}", display: "flex", flexDirection: "column", gap: "12px", minWidth: "0" }}><${comp} variante="mobile" /></div>` +
      jsx.slice(f)
    );
  }
  const [, f] = enfants[0];
  return jsx.slice(0, f) + `<${comp} variante="bureau" />` + jsx.slice(fermeture);
}

const regionVivante = (screen, comp, why) => ({
  screens: [screen],
  nom: `${screen}_REGION`,
  why,
  provides: [],
  apply(jsx) {
    const out = regionPrincipale(jsx, comp);
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
});

const H05_LISTE = regionVivante('H05', 'ListeParrains', 'H05 : la liste des parrains et ses filtres (ville, langue, parcours, pays) lisent `GET /mentors` au lieu de trois parrains écrits en dur.');
const H07_LISTE = regionVivante('H07', 'MesParrainagesVivants', 'H07 : mes parrainages par état (en cours, terminés, demandes en attente reçues et envoyées), avec accepter, refuser, terminer, prolonger, évaluer.');
const H08_FORMULAIRE = regionVivante('H08', 'FormulaireParrain', 'H08 : le diagnostic des trois conditions et le formulaire réel du profil de parrain (`GET`, `PUT`, `DELETE /me/mentor-profile`).');
const H09_LISTE = regionVivante('H09', 'MesDemandes', 'H09 : mes demandes (`GET /help/mine`) avec voir, modifier, clôturer, rouvrir, supprimer.');
const H10_LISTE = regionVivante('H10', 'MesReponses', 'H10 : mes réponses (`GET /help/my-responses`) avec voir, écrire à, modifier, supprimer.');

/**
 * Les boutons dessinés `<button>` dont le seul geste est d'ALLER quelque part
 * deviennent des liens (clic droit, nouvel onglet, lecteur d'écran : ce sont des
 * liens) : « Publier une demande » (H01, H09 → le composeur) et « Voir les
 * conditions » (H05 → « Devenir parrain »).
 */
const boutonEnLien = (screens, nom, texte, vers) => ({
  screens,
  nom,
  why: `Le bouton « ${texte} » mène à ${vers} : il était dessiné sans geste.`,
  provides: [],
  apply(jsx) {
    const marque = `${texte}</button>`;
    const fin = jsx.indexOf(marque);
    if (fin < 0) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<button', fin);
    const finOuvre = jsx.indexOf('>', debut) + 1;
    const ouvre = jsx.slice(debut, finOuvre).replace('<button style={{', `<a href="${vers}" style={{ textDecoration: "none", `);
    return {
      jsx: jsx.slice(0, debut) + ouvre + jsx.slice(finOuvre, fin) + texte + '</a>' + jsx.slice(fin + marque.length),
      applied: true,
    };
  },
});
const H01_PUBLIER = boutonEnLien(['H01', 'H09'], 'H_PUBLIER', 'Publier une demande', '/entraide/nouveau');
const H05_CONDITIONS = boutonEnLien(['H05'], 'H05_CONDITIONS', 'Voir les conditions', '/parrainage/devenir');

/** H03 (ordinateur) : l'encart « OFFRE · NIVEAU L0 » ne s'affiche qu'à qui ne peut pas encore proposer. */
const H03_ENCART = {
  screens: ['H03'],
  nom: 'H03_ENCART',
  why: 'H03 : l’encart « OFFRE · NIVEAU L0 » suit le niveau réel (`help.offer`) et son bouton mène à la vérification d’identité.',
  provides: [],
  apply(jsx) {
    const lib = jsx.indexOf('OFFRE · NIVEAU L0');
    if (lib < 0) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px"', lib);
    const fin = debut < 0 ? -1 : finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    return { jsx: jsx.slice(0, debut) + '<EncartOffre />' + jsx.slice(fin), applied: true };
  },
};

/** H01, H04 : les trois suggestions de la colonne de droite lisent `GET /help/can-help`. */
const H_ENCART_AIDER = {
  screens: ['H01', 'H04'],
  nom: 'H_ENCART_AIDER',
  why: 'H01 et H04 : l’encart « VOUS POUVEZ AIDER · N » de la colonne de droite montre les vraies suggestions (`GET /help/can-help`), pas trois demandes écrites en dur.',
  provides: ['compteurs'],
  apply(jsx) {
    const lib = jsx.indexOf('VOUS POUVEZ AIDER · 4');
    if (lib < 0) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px"', lib);
    const fin = debut < 0 ? -1 : finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    return { jsx: jsx.slice(0, debut) + '<EncartAider nombre={compteurs.pouvezAider} />' + jsx.slice(fin), applied: true };
  },
};

/** H09 : le BILAN de la colonne de droite compte mes demandes, il n'écrit pas « 4 » et « 2 ». */
const H09_BILAN = {
  screens: ['H09'],
  nom: 'H09_BILAN',
  why: 'H09 : le BILAN (« 4 demandes publiées · 2 résolues ») compte mes demandes réelles.',
  provides: ['mesDemandes'],
  apply(jsx) {
    const lib = jsx.indexOf('>BILAN</div>');
    if (lib < 0) return { jsx, applied: false };
    const style = '"-0.6px", color: "#16211D" }}>';
    let out = jsx;
    const a = out.indexOf(style + '4</div>', lib);
    const b = out.indexOf(style + '2</div>', lib);
    if (a < 0 || b < 0) return { jsx, applied: false };
    out = out.replace(style + '4</div>', style + '{mesDemandes.total}</div>').replace(style + '2</div>', style + '{mesDemandes.resolues}</div>');
    return { jsx: out, applied: true };
  },
};

/** H01, H04 : le signet de chaque carte enregistre la demande (§2.9 des enregistrés). */
const H_SIGNET = {
  screens: ['H01', 'H04'],
  nom: 'H_SIGNET',
  why: 'H01 et H04 : l’icône de signet de chaque carte enregistre la demande (`PUT /me/bookmarks`) au lieu d’être un dessin sans geste.',
  provides: [],
  apply(jsx) {
    const motif = /<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1\.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" \/><\/svg>/g;
    let n = 0;
    const out = jsx.replace(motif, () => {
      n += 1;
      // La ligne de la boucle s'appelle `d` (fil) ou `s` (suggestions) ; elle porte `href`.
      return `<Signet href={${jsx.includes('(suggestions ?? [])') ? 's' : 'd'}.href} />`;
    });
    return { jsx: out, applied: n > 0 };
  },
};

/** H04 : « Échéance » et « Récentes » trient vraiment la liste. */
const H04_TRI = {
  screens: ['H04'],
  nom: 'H04_TRI',
  why: 'H04 : les pastilles de tri « Échéance » / « Récentes » reclassent la liste au lieu d’être deux `<span>` sans geste.',
  provides: ['tris'],
  apply(jsx) {
    const m = />Échéance<\/span>/.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const span = jsx.lastIndexOf('<span style={{', m.index);
    const conteneur = jsx.lastIndexOf('<div style={{', span);
    const fin = finElement(jsx, conteneur);
    if (fin < 0) return { jsx, applied: false };
    const ouvre = jsx.slice(conteneur, jsx.indexOf('>', conteneur) + 1);
    const neuf =
      `{(tris ?? []).length > 0 ? (${ouvre}{(tris ?? []).map((t) => (<button type="button" key={t.cle} onClick={t.onChoisir} aria-pressed={t.actif} ` +
      'style={{ font: "inherit", padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", cursor: "pointer", backgroundColor: t.fond, color: t.texte, border: `1px solid ${t.bord}` }}>{t.libelle}</button>))}</div>) : null}';
    return { jsx: jsx.slice(0, conteneur) + neuf + jsx.slice(fin), applied: true };
  },
};

/** H08 (téléphone) : le « Activer » de la barre du bas doublait le bouton du formulaire. */
const H08_PIED = {
  screens: ['H08'],
  nom: 'H08_PIED',
  why: 'H08 (390 px) : la barre « Activer » du bas était un bouton sans geste ; le formulaire porte son propre bouton « Activer mon profil de parrain ».',
  provides: [],
  apply(jsx) {
    const pied = '<div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><button';
    const i = jsx.indexOf(pied);
    if (i < 0) return { jsx, applied: false };
    const fin = finElement(jsx, i);
    return fin < 0 ? { jsx, applied: false } : { jsx: jsx.slice(0, i) + jsx.slice(fin), applied: true };
  },
};

export const ADAPTATIONS_ENTRAIDE_VIVANT = [
  SIGNALER,
  SIGNALER_H02,
  SIGNALER_H06,
  H03_FORMULAIRE,
  H02_GESTES,
  H06_FICHE,
  H01_PUBLIER,
  H03_ENCART,
  H04_TRI,
  H_SIGNET,
  H_ENCART_AIDER,
  H09_BILAN,
  H05_CONDITIONS,
  H08_PIED,
  H05_LISTE,
  H07_LISTE,
  H08_FORMULAIRE,
  H09_LISTE,
  H10_LISTE,
];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_ENTRAIDE_VIVANT = {
  SignalerArgent: '@/components/entraide/signaler-argent',
  FormulaireDemande: '@/components/entraide/formulaire-demande',
  EncartOffre: '@/components/entraide/encart-offre',
  EncartAider: '@/components/entraide/encart-aider',
  Signet: '@/components/entraide/signet',
  EnteteDemande: '@/components/entraide/demande-vivante',
  MenuDemande: '@/components/entraide/demande-vivante',
  ActionsAuteur: '@/components/entraide/demande-vivante',
  ActionsReponse: '@/components/entraide/demande-vivante',
  ApresResolution: '@/components/entraide/demande-vivante',
  RepondreDemande: '@/components/entraide/demande-vivante',
  BarreReponse: '@/components/entraide/demande-vivante',
  BoutonDemander: '@/components/entraide/parrainage-vivant',
  ListeParrains: '@/components/entraide/parrainage-vivant',
  MesParrainagesVivants: '@/components/entraide/parrainage-vivant',
  FormulaireParrain: '@/components/entraide/parrainage-vivant',
  MesDemandes: '@/components/entraide/listes-entraide',
  MesReponses: '@/components/entraide/listes-entraide',
};
