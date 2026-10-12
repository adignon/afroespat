/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE LOT « RÉSEAU VIVANT » — LES ADAPTATIONS DE A08, A08T, A09 ET E03         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur a relevé, onglet par onglet, ce qui restait DESSINÉ sur le module
 * réseaux. Ces adaptations le rendent vivant ; leurs prises sont déclarées dans
 * `apps/web/src/screens/a08t/vivant.ts` (et `screens/agenda/data.ts` pour E03),
 * et c'est `useReseau` qui les remplit.
 *
 * ── POURQUOI UN MODULE À PART ──────────────────────────────────────────────
 *
 * `generate-screens.mjs` compte déjà vingt-deux mille lignes. Ce lot en ajoute
 * un millier, toutes sur le même module ; les poser dans un fichier dédié les
 * garde lisibles ENSEMBLE, et `generate-screens.mjs` les importe et les range
 * dans sa liste de transformations, EN FIN de liste : elles travaillent sur le
 * JSX que les adaptations précédentes ont déjà produit (la sourdine, les liens
 * de gestion, les boucles de membres…), et leurs motifs sont écrits contre CE
 * texte-là, relevé sur les cadres générés.
 *
 * ── LES RÈGLES QUE CHAQUE ADAPTATION TIENT ─────────────────────────────────
 *
 *   · aucune mesure n'est inventée : un style posé ici est RECOPIÉ d'un nœud
 *     voisin de la même planche, et l'adaptation le dit ;
 *   · une coupe COMPTE ses balises (piège n° 3) — `finElement` ;
 *   · un motif est ancré sur la STRUCTURE (un texte, un tracé d'icône, une
 *     prise), jamais sur une mesure qui ne vaut que pour une largeur (piège 1) ;
 *   · une adaptation qui ne trouve rien le DIT (`applied: false`) — le
 *     générateur en fait un « attendue mais introuvable », normal sur les cadres
 *     qui ne dessinent pas ce qu'elle vise (piège 7).
 */

// ─── Outils ──────────────────────────────────────────────────────────────────

/**
 * L'INDICE QUI SUIT LA FERMETURE de l'élément dont la balise ouvrante commence
 * à `debut` — en COMPTANT les balises, jamais en cherchant un `</div>` (piège 3).
 * `-1` quand les balises ne retombent pas à zéro.
 */
export function finElement(jsx, debut) {
  const balises = /<(\/?)([a-zA-Z][\w.]*)\b[^>]*?(\/?)>/g;
  balises.lastIndex = debut;
  let profondeur = 0;
  for (let m = balises.exec(jsx); m !== null; m = balises.exec(jsx)) {
    if (m[1] === '/') profondeur -= 1;
    else if (m[3] !== '/') profondeur += 1;
    if (profondeur === 0) return m.index + m[0].length;
    if (profondeur < 0) return -1;
  }
  return -1;
}

/** Remplace la PREMIÈRE occurrence d'un motif ; `null` quand il n'y est pas. */
function remplacerUn(jsx, motif, vers) {
  const m = motif.exec(jsx);
  if (m === null) return null;
  const neuf = typeof vers === 'function' ? vers(m) : vers;
  return jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length);
}

/** Remplace TOUTES les occurrences (piège 2 : `String.replace` n'en coupe qu'une). */
function remplacerTous(jsx, motif, vers) {
  const g = new RegExp(motif.source, motif.flags.includes('g') ? motif.flags : `${motif.flags}g`);
  let compte = 0;
  const out = jsx.replace(g, (...args) => {
    compte += 1;
    return typeof vers === 'function' ? vers(args) : vers;
  });
  return { out, compte };
}

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Le style JSX d'une balise ouvrante (`style={{ … }}`), ou `null`. Le contenu est
 * rendu SANS les doubles accolades, pour être recomposé.
 */
function styleDe(ouvrante) {
  const m = /style=\{\{ ([^}]*) \}\}/.exec(ouvrante);
  return m === null ? null : m[1];
}

/** Un bouton nu : les remises à zéro que toute promotion `<span>` → `<button>` exige. */
const NU = 'border: "none", font: "inherit", padding: 0, cursor: "pointer"';

/**
 * FUSIONNE des déclarations dans un style : une clé déjà présente est REMPLACÉE,
 * jamais doublée — deux fois la même clé dans un objet littéral, c'est TS1117
 * (piège 8), et la seconde l'emporterait de toute façon.
 */
export function fusion(style, ajouts) {
  const decls = style.split(/, (?=[a-zA-Z]+: )/);
  const neuves = ajouts.split(/, (?=[a-zA-Z]+: )/);
  const cles = new Set(neuves.map((d) => d.slice(0, d.indexOf(':'))));
  return [...decls.filter((d) => !cles.has(d.slice(0, d.indexOf(':')))), ...neuves].join(', ');
}

function nu(style) {
  // Les remises à zéro D'ABORD, le style dessiné ENSUITE : `font: "inherit"`
  // est un raccourci qui remet `fontSize` à zéro s'il vient après lui — mesuré,
  // « Épingler » passait de 12,5 à 16 px. Une valeur dessinée (un `padding`, une
  // `border`) l'emporte donc sur la remise à zéro ; `dedoublerStyles` garde la
  // dernière occurrence de chaque clé.
  const propre = style
    .split(/, (?=[a-zA-Z]+: )/)
    .filter((d) => !/^cursor: /.test(d))
    .join(', ');
  return `${NU}, ${propre}`;
}

// ─── A08 · A08T — L'EN-TÊTE ──────────────────────────────────────────────────

/**
 * « Réseau automatique » + « Sourdine » → `ActionsReseau`.
 *
 * Le porteur : « Remplace le bouton "Réseau automatique" par Rejoindre pour les
 * nouveaux, et quand on est déjà dans le groupe c'est un bouton "Option" […] Si
 * c'est un modérateur le bouton gérer à côté. » La paire dessinée est remplacée
 * ENTIÈRE — la sourdine passe dans le menu « Options », confirmée.
 *
 * Sur les planches de l'équipe, « Gérer le réseau » est déjà là : « Options » se
 * pose à côté. Sur les téléphones, le rond « ··· » (ou la roue) en haut à droite
 * devient le bouton du menu, « Rejoindre » et « Gérer » compris.
 */
export const RV_ENTETE = {
  screens: ['A08', 'A08T'],
  nom: 'RV_ENTETE',
  why: 'Le bouton « Réseau automatique » était montré à tous et la sourdine partait sans confirmation : l’en-tête porte maintenant Rejoindre, Options (sourdine confirmée, quitter) et Gérer pour l’équipe.',
  provides: ['actions'],
  apply(jsx) {
    let out = jsx;
    let fait = false;

    // 1. La paire des planches d'ordinateur de la vue membre.
    const paire = remplacerUn(
      out,
      /<button style=\{\{ height: "42px"[^}]*\}\}>Réseau automatique<\/button>\s*<button type="button" onClick=\{sourdine\.onBasculer\}[^>]*>\{sourdine\.active \? "En sourdine" : "Sourdine"\}<\/button>/,
      '<ActionsReseau actions={actions} />',
    );
    if (paire !== null) {
      out = paire;
      fait = true;
    }

    // 2. La paire de la planche de 390 px de A08.
    const paireMobile = remplacerUn(
      out,
      /<span style=\{\{ flex: "1"[^}]*\}\}>Réseau automatique<\/span><button type="button" onClick=\{sourdine\.onBasculer\}[^>]*>\{sourdine\.active \? "En sourdine" : "Sourdine"\}<\/button>/,
      '<ActionsReseau actions={actions} variante="mobile" />',
    );
    if (paireMobile !== null) {
      out = paireMobile;
      fait = true;
    }

    // 3. Les planches d'ordinateur de l'équipe : « Options » à côté de « Gérer le réseau ».
    const gerer = remplacerUn(
      out,
      /<Link href=\{gerer\.hrefGerer\} data-reseau-gerer="" style=\{\{ height: "42px"/,
      (m) => `<ActionsReseau actions={actions} variante="options" />${m[0]}`,
    );
    if (gerer !== null) {
      out = gerer;
      fait = true;
    }

    // 4. Le rond du coin haut droit des téléphones : « ··· » ou la roue.
    const rond = remplacerUn(
      out,
      /<span style=\{\{ position: "absolute", top: "50px", right: "12px" \}\}><span style=\{\{ ([^}]*) \}\}>(<svg(?:(?!<\/svg>)[\s\S])*<\/svg>)<\/span><\/span>/,
      (m) =>
        '<span style={{ position: "absolute", top: "50px", right: "12px", zIndex: 25 }}>' +
        `<ActionsReseau actions={actions} variante="rond" rondStyle={{ ${m[1]} }}>${m[2]}</ActionsReseau></span>`,
    );
    if (rond !== null) {
      out = rond;
      fait = true;
    }

    // 5. La pastille « Propriétaire » à côté du nom : le rôle RÉEL (un modérateur
    //    lisait « Propriétaire »). On la reconnaît à SON DESSIN — la pastille vert
    //    foncé à texte blanc, la seule de ce genre sur ces planches — et non à sa
    //    position après le nom : à ce stade le nom n'est ni un `<h1>` (la
    //    promotion vient après) ni encore `{reseau.nom}`. Mesuré : l'ancien motif,
    //    ancré sur `<h1>{reseau.nom}</h1>`, ne trouvait rien, et les sept planches
    //    propriétaire d'ordinateur disaient « Propriétaire » à un modérateur.
    const badge = remplacerUn(
      out,
      /(<span style=\{\{ background: "#0F5C48", color: "#fff"[^}]*\}\}>)Propriétaire(<\/span>)/,
      (m) => `${m[1]}{actions.badge}${m[2]}`,
    );
    if (badge !== null) {
      out = badge;
      fait = true;
    }

    // 6. La ligne de résumé : trois interpolations entre deux points médians
    //    DESSINÉS laissaient « 4 membres · réseau d'intérêt · » à un passant, dont
    //    l'appartenance est vide. `reseau.resume` (déjà composé pour A08) ne
    //    joint que les morceaux présents — c'est l'arbitrage de `ReseauEnteteView`.
    const resume = out.replace(
      '>{reseau.membres} · {reseau.genre} · {reseau.monAppartenance}<',
      '>{reseau.resume}<',
    );
    if (resume !== out) {
      out = resume;
      fait = true;
    }

    return fait ? { jsx: out, applied: true } : { jsx, applied: false };
  },
};

/**
 * LES ONGLETS DE CONTENU DISPARAISSENT POUR QUI N'EST PAS MEMBRE.
 *
 * Le porteur : « Quand on n'est pas encore membre d'un réseau uniquement
 * afficher l'onglet À propos. » Les liens d'onglet sont écrits EN CLAIR sur les
 * planches A08T (`?onglet=fil`, `?onglet=sujets&vue=…`) ; sur A08 ils sont dans
 * la boucle `netTabs`, que le crochet filtre lui-même.
 */
