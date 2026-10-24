/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT E — « VILLES VIVANTES » : A11, A12, A12C, A12T                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré sur les cadres générés avant ce lot : tout était de la démonstration.
 * « Lyon », « Auvergne-Rhône-Alpes · 1 400 membres », « Réseau Lyon et Rhône »,
 * « 1 050 € », « budget mensuel médian d'un étudiant · 38 contributions » étaient
 * écrits en toutes lettres sur la fiche ; la bascule « Carte | Annuaire » et « Pays
 * d'origine » étaient des `<span>` ; la carte était un `<iframe>` vers un fichier
 * absent (404) ; « Saluer », « Utile », « Signaler » et « Contribuer » ne
 * partaient nulle part ; le bouton « Voir sur la carte » des produits du pays
 * aurait demandé de GÉOCODER une adresse, ce que 09 §2.1 et la règle dure du §10
 * interdisent.
 *
 * Appliquées après les adaptations des autres lots, avant « l'en-tête global ».
 * Les cadres sont typés `VilleData` / `VillesData` (voir `screens/villes/data.ts`,
 * et les déclarations de A11, A12, A12C et A12T dans `03-accueil.mjs`).
 *
 * CE QUI DISPARAÎT, ET POURQUOI (remonté au porteur) :
 *   · les puces de catégorie (« Transport », « Administration »…), de commerce
 *     (« Épiceries », « Tissus »…) et de parcours (« Études », « Travail »…) :
 *     `city_tips` ne porte aucune catégorie — un filtre qui ne filtre rien ment ;
 *   · le rond « enregistrer » d'une contribution : le signet n'accepte pas ce type
 *     de sujet ;
 *   · « J'y suis allé·e » : aucune colonne, aucune route ;
 *   · « Voir sur la carte » : géocoder une adresse est interdit ;
 *   · « Catégorie » et « Ajouter une photo » du produit du pays, « Profil » du
 *     budget : aucune colonne.
 */
import { dedoublerStyles, finElement } from './reseau-vivant.mjs';
import { NU, changerBalise, finAccolade, ouvranteAvant } from './outils-lot-e.mjs';

// ─── A11 ─────────────────────────────────────────────────────────────────────

/**
 * ── LA BASCULE « CARTE | ANNUAIRE » ─────────────────────────────────────────
 *
 * Deux `<span>` sur les trois cadres. Ils deviennent des liens vers `?vue=…` (le
 * pays se conserve) ; l'actif suit `vivant.vue` — mais sur les deux cadres mobiles
 * c'est le CADRE qui dit la vue (le mobile montre l'annuaire par défaut), donc la
 * couleur est fixée par ce que le cadre dessine : on garde le style dessiné.
 */
