/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT G — « FIL VIVANT » : A02 (UNE PUBLICATION), ET LE RESTE DU FIL         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * A02 écrivait EN DUR la publication qu'elle montre — « Fatou Ndiaye », « Parcours
 * Santé · Lyon 7e · il y a 6 h », « 11 réponses · 4 soutiens » — et un compositeur
 * qui n'était pas un champ (« Écrire une réponse… » est un `<div>`, « Envoyer » un
 * bouton sans geste), un « Répondre » en `href="#"`, « GUIDES LIÉS · 3 » et « Lier
 * un guide » inertes, un « Choisir un réseau » qui ne choisit rien.
 *
 * Les pièces cédent la place à `PublicationVivante` et `GuidesLiesPublication`
 * (`apps/web/src/components/publication-vivante.tsx`, AJOUT autorisé par le
 * porteur), qui reprennent les valeurs EXACTES de la planche et lisent
 * `GET /posts/:id`. Le fournisseur (`PublicationProvider`) est posé par la page.
 *
 * ── CE QUE LES ADAPTATIONS COUPENT, ET COMMENT ───────────────────────────────
 *
 * Toujours en COMPTANT les balises (`finElement`, piège 3), jamais en cherchant un
 * `</div>` ; et jamais sur une mesure (piège 1) : les ancres sont des balises et des
 * textes que la planche écrit sur les deux cadres.
 */
import { finElement } from './reseau-vivant.mjs';