export const RV_ONGLETS_FERMES = {
  screens: ['A08T'],
  nom: 'RV_ONGLETS_FERMES',
  why: 'Un passant voyait les six onglets d’un réseau dont le serveur lui refuse cinq contenus ; seul « À propos » reste.',
  provides: ['actions'],
  apply(jsx) {
    const { out, compte } = remplacerTous(
      jsx,
      /<a href="\?onglet=(?:fil|sujets|evenements|membres|album)(?:&vue=proprietaire)?"[^>]*>(?:(?!<\/a>)[\s\S])*<\/a>/,
      (args) => `{actions.ongletsFermes ? null : (${args[0]})}`,
    );
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A08 — L'ONGLET « SUJETS » ───────────────────────────────────────────────

/**
 * LA BANDE « PROPRIÉTAIRE DU RÉSEAU », POUR L'ÉQUIPE SEULEMENT, ET SES GESTES.
 *
 * Le porteur : « Dans sujet on a la bande "Propriétaire du réseau" qui affiche
 * Annonce, Épingler et Gérer qui s'affiche à tout le monde et les deux premiers
 * ne marchent pas. » Elle est maintenant sous `outils.visibles`, son libellé dit
 * le rôle réel, « Annonce » mène au formulaire, « Épingler » ouvre la fenêtre
 * des sujets à épingler. « Gérer » était déjà un lien (`A08_BANDEAU_GERER`).
 */
export const RV_BANDE_EQUIPE = {
  screens: ['A08'],
  nom: 'RV_BANDE_EQUIPE',
  why: 'La bande « Propriétaire du réseau » était montrée à tous, et « Annonce » / « Épingler » étaient inertes.',
  provides: ['outils'],
  apply(jsx) {
    const ouverture =
      '<div style={{ background: "#0F5C48", borderRadius: "18px", padding: "10px 12px 10px 20px"';
    const debut = jsx.indexOf(ouverture);
    if (debut === -1) return { jsx, applied: false };
    const fin = finElement(jsx, debut);
    if (fin === -1) return { jsx, applied: false };
    let bande = jsx.slice(debut, fin);
    bande = bande.replace('>Propriétaire du réseau<', '>{outils.libelle}<');
    bande = bande.replace(
      /\(<button (style=\{\{ height: "38px"[^}]*\}\})>\{o\}<\/button>\)/,
      (_, style) =>
        `(o === 'Annonce' ? (<Link href={outils.hrefAnnonce} data-reseau-annonce="" ${style.replace(' }}', ', textDecoration: "none", display: "flex", alignItems: "center" }}')}>{o}</Link>) : ` +
        `(<button type="button" onClick={outils.onEpingler} data-reseau-epingler="" ${style.replace(' }}', ', cursor: "pointer" }}')}>{o}</button>))`,
    );
    return {
      jsx: `${jsx.slice(0, debut)}{outils.visibles ? (${bande}) : null}${jsx.slice(fin)}`,
      applied: true,
    };
  },
};

/**
 * LES RANGÉES DE SUJETS SONT DES LIENS VERS A09, ET LA LISTE VIDE SE DIT.
 *
 * Le porteur : « La vue détails des sujets aussi n'est pas faite. » La page A09
 * existe (`/reseaux/:slug/sujets/:id`) — RIEN n'y menait : les rangées étaient
 * des `<div>`. La rangée entière devient le lien, sans rien redessiner.
 *
 * « NOUVEAU SUJET » : la planche de 390 px dessine un bouton flottant « + » (le
 * `BoutonCreer` générique, qui ouvrait le menu de création de l'accueil) ; celle
 * de 1 440 px n'en dessine aucun. Le bouton flottant ouvre maintenant la fenêtre
 * de sujet, et la carte d'ordinateur reçoit une rangée d'en-tête « SUJETS » avec
 * le même geste — dans les mesures du titre de carte « SIGNALEMENTS » de la
 * planche « Gérer » (10,5 px, 700, `#8A958F`) et du lien « Tout accepter »
 * (12,5 px, `#16785E`). REMONTÉ : la maquette ne dessine pas ce bouton.
 */
export const RV_SUJETS = {
  screens: ['A08'],
  nom: 'RV_SUJETS',
  why: 'Les rangées de sujets ne menaient nulle part, la liste vide était muette et aucun bouton n’ouvrait un sujet sur ordinateur.',
  provides: ['sujets'],
  apply(jsx) {
    let out = jsx;
    const boucle = '{(topics ?? []).map((t, tIndex) => (\n<Fragment key={tIndex}>';
    const at = out.indexOf(boucle);
    if (at === -1) return { jsx, applied: false };
    const rangee = at + boucle.length;
    const finRangee = finElement(out, rangee);
    if (finRangee === -1) return { jsx, applied: false };
    const element = out.slice(rangee, finRangee);
    const ouvrante = /^<div style=\{\{ /.exec(element);
    if (ouvrante === null) return { jsx, applied: false };
    const lien =
      '<Link href={t.href} data-sujet-lien="" style={{ textDecoration: "none", color: "inherit", ' +
      element.slice(ouvrante[0].length, element.length - '</div>'.length) +
      '</Link>';
    out = out.slice(0, rangee) + lien + out.slice(finRangee);

    // La fin de la boucle : `))}` juste après le `</Fragment>` de la rangée.
    const finBoucle = out.indexOf('</Fragment>\n))}', rangee);
    if (finBoucle === -1) return { jsx, applied: false };
    const apres = finBoucle + '</Fragment>\n))}'.length;
    out =
      out.slice(0, apres) +
      '{(topics ?? []).length === 0 ? (<EtatVide texte={sujets.vide} />) : null}' +
      out.slice(apres);

    // Ordinateur : la rangée d'en-tête dans la carte des sujets.
    const carte =
      '<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "8px" }}>';
    const c = out.indexOf(carte);
    if (c !== -1) {
      const enTete =
        '{sujets.nouveauVisible ? (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 6px" }}>' +
        '<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>SUJETS</div>' +
        '<button type="button" onClick={sujets.onNouveau} data-sujet-nouveau="" style={{ fontSize: "12.5px", fontWeight: "700", color: "#16785E", fontFamily: "inherit", border: "none", background: "none", padding: 0, cursor: "pointer" }}>Nouveau sujet</button></div>) : null}';
      out = out.slice(0, c + carte.length) + enTete + out.slice(c + carte.length);
    }

    // Téléphone : le « + » flottant ouvre la fenêtre de sujet.
    const fab = remplacerUn(
      out,
      /<BoutonCreer style=\{\{ position: "fixed"([^}]*)\}\}>(<svg(?:(?!<\/svg>)[\s\S])*<\/svg>)<\/BoutonCreer>/,
      (m) =>
        `{sujets.nouveauVisible ? (<button type="button" onClick={sujets.onNouveau} aria-label="Nouveau sujet" data-sujet-nouveau="" style={{ position: "fixed"${m[1]}, ${NU} }}>${m[2]}</button>) : null}`,
    );
    if (fab !== null) out = fab;

    return { jsx: out, applied: true };
  },
};

// ─── A08T — LE FIL : COMPOSEUR, OUTILS DE L'ÉQUIPE, ÉTAT VIDE ─────────────────

/**
 * LE COMPOSEUR DU FIL DU RÉSEAU.
 *
 * Le champ « Publier dans … » était un `<div>` ; il devient un `<textarea>` qui
 * hérite du fond, du rayon et des retraits du `<div>` dessiné. Les trois
 * icônes deviennent des boutons (image : le choisisseur ; sondage et guide :
 * voir `ComposeurReseauView`), les quatre pastilles de type la rangée du
 * composeur de l'accueil (`postTypesFor`), et « Publier » part.
 *
 * Sur la planche de 390 px, la maquette ne dessine NI pastilles NI « Publier » :
 * le champ seul. Un « Publier » est donc posé DANS le champ, en bas à gauche,
 * aux mesures des icônes voisines (32 px, rayon 11) — sans lui, un membre sur
 * téléphone ne pourrait rien envoyer. REMONTÉ.
 */
export const RV_COMPOSEUR = {
  screens: ['A08T'],
  nom: 'RV_COMPOSEUR',
  why: 'Le composeur du fil du réseau était entièrement dessiné : champ, pastilles de type, icônes et « Publier ».',
  provides: ['composeur', 'reseau'],
  apply(jsx) {
    let out = jsx;
    const texte = /(<div style=\{\{ flex: "1", minWidth: "0", position: "relative", minHeight: "(?:92|78)px"[^}]*\}\}>)Publier dans (?:\{reseau\.nom\}|le réseau)…/;
    const m = texte.exec(out);
    if (m === null) return { jsx, applied: false };
    const large = m[0].includes('minHeight: "92px"');
    const champ =
      '<textarea value={composeur.texte} onChange={composeur.onTexte} ' +
      'placeholder={`Publier dans ${reseau.nom}…`} aria-label="Votre publication" data-reseau-composeur="" ' +
      `style={{ display: "block", width: "100%", minHeight: "${large ? '64' : '30'}px", border: "none", background: "transparent", font: "inherit", fontSize: "${large ? '14' : '13.5'}px", color: "#16211D", outline: "none", resize: "vertical", padding: 0 }} />`;
    out = out.slice(0, m.index) + m[1] + champ + out.slice(m.index + m[0].length);

    // Les trois icônes, dans le champ seulement : on borne la recherche au champ.
    const debutChamp = m.index;
    const finChamp = finElement(out, debutChamp);
    if (finChamp === -1) return { jsx, applied: false };
    let zone = out.slice(debutChamp, finChamp);
    const icone = (trace, geste, libelle) => {
      const motif = new RegExp(
        `<span (?:title="[^"]*" )?style=\\{\\{ ([^}]*) \\}\\}>(<svg[^>]*><path d="${echapper(trace)}" \\/><\\/svg>)<\\/span>`,
      );
      zone = zone.replace(
        motif,
        (_, style, svg) =>
          `<button type="button" title="${libelle}" aria-label="${libelle}" onClick={${geste}} style={{ ${nu(style)} }}>${svg}</button>`,
      );
    };
    // Le sondage et le guide ouvrent les fenêtres de l'accueil (A01S, A01G) —
    // voir `useSondageGuides`. Ils disaient « pas encore ici » au premier lot.
    icone('M4 20V10M10 20V4M16 20v-7M22 20H2', 'composeur.onSondage', 'Créer un sondage');
    icone(
      'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
      'composeur.onGuide',
      'Lier un guide',
    );
    icone(
      'M3 4h18v16H3zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM21 16l-5-5-9 9',
      'composeur.onAjouterImage',
      'Ajouter une image',
    );
    if (!large) {
      // Le « Publier » du téléphone, aux mesures des icônes voisines (32 px, rayon 11).
      zone = zone.replace(
        /(<span style=\{\{ position: "absolute", right: "8px", bottom: "8px")/,
        '<button type="button" onClick={composeur.onPublier} disabled={composeur.bloque} data-reseau-publier="" ' +
          'style={{ position: "absolute", left: "8px", bottom: "8px", height: "32px", padding: "0 14px", borderRadius: "11px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", opacity: composeur.bloque ? ".55" : "1" }}>Publier</button>$1',
      );
    }
    out = out.slice(0, debutChamp) + zone + out.slice(finChamp);

    if (large) {
      // Les quatre pastilles de type → la rangée du composeur de l'accueil.
      const pastilles =
        /<span style=\{\{ height: "38px", padding: "0 14px", borderRadius: "999px"[^}]*\}\}><span style=\{\{[^}]*\}\}><\/span>Victoire<\/span>(?:<span style=\{\{ height: "38px"[^}]*\}\}><span style=\{\{[^}]*\}\}><\/span>(?:Question|Info|Discussion)<\/span>){3}/;
      const p = remplacerUn(
        out,
        pastilles,
        '{(composeur.types ?? []).map((t, tIndex) => (<button key={tIndex} type="button" onClick={t.onPick} ' +
          'style={{ height: "38px", padding: "0 14px", borderRadius: "999px", border: "none", font: "inherit", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", background: t.bg, color: t.fg }}>' +
          '<span style={{ width: "6px", height: "6px", borderRadius: "999px", background: t.dot }}></span>{t.label}</button>))}' +
          '{composeur.images === "" ? null : (<span style={{ fontSize: "12px", color: "#5D6B66", fontWeight: "600" }}>{composeur.images}</span>)}',
      );
      if (p !== null) out = p;
      const publier = remplacerUn(
        out,
        /<button style=\{\{ (height: "40px", padding: "0 20px", borderRadius: "14px", background: "#16785E"[^}]*) \}\}>Publier<\/button>/,
        (b) =>
          `<button type="button" onClick={composeur.onPublier} disabled={composeur.bloque} data-reseau-publier="" style={{ ${b[1]}, cursor: "pointer", opacity: composeur.bloque ? ".55" : "1" }}>Publier</button>`,
      );
      if (publier !== null) out = publier;
    }
    return { jsx: out, applied: true };
  },
};

/**
 * « OUTILS DU PROPRIÉTAIRE » — ANNONCE · ÉPINGLER · ÉVÉNEMENT.
 *
 * Le porteur : « Dans le fil, l'outil propriétaire (Annonce, Épingler,
 * Événement) ne marchent pas. » Trois `<span>` à 1 036 px, trois tuiles à
 * 390 px (la quatrième, « Gérer », est déjà un lien). Le libellé de la rangée dit
 * le rôle réel : un modérateur n'est pas le propriétaire.
 */
