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

export const ADAPTATIONS_ENTRAIDE_VIVANT = [SIGNALER, SIGNALER_H02, SIGNALER_H06, H03_FORMULAIRE, H02_GESTES, H06_FICHE];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_ENTRAIDE_VIVANT = {
  SignalerArgent: '@/components/entraide/signaler-argent',
  FormulaireDemande: '@/components/entraide/formulaire-demande',
  EnteteDemande: '@/components/entraide/demande-vivante',
  MenuDemande: '@/components/entraide/demande-vivante',
  ActionsAuteur: '@/components/entraide/demande-vivante',
  ActionsReponse: '@/components/entraide/demande-vivante',
  ApresResolution: '@/components/entraide/demande-vivante',
  RepondreDemande: '@/components/entraide/demande-vivante',
  BarreReponse: '@/components/entraide/demande-vivante',
  BoutonDemander: '@/components/entraide/parrainage-vivant',
};
