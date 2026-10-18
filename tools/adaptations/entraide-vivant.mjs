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
const SIGNALER = {
  screens: TOUS_H,
  nom: 'H_SIGNALER',
  why: 'Le « Signaler » du bandeau anti-paiement (§2.7) ouvre la fenêtre de signalement (`POST /reports`) au lieu d’être un lien `href="#"` mort.',
  provides: ['signalement'],
  apply(jsx) {
    const motif = /<a href="#" style=\{\{ ([^}]*) \}\}>Signaler<\/a>/g;
    let compte = 0;
    const out = jsx.replace(motif, (_t, style) => {
      compte += 1;
      const sujet = /\bsignalement\b/.test(jsx.split('<a href="#"')[0] ?? '') ? '' : '';
      return `<SignalerArgent style={{ ${style} }}${sujet} />`;
    });
    return { jsx: out, applied: compte > 0 };
  },
};

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

export const ADAPTATIONS_ENTRAIDE_VIVANT = [SIGNALER, H03_FORMULAIRE];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_ENTRAIDE_VIVANT = {
  SignalerArgent: '@/components/entraide/signaler-argent',
  FormulaireDemande: '@/components/entraide/formulaire-demande',
};