export const RV_OUTILS_FIL = {
  screens: ['A08T'],
  nom: 'RV_OUTILS_FIL',
  why: 'Les trois outils de l’équipe du fil — Annonce, Épingler, Événement — étaient dessinés et inertes.',
  provides: ['outils'],
  apply(jsx) {
    let out = jsx.replace('>Outils du propriétaire<', '>{outils.titre}<');
    let compte = out === jsx ? 0 : 1;
    const geste = {
      Annonce: null,
      Épingler: 'outils.onEpingler',
      Événement: 'outils.onEvenement',
    };
    for (const [libelle, appel] of Object.entries(geste)) {
      const motif = new RegExp(
        `<span style=\\{\\{ ((?:height: "36px", padding: "0 12px"|flex: "1", height: "48px")[^}]*) \\}\\}>(<svg(?:(?!<\\/svg>)[\\s\\S])*?<\\/svg>)${libelle}<\\/span>`,
      );
      const neuf = remplacerUn(out, motif, (m) =>
        appel === null
          ? `<Link href={outils.hrefAnnonce} data-reseau-annonce="" style={{ ${fusion(m[1], 'color: "#fff", textDecoration: "none"')} }}>${m[2]}${libelle}</Link>`
          : `<button type="button" onClick={${appel}} style={{ ${fusion(nu(m[1]), 'color: "#fff"')} }}>${m[2]}${libelle}</button>`,
      );
      if (neuf !== null) {
        out = neuf;
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * LE FIL VIDE SE DIT DANS LA COLONNE DU FIL, sous le composeur et l'annonce.
 */
export const RV_FIL_VIDE = {
  screens: ['A08T'],
  nom: 'RV_FIL_VIDE',
  why: 'Un fil sans publication restait une colonne blanche : l’état vide se dit à la place des cartes.',
  provides: ['publications', 'vides'],
  apply(jsx) {
    const neuf = remplacerUn(
      jsx,
      /\{\(publications \?\? \[\]\)\.map\(\(pub\) => \(<CartePublication(Desktop|Mobile) key=\{pub\.postId\} p=\{pub\} \/>\)\)\}/,
      (m) => `${m[0]}{(publications ?? []).length === 0 ? (<EtatVide texte={vides.fil} />) : null}`,
    );
    return neuf === null ? { jsx, applied: false } : { jsx: neuf, applied: true };
  },
};

// ─── A08T — LES COLONNES DE DROITE ───────────────────────────────────────────

/**
 * « PROCHAIN ÉVÉNEMENT », « SUJETS ÉPINGLÉS », « CE MOIS-CI » et la pastille
 * « Pays » des cartes « À PROPOS ». Voir `ColonneReseauView`.
 */
export const RV_COLONNE = {
  screens: ['A08T'],
  nom: 'RV_COLONNE',
  why: 'Les colonnes de droite du fil et des événements peignaient un événement, deux sujets épinglés et un compte du mois de maquette sur tous les réseaux.',
  provides: ['colonne', 'reseau'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;

    // La pastille « Pays » des cartes « À PROPOS » — le genre réel, en un mot.
    const pays = remplacerTous(
      out,
      /(<span style=\{\{ background: "#F2F5F4", color: "#5D6B66", fontSize: "1[01](?:\.5)?px"[^}]*\}\}>)Pays(<\/span>)/,
      (a) => `${a[1]}{reseau.genreCourt}${a[2]}`,
    );
    out = pays.out;
    compte += pays.compte;

    // PROCHAIN ÉVÉNEMENT.
    const titre = out.indexOf('>PROCHAIN ÉVÉNEMENT</div>');
    if (titre !== -1) {
      const debut = out.indexOf('<div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}>', titre);
      const fin = debut === -1 ? -1 : finElement(out, debut);
      if (fin !== -1) {
        let bloc = out.slice(debut, fin);
        bloc = bloc
          .replace('<div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}>', '<Link href={colonne.prochain.href} data-reseau-prochain="" style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px", textDecoration: "none", color: "inherit" }}>')
          .replace(/(<span style=\{\{ fontSize: "16px", fontWeight: "800", lineHeight: "1" \}\}>)[^<]*(<\/span>)/, '$1{colonne.prochain.numero}$2')
          .replace(/(<span style=\{\{ fontSize: "9px", fontWeight: "700" \}\}>)[^<]*(<\/span>)/, '$1{colonne.prochain.mois}$2')
          .replace(/(<div style=\{\{ fontSize: "13px", fontWeight: "700" \}\}>)[^<]*(<\/div>)/, '$1{colonne.prochain.titre}$2')
          .replace(/(<div style=\{\{ fontSize: "11\.5px", color: "#8A958F" \}\}>)[^<]*(<\/div>)/, '$1{colonne.prochain.sous}$2');
        bloc = `${bloc.slice(0, bloc.length - '</div>'.length)}</Link>`;
        out =
          out.slice(0, debut) +
          `{colonne.prochain === null ? (<EtatVide compact texte="Aucun événement à venir dans ce réseau." />) : (${bloc})}` +
          out.slice(fin);
        compte += 1;
      }
    }

    // SUJETS ÉPINGLÉS — les deux rangées dessinées deviennent la boucle.
    const epingles = out.indexOf('>SUJETS ÉPINGLÉS</div>');
    if (epingles !== -1) {
      const ouverture =
        '<div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "12px", fontSize: "13px", fontWeight: "600" }}>';
      const debut = out.indexOf(ouverture, epingles);
      if (debut !== -1) {
        let fin = debut;
        let rangees = 0;
        let modele = '';
        while (out.startsWith(ouverture, fin)) {
          const suivant = finElement(out, fin);
          if (suivant === -1) break;
          if (rangees === 0) modele = out.slice(fin, suivant);
          fin = suivant;
          rangees += 1;
        }
        if (rangees > 0) {
          const svg = /<svg(?:(?!<\/svg>)[\s\S])*<\/svg>/.exec(modele)?.[0] ?? '';
          const boucle =
            '{(colonne.epingles ?? []).length === 0 ? (<EtatVide compact texte="Aucun sujet épinglé." />) : null}' +
            '{(colonne.epingles ?? []).map((e, eIndex) => (<Link key={eIndex} href={e.href} data-reseau-epingle="" ' +
            'style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "12px", fontSize: "13px", fontWeight: "600", textDecoration: "none", color: "inherit" }}>' +
            `${svg}{e.titre}</Link>))}`;
          out = out.slice(0, debut) + boucle + out.slice(fin);
          compte += 1;
        }
      }
    }

    // CE MOIS-CI — le nombre et sa ligne.
    const mois = out.indexOf('>CE MOIS-CI</div>');
    if (mois !== -1) {
      const avant = out.length;
      out =
        out.slice(0, mois) +
        out
          .slice(mois)
          .replace(/(<div style=\{\{ fontSize: "[0-9]+px", fontWeight: "800"[^}]*\}\}>)3(<\/div>)/, '$1{colonne.moisNombre}$2')
          .replace(/>événements du réseau · 132 inscrits</, '>{colonne.moisSous}<');
      if (out.length !== avant) compte += 1;
    }

    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A08T — ÉVÉNEMENTS ───────────────────────────────────────────────────────

/**
 * « CRÉER UN ÉVÉNEMENT DU RÉSEAU » ET LA LISTE VIDE.
 *
 * Le porteur : « Ajoute dans Événement la possibilité d'avoir un bouton d'ajout
 * d'événement qui affiche la page Créer un événement (qui est actuellement
 * dessinée) en modal. » Le bouton est dessiné sur les deux planches de
 * l'équipe ; il ouvre maintenant la fenêtre, que l'écran pose une seule fois.
 */
export const RV_EVENEMENTS = {
  screens: ['A08T'],
  nom: 'RV_EVENEMENTS',
  why: 'Le bouton « Créer un événement du réseau » était inerte, et la liste vide était muette.',
  provides: ['outils', 'evenements', 'vides'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    const bouton = remplacerUn(
      out,
      /<button style=\{\{ ([^}]*) \}\}>(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)Créer un événement du réseau<\/button>/,
      (m) =>
        `<button type="button" onClick={outils.onEvenement} data-reseau-creer-evenement="" style={{ ${m[1]}, cursor: "pointer" }}>${m[2]}Créer un événement du réseau</button>`,
    );
    if (bouton !== null) {
      out = bouton;
      compte += 1;
    }
    // La fin de la boucle des cartes : `))}` après `{(evenements.liste ?? []).map(`.
    const at = out.indexOf('{(evenements.liste ?? []).map(');
    if (at !== -1) {
      // La boucle est une expression `{…}` : on cherche son accolade fermante en
      // comptant les accolades À PARTIR de son ouverture.
      let profondeur = 0;
      let fin = -1;
      for (let i = at; i < out.length; i += 1) {
        if (out[i] === '{') profondeur += 1;
        else if (out[i] === '}') {
          profondeur -= 1;
          if (profondeur === 0) {
            fin = i + 1;
            break;
          }
        }
      }
      if (fin !== -1) {
        out =
          out.slice(0, fin) +
          '{evenements.liste.length === 0 && evenements.echec === null ? (<EtatVide texte={vides.evenements} />) : null}' +
          out.slice(fin);
        compte += 1;
      }
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A08T — MEMBRES ──────────────────────────────────────────────────────────

/**
 * LA RECHERCHE, LES FILTRES, LE MENU DE RÔLE ET LA LISTE VIDE.
 *
 * Le champ devient un `<input>` dans le `<div>` dessiné (même fond, même rayon) ;
 * « Tous » et « Modérateurs » deviennent des boutons qui choisissent `role` ;
 * « Lyon » est RETIRÉ (le porteur ne le comprenait pas, et rien ne le portait).
 * La planche de 390 px ne dessine aucune pastille : elle reçoit les deux mêmes,
 * aux mesures de celles d'ordinateur, sous le champ.
 *
 * ── LE MENU DE RÔLE S'OUVRE SOUS SON BOUTON ─────────────────────────────────
 *
 * Le porteur : « le menu de trois points sur les membres ne s'affiche pas bien
 * […] Il s'affiche en bas de la section au lieu d'être sous le bouton ». C'est
 * la maquette qui le pose à `right: 30px; top: 240px` — une position de PLANCHE,
 * vraie pour la deuxième rangée dessinée et fausse pour toutes les autres
 * (piège 6). Le menu est donc déplacé DANS la rangée du membre visé, ancré sous
 * sa poignée, et un voile transparent le referme au clic dehors.
 */
export const RV_MEMBRES = {
  screens: ['A08T'],
  nom: 'RV_MEMBRES',
  why: 'La recherche était un <div>, les filtres des <span> (dont un « Lyon » sans objet), et le menu de rôle s’ouvrait en bas de la carte au lieu de sous son bouton.',
  provides: ['filtreMembres', 'gerer', 'vides'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;

    // Le champ de recherche — ordinateur et téléphone.
    const champ = remplacerUn(
      out,
      /(<div style=\{\{ (?:flex: "1", height: "44px"|height: "42px", borderRadius: "999px", background: "#fff")[^}]*\}\}>)(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)Rechercher parmi \{reseau\.membres\}(<\/div>)/,
      (m) =>
        `${m[1]}${m[2]}<input type="search" value={filtreMembres.q} onChange={filtreMembres.onQ} ` +
        'placeholder={`Rechercher parmi ${reseau.membres}`} aria-label="Rechercher un membre" data-membres-recherche="" ' +
        'style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", color: "#16211D", outline: "none", padding: 0 }} />' +
        m[3],
    );
    if (champ !== null) {
      out = champ;
      compte += 1;
    }

    // Les pastilles d'ordinateur : Tous · Modérateurs · Lyon.
    const pastilles = remplacerUn(
      out,
      /<span style=\{\{ (padding: "8px 13px", borderRadius: "999px", fontSize: "12\.5px", fontWeight: "700"), background: "#16785E", color: "#fff", border: "1px solid #16785E" \}\}>Tous<\/span><span style=\{\{[^}]*\}\}>Modérateurs<\/span><span style=\{\{[^}]*\}\}>Lyon<\/span>/,
      (m) =>
        `<button type="button" onClick={filtreMembres.onTous} aria-pressed={!filtreMembres.moderateurs} data-membres-filtre="tous" style={{ ${m[1]}, backgroundColor: filtreMembres.tousBg, color: filtreMembres.tousFg, border: \`1px solid \${filtreMembres.tousBd}\`, fontFamily: "inherit", cursor: "pointer" }}>Tous</button>` +
        `<button type="button" onClick={filtreMembres.onModerateurs} aria-pressed={filtreMembres.moderateurs} data-membres-filtre="moderateurs" style={{ ${m[1]}, backgroundColor: filtreMembres.modBg, color: filtreMembres.modFg, border: \`1px solid \${filtreMembres.modBd}\`, fontFamily: "inherit", cursor: "pointer" }}>Modérateurs</button>`,
    );
    if (pastilles !== null) {
      out = pastilles;
      compte += 1;
    } else if (out.includes('data-membres-recherche=""') && out.includes('height: "42px", borderRadius: "999px", background: "#fff"')) {
      // Le téléphone : les deux mêmes pastilles sous le champ (aucune n'y est dessinée).
      const at = out.indexOf('data-membres-recherche=""');
      const debutChamp = out.lastIndexOf('<div style={{ height: "42px", borderRadius: "999px", background: "#fff"', at);
      const finChamp = debutChamp === -1 ? -1 : finElement(out, debutChamp);
      if (finChamp !== -1) {
        const style = 'padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700"';
        out =
          out.slice(0, finChamp) +
          '<div style={{ display: "flex", gap: "6px", flexShrink: "0" }}>' +
          `<button type="button" onClick={filtreMembres.onTous} aria-pressed={!filtreMembres.moderateurs} data-membres-filtre="tous" style={{ ${style}, backgroundColor: filtreMembres.tousBg, color: filtreMembres.tousFg, border: \`1px solid \${filtreMembres.tousBd}\`, fontFamily: "inherit", cursor: "pointer" }}>Tous</button>` +
          `<button type="button" onClick={filtreMembres.onModerateurs} aria-pressed={filtreMembres.moderateurs} data-membres-filtre="moderateurs" style={{ ${style}, backgroundColor: filtreMembres.modBg, color: filtreMembres.modFg, border: \`1px solid \${filtreMembres.modBd}\`, fontFamily: "inherit", cursor: "pointer" }}>Modérateurs</button>` +
          '</div>' +
          out.slice(finChamp);
        compte += 1;
      }
    }

    // La liste vide, après la boucle des membres.
    const boucle = out.indexOf('{(gerer.membres ?? []).map((m, mIndex) => (');
    if (boucle !== -1) {
      const fin = out.indexOf('</Fragment>\n))}', boucle);
      if (fin !== -1) {
        const apres = fin + '</Fragment>\n))}'.length;
        out =
          out.slice(0, apres) +
          '{(gerer.membres ?? []).length === 0 ? (<EtatVide texte={vides.membres} />) : null}' +
          out.slice(apres);
        compte += 1;
      }
    }

    // Le menu d'ordinateur : de la position de planche à la rangée du membre.
    const menu =
      /\{gerer\.menu === null \? null : \(<div style=\{\{ position: "absolute", zIndex: 30, right: "30px", top: "240px", ([^}]*) \}\}>/;
    const mm = menu.exec(out);
    if (mm !== null) {
      const debutMenu = mm.index + mm[0].length - 1 - (mm[0].length - mm[0].indexOf('<div'));
      const debutDiv = mm.index + mm[0].indexOf('<div');
      const finDiv = finElement(out, debutDiv);
      if (finDiv !== -1 && out.startsWith(')}', finDiv)) {
        void debutMenu;
        const corps = out.slice(debutDiv, finDiv).replace(
          'position: "absolute", zIndex: 30, right: "30px", top: "240px", ',
          'position: "absolute", zIndex: 30, right: "4px", top: "calc(100% - 6px)", ',
        );
        // Le menu quitte sa place de planche…
        out = out.slice(0, mm.index) + out.slice(finDiv + 2);
        // … et se pose dans la rangée, après la poignée, avec son voile.
        const poignee = out.indexOf('data-membre-options=""');
        const finPoignee = poignee === -1 ? -1 : out.indexOf('</button>', poignee);
        if (finPoignee !== -1) {
          const apres = finPoignee + '</button>'.length;
          out =
            out.slice(0, apres) +
            '{gerer.menu === m.userId ? (<><button type="button" aria-label="Fermer le menu" onClick={gerer.onFermerMenu} data-membre-menu-voile="" style={{ position: "fixed", inset: "0", zIndex: 29, background: "transparent", border: "none", padding: 0, cursor: "default" }}></button>' +
            corps +
            '</>) : null}' +
            out.slice(apres);
          // La rangée devient l'ancre du menu.
          const rangee = out.lastIndexOf('<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 4px"', poignee);
          if (rangee !== -1) {
            out =
              out.slice(0, rangee) +
              '<div style={{ position: "relative", display: "flex", alignItems: "center", gap: "12px", padding: "12px 4px"' +
              out.slice(rangee + '<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 4px"'.length);
          }
          compte += 1;
        }
      }
    }

    // Les entrées du menu : « Retirer » retire (on peut revenir), « Bannir » bannit,
    // et l'équipe peut RÉVOQUER un modérateur — voir `GestionReseauView`.
    const retirer = remplacerTous(
      out,
      /onClick=\{gerer\.onBannir\}( disabled=\{gerer\.occupe\} )data-membre-bannir=""( style=\{\{[^}]*color: "#16211D"[^}]*\}\}>)(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)Retirer du réseau/,
      (a) => `onClick={gerer.onRetirer}${a[1]}data-membre-retirer=""${a[2]}${a[3]}Retirer du réseau`,
    );
    out = retirer.out;
    compte += retirer.compte;
    const nommer = remplacerTous(
      out,
      /\{gerer\.membreMenu\?\.nommable === true \? \((<button type="button" onClick=\{gerer\.onNommerModerateur\}[^>]*>(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)Nommer modérat(?:eur·rice|rice)<\/button>)\) : null\}/,
      (a) =>
        `{gerer.membreMenu?.nommable === true ? (${a[1]}) : null}` +
        `{gerer.membreMenu?.revocable === true ? (${a[1]
          .replace('onClick={gerer.onNommerModerateur}', 'onClick={gerer.onRevoquerModerateur}')
          .replace('data-membre-nommer=""', 'data-membre-revoquer=""')
          .replace(/Nommer modérat(?:eur·rice|rice)<\/button>$/, 'Retirer le rôle de modérateur</button>')}) : null}`,
    );
    out = nommer.out;
    compte += nommer.compte;

    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A08T — ALBUM : L'ÉTAT VIDE DANS LA GRILLE ───────────────────────────────

export const RV_ALBUM_VIDE = {
  screens: ['A08T'],
  nom: 'RV_ALBUM_VIDE',
  why: 'Un album sans photo restait une grille blanche : l’état vide se dit à la place des tuiles.',
  provides: ['album', 'vides'],
  apply(jsx) {
    const at = jsx.indexOf('{(album.photos ?? []).map(');
    if (at === -1) return { jsx, applied: false };
    let profondeur = 0;
    let fin = -1;
    for (let i = at; i < jsx.length; i += 1) {
      if (jsx[i] === '{') profondeur += 1;
      else if (jsx[i] === '}') {
        profondeur -= 1;
        if (profondeur === 0) {
          fin = i + 1;
          break;
        }
      }
    }
    if (fin === -1) return { jsx, applied: false };
    return {
      jsx:
        jsx.slice(0, fin) +
        '{album.prete && album.echec === null && (album.photos ?? []).length === 0 ? (<EtatVide texte={vides.album} />) : null}' +
        jsx.slice(fin),
      applied: true,
    };
  },
};

/**
 * « ALBUM OUVERT AUX MEMBRES » — LE BOUTON « AJOUTER » SUIT LE PARAMÈTRE.
 *
 * Le porteur : « L'option "Album ouvert aux membres" peut permettre aux membres
 * d'ajouter des photos dans des albums déjà créés (le bouton d'ajout dans ce cas
 * est actif). » Le bouton « Ajouter » était réservé à l'équipe (`album.moderateur`) ;
 * il paraît maintenant aussi pour un membre quand l'album est ouvert — le crochet
 * le dit par `album.moderateur`, renommé dans sa note —, mais l'entrée « Ajouter
 * un album » reste à l'équipe : la création d'un album n'est pas ouverte (le
 * service la garde sous `MODERATOR_REQUIRED`).
 */
export const RV_ALBUM_OUVERT = {
  screens: ['A08T'],
  nom: 'RV_ALBUM_OUVERT',
  why: 'Le paramètre « Album ouvert aux membres » n’avait aucun effet à l’écran : le bouton d’ajout restait réservé à l’équipe.',
  provides: ['album'],
  apply(jsx) {
    const motif =
      /<button type="button" onClick=\{album\.onAjouterAlbum\}(?:(?!<\/button>)[\s\S])*?Ajouter un album<\/button>/g;
    let compte = 0;
    const out = jsx.replace(motif, (m) => {
      compte += 1;
      return `{album.peutCreerAlbum ? (${m}) : null}`;
    });
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A08T — À PROPOS ─────────────────────────────────────────────────────────

/**
 * LA DESCRIPTION, LES RÈGLES, L'ÉQUIPE ET LES « MODIFIER ».
 *
 * La description de la vue membre et de la vue de l'équipe écrivait encore
 * « Le réseau des Béninoises et Béninois… » ; les trois règles et les trois
 * membres d'équipe étaient ceux de la maquette. Tout vient maintenant de la
 * fiche. « Modifier » (deux fois, sur la planche de l'équipe) mène à la planche
 * d'édition.
 *
 * ⚠ LA FENÊTRE DE SIGNALEMENT QUITTE LE CADRE. `A08T_GERER_SIGNALER` la posait
 * DANS chaque cadre, c'est-à-dire en DEUX exemplaires portalisés — le défaut
 * déjà mesuré sur `FenetreConfirmation` (le voile du cadre masqué intercepte
 * les clics de l'autre). Le porteur : « Même le modal de signalement ne marche
 * pas. » Elle est maintenant posée une seule fois par `reseau-screen.tsx`.
 */
export const RV_APROPOS = {
  screens: ['A08T'],
  nom: 'RV_APROPOS',
  why: 'La description, les règles et l’équipe de l’onglet « À propos » étaient celles de la maquette, les « Modifier » ne menaient nulle part, et la fenêtre de signalement était posée deux fois.',
  provides: ['apropos', 'reseau'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;

    // La fenêtre de signalement, posée en double — retirée du cadre.
    const fenetre = '<FenetreSignalement sujet={gerer.signalement} onFermer={gerer.onFermerSignalement} />';
    if (out.includes(fenetre)) {
      out = out.split(fenetre).join('');
      compte += 1;
    }

    // ⚠ LES PLANCHES D'ÉDITION portent les mêmes titres (« RÈGLES DU RÉSEAU »)
    // et sont l'affaire de `RV_EDITION` : y lier la vue de lecture transformait
    // les règles éditables en texte figé — mesuré sur la planche de 390 px.
    const edition = out.includes('Ajouter une règle');

    // La description — ordinateur (un <p>) et téléphone (un <div> après le titre).
    const desc = remplacerUn(
      out,
      /<p style=\{\{ margin: "10px 0 0", fontSize: "14\.5px", lineHeight: "1\.7" \}\}>Le réseau des Béninoises[^<]*<\/p>/,
      '{reseau.description === "" ? (<EtatVide compact texte="Aucune description pour le moment." />) : (<p style={{ margin: "10px 0 0", fontSize: "14.5px", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>{reseau.description}</p>)}',
    );
    if (desc !== null) {
      out = desc;
      compte += 1;
    }
    const descMobile = remplacerUn(
      out,
      /<div style=\{\{ marginTop: "8px", fontSize: "13\.5px", lineHeight: "1\.6" \}\}>Le réseau des Béninoises[^<]*<\/div>/,
      '{reseau.description === "" ? (<EtatVide compact texte="Aucune description pour le moment." />) : (<div style={{ marginTop: "8px", fontSize: "13.5px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{reseau.description}</div>)}',
    );
    if (descMobile !== null) {
      out = descMobile;
      compte += 1;
    }

    // Les règles : la suite de rangées numérotées après « RÈGLES DU RÉSEAU ».
    const regles = edition ? -1 : out.indexOf('>RÈGLES DU RÉSEAU</div>');
    if (regles !== -1) {
      const debut = out.indexOf('<div style={{ display: "flex", gap: "1', regles);
      if (debut !== -1 && debut - regles < 400) {
        const ouverture = out.slice(debut, out.indexOf('>', debut) + 1);
        let fin = debut;
        let modele = '';
        let n = 0;
        while (out.startsWith(ouverture, fin)) {
          const suivant = finElement(out, fin);
          if (suivant === -1) break;
          if (n === 0) modele = out.slice(fin, suivant);
          fin = suivant;
          n += 1;
        }
        if (n > 0) {
          const ligne = modele
            .replace(/(<span style=\{\{ width: "2[46]px"[^}]*\}\}>)1(<\/span>)/, '$1{r.n}$2')
            .replace(/(<span style=\{\{ flex: "1"[^}]*\}\}>)[^<]*(<\/span>)/, '$1{r.texte}$2')
            .replace(/(<\/span>)Bienveillance[^<]*(<\/div>)$/, '$1{r.texte}$2');
          out =
            out.slice(0, debut) +
            `{(apropos.regles ?? []).length === 0 ? (<EtatVide compact texte="Ce réseau n’a pas encore écrit ses règles." />) : null}{(apropos.regles ?? []).map((r, rIndex) => (<Fragment key={rIndex}>${ligne}</Fragment>))}` +
            out.slice(fin);
          compte += 1;
        }
      }
    }

    // L'équipe : la rangée de membres après « ÉQUIPE ».
    const equipe = edition ? -1 : out.indexOf('>ÉQUIPE</div>');
    if (equipe !== -1) {
      const debut = out.indexOf('<div style={{ display: "flex", gap: "1', equipe);
      const fin = debut === -1 ? -1 : finElement(out, debut);
      if (fin !== -1) {
        const rangee = out.slice(debut, fin);
        const ouvrante = rangee.slice(0, rangee.indexOf('>') + 1);
        // APRÈS l'ouvrante : la rangée commence elle-même par `display: "flex", gap:`.
        const premier = rangee.indexOf('<div style={{ display: "flex", gap: "', ouvrante.length);
        const finPremier = premier === -1 ? -1 : finElement(rangee, premier);
        if (premier !== -1 && finPremier !== -1) {
          const modele = rangee
            .slice(premier, finPremier)
            .replace(/background: "#[0-9A-F]{6}", color: "#fff"/, 'backgroundColor: q.bg, color: "#fff"')
            .replace(/(fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" \}\}>)[A-Z]{2}(<\/span>)/, '$1{q.i}$2')
            .replace(/(fontWeight: "700"(?: \}\}>| \}\}>))(?:Aïcha Diop|Aïcha)(<\/)/, '$1{q.nom}$2')
            .replace(/(color: "#8A958F" \}\}>)Propriétaire(<\/)/, '$1{q.role}$2');
          out =
            out.slice(0, debut) +
            ouvrante.replace(' }}>', ', flexWrap: "wrap" }}>') +
            `{(apropos.equipe ?? []).map((q, qIndex) => (<Fragment key={qIndex}>${modele}</Fragment>))}</div>` +
            out.slice(fin);
          compte += 1;
        }
      }
    }

    // Le téléphone : la planche « À propos » ne dessine AUCUN « Modifier », et
    // c'est pourtant la seule porte vers sa planche d'édition de 390 px. Le lien
    // se pose à la place que l'ordinateur lui donne — à droite du titre
    // « DESCRIPTION », dans la rangée `space-between` déjà dessinée vide —, aux
    // mesures du « Modifier » d'ordinateur. REMONTÉ.
    out = out.replace(
      /(<div style=\{\{ display: "flex", justifyContent: "space-between" \}\}><div style=\{\{[^}]*\}\}>DESCRIPTION<\/div>)(<\/div>)/,
      '$1{apropos.modifiable ? (<Link href={apropos.hrefModifier} data-apropos-modifier="" style={{ fontSize: "12.5px", fontWeight: "700", color: "#16785E", textDecoration: "none" }}>Modifier</Link>) : null}$2',
    );

    // Les « Modifier » de la planche de l'équipe → la planche d'édition.
    const modifier = remplacerTous(
      out,
      /<span style=\{\{ (fontSize: "12\.5px", fontWeight: "700", color: "#16785E") \}\}>Modifier<\/span>/,
      (a) =>
        `{apropos.modifiable ? (<Link href={apropos.hrefModifier} data-apropos-modifier="" style={{ ${a[1]}, textDecoration: "none" }}>Modifier</Link>) : null}`,
    );
    out = modifier.out;
    compte += modifier.compte;

    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * LA PLANCHE D'ÉDITION DE « À PROPOS » — LES CHAMPS ÉDITABLES.
 *
 * Le porteur : « Les champs ne sont pas modifiables et l'option Modifier
 * n'affiche pas les champs. » La description était un `<div>` bordé de vert avec
 * un faux curseur ; les quatre règles des `<div>` ; « Ajouter une règle », la
 * corbeille, « Annuler » et « Enregistrer » des `<span>` et des boutons sans
 * geste. Chaque nœud garde ses mesures — seul l'élément change.
 *
 * « Glissez pour réordonner » : la poignée est dessinée, et AUCUN geste de
 * glisser n'est branché — l'ordre est celui de la saisie. REMONTÉ.
 */
export const RV_EDITION = {
  screens: ['A08T'],
  nom: 'RV_EDITION',
  why: 'La planche « À propos — édition » ne permettait de rien modifier : description, règles, ajout, suppression et enregistrement étaient dessinés.',
  provides: ['apropos'],
  apply(jsx) {
    if (!jsx.includes('RÈGLES DU RÉSEAU · 4 SUR 8') && !jsx.includes('/ 500<')) {
      return { jsx, applied: false };
    }
    let out = jsx;
    let compte = 0;

    // Le compteur de règles : « 4 SUR 8 ».
    out = out.replace('RÈGLES DU RÉSEAU · 4 SUR 8', 'RÈGLES DU RÉSEAU · {apropos.edition.reglesCompte}');
    out = out.replace('>{reseau.descriptionLongueur} / 500<', '>{apropos.edition.longueur} / {apropos.edition.descriptionMax}<');

    // La description : le <div> bordé de vert, faux curseur compris.
    const desc = remplacerUn(
      out,
      /<div style=\{\{ ((?:marginTop: "10px", )?minHeight: "[0-9]+px", borderRadius: "16px", border: "1\.5px solid #16785E"[^}]*|marginTop: "8px", fontSize: "13\.5px", lineHeight: "1\.6", border: "1\.5px solid #16785E"[^}]*) \}\}>(?:Le réseau des Béninoises[^<]*|\{reseau\.description\})(?:<span style=\{\{ display: "inline-block"[^}]*\}\}><\/span>)?<\/div>/,
      (m) =>
        `<textarea value={apropos.edition.description} onChange={apropos.edition.onDescription} maxLength={apropos.edition.descriptionMax} aria-label="La description du réseau" data-apropos-description="" style={{ ${m[1]}, display: "block", width: "100%", boxSizing: "border-box", font: "inherit", fontSize: "14.5px", color: "#16211D", outline: "none", resize: "vertical", background: "#fff" }} />`,
    );
    if (desc !== null) {
      out = desc;
      compte += 1;
    }

    // Catégorie et visibilité : verrouillées sur un réseau automatique (ce que la
    // planche dessine), lues sur la fiche sinon.
    out = out.replace(
      /(<svg[^>]*><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" \/><\/svg>)Pays(<\/div>)/,
      '$1{apropos.edition.categorie}$2',
    );
    out = out.replace(
      />Catégorie et visibilité sont fixées pour un réseau automatique de pays\.</,
      '>{apropos.edition.automatique ? "Catégorie et visibilité sont fixées pour un réseau automatique." : "La catégorie et la visibilité se changent dans « Gérer · Paramètres »."}<',
    );

    // Les règles : la suite de rangées éditables.
    // Les deux planches n'ordonnent pas les déclarations de la rangée de la même
    // façon (ordinateur : `alignItems` puis `gap`, téléphone : `gap` puis
    // `alignItems`) — on prend la première des deux qui suit le titre.
    const titreRegles = out.indexOf('RÈGLES DU RÉSEAU');
    const candidats = [
      out.indexOf('<div style={{ display: "flex", alignItems: "center", gap: "1', titreRegles),
      out.indexOf('<div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "10px" }}>', titreRegles),
    ].filter((i) => i !== -1);
    const debut = candidats.length === 0 ? -1 : Math.min(...candidats);
    if (debut !== -1) {
      const ouverture = out.slice(debut, out.indexOf('>', debut) + 1);
      let fin = debut;
      let modele = '';
      let n = 0;
      while (out.startsWith(ouverture, fin)) {
        const suivant = finElement(out, fin);
        if (suivant === -1) break;
        if (n === 0) modele = out.slice(fin, suivant);
        fin = suivant;
        n += 1;
      }
      if (n > 0) {
        let ligne = modele.replace(/(<span style=\{\{ width: "2[0-9]px", height: "2[0-9]px"[^}]*\}\}>)1(<\/span>)/, '$1{r.n}$2');
        ligne = ligne.replace(
          /<div style=\{\{ (flex: "1", minHeight: "[0-9]+px", borderRadius: "1[0-9]px", border: "1px solid #E6EBE9"[^}]*) \}\}>[^<]*<\/div>/,
          (_, style) =>
            `<input type="text" value={r.texte} onChange={r.onTexte} aria-label={\`Règle \${r.n}\`} data-apropos-regle="" style={{ ${style}, minWidth: "0", font: "inherit", color: "#16211D", outline: "none", background: "#fff", boxSizing: "border-box" }} />`,
        );
        // Le téléphone écrit la règle dans un <span> bordé, pas dans un <div>.
        ligne = ligne.replace(
          /<span style=\{\{ (flex: "1", fontSize: "13px", lineHeight: "1\.45", border: "1px solid #E6EBE9"[^}]*) \}\}>(?:\{r\.texte\}|[^<{]*)<\/span>/,
          (_, style) =>
            `<input type="text" value={r.texte} onChange={r.onTexte} aria-label={\`Règle \${r.n}\`} data-apropos-regle="" style={{ ${style}, minWidth: "0", font: "inherit", fontSize: "13px", color: "#16211D", outline: "none", background: "#fff", boxSizing: "border-box" }} />`,
        );
        // … et sa corbeille est une icône nue, sans pastille.
        ligne = ligne.replace(
          /(<\/span>|\/>)(<svg width="14" height="14"[^>]*><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" \/><\/svg>)(<\/div>)$/,
          (_, avant, svg, fin) =>
            `${avant}<button type="button" onClick={r.onRetirer} aria-label={\`Retirer la règle \${r.n}\`} data-apropos-regle-retirer="" style={{ ${NU}, background: "none", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>${svg}</button>${fin}`,
        );
        ligne = ligne.replace(
          /<span style=\{\{ ((?:width: "3[0-9]px", height: "3[0-9]px")[^}]*) \}\}>(<svg[^>]*><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" \/><\/svg>)<\/span>/,
          (_, style, svg) =>
            `<button type="button" onClick={r.onRetirer} aria-label={\`Retirer la règle \${r.n}\`} data-apropos-regle-retirer="" style={{ ${nu(style)} }}>${svg}</button>`,
        );
        out =
          out.slice(0, debut) +
          `{(apropos.edition.regles ?? []).map((r, rIndex) => (<Fragment key={rIndex}>${ligne}</Fragment>))}` +
          out.slice(fin);
        compte += 1;
      }
    }

    // « Ajouter une règle ».
    const ajouter = remplacerUn(
      out,
      /<span style=\{\{ ([^}]*) \}\}>(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)Ajouter une règle<\/span>/,
      (m) =>
        `{apropos.edition.peutAjouter ? (<button type="button" onClick={apropos.edition.onAjouterRegle} data-apropos-regle-ajouter="" style={{ ${nu(m[1])}, background: "none", width: "100%" }}>${m[2]}Ajouter une règle</button>) : null}`,
    );
    if (ajouter !== null) {
      out = ajouter;
      compte += 1;
    }

    // « Prévenir les membres » : la case dessinée cochée devient un interrupteur.
    out = out.replace(
      /<label style=\{\{ ([^}]*) \}\}><span style=\{\{ (width: "20px", height: "20px", borderRadius: "6px"), background: "#16785E", ([^}]*) \}\}>(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)<\/span>Prévenir les membres du changement de règles<\/label>/,
      (_, label, taille, reste, svg) =>
        `<button type="button" role="checkbox" aria-checked={apropos.edition.prevenir} onClick={apropos.edition.onPrevenir} data-apropos-prevenir="" style={{ ${NU}, ${label}, background: "none", textAlign: "left" }}><span style={{ ${taille}, backgroundColor: apropos.edition.prevenir ? "#16785E" : "#fff", border: apropos.edition.prevenir ? "none" : "1.5px solid #CBD5D1", ${reste} }}>{apropos.edition.prevenir ? (${svg}) : null}</span>Prévenir les membres du changement de règles</button>`,
    );

    // Le téléphone : la même case, dans une rangée sans <label>.
    out = out.replace(
      /<div style=\{\{ (display: "flex", alignItems: "center", gap: "10px", flexShrink: "0") \}\}><span style=\{\{ (width: "20px", height: "20px", borderRadius: "6px"), background: "#16785E", ([^}]*) \}\}>(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)<\/span>(<span style=\{\{[^}]*\}\}>Prévenir les membres du changement de règles<\/span>)<\/div>/,
      (_, rangee, taille, reste, svg, texte) =>
        `<button type="button" role="checkbox" aria-checked={apropos.edition.prevenir} onClick={apropos.edition.onPrevenir} data-apropos-prevenir="" style={{ ${NU}, ${rangee}, background: "none", textAlign: "left" }}><span style={{ ${taille}, backgroundColor: apropos.edition.prevenir ? "#16785E" : "#fff", border: apropos.edition.prevenir ? "none" : "1.5px solid #CBD5D1", ${reste} }}>{apropos.edition.prevenir ? (${svg}) : null}</span>${texte}</button>`,
    );
    // Le téléphone : la croix de l'en-tête annule et revient à « À propos ».
    out = out.replace(
      /<span style=\{\{ (width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0"[^}]*) \}\}>(<svg[^>]*><path d="M18 6 6 18M6 6l12 12" \/><\/svg>)<\/span>/,
      (_, style, svg) =>
        `<button type="button" onClick={apropos.edition.onAnnuler} aria-label="Annuler les modifications" data-apropos-annuler="" style={{ ${NU}, ${style} }}>${svg}</button>`,
    );

    // La barre d'enregistrement : la pastille, « Annuler », « Enregistrer ».
    out = out.replace(
      />Modifications non enregistrées</,
      '>{apropos.edition.modifie ? "Modifications non enregistrées" : "Aucune modification"}<',
    );
    const annuler = remplacerUn(
      out,
      /<button style=\{\{ ([^}]*) \}\}>Annuler<\/button>/,
      (m) =>
        `<button type="button" onClick={apropos.edition.onAnnuler} data-apropos-annuler="" style={{ ${m[1]}, cursor: "pointer" }}>Annuler</button>`,
    );
    if (annuler !== null) {
      out = annuler;
      compte += 1;
    }
    const enregistrer = remplacerUn(
      out,
      /<button style=\{\{ ([^}]*) \}\}>Enregistrer<\/button>/,
      (m) =>
        `<button type="button" onClick={apropos.edition.onEnregistrer} disabled={apropos.edition.occupe || !apropos.edition.modifie} data-apropos-enregistrer="" style={{ ${m[1]}, cursor: "pointer", opacity: apropos.edition.occupe || !apropos.edition.modifie ? ".55" : "1" }}>Enregistrer</button>`,
    );
    if (enregistrer !== null) {
      out = enregistrer;
      compte += 1;
    }

    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── A08T — GÉRER ────────────────────────────────────────────────────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « GÉRER » — LE RAIL, LES TUILES, LES DEUX LISTES BORNÉES, LES PARAMÈTRES    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Voir `PilotageReseauView`. Le rail (et la rangée de pastilles du téléphone)
 * devient une navigation par `?section=` ; la vue d'ensemble borne les demandes
 * et les signalements à trois rangées, avec « Voir plus » vers leur section ; la
 * file de validation des publications s'insère après les demandes ; « Voir »
 * ouvre l'extrait du contenu signalé ; les trois interrupteurs et la pastille de
 * visibilité deviennent des boutons.
 */
export const RV_GERER = {
  screens: ['A08T'],
  nom: 'RV_GERER',
  why: 'La vue « Gérer » était dessinée : rail, tuiles, listes complètes sans « Voir plus », « Voir » éteint, paramètres et visibilité inertes.',
  provides: ['pilotage', 'gerer', 'reseau'],
  apply(jsx) {
    const ordinateur = jsx.includes('>GÉRER LE RÉSEAU</div>');
    // Le titre de 390 px n'est promu en <h1> qu'APRÈS les adaptations : on
    // reconnaît la planche à sa pastille « Demandes · N », qu'elle seule porte.
    const telephone = jsx.includes('>Demandes · {reseau.demandes}<');
    if (!ordinateur && !telephone) return { jsx, applied: false };
    let out = jsx;

    // ── Le rail (ordinateur) et la rangée de pastilles (téléphone) ──────────
    const ENTREES = [
      ['Vue d’ensemble', 'ensemble'],
      ['Demandes d’adhésion · {reseau.demandes}', 'demandes'],
      ['Demandes · {reseau.demandes}', 'demandes'],
      ['Signalements · {gerer.signalementsOuverts}', 'signalements'],
      ['Paramètres', 'parametres'],
    ];
    for (const [texte, section] of ENTREES) {
      const motif = new RegExp(
        `<span style=\\{\\{ ([^}]*?)(?:, )?fontWeight: "(?:700|500)", background: "(?:#E3F0EB|transparent)", color: "(?:#0F5C48|#16211D)"( \\}\\})>${echapper(texte)}<\\/span>`,
      );
      out = out.replace(
        motif,
        (_, avant) =>
          `<Link href={pilotage.hrefSection("${section}")} data-gerer-section="${section}" style={{ ${avant}, fontWeight: pilotage.railPoids("${section}"), backgroundColor: pilotage.railBg("${section}"), color: pilotage.railFg("${section}"), textDecoration: "none" }}>${texte}</Link>`,
      );
      const pastille = new RegExp(
        `<span style=\\{\\{ ([^}]*?), background: "(?:#16211D|#fff)", color: "(?:#fff|#16211D)", border: "1px solid (?:#16211D|#E6EBE9)" \\}\\}>${echapper(texte)}<\\/span>`,
      );
      out = out.replace(
        pastille,
        (_, avant) =>
          `<Link href={pilotage.hrefSection("${section}")} data-gerer-section="${section}" style={{ ${avant}, backgroundColor: pilotage.railFg("${section}") === "#0F5C48" ? "#16211D" : "#fff", color: pilotage.railFg("${section}") === "#0F5C48" ? "#fff" : "#16211D", border: pilotage.railFg("${section}") === "#0F5C48" ? "1px solid #16211D" : "1px solid #E6EBE9", textDecoration: "none" }}>${texte}</Link>`,
      );
    }
    // « Rôles et équipe » / « Rôles » → l'onglet « Membres », filtre « Modérateurs ».
    out = out.replace(
      /<span style=\{\{ ([^}]*) \}\}>(Rôles et équipe|Rôles)<\/span>/,
      (_, style, texte) =>
        `<Link href="?onglet=membres" data-gerer-section="roles" style={{ ${style}, textDecoration: "none" }}>${texte}</Link>`,
    );

    // ── Les tuiles : « +34 ce mois » et « 61 % » ────────────────────────────
    out = out.replace(/>\+34 ce mois</, '>{pilotage.tuiles.nouveaux}<');
    out = out.replace(/>61 %</, '>{pilotage.tuiles.actifs}<');
    const tuiles = remplacerUn(
      out,
      /<div style=\{\{ display: "grid", gridTemplateColumns: "(?:repeat\(4,1fr\)|1fr 1fr)", gap: "(?:10|8)px"(?:, flexShrink: "0")? \}\}>/,
      (m) => `{pilotage.montrer("tuiles") ? (${m[0]}`,
    );
    if (tuiles !== null) {
      const debut =
        tuiles.indexOf('{pilotage.montrer("tuiles") ? (') + '{pilotage.montrer("tuiles") ? ('.length;
      const fin = finElement(tuiles, debut);
      // La coupe COMPTE ses balises (piège 3) : si elle ne retombe pas à zéro,
      // on renonce à envelopper plutôt que de produire un JSX déséquilibré.
      if (fin !== -1) out = `${tuiles.slice(0, fin)}) : null}${tuiles.slice(fin)}`;
    }

    // ── Ordinateur : les deux cartes, leur borne et leur « Voir plus » ──────
    if (ordinateur) {
      const carte = (titre, cle, borne, voirPlus, section) => {
        const at = out.indexOf(titre);
        if (at === -1) return;
        const debut = out.lastIndexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}>', at);
        const fin = debut === -1 ? -1 : finElement(out, debut);
        if (fin === -1) return;
        let bloc = out.slice(debut, fin);
        bloc = bloc.replace(`{(gerer.${cle} ?? []).map(`, `{(gerer.${cle} ?? []).slice(0, pilotage.${borne}).map(`);
        const vide =
          cle === 'demandes'
            ? '{(gerer.demandes ?? []).length === 0 ? (<EtatVide texte="Aucune demande d’adhésion en attente." />) : null}'
            : '{(gerer.signalements ?? []).length === 0 ? (<EtatVide texte="Aucun signalement ouvert dans ce réseau." />) : null}';
        const plus =
          `{pilotage.${voirPlus} ? (<Link href={pilotage.hrefSection("${section}")} data-gerer-voir-plus="${section}" ` +
          'style={{ display: "flex", justifyContent: "center", paddingTop: "12px", fontSize: "12.5px", fontWeight: "700", color: "#16785E", textDecoration: "none" }}>Voir plus</Link>) : null}';
        bloc = `${bloc.slice(0, bloc.length - '</div>'.length)}${vide}${plus}</div>`;
        out = out.slice(0, debut) + `{pilotage.montrer("${cle}") ? (${bloc}) : null}` + out.slice(fin);
      };
      carte('>DEMANDES D’ADHÉSION · {reseau.demandes}<', 'demandes', 'bornerDemandes', 'voirPlusDemandes', 'demandes');
      carte('>SIGNALEMENTS · {gerer.signalementsOuverts}<', 'signalements', 'bornerSignalements', 'voirPlusSignalements', 'signalements');

      // « Voir » : l'extrait du contenu signalé, pour les trois genres.
      out = out.replace(
        /\{s\.href === '' \? \(<button type="button" disabled data-signalement-voir="" style=\{\{ ([^}]*), cursor: "default" \}\}>Voir<\/button>\) : \(<Link[^>]*>Voir<\/Link>\)\}/,
        (_, style) =>
          `<button type="button" onClick={() => pilotage.onVoirSignalement(s.subjectType, s.subjectId)} data-signalement-voir="" style={{ ${style}, cursor: "pointer" }}>Voir</button>`,
      );

      // La file de validation, entre les demandes et les signalements — dans le
      // châssis de la carte des demandes, rangées comprises (mêmes mesures).
      const sig = out.indexOf('{pilotage.montrer("signalements") ? (');
      if (sig !== -1) {
        const attente =
          '{pilotage.montrer("attente") ? (<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}>' +
          '<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>PUBLICATIONS À VALIDER · {pilotage.enAttente.length}</div>' +
          '{(pilotage.enAttente ?? []).length === 0 ? (<EtatVide texte="Aucune publication n’attend de validation." />) : null}' +
          '{(pilotage.enAttente ?? []).map((p, pIndex) => (<div key={pIndex} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid #F0F3F2" }}>' +
          '<span style={{ width: "40px", height: "40px", borderRadius: "999px", backgroundColor: p.bg, color: "#fff", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{p.i}</span>' +
          '<div style={{ flex: "1", minWidth: "0" }}><div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "700" }}>{p.nom}<span style={{ fontSize: "12px", color: "#8A958F", fontWeight: "500" }}>{p.sous}</span></div><div style={{ fontSize: "13px", color: "#16211D", marginTop: "4px", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{p.extrait}</div></div>' +
          '<button type="button" onClick={() => pilotage.onValider(p.postId)} disabled={gerer.occupe} data-attente-valider="" style={{ padding: "0 16px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", height: "38px", cursor: "pointer" }}>Valider</button>' +
          '<button type="button" onClick={() => pilotage.onRefuserPublication(p.postId)} disabled={gerer.occupe} data-attente-refuser="" style={{ padding: "0 16px", borderRadius: "14px", background: "#F2F5F4", color: "#5D6B66", border: "none", font: "inherit", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", height: "38px", cursor: "pointer" }}>Refuser</button>' +
          '</div>))}</div>) : null}';
        out = out.slice(0, sig) + attente + out.slice(sig);
      }
    }

    // ── Téléphone : les deux titres, les bornes, « Voir plus » ───────────────
    if (telephone) {
      for (const [titre, cle, borne, voirPlus, section, videTexte] of [
        ['DEMANDES D’ADHÉSION', 'demandes', 'bornerDemandes', 'voirPlusDemandes', 'demandes', 'Aucune demande d’adhésion en attente.'],
        ['SIGNALEMENTS', 'signalements', 'bornerSignalements', 'voirPlusSignalements', 'signalements', 'Aucun signalement ouvert dans ce réseau.'],
      ]) {
        const at = out.indexOf(`>${titre}</div>{(gerer.${cle} ?? []).map(`);
        if (at === -1) continue;
        const debutTitre = out.lastIndexOf('<div style={{', at);
        const debutBoucle = at + `>${titre}</div>`.length;
        let profondeur = 0;
        let fin = -1;
        for (let i = debutBoucle; i < out.length; i += 1) {
          if (out[i] === '{') profondeur += 1;
          else if (out[i] === '}') {
            profondeur -= 1;
            if (profondeur === 0) {
              fin = i + 1;
              break;
            }
          }
        }
        if (fin === -1) continue;
        const boucle = out
          .slice(debutBoucle, fin)
          .replace(`{(gerer.${cle} ?? []).map(`, `{(gerer.${cle} ?? []).slice(0, pilotage.${borne}).map(`);
        const plus =
          `{pilotage.${voirPlus} ? (<Link href={pilotage.hrefSection("${section}")} data-gerer-voir-plus="${section}" ` +
          'style={{ display: "flex", justifyContent: "center", fontSize: "12.5px", fontWeight: "700", color: "#16785E", textDecoration: "none", flexShrink: "0" }}>Voir plus</Link>) : null}';
        const vide = `{(gerer.${cle} ?? []).length === 0 ? (<EtatVide texte="${videTexte}" />) : null}`;
        out =
          out.slice(0, debutTitre) +
          `{pilotage.montrer("${cle}") ? (<>${out.slice(debutTitre, debutBoucle)}${boucle}${vide}${plus}</>) : null}` +
          out.slice(fin);
      }
    }

    // ── Les trois interrupteurs et la visibilité (ordinateur) ───────────────
    const interrupteurs = [
      ['Validation des nouvelles publications', 'validation', 'onValidation'],
      ['Autoriser les sondages par tous les membres', 'sondages', 'onSondages'],
      ['Album ouvert aux membres', 'album', 'onAlbum'],
    ];
    for (const [libelle, cle, geste] of interrupteurs) {
      const at = out.indexOf(`>${libelle}</div>`);
      if (at === -1) continue;
      const motif =
        /<span style=\{\{ width: "46px", height: "26px", borderRadius: "999px", background: "#(?:CBD5D1|16785E)", position: "relative", flexShrink: "0" \}\}><span style=\{\{ position: "absolute", top: "3px", left: "(?:3|23)px", width: "20px", height: "20px", borderRadius: "999px", background: "#fff" \}\}><\/span><\/span>/g;
      motif.lastIndex = at;
      const m = motif.exec(out);
      if (m === null) continue;
      // Les deux positions de la pastille et les deux pistes sont celles que la
      // maquette dessine — éteinte (`#CBD5D1`, 3 px) et allumée (`#16785E`, 23 px).
      const bouton =
        `<button type="button" role="switch" aria-checked={pilotage.parametres.${cle}} aria-label="${libelle}" onClick={pilotage.parametres.${geste}} disabled={pilotage.parametres.occupe} data-gerer-parametre="${cle}" ` +
        `style={{ width: "46px", height: "26px", borderRadius: "999px", backgroundColor: pilotage.parametres.${cle} ? "#16785E" : "#CBD5D1", position: "relative", flexShrink: "0", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}>` +
        `<span style={{ position: "absolute", top: "3px", left: pilotage.parametres.${cle} ? "23px" : "3px", width: "20px", height: "20px", borderRadius: "999px", background: "#fff" }}></span></button>`;
      out = out.slice(0, m.index) + bouton + out.slice(m.index + m[0].length);
    }
    out = out.replace(
      />Réseau automatique de pays : toujours public</,
      '>{pilotage.parametres.visibiliteSous}<',
    );
    out = out.replace(
      /<span style=\{\{ (background: "#F2F5F4", color: "#8A958F", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap") \}\}>\{reseau\.visibilite\}<\/span>/,
      (_, style) =>
        `{pilotage.parametres.visibiliteFixe ? (<span style={{ ${style} }}>{pilotage.parametres.visibilite}</span>) : (<select value={pilotage.parametres.visibiliteValeur} onChange={pilotage.parametres.onVisibilite} disabled={pilotage.parametres.occupe} aria-label="La visibilité du réseau" data-gerer-visibilite="" style={{ ${style.replace('color: "#8A958F"', 'color: "#16211D"')}, border: "1px solid #E6EBE9", font: "inherit", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>{(pilotage.parametres.visibilites ?? []).map((v, vIndex) => (<option key={vIndex} value={v.valeur}>{v.libelle}</option>))}</select>)}`,
    );
    const params = out.indexOf('>PARAMÈTRES</div>');
    if (params !== -1) {
      const debut = out.lastIndexOf('<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}>', params);
      const fin = debut === -1 ? -1 : finElement(out, debut);
      if (fin !== -1) {
        out = `${out.slice(0, debut)}{pilotage.montrer("parametres") ? (${out.slice(debut, fin)}) : null}${out.slice(fin)}`;
      }
    }

    return { jsx: out, applied: true };
  },
};

// ─── A09 — LE SUJET : SES RÉPONSES VIDES ─────────────────────────────────────

export const RV_SUJET_VIDE = {
  screens: ['A09'],
  nom: 'RV_SUJET_VIDE',
  why: 'Un sujet sans réponse montrait une carte blanche : « Aucune réponse » se dit à la place.',
  provides: ['comments'],
  apply(jsx) {
    const at = jsx.indexOf('{(comments ?? []).map(');
    if (at === -1) return { jsx, applied: false };
    let profondeur = 0;
    let fin = -1;
    for (let i = at; i < jsx.length; i += 1) {
      if (jsx[i] === '{') profondeur += 1;
      else if (jsx[i] === '}') {
        profondeur -= 1;
        if (profondeur === 0) {
          fin = i + 1;
          break;
        }
      }
    }
    if (fin === -1) return { jsx, applied: false };
    return {
      jsx:
        jsx.slice(0, fin) +
        '{(comments ?? []).length === 0 ? (<EtatVide texte="Aucune réponse pour le moment : soyez la première personne à répondre." />) : null}' +
        jsx.slice(fin),
      applied: true,
    };
  },
};


/**
 * LA CARTE « MODÉRATION » D'UN SUJET : POUR L'ÉQUIPE SEULEMENT, ET SUR MOBILE.
 *
 * `modActions` est maintenant calculée par `useSujet` d'après `canPin` — vide
 * pour un membre ordinaire, qui voyait jusqu'ici trois entrées de modération.
 * La carte d'ordinateur disparaît alors ; sur la planche de 390 px, qui ne la
 * dessine pas, le rond « ··· » de l'en-tête ouvre les mêmes entrées.
 */
export const RV_SUJET_MODERATION = {
  screens: ['A09'],
  nom: 'RV_SUJET_MODERATION',
  why: 'La carte « MODÉRATION » d’un sujet était montrée à tout lecteur, et le rond « ··· » de la planche mobile n’ouvrait rien.',
  provides: ['modActions'],
  apply(jsx) {
    let out = jsx;
    let compte = 0;
    const titre = out.indexOf('>MODÉRATION</div>');
    if (titre !== -1) {
      const debut = out.lastIndexOf('<div style={{ background: "#fff"', titre);
      const fin = debut === -1 ? -1 : finElement(out, debut);
      if (fin !== -1) {
        out = `${out.slice(0, debut)}{(modActions ?? []).length === 0 ? null : (${out.slice(debut, fin)})}${out.slice(fin)}`;
        compte += 1;
      }
    }
    const rond = remplacerUn(
      out,
      /<span style=\{\{ (width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4"[^}]*) \}\}>(<svg[^>]*><path d="M5 12h\.01M12 12h\.01M19 12h\.01" \/><\/svg>)<\/span>/,
      (m) =>
        `<MenuRond entrees={modActions ?? []} libelle="Modérer ce sujet" rondStyle={{ ${m[1]} }}>${m[2]}</MenuRond>`,
    );
    if (rond !== null) {
      out = rond;
      compte += 1;
    }
    return compte === 0 ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

// ─── E03 — « CRÉER UN ÉVÉNEMENT » ────────────────────────────────────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FORMULAIRE DE E03, BRANCHÉ — ET RÉEMPLOYÉ PAR LA FENÊTRE DU RÉSEAU       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Chaque champ dessiné est un `<div>` au contenu d'exemple ; il devient le
 * contrôle qu'il représente, DANS les mesures du `<div>` (hauteur, rayon,
 * bordure, retraits). Voir `FormulaireEvenementView` pour le contrat, et la
 * déclaration de E03 (`07-agenda.mjs`) pour la RÉGION qui extrait la carte du
 * formulaire et la rend montable dans la fenêtre de l'onglet « Événements ».
 *
 * ⚠ LA PLANCHE DE 390 PX NE DESSINE PAS L'ADRESSE, que `createEventSchema`
 * exige (4–400). Sans elle, aucun événement ne pourrait être publié depuis un
 * téléphone. Le champ est donc posé après « Lieu », en CLONANT le bloc « Lieu »
 * de la même planche (libellé et boîte) — aucune mesure n'est inventée. REMONTÉ.
 */
const CONTROLE = 'width: "100%", boxSizing: "border-box", font: "inherit", color: "#16211D", outline: "none"';

function champE03(out, libelle, controle) {
  const at = out.indexOf(`>${libelle}</div>`);
  if (at === -1) return out;
  const motif = /<div style=\{\{ (minHeight: "48px", borderRadius: "14px", border: "1(?:\.5)?px solid #[0-9A-F]{6}", background: "#fff", padding: "13px 14px", fontSize: "14px", lineHeight: "1\.5") \}\}>(?:(?!<\/div>)[\s\S])*<\/div>/g;
  motif.lastIndex = at;
  const m = motif.exec(out);
  if (m === null || m.index - at > 200) return out;
  return out.slice(0, m.index) + controle(m[1]) + out.slice(m.index + m[0].length);
}

export const RV_E03_FORMULAIRE = {
  screens: ['E03'],
  nom: 'RV_E03_FORMULAIRE',
  why: 'Le formulaire « Créer un événement » était dessiné en <div> : aucun champ ne se saisissait et « Publier l’événement » ne partait pas.',
  provides: ['formulaire'],
  apply(jsx) {
    let out = jsx;

    // Les pastilles de type : la suite dessinée → les huit types du serveur.
    out = out.replace(
      /<span style=\{\{ (padding: "8px 13px", borderRadius: "999px", fontSize: "12\.5px", fontWeight: "700", whiteSpace: "nowrap"), background: "#16785E", color: "#fff", border: "1px solid #16785E" \}\}>Rencontre<\/span>(?:<span style=\{\{[^}]*\}\}>(?:Atelier|Sport|Fête|Démarches)<\/span>)+/,
      (_, style) =>
        `{(formulaire.types ?? []).map((t, tIndex) => (<button key={tIndex} type="button" onClick={t.onPick} aria-pressed={t.bg === "#16785E"} data-evenement-type="" style={{ ${style}, backgroundColor: t.bg, color: t.fg, border: \`1px solid \${t.bd}\`, fontFamily: "inherit", cursor: "pointer" }}>{t.label}</button>))}`,
    );

    const texte = (valeur, geste, aria, extra = '') => (style) =>
      `<input type="text" value={formulaire.${valeur}} onChange={formulaire.${geste}} aria-label="${aria}" data-evenement-${valeur}="" ${extra}style={{ ${style}, ${CONTROLE} }} />`;

    // Mobile : l'adresse manque — clonée du bloc « Lieu » (voir l'en-tête).
    if (!out.includes('>Adresse</div>') && out.includes('>Lieu</div>')) {
      const lieu = out.indexOf('>Lieu</div>');
      const debut = out.lastIndexOf('<div style={{ flexShrink: "0" }}>', lieu);
      const fin = debut === -1 ? -1 : finElement(out, debut);
      if (fin !== -1) {
        const bloc = out.slice(debut, fin).replace('>Lieu</div>', '>Adresse</div>');
        out = out.slice(0, fin) + bloc + out.slice(fin);
      }
    }

    out = champE03(out, 'Titre', texte('titre', 'onTitre', 'Le titre de l’événement', 'maxLength={120} '));
    out = champE03(
      out,
      'Description',
      (style) =>
        `<textarea value={formulaire.description} onChange={formulaire.onDescription} aria-label="La description de l’événement" maxLength={3000} data-evenement-description="" style={{ ${style}, ${CONTROLE}, resize: "vertical" }} />`,
    );
    out = champE03(
      out,
      'Ville',
      (style) =>
        `<select value={formulaire.villeId} onChange={formulaire.onVille} aria-label="La ville de l’événement" data-evenement-ville="" style={{ ${style}, ${CONTROLE} }}><option value="">Choisir une ville</option>{(formulaire.villes ?? []).map((v, vIndex) => (<option key={vIndex} value={v.id}>{v.nom}</option>))}</select>`,
    );
    out = champE03(out, 'Lieu', texte('lieu', 'onLieu', 'Le lieu', 'maxLength={160} '));
    out = champE03(out, 'Adresse', texte('adresse', 'onAdresse', 'L’adresse', 'maxLength={400} '));
    out = champE03(
      out,
      'Début',
      (style) =>
        `<input type="datetime-local" value={formulaire.debut} onChange={formulaire.onDebut} aria-label="Le début" data-evenement-debut="" style={{ ${style}, ${CONTROLE} }} />`,
    );
    out = champE03(
      out,
      'Fin',
      (style) =>
        `<input type="datetime-local" value={formulaire.fin} onChange={formulaire.onFin} aria-label="La fin" data-evenement-fin="" style={{ ${style}, ${CONTROLE} }} />`,
    );
    out = champE03(
      out,
      'Capacité',
      (style) =>
        `<input type="number" min={1} value={formulaire.capacite} onChange={formulaire.onCapacite} aria-label="La capacité (vide : sans limite)" data-evenement-capacite="" style={{ ${style}, ${CONTROLE} }} />`,
    );

    // « Réservé à un réseau » : la ligne fermée devient le choix de mes réseaux.
    out = out.replace(
      /<div style=\{\{ (height: "48px", borderRadius: "14px", border: "1px solid #E6EBE9", padding: "0 14px"[^}]*) \}\}>Béninois en France(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)<\/div>/,
      (_, style) =>
        `<select value={formulaire.reseauId} onChange={formulaire.onReseau} disabled={formulaire.reseauFige} aria-label="Réservé à un réseau" data-evenement-reseau="" style={{ ${style}, width: "100%", font: "inherit", fontSize: "14px", fontWeight: "600", color: "#16211D", background: "#fff", outline: "none" }}><option value="">Ouvert à tous</option>{(formulaire.reseaux ?? []).map((r, rIndex) => (<option key={rIndex} value={r.id}>{r.nom}</option>))}</select>`,
    );

    // « Ajouter une couverture » : le cadre pointillé devient un choisisseur.
    out = out.replace(
      /<div style=\{\{ (height: "90px", borderRadius: "16px", border: "1\.5px dashed #CBD5D1"[^}]*) \}\}>(<svg(?:(?!<\/svg>)[\s\S])*?<\/svg>)Ajouter une couverture<\/div>/,
      (_, style, svg) =>
        `<label data-evenement-couverture="" style={{ ${style}, cursor: "pointer" }}>${svg}{formulaire.couverture === "" ? "Ajouter une couverture" : formulaire.couverture}<input type="file" accept="image/*" onChange={formulaire.onCouverture} style={{ display: "none" }} /></label>`,
    );

    // « Publier l'événement » (1 440 px) et « Publier » (390 px).
    const publier = /<button style=\{\{ ([^}]*background: "#16785E"[^}]*) \}\}>(Publier l’événement|Publier)<\/button>/;
    const m = publier.exec(out);
    if (m === null) return out === jsx ? { jsx, applied: false } : { jsx: out, applied: true };
    const refus =
      '{formulaire.echec === "" ? null : (<p role="alert" data-evenement-echec="" style={{ margin: "0", fontSize: "12.5px", fontWeight: "700", color: "#B4581F" }}>{formulaire.echec}</p>)}';
    out =
      out.slice(0, m.index) +
      (m[2] === 'Publier l’événement' ? refus : '') +
      `<button type="button" onClick={formulaire.onPublier} disabled={formulaire.bloque} data-evenement-publier="" style={{ ${m[1]}, cursor: "pointer", opacity: formulaire.bloque ? ".55" : "1" }}>${m[2]}</button>` +
      out.slice(m.index + m[0].length);
    if (m[2] === 'Publier') {
      // Le téléphone : le refus se dit au-dessus de la barre, dans le contenu.
      out = out.replace(
        /(<div style=\{\{ fontSize: "12px", color: "#B4581F", fontWeight: "700" \}\}>\{panneau\.quota\.utilise\})/,
        `${refus}$1`,
      );
    }
    return { jsx: out, applied: true };
  },
};

