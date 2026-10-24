/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT E2 — CE QUE LE LOT E AVAIT LAISSÉ : SERVICES S04 À S10                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le lot E a rendu vivants les gestes des écrans Services ; il restait, mesuré sur
 * les cadres générés :
 *
 *   · S04 : la bande « Offres | Profils disponibles | Mon profil de recherche » (et
 *     « Offres | Profils | Mon profil » à 390 px) était trois `<span>` ; « 8 offres à
 *     Lyon et en télétravail » était écrit en dur ;
 *   · S05 et S07 à 390 px : aucun « Signaler » (la planche mobile ne le dessine pas,
 *     le cadre d'ordinateur l'a) ;
 *   · S06 : la pastille « Lyon » était le nom d'une ville d'exemple, sans geste ;
 *   · les dix cadres d'ordinateur : « 12 », « 8 » et « 2 » du panneau de gauche
 *     (annonces, offres, « Mes annonces »), la pastille « PREMIUM » de « Mes alertes »,
 *     le bouton « Créer ma fiche pro » et la roue du rail, tous sans geste ;
 *   · S10 à 390 px : la carte « Réservé à Premium » s'affichait toujours, alors que le
 *     réglage serveur `monetisation_active` est faux (tout est gratuit).
 *
 * Appliquées APRÈS `services-vivant.mjs` (leurs motifs lisent du JSX déjà branché) et
 * avant « l'en-tête global ». Chaque adaptation est bornée par des marques propres au
 * cadre visé : une marque absente et elle ne fait rien, sans bruit.
 *
 * Les composants posés sont des AJOUTS marqués dans leur en-tête :
 * `components/services/profil-recherche.tsx`, `liste-profils-emploi.tsx`,
 * `filtre-ville-annuaire.tsx`.
 */
import { dedoublerStyles, finElement } from './reseau-vivant.mjs';
import { changerBalise, finAccolade } from './outils-lot-e.mjs';

const SERIE = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'];

/** Une adaptation bornée par des marques ; `fn` rend le JSX neuf ou `null`. */
function sur(nom, screens, marques, why, provides, fn) {
  return {
    screens,
    nom,
    why,
    provides,
    apply(jsx) {
      if (!marques.every((m) => jsx.includes(m))) return { jsx, applied: false };
      const r = fn(jsx);
      return r === null || r === jsx ? { jsx, applied: false } : { jsx: dedoublerStyles(r), applied: true };
    },
  };
}

const coupe = (jsx, [a, b], neuf) => jsx.slice(0, a) + neuf + jsx.slice(b);

/** [début, fin) de l'élément `tag` qui entoure l'indice `at`, ou `null`. */
function autour(jsx, at, tag = 'div') {
  if (at < 0) return null;
  const debut = jsx.lastIndexOf(`<${tag}`, at);
  if (debut < 0) return null;
  const fin = finElement(jsx, debut);
  return fin < 0 ? null : [debut, fin];
}

/** Le style (sans accolades) de la balise ouvrante qui commence à `debut`. */
function styleDe(jsx, debut) {
  const pos = jsx.indexOf('style={{ ', debut);
  const fin = finAccolade(jsx, pos + 'style='.length);
  return jsx.slice(pos + 'style={{ '.length, fin - ' }}'.length);
}

const echapper = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Le panneau de gauche des dix cadres d'ordinateur ────────────────────────

/**
 * « 12 », « 8 » et « 2 » (annonces, offres, « Mes annonces ») sont les totaux des
 * listes : `GET /services/counts`, rangés dans `quotas.compteurs`. Un compteur que
 * l'appel n'a pas pu lire (`null`) disparaît avec sa pastille plutôt que de montrer un
 * zéro qui ferait croire à un marché vide.
 */