/** Le rond de retour du cadre mobile, dessiné en `<span>` : un lien vers le fil. */
const RETOUR_MOBILE =
  /<span style=\{\{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center" \}\}>(<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" \/><\/svg>)<\/span>/;

const A02_DESKTOP = {
  screens: ['A02'],
  nom: 'A02_PUBLICATION_VIVANTE_DESKTOP',
  why: 'L’article, la liste des réponses et le compositeur de A02 deviennent `PublicationVivante` : la vraie publication (`GET /posts/:id`), de vrais champs et gestes (répondre, modifier, supprimer, réagir, enregistrer, déplacer vers un réseau) — la planche les écrivait en dur.',
  provides: [],
  apply(jsx) {
    const debut = jsx.indexOf('<article style={{ background: "#fff"');
    if (debut < 0) return { jsx, applied: false };
    // Le compositeur est le DERNIER enfant du <main> : un <div> en absolu, en bas.
    const compo = jsx.indexOf('<div style={{ position: "absolute", left: "0", right: "0", bottom: "0"', debut);
    if (compo < 0) return { jsx, applied: false };
    const finCompo = finElement(jsx, compo);
    if (finCompo < 0) return { jsx, applied: false };
    return {
      jsx: jsx.slice(0, debut) + '<PublicationVivante largeur="desktop" />' + jsx.slice(finCompo),
      applied: true,
    };
  },
};

const A02_GUIDES = {
  screens: ['A02'],
  nom: 'A02_GUIDES_LIES_VIVANTS',
  why: 'La carte « GUIDES LIÉS · 3 » lit les guides réellement liés à la publication ; « Lier un guide » ouvre la fenêtre A01G du composeur et enregistre par `PATCH /posts/:id`.',
  provides: [],
  apply(jsx) {
    const marque = jsx.indexOf('GUIDES LIÉS · 3');
    if (marque < 0) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<div style={{ background: "#fff"', marque);
    if (debut < 0) return { jsx, applied: false };
    const fin = finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    return {
      jsx: jsx.slice(0, debut) + '<GuidesLiesPublication largeur="desktop" />' + jsx.slice(fin),
      applied: true,
    };
  },
};

const A02_MOBILE = {
  screens: ['A02'],
  nom: 'A02_PUBLICATION_VIVANTE_MOBILE',
  why: 'La carte, les réponses et la barre de saisie de A02 mobile deviennent `PublicationVivante` : la vraie publication, répondre, modifier/supprimer ses commentaires, guides liés — la planche ne dessinait ni « Répondre », ni les guides, ni un champ de saisie.',
  provides: [],
  apply(jsx) {
    // Le corps : le <div> défilant qui suit l'en-tête, jusqu'à la barre de saisie.
    const corps = jsx.indexOf('<div style={{ flex: "1", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}>');
    if (corps < 0) return { jsx, applied: false };
    const finCorps = finElement(jsx, corps);
    if (finCorps < 0) return { jsx, applied: false };
    const barre = jsx.indexOf('<div style={{ padding: "10px 12px 28px", background: "#fff", borderTop: "1px solid #E6EBE9"', finCorps);
    if (barre < 0) return { jsx, applied: false };
    const finBarre = finElement(jsx, barre);
    if (finBarre < 0) return { jsx, applied: false };
    let out = jsx.slice(0, corps) + '<PublicationVivante largeur="mobile" />' + jsx.slice(finBarre);
    // Le titre de l'en-tête dit le TYPE de la publication, et le rond retour est un lien.
    out = out.replace(RETOUR_MOBILE, (_m, svg) => {
      const style = 'width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center"';
      return `<Link href="/accueil" aria-label="Retour au fil" style={{ ${style} }}>${svg}</Link>`;
    });
    out = out.replace('>Question</span></div>', '><TitrePublication /></span></div>');
    return { jsx: out, applied: true };
  },
};


/**
 * ── A01 : L'ENTRÉE DE L'HISTORIQUE « MES STORIES » ───────────────────────────
 *
 * `GET /me/stories` (historique de 30 jours, 04 §2.6) n'était appelée par aucun
 * écran. La page `/stories/mes-stories` la lit ; ce lien, posé à côté des filtres
 * du ruban (ordinateur) ou du libellé « STORIES DU JOUR » (téléphone), y mène. Il
 * reprend le dessin des puces de filtre voisines, en version neutre.
 */
const PUCE_MES_STORIES =
  'height: "32px", padding: "0 12px", borderRadius: "999px", border: "1px solid #E6EBE9", background: "#fff", color: "#5D6B66", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", textDecoration: "none"';

const A01_MES_STORIES = {
  screens: ['A01'],
  nom: 'A01_MES_STORIES',
  why: 'Un lien « Mes stories » mène à l’historique de 30 jours (`GET /me/stories`), que la maquette ne dessine pas et qu’aucun écran n’employait.',
  provides: [],
  apply(jsx) {
    const desktop = 'STORIES DU JOUR</span><div style={{ display: "flex", gap: "6px" }}>';
    const i = jsx.indexOf(desktop);
    if (i >= 0) {
      const lien = `<Link href="/stories/mes-stories" style={{ ${PUCE_MES_STORIES} }}>Mes stories</Link>`;
      return { jsx: jsx.slice(0, i + desktop.length) + lien + jsx.slice(i + desktop.length), applied: true };
    }
    const m = /<div style=\{\{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginBottom: "10px" \}\}>STORIES DU JOUR<\/div>/.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const neuf =
      '<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "10px" }}>' +
      '<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>STORIES DU JOUR</span>' +
      `<Link href="/stories/mes-stories" style={{ ${PUCE_MES_STORIES} }}>Mes stories</Link></div>`;
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

/** L'indice qui suit l'accolade fermante qui ferme celle ouverte à `debut` ; `-1` sinon. */
function finAccolade(jsx, debut) {
  let profondeur = 0;
  for (let i = debut; i < jsx.length; i += 1) {
    const c = jsx[i];
    if (c === '{') profondeur += 1;
    else if (c === '}') {
      profondeur -= 1;
      if (profondeur === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * ── LES BORNES DE SAISIE : `maxLength` SUR LE COMPOSEUR ET LES COMMENTAIRES ───
 *
 * Le composeur du fil (A01, A01N) et le champ de commentaire (A01C) acceptaient un
 * texte sans limite, que le serveur refusait ensuite avec un `400`. Les bornes sont
 * celles de `FEED_LIMITS` (@app/shared), jamais recopiées : le front PRÉVIENT, le
 * serveur décide.
 */
const A01_LIMITES = {
  screens: ['A01', 'A01N', 'A01C'],
  nom: 'A01_LIMITES_SAISIE',
  why: 'Le composeur et le champ de commentaire portent `maxLength` (les bornes de `FEED_LIMITS`) : le texte ne dépasse plus ce que le serveur accepte.',
  provides: [],
  apply(jsx) {
    let out = jsx;
    let n = 0;
    if (out.includes('data-composeur-texte="" ') && !out.includes('maxLength={FEED_LIMITS.postBodyMax}')) {
      out = out.replace('data-composeur-texte="" ', 'data-composeur-texte="" maxLength={FEED_LIMITS.postBodyMax} ');
      n += 1;
    }
    if (out.includes('data-commentaire-texte="" ') && !out.includes('maxLength={FEED_LIMITS.commentBodyMax}')) {
      out = out.replace('data-commentaire-texte="" ', 'data-commentaire-texte="" maxLength={FEED_LIMITS.commentBodyMax} ');
      n += 1;
    }
    return n === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * ── A01 : LES ÉTATS DU FIL — CHARGEMENT, ERREUR, VIDE ────────────────────────
 *
 * La planche dessine des publications et rien d'autre : un fil qui charge, qui a
 * échoué ou qui est vide restait une colonne blanche sous le composeur. La phrase
 * est posée à la place des cartes, dans le style de `EtatVide` (gris, 13 px).
 */
const A01_FIL_ETATS = {
  screens: ['A01'],
  nom: 'A01_FIL_ETATS',
  why: 'Un fil qui charge, qui a échoué ou qui est vide dit ce qu’il en est au lieu de rester une colonne blanche.',
  provides: ['filEtat'],
  apply(jsx) {
    const debut = jsx.indexOf('{(feedPosts ?? []).map(');
    if (debut < 0) return { jsx, applied: false };
    const fin = finAccolade(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    const etats =
      '{filEtat.chargement ? (<EtatVide texte="Chargement du fil…" />) : filEtat.echec !== null ? (<EtatVide texte={filEtat.echec} />) : (feedPosts ?? []).length === 0 ? (<EtatVide texte={filEtat.vide} />) : null}';
    return { jsx: jsx.slice(0, fin) + etats + jsx.slice(fin), applied: true };
  },
};

/**
 * ── A06 : LES PROPOSITIONS, EN NOMBRE RÉEL, AVEC LEUR VRAI DIFF ──────────────
 *
 * La planche dessine deux emplacements fixes (une carte dépliée, une repliée) dont
 * le « AVANT / APRÈS » et le nom de section sont écrits en dur, et trois onglets
 * inertes. Les onglets et la liste deviennent `OngletsPropositions` et
 * `ListePropositions` (`components/propositions-recues.tsx`, AJOUT) : zéro, une ou
 * dix cartes, le diff mot à mot, un état vide par onglet. Le fournisseur est posé
 * par la page. Seuls les cadres « Propositions reçues » (`Desktop`, `Mobile`) sont
 * concernés — les cadres Corriger et Signalements n'ont pas ces blocs.
 */
const A06_ONGLETS = {
  screens: ['A06'],
  nom: 'A06_PROPOSITIONS_VIVANTES_ONGLETS',
  why: 'Les trois onglets de A06 deviennent de vrais onglets (En attente, Acceptées, Refusées) — la planche les dessinait inertes, avec « Refusées · 1 » en dur.',
  provides: [],
  apply(jsx) {
    // Ordinateur : un bandeau gris `#EEF2F0` ; téléphone : une rangée de puces sous le titre.
    const d = jsx.indexOf('<div style={{ display: "flex", gap: "4px", background: "#EEF2F0"');
    if (d >= 0) {
      const f = finElement(jsx, d);
      if (f < 0) return { jsx, applied: false };
      return { jsx: jsx.slice(0, d) + '<OngletsPropositions largeur="desktop" />' + jsx.slice(f), applied: true };
    }
    const m = jsx.indexOf('<div style={{ display: "flex", gap: "6px", marginTop: "12px" }}><span style={{ padding: "8px 13px"');
    if (m < 0) return { jsx, applied: false };
    const f = finElement(jsx, m);
    if (f < 0) return { jsx, applied: false };
    return { jsx: jsx.slice(0, m) + '<OngletsPropositions largeur="mobile" />' + jsx.slice(f), applied: true };
  },
};

const A06_LISTE = {
  screens: ['A06'],
  nom: 'A06_PROPOSITIONS_VIVANTES_LISTE',
  why: 'Les deux emplacements fixes de A06 deviennent `ListePropositions` : autant de cartes que de propositions, avec le diff réel — la planche en dessinait deux, et leur texte était écrit en dur.',
  provides: [],
  apply(jsx) {
    // Ordinateur : deux cartes sœurs, la première commence par la pastille de la proposition dépliée.
    const marque = jsx.indexOf('background: propositionDepliee.bg');
    const debut1 =
      marque < 0
        ? -1
        : jsx.lastIndexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "20px" }}>', marque);
    if (debut1 >= 0) {
      const fin1 = finElement(jsx, debut1);
      const reste = jsx.indexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "20px" }}>', fin1);
      if (fin1 < 0 || reste < 0) return { jsx, applied: false };
      const fin2 = finElement(jsx, reste);
      if (fin2 < 0) return { jsx, applied: false };
      return { jsx: jsx.slice(0, debut1) + '<ListePropositions largeur="desktop" />' + jsx.slice(fin2), applied: true };
    }
    // Téléphone : le conteneur défilant des deux cartes.
    const c = jsx.indexOf('<div style={{ flex: "1", padding: "14px 16px", overflow: "hidden", display: "flex", flexDirection: "column", gap: "12px" }}>');
    if (c < 0) return { jsx, applied: false };
    const f = finElement(jsx, c);
    if (f < 0) return { jsx, applied: false };
    return { jsx: jsx.slice(0, c) + '<ListePropositions largeur="mobile" />' + jsx.slice(f), applied: true };
  },
};

export const ADAPTATIONS_FIL_VIVANT = [A02_DESKTOP, A02_GUIDES, A02_MOBILE, A01_MES_STORIES, A01_LIMITES, A01_FIL_ETATS, A06_ONGLETS, A06_LISTE];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_FIL_VIVANT = {
  PublicationVivante: '@/components/publication-vivante',
  GuidesLiesPublication: '@/components/publication-vivante',
  TitrePublication: '@/components/publication-vivante',
  FEED_LIMITS: '@app/shared',
  OngletsPropositions: '@/components/propositions-recues',
  ListePropositions: '@/components/propositions-recues',
};