/**
 * ── LE DERNIER PASSAGE : AUCUNE CLÉ DE STYLE EN DOUBLE ─────────────────────
 *
 * Les adaptations de ce module COMPOSENT des styles : elles reprennent celui du
 * nœud dessiné et y ajoutent ce que la promotion exige (`cursor`, `border`,
 * `textDecoration`…). Une clé déjà dessinée y figurerait deux fois — TS1117,
 * piège 8, payé trois fois pendant ce lot. Plutôt que d'en garder la discipline
 * à chaque gabarit, chaque sortie passe ici : dans chaque `style={{ … }}`, une
 * clé répétée ne garde que sa DERNIÈRE occurrence, qui est celle que React
 * appliquerait de toute façon. Le découpage respecte les parenthèses, les
 * accolades, les chaînes et les gabarits : une valeur comme
 * `` `1px solid ${x}` `` ou `a ? "b" : "c"` n'est jamais coupée.
 */
export function dedoublerStyles(jsx) {
  let out = '';
  let i = 0;
  for (;;) {
    const at = jsx.indexOf('style={{ ', i);
    if (at === -1) {
      out += jsx.slice(i);
      return out;
    }
    const debut = at + 'style={{ '.length;
    // La fin de l'objet : l'accolade qui ramène la profondeur à zéro.
    let profondeur = 2;
    let j = debut;
    let chaine = null;
    for (; j < jsx.length; j += 1) {
      const c = jsx[j];
      if (chaine !== null) {
        if (c === '\\') j += 1;
        else if (c === chaine) chaine = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') chaine = c;
      else if (c === '{') profondeur += 1;
      else if (c === '}') {
        profondeur -= 1;
        if (profondeur === 1) break;
      }
    }
    const corps = jsx.slice(debut, j).replace(/ $/, '');
    // Les déclarations, coupées aux virgules de premier niveau.
    const decls = [];
    let p = 0;
    let courant = '';
    chaine = null;
    for (let k = 0; k < corps.length; k += 1) {
      const c = corps[k];
      if (chaine !== null) {
        courant += c;
        if (c === '\\') {
          k += 1;
          courant += corps[k] ?? '';
        } else if (c === chaine) chaine = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') chaine = c;
      if (c === '(' || c === '{' || c === '[') p += 1;
      if (c === ')' || c === '}' || c === ']') p -= 1;
      if (c === ',' && p === 0) {
        decls.push(courant.trim());
        courant = '';
        continue;
      }
      courant += c;
    }
    if (courant.trim() !== '') decls.push(courant.trim());
    const cle = (d) => /^([a-zA-Z]+)\s*:/.exec(d)?.[1] ?? d;
    const vues = new Set();
    const gardees = [];
    for (let k = decls.length - 1; k >= 0; k -= 1) {
      const nom = cle(decls[k]);
      if (vues.has(nom)) continue;
      vues.add(nom);
      gardees.unshift(decls[k]);
    }
    out += jsx.slice(i, debut) + gardees.join(', ') + ' ';
    i = j;
  }
}

/**
 * ── « CONTACTER LES MODÉRATEURS » : MASQUÉ LÀ OÙ IL NE PEUT PAS ABOUTIR ─────
 *
 * Le porteur, à la question « le masquer ou l'expliquer pour un non-membre ? » :
 * « Masque. » Le bouton est branché par `A08T_CONTACTER_MODERATEURS` (dans
 * `generate-screens.mjs`, qui passe AVANT ce lot) ; on ne fait ici que
 * l'envelopper dans `apropos.contacterVisible`, calculé par `use-reseau.ts` —
 * membre ACTIF, et au moins une autre personne dans l'équipe.
 *
 * On repère le bouton par sa balise `data-contacter-moderateurs`, que
 * l'adaptation d'origine pose sur les DEUX planches « À propos » (1036 px et
 * 390 px), et on enveloppe l'élément ENTIER (`finElement`) : couper sur le
 * libellé laisserait l'icône ou le texte dehors selon la planche. Le voisin
 * « Signaler le réseau » reste en place ; dans une rangée flexible, il prend
 * alors la largeur que le bouton libère, sans rien redessiner.
 */
const RV_CONTACTER = {
  screens: ['A08T'],
  nom: 'RV_CONTACTER',
  why: 'Le porteur : « Masque » — « Contacter les modérateurs » ne paraît que pour un membre ACTIF d’un réseau dont l’équipe compte quelqu’un d’autre que lui (sinon la route refuse à coup sûr : NOT_A_MEMBER, NO_TEAM, ONLY_ME). Présent sur les deux seules planches qui dessinent ce bouton.',
  provides: ['apropos'],
  apply(jsx) {
    let out = jsx;
    let applied = false;
    let depuis = 0;
    for (;;) {
      const marque = out.indexOf('data-contacter-moderateurs=""', depuis);
      if (marque < 0) break;
      const debut = out.lastIndexOf('<button', marque);
      const fin = debut < 0 ? -1 : finElement(out, debut);
      if (fin < 0) break;
      // Déjà enveloppé (relance du générateur sur sa propre sortie) : on passe.
      if (out.slice(Math.max(0, debut - 40), debut).includes('apropos.contacterVisible')) {
        depuis = fin;
        continue;
      }
      const element = out.slice(debut, fin);
      const neuf = `{apropos.contacterVisible ? (${element}) : null}`;
      out = out.slice(0, debut) + neuf + out.slice(fin);
      depuis = debut + neuf.length;
      applied = true;
    }
    return { jsx: out, applied };
  },
};

/**
 * ── LA COUVERTURE DU RÉSEAU : LE BANDEAU L'AFFICHE, LE PROPRIÉTAIRE LA CHANGE ─
 *
 * Le porteur : « Ajouter une couverture ne marche pas ? Aussi l'ajout ou
 * l'édition après la création ? » Deux gestes ici, sur les 25 planches de A08T
 * et les deux de A08 :
 *
 *   1. LE BANDEAU. Toutes les planches peignent la même bande `#CFE3DA` (120 px à
 *      1036, 118 px à 390, 140/150 px sur A08). On n'en change rien : on lui
 *      AJOUTE `backgroundImage` depuis `reseau.couverture`. Sans couverture, la
 *      valeur est `"none"` et c'est exactement la maquette ; avec, l'image couvre
 *      la bande (`cover`, centrée). `background` vient AVANT `backgroundImage`
 *      dans l'objet — le même ordre que les vignettes de l'album, sans quoi le
 *      raccourci effacerait l'image.
 *
 *   2. « CHANGER LA COUVERTURE ». La maquette le dessine en `<span>` inerte sur
 *      les sept planches propriétaire d'ordinateur. Il devient un bouton,
 *      montré au PROPRIÉTAIRE seul (`actions.peutChangerCouverture` : un
 *      modérateur voit ces mêmes planches, et le serveur lui refuserait ce champ
 *      fondateur). Il ouvre l'unique sélecteur de fichier de l'écran. À 390 px,
 *      où rien n'est dessiné, le geste est une entrée du menu du rond
 *      (`ActionsReseau`).
 */
const RV_COUVERTURE = {
  screens: ['A08T', 'A08'],
  nom: 'RV_COUVERTURE',
  why: 'Le bandeau affiche la couverture du réseau (`reseau.couverture`) par-dessus sa teinte dessinée, et « Changer la couverture » — dessiné sur les sept planches propriétaire à 1036 px — ouvre le sélecteur, pour le propriétaire seul.',
  provides: ['reseau', 'actions'],
  apply(jsx) {
    let out = jsx;
    let applied = false;

    const bandeau = remplacerUn(
      out,
      /<div style=\{\{ height: "(\d+)px", background: "#CFE3DA"([^}]*)\}\}>/,
      (m) =>
        `<div style={{ height: "${m[1]}px", background: "#CFE3DA"${m[2]}, ` +
        'backgroundImage: reseau.couverture === null ? "none" : `url("${reseau.couverture}")`, ' +
        'backgroundSize: "cover", backgroundPosition: "center" }}>',
    );
    if (bandeau !== null && !jsx.includes('reseau.couverture')) {
      out = bandeau;
      applied = true;
    }

    const libelle = 'Changer la couverture</span>';
    const fin = out.indexOf(libelle);
    if (fin >= 0) {
      const debut = out.lastIndexOf('<span style={{', fin);
      const ouvre = out.slice(debut, out.indexOf('>', debut) + 1);
      const ms = /style=\{\{ ([^}]*) \}\}/.exec(ouvre);
      if (debut >= 0 && ms !== null) {
        const interieur = out.slice(debut + ouvre.length, fin);
        const style = fusion(nu(ms[1]), 'color: "#16211D", cursor: actions.couvertureOccupee ? "default" : "pointer", opacity: actions.couvertureOccupee ? ".6" : "1"');
        const bouton =
          '{actions.peutChangerCouverture ? (<button type="button" onClick={actions.onChangerCouverture} ' +
          'disabled={actions.couvertureOccupee} data-reseau-changer-couverture="" ' +
          `style={{ ${style} }}>${interieur}` +
          '{actions.couvertureOccupee ? "Envoi de la couverture…" : "Changer la couverture"}</button>) : null}';
        out = out.slice(0, debut) + bouton + out.slice(fin + libelle.length);
        applied = true;
      }
    }
    return { jsx: out, applied };
  },
};