const SC_COMPTEURS = sur(
  'SC_COMPTEURS',
  SERIE,
  ['>Annonces logement</span>', '>Bourses et emploi</span>', '>Mes annonces</span>'],
  'Les compteurs du panneau de gauche (annonces, offres, « Mes annonces ») sont les totaux réels des listes ; la pastille « PREMIUM » de « Mes alertes » disparaît quand tout est gratuit.',
  ['quotas'],
  (jsx) => {
    let out = jsx;
    let n = 0;
    for (const [libelle, champ, ancien] of [
      ['Annonces logement', 'logement', '12'],
      ['Bourses et emploi', 'emploi', '8'],
      ['Mes annonces', 'mesAnnonces', '2'],
    ]) {
      const re = new RegExp(`(>${echapper(libelle)}</span>)(<span style=\\{\\{[^}]*\\}\\}>)${ancien}(</span>)`);
      const m = re.exec(out);
      if (m === null) continue;
      const neuf =
        `${m[1]}{quotas.compteurs.${champ} === null ? null : (${m[2]}{quotas.compteurs.${champ}}${m[3]})}`;
      out = out.slice(0, m.index) + neuf + out.slice(m.index + m[0].length);
      n += 1;
    }
    // La pastille « PREMIUM » à côté de « Mes alertes » : une incitation à payer.
    const prem = /(>Mes alertes<\/span>)(<span style=\{\{[^}]*\}\}>PREMIUM<\/span>)/.exec(out);
    if (prem !== null) {
      out =
        out.slice(0, prem.index) +
        `${prem[1]}{quotas.gratuit ? null : (${prem[2]})}` +
        out.slice(prem.index + prem[0].length);
      n += 1;
    }
    return n === 0 ? null : out;
  },
);

/** « Créer ma fiche pro » (carte « VOUS EXERCEZ UN MÉTIER ? ») mène à la fiche. */
const SC_CREER_FICHE = sur(
  'SC_CREER_FICHE',
  SERIE,
  ['>Créer ma fiche pro</button>'],
  'Le bouton « Créer ma fiche pro » du panneau de gauche mène à `/services/annuaire/ma-fiche` : c’était un bouton sans geste.',
  [],
  (jsx) => {
    const at = jsx.indexOf('>Créer ma fiche pro</button>');
    const debut = jsx.lastIndexOf('<button', at);
    return changerBalise(jsx, debut, 'Link', 'href="/services/annuaire/ma-fiche"', 'textDecoration: "none"');
  },
);

/** La roue du rail (en bas) mène aux réglages du compte, comme sur A11 et A12. */
const SC_ROUE = sur(
  'SC_ROUE',
  SERIE,
  ['color: "#CFE3DA", background: "transparent" }}><svg width="19"'],
  'La roue « Réglages » du rail mène à `/compte` (c’était un <span> sans geste sur S01 à S10 ; A11 et A12 la lient déjà).',
  [],
  (jsx) => {
    const m = /<span style=\{\{ height: "48px", borderRadius: "16px"[^}]*color: "#CFE3DA", background: "transparent" \}\}><svg width="19"/.exec(jsx);
    if (m === null) return null;
    return changerBalise(jsx, m.index, 'Link', 'href="/compte" aria-label="Réglages" title="Réglages"', 'textDecoration: "none"');
  },
);

/**
 * « Compte » de la barre basse (390 px) mène à `/compte`.
 *
 * Quatre des cinq entrées de la barre étaient des liens ; la cinquième, « Compte »,
 * était un `<div>` : sur un téléphone, depuis les écrans Services et les fiches ville,
 * on ne pouvait pas atteindre ses réglages. `/compte` existe (et la roue du rail
 * d'ordinateur y mène déjà). Bornée à ces écrans : les autres modules règlent la
 * barre de leurs propres cadres.
 */
const SC_COMPTE_BARRE = sur(
  'SC_COMPTE_BARRE',
  [...SERIE, 'A11', 'A12', 'A12T'],
  ['>Compte</div>', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0'],
  'L’entrée « Compte » de la barre basse mène à `/compte` : c’était un <div> sans geste, la seule des cinq entrées qui n’était pas un lien (S01 à S10, A11, A12).',
  [],
  (jsx) => {
    let out = jsx;
    let n = 0;
    for (;;) {
      const re = /<div style=\{\{ height: "54px"[^}]*\}\}><svg [^>]*><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0" \/><\/svg>Compte<\/div>/;
      const m = re.exec(out);
      if (m === null) break;
      const neuf = changerBalise(out, m.index, 'Link', 'href="/compte"', 'textDecoration: "none", cursor: "pointer"');
      if (neuf === null) break;
      out = neuf;
      n += 1;
    }
    return n === 0 ? null : out;
  },
);

