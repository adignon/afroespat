/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « TOUT GRATUIT » — LES INCITATIONS À PAYER DISPARAISSENT (lot A)       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « On va laisser les paiements. Tout sera gratuit pour le moment. »
 *
 * Tant que le réglage serveur `monetisation_active` est faux (`GET /me` →
 * `monetisationActive`), chaque cadre qui dessine une incitation à payer la masque :
 *
 *   · S01–S10 : la carte verte « MES QUOTAS DU MOIS » et son lien « Premium » ;
 *   · E01–E04 : « N sur X ce mois-ci » et la carte « QUOTA / Découvrir Premium » ;
 *   · J11 : « N parcours actif sur 1 avec le plan gratuit… passez à Premium » ;
 *   · J07 : « EXPORT PDF réservé à Premium / Découvrir Premium » (l'export n'existe
 *     pas côté serveur : l'offrir gratuitement serait un bouton sans geste) ;
 *   · K06 (`/premium`, `/compte/abonnement`) : le corps devient `PremiumGratuit`.
 *
 * Rien n'est SUPPRIMÉ du dessin : chaque bloc est enveloppé dans une condition,
 * et le rallumage du réglage le restitue tel que la maquette le dessine.
 * Appliquées après toutes les autres adaptations (leurs motifs lisent du JSX déjà
 * branché).
 */
import { finElement } from './reseau-vivant.mjs';

/**
 * Enveloppe, pour CHAQUE occurrence de `marque`, l'élément `<div style={{` situé
 * `remontees` ouvertures plus haut dans `{cond ? null : (…)}`. De la fin vers le
 * début, pour que les indices restent valides. `{ jsx, compte }`.
 */
function masquer(jsx, marque, remontees, masquerSi) {
  const positions = [];
  for (let i = jsx.indexOf(marque); i >= 0; i = jsx.indexOf(marque, i + marque.length)) {
    positions.push(i);
  }
  let sortie = jsx;
  let compte = 0;
  for (const pos of positions.reverse()) {
    let debut = pos;
    for (let k = 0; k < remontees; k += 1) {
      debut = sortie.lastIndexOf('<div style={{', k === 0 ? debut : debut - 1);
      if (debut < 0) break;
    }
    if (debut < 0) continue;
    const fin = finElement(sortie, debut);
    if (fin < 0) continue;
    // Déjà enveloppé (une occurrence interne d'une carte masquée) : on laisse.
    if (sortie.slice(Math.max(0, debut - 40), debut).includes(`${masquerSi} ? null : (`)) continue;
    sortie =
      sortie.slice(0, debut) +
      `{${masquerSi} ? null : (` +
      sortie.slice(debut, fin) +
      ')}' +
      sortie.slice(fin);
    compte += 1;
  }
  return { jsx: sortie, compte };
}

const SERIE = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'];

const GRATUIT_QUOTAS_SERVICES = {
  screens: SERIE,
  nom: 'GRATUIT_QUOTAS_SERVICES',
  why: 'La carte « MES QUOTAS DU MOIS » (et son lien Premium) n’a pas de sens quand tout est gratuit : elle disparaît tant que `monetisation_active` est faux.',
  provides: ['quotas'],
  apply(jsx) {
    const r = masquer(jsx, '>MES QUOTAS DU MOIS</div>', 2, 'quotas.gratuit');
    return { jsx: r.jsx, applied: r.compte > 0 };
  },
};

const GRATUIT_QUOTA_AGENDA = {
  screens: ['E01', 'E02', 'E03', 'E04'],
  nom: 'GRATUIT_QUOTA_AGENDA',
  why: 'Le compteur « N sur X ce mois-ci » et la carte « QUOTA / Découvrir Premium » disparaissent quand tout est gratuit.',
  provides: ['panneau'],
  apply(jsx) {
    let sortie = jsx;
    let compte = 0;
    for (const [marque, n] of [
      ['>QUOTA</div>', 2],
      ['{panneau.quota.utilise} sur {panneau.quota.plafond} ce mois-ci', 1],
      ['{panneau.quota.utilise} événement sur {panneau.quota.plafond} ce mois-ci', 1],
    ]) {
      const r = masquer(sortie, marque, n, 'panneau.quota.gratuit');
      sortie = r.jsx;
      compte += r.compte;
    }
    return { jsx: sortie, applied: compte > 0 };
  },
};

const GRATUIT_PLAN_PARCOURS = {
  screens: ['J11'],
  nom: 'GRATUIT_PLAN_PARCOURS',
  why: '« N parcours actif sur 1 avec le plan gratuit » (et « passez à Premium ») n’a pas de sens quand il n’y a plus de plafond.',
  provides: ['plan'],
  apply(jsx) {
    const r = masquer(jsx, '<strong>{plan.actifs} parcours actif sur {plan.limite}</strong>', 1, 'plan.gratuit');
    return { jsx: r.jsx, applied: r.compte > 0 };
  },
};

const GRATUIT_EXPORT = {
  screens: ['J07'],
  nom: 'GRATUIT_EXPORT',
  why: '« Export PDF réservé à Premium / Découvrir Premium » disparaît quand tout est gratuit (l’export n’existe pas côté serveur : un bouton « Exporter » serait sans geste).',
  provides: ['gratuit'],
  apply(jsx) {
    let sortie = jsx;
    let compte = 0;
    for (const [marque, n] of [
      ['>EXPORT PDF</div>', 2],
      ['>Export PDF réservé à Premium.</span>', 1],
    ]) {
      const r = masquer(sortie, marque, n, 'gratuit');
      sortie = r.jsx;
      compte += r.compte;
    }
    return { jsx: sortie, applied: compte > 0 };
  },
};

/**
 * K06 — LE CORPS DEVIENT `PremiumGratuit` quand tout est gratuit.
 *
 * Ordinateur : le rail et la barre haute restent ; dans `<main>`, le titre reste
 * et tout ce qui le suit (plan, comparatif, « Passer à Premium ») est remplacé ;
 * la colonne FACTURES reste seulement s'il existe une facture à retrouver.
 * Téléphone : le titre « Premium » reste, sa carte et son comparatif sont remplacés.
 */
const K06_GRATUIT = {
  screens: ['K06'],
  nom: 'K06_GRATUIT',
  why: 'Tant que tout est gratuit, K06 (`/premium`, `/compte/abonnement`) dit sobrement que tout est gratuit : aucun prix, aucun bouton de paiement.',
  provides: ['gratuit', 'factures'],
  apply(jsx) {
    if (jsx.includes('<PremiumGratuit')) return { jsx, applied: false };

    // Ordinateur : `<main>` porte le titre « Abonnement et Premium » (un <div> à ce
    // stade : la promotion en <h1> vient après) puis les cartes ; `<aside>` suit.
    const titreBureau = '>Abonnement et Premium</div></div></div>';
    const t = jsx.indexOf(titreBureau);
    if (t >= 0) {
      const main = jsx.lastIndexOf('<main', t);
      const fermeMain = main < 0 ? -1 : finElement(jsx, main);
      if (fermeMain < 0) return { jsx, applied: false };
      const debutCorps = t + titreBureau.length;
      const interieurFin = fermeMain - '</main>'.length;
      let sortie =
        jsx.slice(0, debutCorps) +
        `{gratuit ? (<PremiumGratuit />) : (<>${jsx.slice(debutCorps, interieurFin)}</>)}` +
        jsx.slice(interieurFin);
      const aside = sortie.indexOf('<aside', debutCorps);
      const finAside = aside < 0 ? -1 : finElement(sortie, aside);
      if (finAside < 0) return { jsx, applied: false };
      sortie =
        sortie.slice(0, aside) +
        '{gratuit && factures.derniere === "Aucune facture" ? null : (' +
        sortie.slice(aside, finAside) +
        ')}' +
        sortie.slice(finAside);
      return { jsx: sortie, applied: true };
    }

    // Téléphone : titre « Premium » dans un <span>, puis le contenu défilant.
    const titreMobile = '>Premium</span></div>';
    const m = jsx.indexOf(titreMobile);
    if (m >= 0 && jsx.slice(m + titreMobile.length).startsWith('<div style={{ flexGrow')) {
      const debutCorps = m + titreMobile.length;
      let fin = finElement(jsx, debutCorps);
      if (fin < 0) return { jsx, applied: false };
      // La barre collante du bas (« Passer à Premium ») suit le contenu : elle
      // part avec lui, sans quoi le bouton de paiement resterait seul à l'écran.
      const barre = '<div style={{ flexShrink: "0", background: "#fff", borderTop';
      if (jsx.slice(fin).startsWith(barre)) {
        const finBarre = finElement(jsx, fin);
        if (finBarre > 0) fin = finBarre;
      }
      return {
        jsx:
          jsx.slice(0, debutCorps) +
          `{gratuit ? (<PremiumGratuit />) : (<>${jsx.slice(debutCorps, fin)}</>)}` +
          jsx.slice(fin),
        applied: true,
      };
    }
    return { jsx, applied: false };
  },
};


/**
 * S08 — LES PALIERS PAYANTS DE « MA FICHE PRO » DEVIENNENT « INCLUSE ».
 *
 * Ordinateur : la grille « Gratuite 0 € / Pro 9 €/mois / Pro+ 19 €/mois » ; téléphone :
 * la carte « Pro » et son prix. Quand tout est gratuit, `FicheProIncluse` les remplace ;
 * le dessin des paliers reste dans la condition pour le jour du rallumage.
 */
const S08_GRATUIT = {
  screens: ['S08'],
  nom: 'S08_GRATUIT',
  why: 'Les paliers payants (Pro 9 €/mois, Pro+ 19 €/mois) de « Ma fiche pro » n’ont pas de sens quand tout est gratuit : une carte « incluse » les remplace tant que `monetisation_active` est faux.',
  provides: ['quotas'],
  apply(jsx) {
    if (jsx.includes('<FicheProIncluse')) return { jsx, applied: false };
    let debut = jsx.indexOf('<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)"');
    if (debut < 0 || !jsx.slice(debut).includes('>Gratuite</div>')) {
      const nom = jsx.indexOf('>{offrePro.nom}</div>');
      debut = nom < 0 ? -1 : jsx.lastIndexOf('<div style={{ padding: "16px", borderRadius: "18px"', nom);
    }
    if (debut < 0) return { jsx, applied: false };
    const fin = finElement(jsx, debut);
    if (fin < 0) return { jsx, applied: false };
    return {
      jsx:
        jsx.slice(0, debut) +
        `{quotas.gratuit ? (<FicheProIncluse />) : (${jsx.slice(debut, fin)})}` +
        jsx.slice(fin),
      applied: true,
    };
  },
};

export const ADAPTATIONS_GRATUIT_VIVANT = [
  GRATUIT_QUOTAS_SERVICES,
  S08_GRATUIT,
  GRATUIT_QUOTA_AGENDA,
  GRATUIT_PLAN_PARCOURS,
  GRATUIT_EXPORT,
  K06_GRATUIT,
];

/** Le composant que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_GRATUIT_VIVANT = {
  PremiumGratuit: '@/components/premium-gratuit',
  FicheProIncluse: '@/components/services/fiche-pro-incluse',
};