/**
 * ── A10 : « AJOUTER UNE COUVERTURE » DEVIENT UN VRAI CHAMP DE FICHIER ────────
 *
 * Le porteur : « Ajouter une couverture ne marche pas ? » La zone pointillée
 * (120 px à 1 440, 84 px à 390) était un `<div>` inerte. Elle devient un
 * `<label>` qui porte un `<input type="file">` caché : toute la zone ouvre le
 * sélecteur, au clavier comme à la souris, sans script de clic.
 *
 * Une fois l'image déposée (`use-creation.ts` la dépose dès le choix), elle
 * REMPLIT la zone en `backgroundImage` et le libellé devient une pastille
 * « Changer la couverture » posée dessus, lisible sur n'importe quelle photo.
 * Pendant le dépôt, « Envoi… ». Le style dessiné est gardé tel quel ; on n'ajoute
 * que ce qu'un fond d'image exige (`cover`, centré, `overflow: hidden`).
 */
const RV_A10_COUVERTURE = {
  screens: ['A10'],
  nom: 'RV_A10_COUVERTURE',
  why: 'La zone « Ajouter une couverture » de la création de réseau ouvre le sélecteur de fichier, affiche l’image déposée et propose de la changer — sur les deux planches.',
  provides: ['couvertureUrl', 'couvertureOccupee', 'onCouverture'],
  apply(jsx) {
    const r = remplacerUn(
      jsx,
      /<div style=\{\{ ([^}]*border: "1\.5px dashed #CBD5D1"[^}]*) \}\}>Ajouter une couverture<\/div>/,
      (m) => {
        const style = fusion(
          m[1],
          'cursor: couvertureOccupee ? "default" : "pointer", ' +
            'backgroundImage: couvertureUrl === null ? "none" : `url("${couvertureUrl}")`, ' +
            'backgroundSize: "cover", backgroundPosition: "center", overflow: "hidden"',
        );
        return (
          `<label style={{ ${style} }} data-creation-couverture="">` +
          '<input type="file" accept="image/jpeg,image/png,image/webp" hidden ' +
          'disabled={couvertureOccupee} onChange={onCouverture} data-creation-couverture-fichier="" />' +
          '{couvertureOccupee ? "Envoi de la couverture…" : couvertureUrl === null ? "Ajouter une couverture" : ' +
          '(<span style={{ padding: "6px 12px", borderRadius: "12px", background: "rgba(255,255,255,.92)", color: "#16211D" }}>Changer la couverture</span>)}' +
          '</label>'
        );
      },
    );
    return r === null ? { jsx, applied: false } : { jsx: r, applied: true };
  },
};