// ─── S04 : trois onglets, sous-titre, contenu ────────────────────────────────

const HREF_ONGLET = {
  offres: '/services/emploi',
  profils: '/services/emploi?onglet=profils',
  recherche: '/services/emploi?onglet=recherche',
};

/**
 * La bande des trois onglets : trois `<span>` → trois liens `?onglet=`. Le style actif
 * est celui du PREMIER `<span>` dessiné (fond blanc), l'inactif celui du deuxième : ils
 * sont relevés sur le dessin, jamais recopiés (piège 1 — les deux largeurs diffèrent
 * par le libellé, pas par la mesure, mais on relève quand même).
 */
function onglets(jsx) {
  const m = /<div style=\{\{ display: "flex", gap: "4px", background: "#EEF2F0", borderRadius: "14px", padding: "4px"[^}]*\}\}>/.exec(jsx);
  if (m === null) return null;
  const debut = m.index;
  const fin = finElement(jsx, debut);
  if (fin < 0) return null;
  const interieur = jsx.slice(debut + m[0].length, fin - '</div>'.length);
  const spans = [...interieur.matchAll(/<span style=\{\{ ([^}]*) \}\}>([^<]*)<\/span>/g)];
  if (spans.length !== 3) return null;
  const actif = spans.find((s) => s[1].includes('background: "#fff"'));
  const inactif = spans.find((s) => !s[1].includes('background: "#fff"'));
  if (actif === undefined || inactif === undefined) return null;
  const liens = ['offres', 'profils', 'recherche']
    .map(
      (cle, i) =>
        `<Link href="${HREF_ONGLET[cle]}" aria-current={onglet === "${cle}" ? "page" : undefined} data-emploi-onglet="${cle}" ` +
        `style={onglet === "${cle}" ? { ${actif[1]}, textDecoration: "none" } : { ${inactif[1]}, textDecoration: "none" }}>${spans[i][2]}</Link>`,
    )
    .join('');
  return coupe(jsx, [debut, fin], `${m[0]}${liens}</div>`);
}

const SC_S04 = sur(
  'SC_S04',
  ['S04'],
  ['{(offres.liste ?? []).map('],
  'S04 : la bande d’onglets devient trois liens (`?onglet=`) ; « Offres », « Profils disponibles » (pleine colonne) et « Mon profil de recherche » (formulaire `PUT /me/job-seeker-profile`) ; le sous-titre est le total réel.',
  ['onglet', 'pret', 'offres', 'profils', 'vivant'],
  (jsx) => {
    let out = onglets(jsx);
    if (out === null) return null;

    // « 8 offres à Lyon et en télétravail » → le total réel de la recherche.
    out = out.replace('>8 offres à Lyon et en télétravail</div>', '>{offres.sousTitre}</div>');

    // La boucle des offres : visible sur l'onglet « Offres » seulement ; son état vide.
    const debutBoucle = out.indexOf('{(offres.liste ?? []).map(');
    const finBoucle = debutBoucle < 0 ? -1 : finAccolade(out, debutBoucle);
    if (finBoucle < 0) return null;
    const boucle = out.slice(debutBoucle, finBoucle);
    const vide =
      '{pret && (offres.liste ?? []).length === 0 ? (<div data-emploi-vide="" style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px", flexShrink: "0" }}>' +
      '<div style={{ fontSize: "16px", fontWeight: "700" }}>Aucune offre en ligne pour le moment</div>' +
      '<div style={{ fontSize: "13px", color: "#5D6B66", marginTop: "4px" }}>Les offres publiées par les membres apparaissent ici. Vous pouvez publier la première.</div>' +
      '<Link href="/services/emploi/nouveau" style={{ display: "inline-block", marginTop: "12px", fontSize: "13px", fontWeight: "700", color: "#16785E", textDecoration: "none" }}>Publier une offre</Link></div>) : null}';
    const mobile = !out.includes('fontSize: "28px"');
    const contenu =
      `{onglet === "offres" ? (<>${boucle}${vide}</>) : null}` +
      '{pret && onglet === "profils" ? (<ListeProfilsEmploi profils={profils.liste} suite={profils.suite} vivant={vivant} />) : null}' +
      `{pret && onglet === "recherche" ? (<FormulaireProfilRecherche${mobile ? ' mobile' : ''} />) : null}`;
    out = coupe(out, [debutBoucle, finBoucle], contenu);

    // Bureau : la carte « PROFILS DISPONIBLES » de la colonne de droite ne vaut que sur
    // l'onglet « Offres » (sur les deux autres, elle répéterait le centre) ; état vide.
    const lib = out.indexOf('>PROFILS DISPONIBLES</div>');
    if (lib >= 0) {
      const etiquette = autour(out, lib);
      const carte = etiquette === null ? null : autour(out, out.lastIndexOf('<div', etiquette[0] - 1));
      if (carte !== null) {
        let corps = out.slice(carte[0], carte[1]);
        const videProfils =
          '{pret && (profils.liste ?? []).length === 0 ? (<div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "12px" }}>Aucun profil publié pour le moment.</div>) : null}';
        const finLabel = corps.indexOf('</div>', corps.indexOf('>PROFILS DISPONIBLES</div>')) + '</div>'.length;
        corps = corps.slice(0, finLabel) + videProfils + corps.slice(finLabel);
        out = coupe(out, carte, `{onglet === "offres" ? (${corps}) : null}`);
      }
    }
    return out;
  },
);