const VI_A11_BASCULE = {
  screens: ['A11'],
  nom: 'VI_A11_BASCULE',
  why: 'La bascule Carte | Annuaire étaient des <span> : ce sont des liens (?vue=carte|annuaire), la carte et l’annuaire se montrent vraiment.',
  provides: ['vivant'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    // Sur ordinateur, l'onglet actif suit la vue réelle (la maquette dessine toujours
    // « Carte » actif). Sur les cadres mobiles, c'est le CADRE montré qui dit la vue.
    const bureau = jsx.includes('fontSize: "28px"');
    for (const [texte, vue, href] of [
      ['Carte', 'carte', 'vivant.hrefCarte'],
      ['Annuaire', 'annuaire', 'vivant.hrefAnnuaire'],
    ]) {
      const at = out.indexOf(`>${texte}</span>`);
      if (at === -1) continue;
      const debut = ouvranteAvant(out, at, 'span');
      const style = bureau
        ? `background: vivant.vue === "${vue}" ? "#fff" : "transparent", color: vivant.vue === "${vue}" ? "#16211D" : "#5D6B66", textDecoration: "none"`
        : 'textDecoration: "none"';
      const neuf = changerBalise(out, debut, 'Link', `href={${href}} data-villes-vue="${vue}"`, style);
      if (neuf !== null) {
        out = neuf;
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** ── « PAYS D'ORIGINE : TOUS » (ordinateur) — un vrai filtre ─────────────────── */
const VI_A11_PAYS = {
  screens: ['A11'],
  nom: 'VI_A11_PAYS',
  why: '« Pays d’origine : Tous » était un <span> : c’est une liste des pays d’origine, qui recalcule les compteurs de la carte (seuil de 3 côté serveur).',
  provides: ['vivant'],
  apply(jsx) {
    const m = /<span style=\{\{ ([^}]*) \}\}>Pays d'origine : Tous(<svg[\s\S]*?<\/svg>)<\/span>/.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const neuf =
      `<label style={{ ${m[1]}, position: "relative", cursor: "pointer" }} data-villes-pays="">Pays d’origine : ` +
      `<select value={vivant.pays} onChange={(e) => vivant.onPays(e.target.value)} aria-label="Pays d’origine" style={{ border: "none", background: "transparent", font: "inherit", fontWeight: "600", color: "inherit", cursor: "pointer", outline: "none", appearance: "none", paddingRight: "4px" }}>` +
      '{(vivant.paysOptions ?? []).map((o, oIndex) => (<option key={oIndex} value={o.valeur}>{o.libelle}</option>))}</select>' +
      `${m[2]}</label>`;
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

/** ── LE CADRE DE LA CARTE (ordinateur) : l'iframe devient la carte ou l'annuaire ── */
const VI_A11_CONTENU = {
  screens: ['A11'],
  nom: 'VI_A11_CONTENU',
  why: 'L’<iframe src="Carte Villes.html"> renvoyait 404 et chargeait des tuiles tierces (interdit, 09 §2.1) : la carte est un SVG local, et l’onglet Annuaire a son contenu.',
  provides: ['vivant'],
  apply(jsx) {
    const m = /<iframe src="Carte Villes\.html" title="Carte des membres" style=\{\{[^}]*\}\}><\/iframe>/.exec(jsx);
    if (m === null) return { jsx, applied: false };
    // Ordinateur : la carte ou l'annuaire. Téléphone (carte) : la carte seule, avec
    // le filtre de pays posé dessus, puisque cette planche n'en dessine pas.
    const bureau = jsx.includes('fontSize: "28px"');
    const neuf = bureau
      ? '{vivant.vue === "carte" ? (<CarteVilles points={vivant.points} maVilleId={vivant.maVilleId} />) : (<AnnuaireVilles membres={vivant.annuaire} filtres={vivant.filtres} aPlus={vivant.aPlus} onPlus={vivant.onPlus} />)}'
      : '<CarteVilles points={vivant.points} maVilleId={vivant.maVilleId} filtre={<label style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "999px", background: "#fff", border: "1px solid #E6EBE9", fontSize: "13px", fontWeight: "600" }}>Pays : <select value={vivant.pays} onChange={(e) => vivant.onPays(e.target.value)} aria-label="Pays d’origine" style={{ border: "none", background: "transparent", font: "inherit", fontWeight: "600", cursor: "pointer", outline: "none" }}>{(vivant.paysOptions ?? []).map((o, oIndex) => (<option key={oIndex} value={o.valeur}>{o.libelle}</option>))}</select></label>} />';
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

/** ── L'ANNUAIRE MOBILE : filtres, état vide, « Voir plus » ───────────────────── */
const VI_A11_ANNUAIRE_MOBILE = {
  screens: ['A11'],
  nom: 'VI_A11_ANNUAIRE_MOBILE',
  why: 'Les pastilles de filtre de l’annuaire étaient des <span> ; la liste ne savait ni se vider ni paginer (20 par page).',
  provides: ['dirFilters', 'directory', 'vivant'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    // Les pastilles : chacune est une liste (pays, phase) ou une bascule. Le style
    // dessiné porte un gabarit (`${f.bd}`) : on coupe donc en COMPTANT les balises.
    const debutPastille = out.indexOf('<span style={{ padding: "7px 12px"');
    if (debutPastille !== -1) {
      const finPastille = finElement(out, debutPastille);
      if (finPastille !== -1) {
        out = out.slice(0, debutPastille) + '<PastilleFiltre f={f} />' + out.slice(finPastille);
        compte += 1;
      }
    }
    // La liste : une page de plus, un état vide, et du défilement (le conteneur
    // dessiné coupait `overflow: hidden` à la hauteur de l'écran).
    const marque = '{(directory ?? []).map(';
    const at = out.indexOf(marque);
    if (at !== -1) {
      const fin = finAccolade(out, at);
      if (fin !== -1) {
        out =
          out.slice(0, fin) +
          '{(directory ?? []).length === 0 ? (<EtatVide texte="Aucun membre ne correspond à ces filtres." />) : null}' +
          '{vivant.aPlus ? (<button type="button" onClick={vivant.onPlus} data-annuaire-plus="" style={{ border: "none", background: "#F2F5F4", borderRadius: "999px", padding: "10px 18px", font: "inherit", fontSize: "13px", fontWeight: "700", cursor: "pointer", alignSelf: "center" }}>Voir plus</button>) : null}' +
          out.slice(fin);
        out = out.replace(
          'gap: "10px", overflow: "hidden" }}>{(directory ?? [])',
          'gap: "10px", overflow: "visible" }}>{(directory ?? [])',
        );
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A12 · l'en-tête et les colonnes ─────────────────────────────────────────

/**
 * ── L'EN-TÊTE DE LA FICHE (A12) ─────────────────────────────────────────────
 *
 * « Lyon », « Auvergne-Rhône-Alpes · 1 400 membres » et « Réseau Lyon et Rhône » —
 * écrits en dur sur les cadres de 1 440 et de 390 px — viennent de `ville`. Le
 * bouton du réseau mène au réseau de la ville, et disparaît quand elle n'en a pas.
 * Les planches A12T lisent déjà `ville.nom`, `ville.region`… : elles ne reçoivent
 * que le lien.
 */
const VI_A12_ENTETE = {
  screens: ['A12'],
  nom: 'VI_A12_ENTETE',
  why: 'Le nom, la région, le nombre de membres et le réseau de la ville étaient écrits en toutes lettres (« Lyon… ») : ils viennent de GET /cities/:slug.',
  provides: ['ville'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    const sub = (motif, neuf) => {
      if (motif instanceof RegExp ? motif.test(out) : out.includes(motif)) {
        out = out.replace(motif, neuf);
        compte += 1;
      }
    };
    sub('>Lyon</h1>', '>{ville.nom}</h1>');
    sub('>Auvergne-Rhône-Alpes · 1 400 membres</div>', '>{ville.region} · {ville.membres}</div>');
    // Le bouton du réseau — `<a href="#">` à 1 440 px, `<span>` à 390 px.
    const lien = /<a href="#" style=\{\{ ([^}]*) \}\}>Réseau Lyon et Rhône<\/a>/.exec(out);
    if (lien !== null) {
      out =
        out.slice(0, lien.index) +
        `{ville.reseauHref ? (<Link href={ville.reseauHref} data-ville-reseau="" style={{ ${lien[1]}, textDecoration: "none" }}>{ville.reseau}</Link>) : null}` +
        out.slice(lien.index + lien[0].length);
      compte += 1;
    }
    const span = /<span style=\{\{ ([^}]*) \}\}>Réseau Lyon et Rhône<\/span>/.exec(out);
    if (span !== null) {
      out =
        out.slice(0, span.index) +
        `{ville.reseauHref ? (<Link href={ville.reseauHref} data-ville-reseau="" style={{ ${span[1]}, textDecoration: "none" }}>{ville.reseau}</Link>) : null}` +
        out.slice(span.index + span[0].length);
      compte += 1;
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** Le lien du réseau des planches A12T, qui écrivent déjà `{ville.reseau}` sous un `href="#"`. */
const VI_A12T_RESEAU = {
  screens: ['A12T'],
  nom: 'VI_A12T_RESEAU',
  why: 'Le bouton du réseau de la ville était un href="#" : il mène au réseau, et se tait quand la ville n’en a pas.',
  provides: ['ville'],
  apply(jsx) {
    const m = /<a href="#" style=\{\{ ([^}]*) \}\}>\{ville\.reseau\}<\/a>/.exec(jsx);
    if (m === null) return { jsx, applied: false };
    return {
      jsx:
        jsx.slice(0, m.index) +
        `{ville.reseauHref ? (<Link href={ville.reseauHref} data-ville-reseau="" style={{ ${m[1]}, textDecoration: "none" }}>{ville.reseau}</Link>) : null}` +
        jsx.slice(m.index + m[0].length),
      applied: true,
    };
  },
};

/** ── LA MÉDIANE EN TÊTE DES BUDGETS (09 §2.3) ───────────────────────────────── */
const VI_A12_MEDIANE = {
  screens: ['A12'],
  nom: 'VI_A12_MEDIANE',
  why: '« 1 050 € · budget mensuel médian d’un étudiant · 38 contributions » était écrit en dur : la médiane et le nombre viennent des budgets partagés, et le bloc se tait quand il n’y en a aucun.',
  provides: ['ville', 'budgets'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    if (out.includes('>1 050 €<')) {
      out = out.replace('>1 050 €<', '>{ville.mediane}<');
      compte += 1;
    }
    const phrase = /budget (?:mensuel )?médian d'un étudiant · 38 contributions/;
    if (phrase.test(out)) {
      out = out.replace(phrase, 'médiane des budgets partagés · {ville.medianeSous}');
      compte += 1;
    }
    // Pas de médiane = pas de bloc : le premier <div> de fond #EFF7F3.
    const bloc = out.indexOf('background: "#EFF7F3", borderRadius');
    if (bloc !== -1) {
      const debut = out.lastIndexOf('<div', bloc);
      const fin = finElement(out, debut);
      if (fin !== -1) {
        out = `${out.slice(0, debut)}{ville.mediane === null ? null : (${out.slice(debut, fin)})}${out.slice(fin)}`;
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** ── LES LIGNES DE BUDGET : « utiles » se vote, « Signaler » signale, « Retirer » retire ── */
const VI_A12_BUDGETS = {
  screens: ['A12'],
  nom: 'VI_A12_BUDGETS',
  why: 'Dans la liste des budgets, « N utiles » et « Signaler » étaient du texte : l’un vote (PUT/DELETE /tips/:id/vote), l’autre ouvre le signalement ; l’auteur peut retirer sa ligne ; une liste vide le dit.',
  provides: ['budgets', 'vivant'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    const bouton = (style) =>
      `<button type="button" onClick={() => vivant.gestes.onVoter(b.id, b.votedByMe)} disabled={vivant.gestes.occupe} aria-pressed={b.votedByMe} data-budget-utile="" style={{ ${style}, border: "none", background: "transparent", font: "inherit", cursor: "pointer", padding: 0, fontWeight: b.votedByMe ? "700" : "500", color: b.votedByMe ? "#0F5C48" : "#8A958F" }}>{b.u} utiles</button>`;
    const signaler = (style) =>
      `<button type="button" onClick={() => vivant.gestes.onSignaler(b.id)} data-budget-signaler="" style={{ ${style}, border: "none", background: "transparent", font: "inherit", cursor: "pointer", padding: 0 }}>Signaler</button>`;
    const retirer = (style) =>
      `{b.mine ? (<button type="button" onClick={() => vivant.gestes.onSupprimer(b.id)} data-budget-retirer="" style={{ ${style}, border: "none", background: "transparent", font: "inherit", cursor: "pointer", padding: 0 }}>Retirer</button>) : null}`;

    // Ordinateur : « {b.u} utiles » (largeur 90) puis « Signaler » en <span>.
    const d = /<span style=\{\{ (fontSize: "12px", color: "#8A958F", width: "90px", textAlign: "right") \}\}>\{b\.u\} utiles<\/span><span style=\{\{ (fontSize: "12px", color: "#8A958F", fontWeight: "600") \}\}>Signaler<\/span>/.exec(out);
    if (d !== null) {
      out =
        out.slice(0, d.index) +
        bouton(d[1]) +
        `{b.mine ? null : ${signaler(d[2])}}` +
        retirer(d[2]) +
        out.slice(d.index + d[0].length);
      compte += 1;
    }
    // Téléphone : « {b.u} utiles » seul, deux fois (première ligne et suivantes).
    const mobile = /<span style=\{\{ (fontSize: "11\.5px", color: "#8A958F") \}\}>\{b\.u\} utiles<\/span>/g;
    out = out.replace(mobile, (_, style) => {
      compte += 1;
      return `${bouton(style)}{b.mine ? null : ${signaler(style)}}${retirer(style)}`;
    });
    // La liste vide.
    const at = out.indexOf('{(budgets ?? []).map(');
    if (at !== -1) {
      const fin = finAccolade(out, at);
      if (fin !== -1) {
        out =
          out.slice(0, fin) +
          '{(budgets ?? []).length === 0 ? (<EtatVide texte="Aucun budget partagé pour l’instant : soyez le premier à ajouter le vôtre." />) : null}' +
          out.slice(fin);
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/** ── « SALUER » (A12 : <button>, A12T : <span>) ──────────────────────────────── */
const VI_ARRIVANTS_SALUER = {
  screens: ['A12', 'A12T'],
  nom: 'VI_ARRIVANTS_SALUER',
  why: '« Saluer » un nouvel arrivant ne faisait rien : il ouvre la conversation directe pré-adressée (ou rouvre celle qui existe).',
  provides: ['arrivals', 'vivant'],
  apply(jsx) {
    const geste =
      'onClick={() => { if (a.handle !== null) vivant.gestes.onSaluer(a.handle); }} disabled={a.handle === null || vivant.gestes.occupe} data-arrivant-saluer=""';
    const bouton = /<button style=\{\{ ([^}]*) \}\}>Saluer<\/button>/.exec(jsx);
    if (bouton !== null) {
      return {
        jsx:
          jsx.slice(0, bouton.index) +
          `<button type="button" ${geste} style={{ ${bouton[1]}, cursor: "pointer" }}>Saluer</button>` +
          jsx.slice(bouton.index + bouton[0].length),
        applied: true,
      };
    }
    const span = /<span style=\{\{ ([^}]*) \}\}>Saluer<\/span>/.exec(jsx);
    if (span === null) return { jsx, applied: false };
    return {
      jsx:
        jsx.slice(0, span.index) +
        `<button type="button" ${geste} style={{ ${span[1]}, border: "none", font: "inherit", cursor: "pointer" }}>Saluer</button>` +
        jsx.slice(span.index + span[0].length),
      applied: true,
    };
  },
};

/** ── LES ÉVÉNEMENTS À VENIR → leur fiche ─────────────────────────────────────── */
const VI_A12_EVENEMENTS = {
  screens: ['A12'],
  nom: 'VI_A12_EVENEMENTS',
  why: 'Les événements à venir de la fiche ne menaient nulle part : chaque ligne mène à /agenda/:id, et la carte dit quand il n’y en a pas.',
  provides: ['events'],
  apply(jsx) {
    const at = jsx.indexOf('{(events ?? []).map(');
    if (at === -1) return { jsx, applied: false };
    const ligne = jsx.indexOf('<div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}>', at);
    if (ligne === -1) return { jsx, applied: false };
    const neuf = changerBalise(jsx, ligne, 'Link', 'href={e.href} data-ville-evenement=""', 'textDecoration: "none", color: "inherit"');
    if (neuf === null) return { jsx, applied: false };
    const fin = finAccolade(neuf, neuf.indexOf('{(events ?? []).map('));
    return {
      jsx:
        neuf.slice(0, fin) +
        '{(events ?? []).length === 0 ? (<EtatVide compact texte="Aucun événement à venir." />) : null}' +
        neuf.slice(fin),
      applied: true,
    };
  },
};

// ─── A12T · les trois listes ────────────────────────────────────────────────

/** Retire un bloc `{(liste ?? []).map(…)}` ET le <div> de pastilles qui le contient. */
function retirerRangee(jsx, liste) {
  const marque = `{(${liste} ?? []).map(`;
  const at = jsx.indexOf(marque);
  if (at === -1) return jsx;
  const debut = ouvranteAvant(jsx, at, 'div');
  const fin = finElement(jsx, debut);
  return fin === -1 ? jsx : jsx.slice(0, debut) + jsx.slice(fin);
}

const VI_A12T_LISTES = {
  screens: ['A12T'],
  nom: 'VI_A12T_LISTES',
  why: 'Les listes de la fiche (bons plans, produits du pays, témoignages) : les puces de catégorie disparaissent (aucune catégorie en base), « Utile », « Signaler » et « Retirer » deviennent des gestes, le signet et « J’y suis allé·e » disparaissent, une liste vide le dit.',
  provides: ['vivant'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    for (const liste of ['cityTipFilters', 'cityPlaceFilters', 'cityStoryFilters']) {
      const apres = retirerRangee(out, liste);
      if (apres !== out) {
        out = apres;
        compte += 1;
      }
    }

    // Les pieds de carte : « Utile · N », le signet, « Signaler ».
    const element = (liste) =>
      liste === 'cityTips' ? 't' : liste === 'cityPlaces' ? 'p' : 's';
    for (const liste of ['cityTips', 'cityPlaces', 'cityStories']) {
      if (!out.includes(`{(${liste} ?? []).map(`)) continue;
      const v = element(liste);
      const utile = new RegExp(
        `<span style=\\{\\{ ([^}]*background: ${v}\\.utileBg[^}]*) \\}\\}>(<svg[\\s\\S]*?<\\/svg>)Utile · \\{${v}\\.utiles\\}<\\/span>`,
      ).exec(out);
      if (utile !== null) {
        out =
          out.slice(0, utile.index) +
          `<button type="button" onClick={() => vivant.gestes.onVoter(${v}.id, ${v}.votedByMe)} disabled={vivant.gestes.occupe} aria-pressed={${v}.votedByMe} data-contribution-utile="" style={{ ${utile[1]}, border: "none", font: "inherit", cursor: "pointer" }}>${utile[2]}Utile · {${v}.utiles}</button>` +
          out.slice(utile.index + utile[0].length);
        compte += 1;
      }
      // Le signet : un rond sans route — retiré.
      const signet = /<span style=\{\{[^}]*\}\}><svg[^>]*><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" \/><\/svg><\/span>/.exec(out);
      if (signet !== null) {
        out = out.slice(0, signet.index) + out.slice(signet.index + signet[0].length);
        compte += 1;
      }
      const signaler = /<span title="Signaler" style=\{\{ ([^}]*) \}\}>(<svg[\s\S]*?<\/svg>)<\/span>/.exec(out);
      if (signaler !== null) {
        out =
          out.slice(0, signaler.index) +
          `{${v}.mine ? null : (<button type="button" title="Signaler" aria-label="Signaler" onClick={() => vivant.gestes.onSignaler(${v}.id)} data-contribution-signaler="" style={{ ${signaler[1]}, border: "none", font: "inherit", cursor: "pointer", padding: 0 }}>${signaler[2]}</button>)}` +
          `{${v}.mine ? (<button type="button" onClick={() => vivant.gestes.onSupprimer(${v}.id)} data-contribution-retirer="" style={{ height: "32px", padding: "0 12px", borderRadius: "999px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Retirer</button>) : null}` +
          out.slice(signaler.index + signaler[0].length);
        compte += 1;
      }
    }

    // Un bon plan sans titre n'écrit pas de ligne vide.
    const titre = /<div style=\{\{ (fontSize: "15\.5px", fontWeight: "700", marginTop: "10px") \}\}>\{t\.titre\}<\/div>/.exec(out);
    if (titre !== null) {
      out =
        out.slice(0, titre.index) +
        `{t.titre === "" ? null : (<div style={{ ${titre[1]} }}>{t.titre}</div>)}` +
        out.slice(titre.index + titre[0].length);
      compte += 1;
    }

    // Les produits du pays : « Voir sur la carte » (géocodage interdit) et « J'y suis allé·e ».
    const carte = out.indexOf('>Voir sur la carte</span>');
    if (carte !== -1) {
      const debut = ouvranteAvant(out, ouvranteAvant(out, carte, 'span') - 1, 'div');
      const fin = finElement(out, debut);
      if (fin !== -1 && out.slice(debut, fin).includes('Voir sur la carte')) {
        out = out.slice(0, debut) + out.slice(fin);
        compte += 1;
      }
    }
    const allee = out.indexOf('{p.been}</span>');
    if (allee !== -1) {
      // Le style porte un gabarit (`${p.beenBd}`) : on coupe en COMPTANT les balises.
      const debut = ouvranteAvant(out, allee, 'span');
      const fin = finElement(out, debut);
      if (fin !== -1) {
        out = out.slice(0, debut) + out.slice(fin);
        compte += 1;
      }
    }

    // Les témoignages : la ligne « Parcours … » n'existe que si un parcours est rattaché.
    const parcours = /<div style=\{\{ ([^}]*) \}\}>(<svg[\s\S]*?<\/svg>)?\{s\.parcours\}<\/div>/.exec(out);
    if (parcours !== null) {
      out =
        out.slice(0, parcours.index) +
        `{s.parcours === "" ? null : (${parcours[0]})}` +
        out.slice(parcours.index + parcours[0].length);
      compte += 1;
    }

    // Une liste vide le dit (juste après la boucle).
    for (const [liste, texte] of [
      ['cityTips', 'Aucun bon plan pour l’instant : partagez le premier.'],
      ['cityPlaces', 'Aucun commerce pour l’instant : ajoutez le premier.'],
      ['cityStories', 'Aucun témoignage pour l’instant : racontez votre installation.'],
    ]) {
      const at = out.indexOf(`{(${liste} ?? []).map(`);
      if (at === -1) continue;
      const fin = finAccolade(out, at);
      if (fin === -1) continue;
      out = `${out.slice(0, fin)}{(${liste} ?? []).length === 0 ? (<EtatVide texte="${texte}" />) : null}${out.slice(fin)}`;
      compte += 1;
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A12C · « Contribuer » ───────────────────────────────────────────────────

const GENRE_PAR_CARTE = {
  'Bon plan': 'TIP',
  'Produit du pays': 'SHOP',
  'Budget réel': 'BUDGET',
  Témoignage: 'TESTIMONY',
};

/**
 * ── A12C · LES QUATRE CARTES DE GENRE, EN BOUTONS ───────────────────────────
 *
 * La carte retenue se détermine sur `vivant.contribution.type` : fond `#EFF7F3` et
 * icône `#fff` quand elle l'est, fond `#fff` et icône `#E3F0EB` sinon — les deux
 * états que la maquette dessine (la sélection y change d'une planche à l'autre).
 */
const VI_A12C_GENRES = {
  screens: ['A12C'],
  nom: 'VI_A12C_GENRES',
  why: 'Les quatre cartes de genre (Bon plan, Produit du pays, Budget réel, Témoignage) étaient des <div> : elles choisissent le genre de la contribution.',
  provides: ['vivant'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    for (const [libelle, genre] of Object.entries(GENRE_PAR_CARTE)) {
      const at = out.indexOf(`>${libelle}</span>`);
      if (at === -1) continue;
      // La carte est le <div> le plus proche avant le libellé : elle ne contient que des <span>.
      const debut = ouvranteAvant(out, at, 'div');
      const fin = finElement(out, debut);
      if (fin === -1 || !out.slice(debut, fin).includes(`>${libelle}</span>`)) continue;
      const neuf = changerBalise(
        out,
        debut,
        'button',
        `type="button" onClick={() => vivant.contribution.onType("${genre}")} aria-pressed={vivant.contribution.type === "${genre}"} data-contribution-genre="${genre}"`,
        `${NU}, textAlign: "left", background: vivant.contribution.type === "${genre}" ? "#EFF7F3" : "#fff"`,
      );
      if (neuf === null) continue;
      out = neuf;
      // L'icône ronde suit : `#fff` sur la carte retenue, `#E3F0EB` sinon.
      const carte = out.indexOf('<button', debut);
      const reste = out.slice(carte);
      const icone = /(<span style=\{\{[^}]*?)background: "#(?:fff|E3F0EB)"/.exec(reste);
      if (icone !== null) {
        out =
          out.slice(0, carte) +
          reste.replace(
            icone[0],
            `${icone[1]}background: vivant.contribution.type === "${genre}" ? "#fff" : "#E3F0EB"`,
          );
      }
      compte += 1;
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * ── A12C · LE BOUTON PRINCIPAL ET LE RETOUR ─────────────────────────────────
 *
 * « Continuer » (étape 1) passe à l'étape 2 ; « Retour » revient ; « Publier » /
 * « Ajouter mon budget » envoient. Le refus du serveur s'écrit au-dessus des
 * boutons (`role="alert"`), via les champs (`ChampsContribution`).
 */
const VI_A12C_BOUTONS = {
  screens: ['A12C'],
  nom: 'VI_A12C_BOUTONS',
  why: '« Continuer », « Retour », « Publier » et « Ajouter mon budget » n’avaient aucun gestionnaire.',
  provides: ['vivant'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    for (const [texte, geste, extra] of [
      ['Continuer', 'vivant.contribution.onContinuer', ''],
      ['Retour', 'vivant.contribution.onRetour', ''],
      ['Publier', 'vivant.contribution.onPublier', ' disabled={vivant.contribution.bloque}'],
      ['Ajouter mon budget', 'vivant.contribution.onPublier', ' disabled={vivant.contribution.bloque}'],
    ]) {
      const re = new RegExp(`<button style=\\{\\{ ([^}]*) \\}\\}>${texte}<\\/button>`);
      const m = re.exec(out);
      if (m === null) continue;
      const opaque = extra === '' ? '' : ', opacity: vivant.contribution.bloque ? ".55" : "1"';
      out =
        out.slice(0, m.index) +
        `<button type="button" onClick={${geste}}${extra} data-contribution-bouton="${texte}" style={{ ${m[1]}, cursor: "pointer"${opaque} }}>${texte}</button>` +
        out.slice(m.index + m[0].length);
      compte += 1;
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * ── A12C · LES CHAMPS ───────────────────────────────────────────────────────
 *
 * Le bloc de champs dessiné (des `<div>` de texte d'exemple) est remplacé par
 * `ChampsContribution`, qui pose ceux du genre choisi. À 390 px il remplace
 * « Votre bon plan » + « Détail » ; à 1 440 px, le contenu de l'étape 2 du produit
 * du pays et du budget. Le titre de l'étape 2 du « Produit du pays » devient celui
 * du genre : le même cadre sert au bon plan et au témoignage, que la maquette ne
 * dessine pas (remonté).
 */
const VI_A12C_CHAMPS = {
  screens: ['A12C'],
  nom: 'VI_A12C_CHAMPS',
  why: 'Les champs de la fenêtre « Contribuer » étaient des <div> d’exemple : le genre choisi pose ses vrais champs, et le titre de l’étape 2 suit le genre.',
  provides: ['vivant', 'ville'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    const champs = '<ChampsContribution c={vivant.contribution} ville={ville.nom} />';

    // 1 440 px, étape 2 : tout l'intérieur du contenu défilant.
    const contenu = out.indexOf('<div data-fenetre-contenu=""');
    const etape2 = out.includes('Étape 2 sur 2');
    if (contenu !== -1 && etape2) {
      const fin = finElement(out, contenu);
      const ouvrante = out.slice(contenu, out.indexOf('>', contenu) + 1);
      out = out.slice(0, contenu) + ouvrante + champs + '</div>' + out.slice(fin);
      compte += 1;
      if (out.includes('>Produit du pays</h2>')) {
        out = out.replace('>Produit du pays</h2>', '>{vivant.contribution.titreEtape}</h2>');
        compte += 1;
      }
    }

    // 390 px : « Votre bon plan » + « Détail » deviennent les champs du genre.
    const bon = out.indexOf('>Votre bon plan</div>');
    if (bon !== -1 && !etape2) {
      const debut = ouvranteAvant(out, ouvranteAvant(out, bon, 'div') - 1, 'div');
      const premier = ouvranteAvant(out, bon, 'div');
      // Le conteneur de champs est le parent des deux blocs « Votre bon plan » et « Détail ».
      const parent = ouvranteAvant(out, premier - 1, 'div');
      const finParent = finElement(out, parent);
      if (finParent !== -1 && out.slice(parent, finParent).includes('>Détail</div>')) {
        out = out.slice(0, parent) + champs + out.slice(finParent);
        compte += 1;
      } else {
        void debut;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

export const ADAPTATIONS_VILLES_VIVANT = [
  VI_A11_BASCULE,
  VI_A11_PAYS,
  VI_A11_CONTENU,
  VI_A11_ANNUAIRE_MOBILE,
  VI_A12_ENTETE,
  VI_A12T_RESEAU,
  VI_A12_MEDIANE,
  VI_A12_BUDGETS,
  VI_ARRIVANTS_SALUER,
  VI_A12_EVENEMENTS,
  VI_A12T_LISTES,
  VI_A12C_GENRES,
  VI_A12C_BOUTONS,
  VI_A12C_CHAMPS,
].map((a) => ({
  ...a,
  apply(jsx) {
    const r = a.apply(jsx);
    return r.applied ? { jsx: dedoublerStyles(r.jsx), applied: true } : r;
  },
}));

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_VILLES_VIVANT = {
  CarteVilles: '@/components/carte-villes',
  AnnuaireVilles: '@/components/annuaire-villes',
  PastilleFiltre: '@/components/annuaire-villes',
  ChampsContribution: '@/components/champs-contribution',
};