/**
 * ── A01G : « LIER 2 GUIDES » DIT LE VRAI NOMBRE ──────────────────────────────
 *
 * Le bouton de la fenêtre « Lier un guide » écrivait « Lier 2 guides » en dur,
 * quelle que soit la sélection — sur l'accueil comme, depuis ce lot, dans le
 * composeur d'un réseau. Il lit `lierLibelle` (« Lier un guide », « Lier 1
 * guide », « Lier 3 guides »), composé par celui qui nourrit la fenêtre.
 */
const RV_A01G_LIBELLE = {
  screens: ['A01G'],
  nom: 'RV_A01G_LIBELLE',
  why: 'Le bouton « Lier 2 guides » de A01G dit le nombre de guides réellement cochés (`lierLibelle`).',
  provides: ['lierLibelle'],
  apply(jsx) {
    const r = remplacerUn(jsx, /(data-guide-lier="" style=\{\{[^}]*\}\}>)Lier 2 guides(<\/button>)/, (m) => `${m[1]}{lierLibelle}${m[2]}`);
    return r === null ? { jsx, applied: false } : { jsx: r, applied: true };
  },
};

const SANS_DOUBLONS = (adaptation) => ({
  ...adaptation,
  apply(jsx) {
    const r = adaptation.apply(jsx);
    return r.applied ? { jsx: dedoublerStyles(r.jsx), applied: true } : r;
  },
});

export const ADAPTATIONS_RESEAU_VIVANT = [
  RV_ENTETE,
  RV_ONGLETS_FERMES,
  RV_BANDE_EQUIPE,
  RV_SUJETS,
  RV_COMPOSEUR,
  RV_OUTILS_FIL,
  RV_FIL_VIDE,
  RV_COLONNE,
  RV_EVENEMENTS,
  RV_MEMBRES,
  RV_ALBUM_VIDE,
  RV_ALBUM_OUVERT,
  RV_APROPOS,
  RV_CONTACTER,
  RV_COUVERTURE,
  RV_A10_COUVERTURE,
  RV_A01G_LIBELLE,
  RV_EDITION,
  RV_GERER,
  RV_SUJET_VIDE,
  RV_SUJET_MODERATION,
  RV_E03_FORMULAIRE,
].map(SANS_DOUBLONS);

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_RESEAU_VIVANT = {
  ActionsReseau: '@/components/actions-reseau',
  EtatVide: '@/components/etat-vide',
  MenuRond: '@/components/menu-rond',
};