// ─── S05 et S07 à 390 px : « Signaler » ──────────────────────────────────────

/** Le rond de 40 px du pied de S02 à 390 px, repris tel quel (et centré dans la barre). */
const SIGNALER_MOBILE =
  '<button type="button" aria-label="Signaler" onClick={vivant.onSignaler} data-signaler-mobile="" style={{ width: "40px", height: "40px", alignSelf: "center", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", border: "none", font: "inherit", padding: 0, cursor: "pointer" }}>' +
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4h12l-2 4 2 4H5" /></svg></button>';

const SC_SIGNALER_S05 = sur(
  'SC_SIGNALER_S05',
  ['S05'],
  ['data-modal-open="S05R">Recommander</button>', 'safe-area-inset-top'],
  'S05 (390 px) — AJOUT hors maquette : le bouton « Signaler » (la planche mobile ne le dessine pas ; celle d’ordinateur l’a) ouvre la fenêtre de signalement, comme à 1 440 px. Rond de 40 px du pied de S02.',
  ['vivant'],
  (jsx) => {
    const marque = 'data-modal-open="S05R">Recommander</button>';
    const at = jsx.indexOf(marque);
    const apres = at + marque.length;
    return jsx.slice(0, apres) + SIGNALER_MOBILE + jsx.slice(apres);
  },
);

const SC_SIGNALER_S07 = sur(
  'SC_SIGNALER_S07',
  ['S07'],
  ['Contacter · {pro.quotaCourt}</button>', 'safe-area-inset-top'],
  'S07 (390 px) — AJOUT hors maquette : le bouton « Signaler » (la planche mobile ne le dessine pas ; celle d’ordinateur l’a) ouvre la fenêtre de signalement, comme à 1 440 px. Rond de 40 px du pied de S02.',
  ['vivant'],
  (jsx) => {
    const marque = 'Contacter · {pro.quotaCourt}</button>';
    const at = jsx.indexOf(marque);
    const apres = at + marque.length;
    return jsx.slice(0, apres) + SIGNALER_MOBILE + jsx.slice(apres);
  },
);

// ─── S06 : la ville ──────────────────────────────────────────────────────────

const SC_S06 = sur(
  'SC_S06',
  ['S06'],
  ['(annuaire.fiches ?? []).map(', '<form action="/services/annuaire"'],
  'S06 : la pastille « Lyon » (ville d’exemple, en dur) devient une liste des villes du référentiel qui filtre `GET /pros?cityId=` ; la recherche et les puces conservent la ville ; « N contacts sur X ce mois-ci » disparaît quand tout est gratuit.',
  ['annuaire', 'quotas'],
  (jsx) => {
    let out = jsx;
    let n = 0;
    // La recherche garde la ville choisie.
    const fermeture = '</form>';
    const at = out.indexOf(fermeture);
    if (at >= 0) {
      out =
        out.slice(0, at) +
        '{annuaire.ville !== "" ? (<input type="hidden" name="ville" value={annuaire.ville} />) : null}' +
        out.slice(at);
      n += 1;
    }
    const filtre = (mobile) =>
      `<FiltreVilleAnnuaire villes={annuaire.villes} ville={annuaire.ville} recherche={annuaire.recherche}${mobile ? ' mobile' : ''} />`;
    // Bureau : la pastille « Lyon » (200 px) est remplacée.
    const lyon = out.indexOf('</svg>Lyon</div>');
    if (lyon >= 0) {
      const boite = autour(out, lyon);
      if (boite !== null) {
        out = coupe(out, boite, filtre(false));
        n += 1;
      }
    } else {
      // Téléphone : la planche n'en dessine pas ; la pastille se pose sous la recherche.
      const form = out.indexOf(fermeture);
      const boite = form < 0 ? null : autour(out, form);
      if (boite !== null) {
        out = out.slice(0, boite[1]) + filtre(true) + out.slice(boite[1]);
        n += 1;
      }
    }
    // « 0 contacts sur illimité ce mois-ci » : un quota que personne n'a quand tout est
    // gratuit (comme la carte « MES QUOTAS DU MOIS »). Il revient avec les plans.
    const quota = /<(span|div) style=\{\{[^}]*\}\}>\{quotas\.contactsPro\} contacts sur \{quotas\.plafondPro\} ce mois-ci<\/\1>/.exec(out);
    if (quota !== null) {
      out =
        out.slice(0, quota.index) +
        `{quotas.gratuit ? null : (${quota[0]})}` +
        out.slice(quota.index + quota[0].length);
      n += 1;
    }
    return n === 0 ? null : out;
  },
);

// ─── S10 à 390 px : plus de carte « Réservé à Premium » quand tout est gratuit ─

const SC_S10 = sur(
  'SC_S10',
  ['S10'],
  ['Réservé à Premium.</strong>'],
  'S10 (390 px) : la carte « Réservé à Premium » n’apparaît que si le serveur dit que les alertes sont payantes (`alertes.sansPremium`) ; tout est gratuit, elle disparaît. « Découvrir Premium » mène à `/premium`.',
  ['alertes'],
  (jsx) => {
    let out = jsx;
    let n = 0;
    const at = out.indexOf('Réservé à Premium.</strong>');
    const carte = autour(out, at);
    if (carte !== null) {
      out = coupe(out, carte, `{alertes.sansPremium ? (${out.slice(carte[0], carte[1])}) : null}`);
      n += 1;
    }
    const b = out.indexOf('>Découvrir Premium</button>');
    if (b >= 0) {
      const debut = out.lastIndexOf('<button', b);
      const neuf = changerBalise(out, debut, 'Link', 'href="/premium"', 'textDecoration: "none"');
      if (neuf !== null) {
        out = neuf;
        n += 1;
      }
    }
    return n === 0 ? null : out;
  },
);

// ─── Registre ────────────────────────────────────────────────────────────────

export const ADAPTATIONS_SERVICES_COMPLEMENTS = [
  SC_COMPTEURS,
  SC_CREER_FICHE,
  SC_ROUE,
  SC_COMPTE_BARRE,
  SC_S04,
  SC_SIGNALER_S05,
  SC_SIGNALER_S07,
  SC_S06,
  SC_S10,
];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_SERVICES_COMPLEMENTS = {
  FormulaireProfilRecherche: '@/components/services/profil-recherche',
  ListeProfilsEmploi: '@/components/services/liste-profils-emploi',
  FiltreVilleAnnuaire: '@/components/services/filtre-ville-annuaire',
};
