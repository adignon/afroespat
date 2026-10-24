/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT E — « SERVICES VIVANTS » : S01 à S10 et leurs fenêtres                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré sur les cadres générés avant ce lot : tout ce qui ÉCRIT était inerte.
 * « Publier l'annonce », « Envoyer », « Contacter », « Recommander », les puces de
 * S09 (« Renouveler », « Pause », « Supprimer »), « Enregistrer l'alerte » et
 * « Envoyer pour validation » n'avaient aucun gestionnaire ; les champs des
 * formulaires étaient des `<div>` d'exemple (« Studio meublé Lyon 7e ») ; la bande
 * d'onglets de 390 px, les puces de genre et les boutons « Publier » n'étaient pas
 * des liens ; l'encart partenaire était figé ; les photos, « 24 m² », « 1 240 € »,
 * « Installée · Lyon 7e » et « L2 » étaient écrits en toutes lettres.
 *
 * Appliquées APRÈS les adaptations des autres lots et AVANT « l'en-tête global ».
 * Chaque adaptation est universelle (`['*']`) mais BORNÉE PAR DES MARQUES propres au
 * cadre visé : une marque absente et elle ne fait rien, sans bruit (les fenêtres S02C,
 * S02V, S05L et S05R partagent la section de leur page).
 *
 * Les gestes et les formulaires arrivent par des props posées par les pages
 * (`vivant`, `formulaire`, `gestes`) ; les composants sont dans
 * `apps/web/src/components/services/`.
 */
import { writeFileSync } from 'node:fs';
import { dedoublerStyles, finElement } from './reseau-vivant.mjs';
import { NU, changerBalise, finAccolade } from './outils-lot-e.mjs';

const ENTETE_MOBILE = 'padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px"';
const RAYURES = 'repeating-linear-gradient(135deg,#E3ECE8 0 14px,#DCE6E1 14px 28px)';
const MARQUE_SIGNET = 'M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z';
/** Un bouton nu SANS toucher au retrait : le style dessiné reste maître. */
const NU2 = 'border: "none", font: "inherit", cursor: "pointer"';
const SANS_LIEN = 'textDecoration: "none", color: "inherit"';

// ─── Outils ──────────────────────────────────────────────────────────────────

/** Une adaptation universelle bornée par des marques ; `fn` rend le JSX neuf ou `null`. */
function sur(nom, marques, why, provides, fn) {
  return {
    screens: ['*'],
    nom,
    why,
    provides,
    apply(jsx) {
      // Diagnostic : SV_DUMP=<dossier> écrit le JSX tel que l'adaptation le reçoit.
      if (process.env['SV_DUMP'] !== undefined && marques.some((m) => jsx.includes(m))) {
        writeFileSync(`${process.env['SV_DUMP']}/${nom}-${jsx.length}.txt`, jsx);
      }
      if (!marques.every((m) => jsx.includes(m))) return { jsx, applied: false };
      const r = fn(jsx);
      return r === null || r === jsx ? { jsx, applied: false } : { jsx: r, applied: true };
    },
  };
}

/** [début, fin) de l'élément `tag` qui entoure l'indice `at`, ou `null`. */
function autour(jsx, at, tag = 'div') {
  if (at < 0) return null;
  const debut = jsx.lastIndexOf(`<${tag}`, at);
  if (debut < 0) return null;
  const fin = finElement(jsx, debut);
  return fin < 0 ? null : [debut, fin];
}

/** Le même, en remontant de `niveaux - 1` parents au-dessus du premier. */
function parent(jsx, [debut], tag = 'div') {
  const d = jsx.lastIndexOf(`<${tag}`, debut - 1);
  if (d < 0) return null;
  const f = finElement(jsx, d);
  return f < 0 ? null : [d, f];
}

const coupe = (jsx, [a, b], neuf) => jsx.slice(0, a) + neuf + jsx.slice(b);

/** Le contenu du style `style={{ … }}` d'une balise ouvrante. */
function styleDe(ouvrante) {
  const m = /style=\{\{ (.*) \}\}/s.exec(ouvrante);
  return m === null ? null : m[1];
}

/** La balise ouvrante (jusqu'au `>`) qui commence à `debut`, style compris. */
function ouvrante(jsx, debut) {
  const posStyle = jsx.indexOf('style={{ ', debut);
  const finStyle = finAccolade(jsx, posStyle + 'style='.length);
  return jsx.slice(debut, jsx.indexOf('>', finStyle) + 1);
}

/** Le style (sans accolades) du `<span>` ou `<div>` dont le texte direct est `texte`. */
function styleDuTexte(jsx, texte, tag = 'span') {
  const at = jsx.indexOf(`>${texte}</${tag}>`);
  if (at < 0) return null;
  const debut = jsx.lastIndexOf(`<${tag}`, at);
  return styleDe(ouvrante(jsx, debut));
}

/** Remplace TOUTES les occurrences d'un texte, et dit combien. */
function toutes(jsx, ancien, neuf) {
  const morceaux = jsx.split(ancien);
  return { jsx: morceaux.join(neuf), n: morceaux.length - 1 };
}

/**
 * Un bouton/élément dessiné → même balise + attributs (le style dessiné reste).
 * Rend `null` quand l'élément n'est pas trouvé.
 */
function brancher(jsx, texteFin, tag, attributs, nouvelleBalise = tag, ajoutStyle = '') {
  const at = jsx.indexOf(texteFin);
  if (at < 0) return null;
  const debut = jsx.lastIndexOf(`<${tag}`, at);
  return changerBalise(jsx, debut, nouvelleBalise, attributs, ajoutStyle);
}

// ─── Bande d'onglets / puces → liens ─────────────────────────────────────────

/**
 * Remplace un conteneur de puces `<span>` (la bande de 390 px, la rangée de genres)
 * par une boucle de liens sur `liste` (`{ libelle, href, actif }`). Les deux styles,
 * actif et inactif, sont RELEVÉS sur le dessin : le premier `<span>` aux couleurs vertes,
 * le premier qui ne l'est pas.
 */
function puces(jsx, conteneur, liste, supplement = '') {
  const [a, b] = conteneur;
  const ouv = ouvrante(jsx, a);
  const interieur = jsx.slice(a + ouv.length, b - '</div>'.length);
  const spans = [...interieur.matchAll(/<span style=\{\{ ([^}]*) \}\}>[^<]*<\/span>/g)];
  const actif = spans.find((m) => m[1].includes('#16785E') && m[1].includes('background'));
  const inactif = spans.find((m) => m[1].includes('#fff') && m[1].includes('background: "#fff"'));
  if (actif === undefined || inactif === undefined) return null;
  const lien =
    `{(${liste} ?? []).map((pc, pcIndex) => (<Link key={pcIndex} href={pc.href} aria-current={pc.actif ? "page" : undefined} ` +
    `style={pc.actif ? { ${actif[1]}, textDecoration: "none" } : { ${inactif[1]}, textDecoration: "none" }}>{pc.libelle}</Link>))}`;
  return coupe(jsx, conteneur, `${ouv}${lien}${supplement}</div>`);
}

// ─── Le retour des cadres mobiles (S03, S05, S07, S08) ───────────────────────

function retour(repli, nom) {
  return (jsx) => {
    const h = jsx.indexOf(ENTETE_MOBILE);
    if (h < 0) return null;
    const span = jsx.indexOf('<span', h);
    return changerBalise(jsx, span, 'BoutonRetour', `repli="${repli}" nom="${nom}"`, NU);
  };
}

const SV_RETOUR_S03 = sur(
  'SV_RETOUR_S03',
  [ENTETE_MOBILE, 'Je recherche', '>Publier</button>'],
  'S03 (390 px) : la croix de l’en-tête ramène à la liste.',
  [],
  retour('/services/logement', 'Fermer'),
);
const SV_RETOUR_S05 = sur(
  'SV_RETOUR_S05',
  [ENTETE_MOBILE, 'data-modal-open="S05R">Recommander</button>'],
  'S05 (390 px) : la flèche de l’en-tête revient à la page précédente.',
  [],
  retour('/services/emploi', 'Retour'),
);
const SV_RETOUR_S07 = sur(
  'SV_RETOUR_S07',
  [ENTETE_MOBILE, 'Contacter · {pro.quotaCourt}'],
  'S07 (390 px) : la flèche de l’en-tête revient à la page précédente.',
  [],
  retour('/services/annuaire', 'Retour'),
);
const SV_RETOUR_S08 = sur(
  'SV_RETOUR_S08',
  [ENTETE_MOBILE, 'Ma fiche pro<'],
  'S08 (390 px) : la croix de l’en-tête ramène à l’annuaire.',
  [],
  retour('/services/annuaire', 'Fermer'),
);

/** Le signet de l’en-tête de S05 et S07 (390 px) enregistre l’offre ou la fiche. */
function signetEntete(type, ident) {
  return (jsx) => {
    const h = jsx.indexOf(ENTETE_MOBILE);
    if (h < 0) return null;
    const re = new RegExp(`<svg[^>]*>\\s*<path d="${MARQUE_SIGNET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" />\\s*</svg>`);
    const m = re.exec(jsx.slice(h));
    if (m === null) return null;
    const at = h + m.index;
    const bouton = `<BoutonEnregistrer type="${type}" id={${ident}} taille={19} />`;
    // Sur `/emploi/nouveau` il n'y a pas d'offre à enregistrer.
    const pose = type === 'JOB' ? `{offre.mode === "detail" ? ${bouton} : null}` : bouton;
    return jsx.slice(0, at) + pose + jsx.slice(at + m[0].length);
  };
}

const SV_SIGNET_S05 = sur(
  'SV_SIGNET_S05',
  [ENTETE_MOBILE, 'data-modal-open="S05R">Recommander</button>'],
  'S05 (390 px) : le signet de l’en-tête enregistre l’offre (`PUT /me/bookmarks`).',
  [],
  signetEntete('JOB', 'offre.id'),
);
const SV_SIGNET_S07 = sur(
  'SV_SIGNET_S07',
  [ENTETE_MOBILE, 'Contacter · {pro.quotaCourt}'],
  'S07 (390 px) : le signet de l’en-tête enregistre la fiche (`PUT /me/bookmarks`).',
  [],
  signetEntete('PRO', 'pro.id'),
);

// ─── S01 ─────────────────────────────────────────────────────────────────────

const SV_S01_CARTES = sur(
  'SV_S01_CARTES',
  ['{a.genre}</span>', '{a.auteur}', 'L2</span>'],
  'S01 : la photo, le signet et le niveau de la carte viennent de l’annonce (photo réelle, `PUT /me/bookmarks`, niveau du serveur).',
  [],
  (jsx) => {
    let out = jsx;
    let n = 0;
    const photo = toutes(out, `background: "${RAYURES}"`, 'background: a.fondPhoto');
    out = photo.jsx;
    n += photo.n;
    const niveau = toutes(out, '>L2</span>', '>{a.niveau}</span>');
    out = niveau.jsx;
    n += niveau.n;
    const re = new RegExp(`<svg[^>]*>\\s*<path d="${MARQUE_SIGNET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" />\\s*</svg>`, 'g');
    out = out.replace(re, () => {
      n += 1;
      return '<BoutonEnregistrer type="HOUSING" id={a.id} />';
    });
    return n === 0 ? null : out;
  },
);

const SV_S01_PUBLIER = sur(
  'SV_S01_PUBLIER',
  ['liste.total} annonces', 'Publier</button>'],
  'S01 : « Publier » mène au formulaire (S03) au lieu d’être un bouton muet.',
  [],
  (jsx) =>
    brancher(jsx, 'Publier</button>', 'button', 'href="/services/logement/nouveau"', 'Link', 'textDecoration: "none"'),
);

const SV_S01_FILTRES = sur(
  'SV_S01_FILTRES',
  ['>Tout</span>', '>Temporaire</span>', 'liste.bandeau'],
  'S01 : les puces de genre sont des liens `?kind=` ; la puce « Lyon » dit la ville réelle et « Budget ▾ » (sans contrôle) disparaît.',
  ['filtres'],
  (jsx) => {
    const sp = jsx.lastIndexOf('<span', jsx.indexOf('>Tout</span>'));
    const conteneur = parent(jsx, [sp], 'div');
    if (conteneur === null) return null;
    const inactif = styleDuTexte(jsx, 'Colocation');
    const suite = jsx.includes('>Budget ▾</span>')
      ? `<span style={{ width: "1px", background: "#DDE3E0", margin: "0 4px" }}></span><span style={{ ${inactif} }}>{liste.ville}</span>`
      : '';
    return puces(jsx, conteneur, 'filtres', suite);
  },
);

const SV_S01_ONGLETS = sur(
  'SV_S01_ONGLETS',
  ['>Logement · 12</span>', '>Mes annonces</span>'],
  'S01 (390 px) : la bande d’onglets est une liste de liens, avec le total réel du logement.',
  ['onglets'],
  (jsx) => {
    const sp = jsx.lastIndexOf('<span', jsx.indexOf('>Logement · 12</span>'));
    const bande = parent(jsx, [sp], 'div');
    return bande === null ? null : puces(jsx, bande, 'onglets');
  },
);

const SV_S01_PARTENAIRE = sur(
  'SV_S01_PARTENAIRE',
  ['>Partenaire</span>', '>Découvrir</a>'],
  'S01 : l’encart partenaire est celui que le serveur résout (`GET /placements?section=HOUSING`), avec sa mention et son lien de transparence ; sans encart, rien.',
  [],
  (jsx) => {
    const at = jsx.indexOf('>Découvrir</a>');
    const carte = autour(jsx, jsx.lastIndexOf('border: "1.5px dashed #CBD5D1"', at));
    return carte === null ? null : coupe(jsx, carte, '<EncartPartenaire />');
  },
);

const SV_S01_RECHERCHE = sur(
  'SV_S01_RECHERCHE',
  ['>Services<', 'liste.annonces'],
  'S01 (390 px) : la loupe de l’en-tête ouvre la recherche.',
  [],
  (jsx) => {
    const m = />Services<\/(h1|div)>/.exec(jsx);
    if (m === null) return null;
    const fin = m.index + m[0].length;
    const span = jsx.indexOf('<span', fin);
    if (span !== fin) return null;
    return changerBalise(jsx, span, 'Link', 'href="/recherche" aria-label="Rechercher"', 'textDecoration: "none"');
  },
);

// ─── S02 ─────────────────────────────────────────────────────────────────────

const SV_S02_BUREAU = sur(
  'SV_S02_BUREAU',
  ['{annonce.autresPhotos}', 'Installée · Lyon 7e', 'data-modal-open="S02C"'],
  'S02 (1 440 px) : photos réelles, pastille « Meublé » conditionnelle, « 24 m² » et « 1 240 € » (sans source) retirés, auteur et niveau réels, Contacter / Signaler / Masquer câblés.',
  ['vivant'],
  (jsx) => {
    let out = jsx;
    // Les trois tuiles de photo.
    for (let i = 0; i < 3; i += 1) {
      const at = out.indexOf(`background: "${RAYURES}"`);
      if (at < 0) return null;
      out = out.slice(0, at) + `background: annonce.fonds[${i}] ?? "${RAYURES}"` + out.slice(at + `background: "${RAYURES}"`.length);
    }
    out = out.replace('>Photo principale</div>', '>{annonce.nbPhotos === 0 ? "Photo principale" : null}</div>');
    out = out.replace('>+ {annonce.autresPhotos} photos</div>', '>{annonce.autresPhotos > 0 ? `+ ${annonce.autresPhotos} photos` : null}</div>');
    // « Meublé » : seulement si l'annonce l'est.
    const m = out.indexOf('>Meublé</span>');
    if (m >= 0) {
      const sp = autour(out, m, 'span');
      if (sp !== null) out = coupe(out, sp, `{annonce.meuble ? (${out.slice(sp[0], sp[1])}) : null}`);
    }
    // Les deux tuiles sans source.
    for (const texte of ['>24 m²</div>', '>1 240 €</div>']) {
      const at = out.indexOf(texte);
      if (at < 0) return null;
      const interne = autour(out, at);
      const tuile = interne === null ? null : parent(out, interne);
      if (tuile === null) return null;
      out = coupe(out, tuile, '');
    }
    out = out.replace('gridTemplateColumns: "repeat(4,1fr)"', 'gridTemplateColumns: "repeat(2,1fr)"');
    out = out.replace('>Installée · Lyon 7e</span>', '>{annonce.auteurSous}</span>');
    out = out.replace('>L2</span>', '>{annonce.niveau}</span>');
    // Contacter + Signaler : pas pour l'auteur, qui masque l'annonce à un membre.
    const c = out.indexOf('data-modal-open="S02C"');
    const bc = out.lastIndexOf('<button', c);
    const fc = finElement(out, bc);
    const sg = out.indexOf('Signaler</button>', fc);
    if (bc < 0 || fc < 0 || sg < 0) return null;
    const bs = out.lastIndexOf('<button', sg);
    const fs = finElement(out, bs);
    const signaler = changerBalise(out.slice(bs, fs), 0, 'button', 'type="button" onClick={vivant.onSignaler}', '');
    if (signaler === null) return null;
    out = out.slice(0, bc) + `{vivant.estMienne ? null : (<>${out.slice(bc, fc)}${signaler}</>)}` + out.slice(fs);
    // « Masquer à un membre », avant la carte « PRUDENCE ».
    const p = out.indexOf('>PRUDENCE</div>');
    const etiq = p < 0 ? null : autour(out, p);
    const carte = etiq === null ? null : parent(out, etiq);
    if (carte === null) return null;
    out = out.slice(0, carte[0]) + '{vivant.estMienne ? <MasquerMembre v={vivant} /> : null}' + out.slice(carte[0]);
    return out;
  },
);

const SV_S02_MOBILE = sur(
  'SV_S02_MOBILE',
  ['1 / 6', 'data-modal-open="S02C">Contacter</button>', '{annonce.titre}'],
  'S02 (390 px) : photo réelle, retour, signet, partage et signalement câblés ; « 24 m² » retiré ; l’auteur masque au lieu de contacter.',
  ['vivant'],
  (jsx) => {
    let out = jsx;
    out = out.replace(`background: "${RAYURES}"`, 'background: annonce.fonds[0] ?? "' + RAYURES + '"');
    out = out.replace('>Photo</div>', '>{annonce.nbPhotos === 0 ? "Photo" : null}</div>');
    const compteur = out.indexOf('>1 / 6</span>');
    const sp = compteur < 0 ? null : autour(out, compteur, 'span');
    if (sp === null) return null;
    out = coupe(
      out,
      sp,
      `{annonce.nbPhotos > 0 ? (${out.slice(sp[0], sp[1]).replace('>1 / 6<', '>1 / {annonce.nbPhotos}<')}) : null}`,
    );
    // Retour (à gauche) ; signet et partage (à droite).
    const gauche = out.indexOf('left: "12px" }}><span');
    if (gauche < 0) return null;
    const retourSpan = out.indexOf('<span', out.indexOf('>', gauche) );
    const r = changerBalise(out, retourSpan, 'BoutonRetour', 'repli="/services/logement" nom="Retour"', NU);
    if (r === null) return null;
    out = r;
    const droite = out.indexOf('right: "12px", display: "flex", gap: "8px" }}>');
    if (droite < 0) return null;
    const sig = new RegExp(`<svg[^>]*>\\s*<path d="${MARQUE_SIGNET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" />\\s*</svg>`);
    const reste = out.slice(droite);
    const ms = sig.exec(reste);
    if (ms === null) return null;
    out =
      out.slice(0, droite) +
      reste.slice(0, ms.index) +
      '<BoutonEnregistrer type="HOUSING" id={annonce.id} taille={19} />' +
      reste.slice(ms.index + ms[0].length);
    // Le second rond de droite : partager.
    const apres = out.indexOf('</BoutonEnregistrer>') >= 0 ? 0 : out.indexOf('taille={19} />', droite);
    const secondRond = out.indexOf('<span', apres + 'taille={19} />'.length);
    const partage = changerBalise(out, secondRond, 'BoutonPartager', 'titre={annonce.titre}', NU);
    if (partage !== null) out = partage;
    out = out.replace('>24 m²</span>', '>{annonce.meuble ? "Meublé" : "Logement"}</span>');
    // Le drapeau du pied : signaler.
    const bas = out.indexOf('data-modal-open="S02C">Contacter</button>');
    const apresBouton = bas + 'data-modal-open="S02C">Contacter</button>'.length;
    const ronde = out.indexOf('<span', apresBouton);
    const sign = changerBalise(out, ronde, 'button', 'type="button" aria-label="Signaler" onClick={vivant.onSignaler}', NU);
    if (sign !== null) out = sign;
    // L'auteur ne se contacte pas : il masque.
    const bc = out.lastIndexOf('<button', out.indexOf('data-modal-open="S02C">Contacter</button>'));
    const fc = finElement(out, bc);
    out = out.slice(0, bc) + `{vivant.estMienne ? null : ${out.slice(bc, fc)}}` + out.slice(fc);
    const prud = out.indexOf('>Visitez avant tout versement.</div>');
    const carte = prud < 0 ? null : autour(out, prud);
    if (carte !== null) out = out.slice(0, carte[0]) + '{vivant.estMienne ? <MasquerMembre v={vivant} /> : null}' + out.slice(carte[0]);
    return out;
  },
);

/**
 * L'état L0 (« Contacter demande une identité vérifiée ») : « Vérifier mon identité »
 * mène à la vérification, « Ou demandez à un parrain… » au parrainage. Sur le cadre
 * d'ordinateur, la carte entière n'apparaît qu'APRÈS un refus réel du serveur.
 */
const SV_S02_L0 = sur(
  'SV_S02_L0',
  ['Vérifier mon identité</button>', 'Ou demandez à un parrain de visiter pour vous</a>'],
  'S02 : l’état « identité à vérifier » a de vrais liens et n’apparaît qu’après un `403 LEVEL_REQUIRED` du serveur.',
  ['vivant'],
  (jsx) => {
    let out = brancher(jsx, 'Vérifier mon identité</button>', 'button', 'href={vivant.hrefVerification}', 'Link', `textDecoration: "none"`);
    if (out === null) return null;
    out = out.replace(/<a href="#" style=\{\{ ([^}]*) \}\}>Ou demandez à un parrain de visiter pour vous<\/a>/, (_, s) =>
      `<Link href={vivant.hrefParrain} style={{ ${s} }}>Ou demandez à un parrain de visiter pour vous</Link>`,
    );
    const etiquette = out.indexOf('>ÉTAT L0 · APRÈS « CONTACTER »</div>');
    if (etiquette >= 0) {
      const lab = autour(out, etiquette);
      const carte = lab === null ? null : parent(out, lab);
      if (carte !== null) {
        const texte = out.slice(carte[0], carte[1]).replace('>ÉTAT L0 · APRÈS « CONTACTER »</div>', '>IDENTITÉ À VÉRIFIER</div>');
        out = coupe(out, carte, `{vivant.refuseNiveau ? (${texte}) : null}`);
      }
    }
    return out;
  },
);

/** La feuille « Présentez-vous » : un vrai message, plus de pré-remplissage inventé. */
const SV_S02_CONTACT = sur(
  'SV_S02_CONTACT',
  ['Présentez-vous<', 'Votre message</div>', 'Aucun versement avant visite'],
  'S02 (feuille) : le message est un champ réel, « Envoyer » ouvre la conversation, les quatre tuiles « pré-rempli » (sans source) disparaissent.',
  ['vivant'],
  (jsx) => {
    let out = jsx;
    const pre = out.indexOf('Pré-rempli depuis votre parcours');
    if (pre >= 0) {
      const ligne = autour(out, pre);
      if (ligne === null) return null;
      const grille = out.indexOf('<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr"', ligne[1]);
      const finGrille = grille < 0 ? -1 : finElement(out, grille);
      if (finGrille < 0) return null;
      out = out.slice(0, ligne[0]) + out.slice(finGrille);
    }
    const m = /<div (style=\{\{ [^}]* \}\})>Bonjour Sarah[^<]*<\/div>/.exec(out);
    if (m === null) return null;
    const champ =
      `<textarea value={vivant.message} onChange={vivant.onMessage} maxLength={vivant.messageMax} rows={4} aria-label="Votre message" data-contact-message="" ` +
      `${m[1].replace('style={{ ', 'style={{ width: "100%", boxSizing: "border-box", font: "inherit", color: "#16211D", outline: "none", resize: "vertical", ')} />`;
    out = out.slice(0, m.index) + champ + out.slice(m.index + m[0].length);
    const e = out.indexOf('Envoyer</button>');
    if (e < 0) return null;
    const debut = out.lastIndexOf('<button', e);
    const erreur =
      '{vivant.echec ? (<div role="alert" style={{ fontSize: "12.5px", fontWeight: "700", color: "#B4581F" }}>{vivant.echec}</div>) : null}';
    const bouton = changerBalise(out, debut, 'button', 'type="button" onClick={vivant.onEnvoyer} disabled={vivant.occupe} data-contact-envoyer=""', '');
    if (bouton === null) return null;
    const pos = debut;
    return bouton.slice(0, pos) + erreur + bouton.slice(pos);
  },
);

// ─── S03 ─────────────────────────────────────────────────────────────────────

const SV_S03_BUREAU = sur(
  'SV_S03_BUREAU',
  ['Publier une annonce<', 'Publier l’annonce</button>', '>APRÈS ENVOI</div>'],
  'S03 (1 440 px) : les champs sont de vrais contrôles (`ChampsAnnonce`), « Publier l’annonce » envoie `POST /housing` (ou `PATCH` en modification) ; « en vérification » ne s’affiche qu’après un refus réel.',
  ['formulaire'],
  (jsx) => {
    let out = jsx.replace(
      />Publier une annonce<\/(h1|div)>/,
      '>{formulaire.modification ? "Modifier l’annonce" : "Publier une annonce"}</$1>',
    );
    const tabs = out.indexOf('>Je propose</span>');
    const conteneur = autour(out, out.lastIndexOf('<span', tabs));
    const bouton = out.lastIndexOf('<button', out.indexOf('Publier l’annonce</button>'));
    if (conteneur === null || bouton < 0) return null;
    out = out.slice(0, conteneur[0]) + '<ChampsAnnonce f={formulaire} />' + out.slice(bouton);
    const b = out.indexOf('Publier l’annonce</button>');
    const debut = out.lastIndexOf('<button', b);
    const neuf = changerBalise(out, debut, 'button', 'type="button" onClick={formulaire.onPublier} disabled={formulaire.bloque || formulaire.grise} data-publier=""', '');
    if (neuf === null) return null;
    out = neuf.replace('Publier l’annonce</button>', '{formulaire.modification ? "Enregistrer" : "Publier l’annonce"}</button>');
    const apres = out.indexOf('>APRÈS ENVOI</div>');
    const etiquette = apres < 0 ? null : autour(out, apres);
    const carte = etiquette === null ? null : parent(out, etiquette);
    if (carte === null) return null;
    return coupe(out, carte, `{formulaire.enVerification ? (${out.slice(carte[0], carte[1])}) : null}`);
  },
);

const SV_S03_MOBILE = sur(
  'SV_S03_MOBILE',
  ['Je recherche</span>', '>Publier</button>', 'repeat(3,1fr)'],
  'S03 (390 px) : tous les champs du serveur (la planche n’en dessinait que quatre), « Publier » câblé.',
  ['formulaire'],
  (jsx) => {
    const tabs = jsx.indexOf('>Je propose</span>');
    const conteneur = autour(jsx, jsx.lastIndexOf('<span', tabs));
    const grille = jsx.indexOf('<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px" }}>');
    const finGrille = grille < 0 ? -1 : finElement(jsx, grille);
    if (conteneur === null || finGrille < 0) return null;
    let out = jsx.slice(0, conteneur[0]) + '<ChampsAnnonce f={formulaire} mobile />' + jsx.slice(finGrille);
    const b = out.indexOf('>Publier</button>');
    const debut = out.lastIndexOf('<button', b);
    const neuf = changerBalise(out, debut, 'button', 'type="button" onClick={formulaire.onPublier} disabled={formulaire.bloque || formulaire.grise} data-publier=""', '');
    if (neuf === null) return null;
    out = neuf.replace('>Publier</button>', '>{formulaire.modification ? "Enregistrer" : "Publier"}</button>');
    return out;
  },
);

// ─── S05 ─────────────────────────────────────────────────────────────────────

const SV_S05_BUREAU = sur(
  'SV_S05_BUREAU',
  ['PUBLIER UNE OFFRE</div>', 'data-modal-open="S05L"', 'Publier l’offre</button>'],
  'S05 (1 440 px) : le détail et le formulaire se partagent la planche selon la route ; Postuler / Signaler / Publier sont câblés ; les champs sont de vrais contrôles.',
  ['vivant', 'formulaire'],
  (jsx) => {
    let out = jsx;
    // Le formulaire d'abord (il est en bas), puis le détail.
    const lib = out.indexOf('>PUBLIER UNE OFFRE</div>');
    const labelEl = autour(out, lib);
    const carteForm = labelEl === null ? null : parent(out, labelEl);
    if (carteForm === null) return null;
    const ouvr = ouvrante(out, carteForm[0]);
    const etiquette = labelEl;
    const labelDebut = out.lastIndexOf('<div', lib);
    const labelFin = finElement(out, labelDebut);
    const bouton = out.lastIndexOf('<button', out.indexOf('Publier l’offre</button>'));
    const finBouton = finElement(out, bouton);
    if (labelFin < 0 || bouton < 0 || finBouton < 0 || etiquette === null) return null;
    const boutonNeuf = changerBalise(out, bouton, 'button', 'type="button" onClick={formulaire.onPublier} disabled={formulaire.bloque} data-publier=""', '');
    if (boutonNeuf === null) return null;
    const finBoutonNeuf = finElement(boutonNeuf, bouton);
    const btn = boutonNeuf.slice(bouton, finBoutonNeuf);
    const nouveau =
      `{offre.mode === "nouveau" ? (${ouvr}${out.slice(labelDebut, labelFin)}` +
      `<div style={{ marginTop: "12px" }}><ChampsOffre f={formulaire} /></div>${btn}</div>) : null}`;
    out = coupe(out, carteForm, nouveau);
    // Le détail.
    const g = out.indexOf('{offre.genre}</span>');
    const carteDetail = autour(out, out.lastIndexOf('<div', out.lastIndexOf('<div', g) - 1));
    if (carteDetail === null) return null;
    let detail = out.slice(carteDetail[0], carteDetail[1]);
    const post = detail.indexOf('data-modal-open="S05L"');
    if (post >= 0) {
      const bp = detail.lastIndexOf('<button', post);
      const fp = finElement(detail, bp);
      detail = detail.slice(0, bp) + `{vivant.aLien ? ${detail.slice(bp, fp)} : null}` + detail.slice(fp);
    }
    const sg = brancher(detail, 'aria-label="Signaler"', 'button', 'type="button" onClick={vivant.onSignaler}');
    if (sg !== null) detail = sg;
    return coupe(out, carteDetail, `{offre.mode === "detail" ? (${detail}) : null}`);
  },
);

const SV_S05_MOBILE = sur(
  'SV_S05_MOBILE',
  [ENTETE_MOBILE, 'data-modal-open="S05R">Recommander</button>', '>Offre</span>'],
  'S05 (390 px) : sur `/nouveau` la planche (qui ne dessinait que le détail) montre le formulaire ; sur une offre, Postuler (si un lien existe) et Recommander.',
  ['vivant', 'formulaire'],
  (jsx) => {
    let out = jsx.replace('>Offre</span>', '>{offre.mode === "detail" ? "Offre" : "Publier une offre"}</span>');
    // Le contenu.
    const cs = out.indexOf('<div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px"');
    const fc = cs < 0 ? -1 : finElement(out, cs);
    if (cs < 0 || fc < 0) return null;
    const ouv = ouvrante(out, cs);
    out = coupe(
      out,
      [cs, fc],
      `{offre.mode === "detail" ? (${out.slice(cs, fc)}) : (${ouv}<ChampsOffre f={formulaire} mobile /></div>)}`,
    );
    // Le pied.
    const pied = out.indexOf('<div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9"');
    const fp = pied < 0 ? -1 : finElement(out, pied);
    if (pied < 0 || fp < 0) return null;
    let barre = out.slice(pied, fp);
    const bp = barre.lastIndexOf('<button', barre.indexOf('data-modal-open="S05L"'));
    const ep = finElement(barre, bp);
    const postuler = barre.slice(bp, ep);
    const publier = changerBalise(
      postuler.replace(' data-modal-open="S05L"', '').replace('>Postuler</button>', '>Publier l’offre</button>'),
      0,
      'button',
      'type="button" onClick={formulaire.onPublier} disabled={formulaire.bloque} data-publier=""',
      '',
    );
    if (publier === null) return null;
    const ouvBarre = ouvrante(barre, 0);
    barre = `{offre.mode === "detail" ? (${barre.slice(0, bp)}{vivant.aLien ? ${postuler} : null}${barre.slice(ep)}) : (${ouvBarre}${publier}</div>)}`;
    return coupe(out, [pied, fp], barre);
  },
);

/** L'interstitiel « Vous quittez la plateforme » : Annuler ferme, Continuer ouvre le lien. */
const SV_S05_LIEN = sur(
  'SV_S05_LIEN',
  ['Vous quittez la plateforme<', '>Continuer</button>'],
  'S05 (fenêtre) : « Continuer » ouvre le lien de candidature dans un nouvel onglet sans référent ; « Annuler » ferme.',
  ['vivant'],
  (jsx) => {
    let out = brancher(jsx, '>Continuer</button>', 'button', 'type="button" onClick={vivant.onContinuer}');
    if (out === null) return null;
    const annuler = brancher(out, '>Annuler</button>', 'button', 'type="button" data-modal-close=""');
    if (annuler !== null) out = annuler;
    return out;
  },
);

/** « Recommander un membre » : chercher par pseudo, commenter, envoyer. */
const SV_S05_RECOMMANDER = sur(
  'SV_S05_RECOMMANDER',
  ['Recommander un membre<', 'Rechercher un membre</div>', 'Fatou Ndiaye'],
  'S05 (fenêtre) : le membre se désigne par son pseudo (`GET /users/:handle`), le commentaire est un champ, « Recommander » envoie `POST /recommendations/members`.',
  ['vivant'],
  (jsx) => {
    const debutContenu = jsx.indexOf('data-fenetre-contenu=""');
    if (debutContenu < 0) return null;
    const conteneur = autour(jsx, debutContenu);
    if (conteneur === null) return null;
    const ouv = ouvrante(jsx, conteneur[0]);
    const CHAMP = 'width: "100%", boxSizing: "border-box", minHeight: "48px", borderRadius: "14px", border: "1px solid #E6EBE9", background: "#fff", padding: "13px 14px", font: "inherit", fontSize: "14px", lineHeight: "1.5", color: "#16211D", outline: "none"';
    const contenu =
      `${ouv}` +
      `<div style={{ display: "flex", gap: "8px" }}><input type="text" value={vivant.recommander.pseudo} onChange={vivant.recommander.onPseudo} placeholder="@pseudo du membre" aria-label="Pseudo du membre" data-recommander-pseudo="" style={{ ${CHAMP}, flex: "1" }} />` +
      `<button type="button" onClick={vivant.recommander.onChercher} disabled={vivant.recommander.occupe || vivant.recommander.pseudo.trim() === ""} style={{ height: "48px", padding: "0 16px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}>Chercher</button></div>` +
      `{vivant.recommander.trouve ? (<div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "14px", fontWeight: "700" }}>{vivant.recommander.trouve.nom}</span><span style={{ display: "block", fontSize: "12px", color: "#8A958F" }}>{vivant.recommander.trouve.sous}</span></span></div>) : null}` +
      `<div style={{ flexShrink: "0" }}><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Commentaire</div><textarea value={vivant.recommander.commentaire} onChange={vivant.recommander.onCommentaire} rows={3} maxLength={500} aria-label="Commentaire" data-recommander-commentaire="" style={{ ${CHAMP}, resize: "vertical" }} /></div>` +
      `{vivant.recommander.echec ? (<div role="alert" style={{ fontSize: "12.5px", fontWeight: "700", color: "#B4581F" }}>{vivant.recommander.echec}</div>) : null}` +
      '</div>';
    let out = coupe(jsx, conteneur, contenu);
    const b = out.indexOf('>Recommander</button>');
    if (b < 0) return null;
    const neuf = brancher(out, '>Recommander</button>', 'button', 'type="button" onClick={vivant.recommander.onEnvoyer} disabled={vivant.recommander.occupe || vivant.recommander.trouve === null} data-recommander-envoyer=""');
    return neuf === null ? null : neuf;
  },
);

// ─── S07 ─────────────────────────────────────────────────────────────────────

const SV_S07_BUREAU = sur(
  'SV_S07_BUREAU',
  ['Utilise 1 de vos {pro.contactsRestants}', 'Vous pouvez recommander un professionnel'],
  'S07 (1 440 px) : Contacter ouvre la conversation, Signaler la fenêtre commune, Recommander n’apparaît que si le serveur le permet.',
  ['vivant'],
  (jsx) => {
    let out = brancher(jsx, 'Contacter</button>', 'button', 'type="button" onClick={vivant.onContacter} disabled={vivant.occupe || pro.estMienne}');
    if (out === null) return null;
    const signaler = brancher(out, 'Signaler</button>', 'button', 'type="button" onClick={vivant.onSignaler}');
    if (signaler !== null) out = signaler;
    const note = 'Vous pouvez recommander un professionnel avec qui vous avez déjà interagi.</div>';
    const at = out.indexOf(note);
    const apres = at + note.length;
    const bouton =
      '{pro.peutRecommander ? (<button type="button" onClick={vivant.onRecommander} style={{ marginTop: "10px", height: "40px", padding: "0 16px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Recommander ce professionnel</button>) : null}';
    return out.slice(0, apres) + bouton + out.slice(apres);
  },
);

const SV_S07_MOBILE = sur(
  'SV_S07_MOBILE',
  [ENTETE_MOBILE, 'Contacter · {pro.quotaCourt}'],
  'S07 (390 px) : « Contacter » ouvre la conversation.',
  ['vivant'],
  (jsx) =>
    brancher(jsx, 'Contacter · {pro.quotaCourt}</button>', 'button', 'type="button" onClick={vivant.onContacter} disabled={vivant.occupe || pro.estMienne}'),
);

// ─── S08 ─────────────────────────────────────────────────────────────────────

const SV_S08_BUREAU = sur(
  'SV_S08_BUREAU',
  ['Envoyer pour validation</button>', '>Nom commercial</div>', '>CONDITIONS</div>'],
  'S08 (1 440 px) : les champs de la fiche sont de vrais contrôles et « Envoyer pour validation » envoie `PUT /me/pro-profile`.',
  ['formulaire'],
  (jsx) => {
    const metier = jsx.indexOf('>Métier</div>');
    const colonne = '<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>';
    const debut = jsx.lastIndexOf(colonne, metier);
    const fin = debut < 0 ? -1 : finElement(jsx, debut);
    if (fin < 0) return null;
    const out = jsx.slice(0, debut) + '<ChampsFichePro f={formulaire} />' + jsx.slice(fin);
    return brancher(out, 'Envoyer pour validation</button>', 'button', 'type="button" onClick={formulaire.onEnvoyer} disabled={formulaire.occupe} data-fiche-envoyer=""');
  },
);

const SV_S08_MOBILE = sur(
  'SV_S08_MOBILE',
  [ENTETE_MOBILE, 'Ma fiche pro<', 'Déposer le justificatif</div>'],
  'S08 (390 px) : tous les champs de la fiche (la planche n’en dessinait que quatre) ; « Envoyer » envoie `PUT /me/pro-profile`.',
  ['formulaire'],
  (jsx) => {
    const metier = jsx.indexOf('>Métier</div>');
    const premier = jsx.lastIndexOf('<div style={{ flexShrink: "0" }}>', metier);
    const depot = jsx.indexOf('>Déposer le justificatif</div>');
    const boite = depot < 0 ? null : autour(jsx, depot);
    if (premier < 0 || boite === null) return null;
    const out = jsx.slice(0, premier) + '<ChampsFichePro f={formulaire} mobile />' + jsx.slice(boite[1]);
    return brancher(out, '>Envoyer</button>', 'button', 'type="button" onClick={formulaire.onEnvoyer} disabled={formulaire.occupe} data-fiche-envoyer=""');
  },
);

// ─── S09 ─────────────────────────────────────────────────────────────────────

const PUCES_S09 = {
  Renouveler: { type: 'bouton', clic: 'gestes.onRenouveler(a.id, a.genre === "logement")' },
  Pause: { type: 'bouton', clic: 'gestes.onPause(a.id)', logement: true },
  Reprendre: { type: 'bouton', clic: 'gestes.onReprendre(a.id)', logement: true },
  'Logement trouvé': { type: 'bouton', clic: 'gestes.onTrouve(a.id)', logement: true },
  Trouvé: { type: 'bouton', clic: 'gestes.onTrouve(a.id)', logement: true },
  Supprimer: { type: 'bouton', clic: 'gestes.onSupprimer(a.id, a.genre === "logement")' },
  Modifier: { type: 'lien', href: 'a.hrefModifier', logement: true },
  Republier: { type: 'lien', href: '"/services/logement/nouveau"', logement: true },
};

const SV_S09 = sur(
  'SV_S09',
  ['(mesAnnonces.liste ?? []).map(', '{mesAnnonces.logement}'],
  'S09 : les onglets Logement / Emploi filtrent la liste, les puces (Renouveler, Pause, Trouvé, Reprendre, Supprimer, Modifier) agissent, le titre ouvre l’annonce.',
  ['gestes'],
  (jsx) => {
    let out = jsx;
    let n = 0;
    // Le cadre d'ordinateur ne dessine PAS l'état « en pause » (celui de 390 px, si) :
    // une annonce suspendue y disparaîtrait sans moyen de la reprendre. On le clone
    // depuis la carte « Active », avec « Reprendre » et « Supprimer ».
    if (!out.includes('{a.enPause ? (<>') && out.includes('{a.active ? (<>')) {
      const debut = out.indexOf('{a.active ? (<>');
      const carte = debut + '{a.active ? (<>'.length;
      const finCarte = finElement(out, carte);
      const finBloc = finCarte < 0 ? -1 : finCarte + '</>) : null}'.length;
      if (finBloc > 0 && out.slice(finCarte, finBloc) === '</>) : null}') {
        let clone = out
          .slice(debut, finBloc)
          .replace('{a.active ? (<>', '{a.enPause ? (<>')
          .replace('background: "#E3F0EB", color: "#0F5C48"', 'background: "#F2F5F4", color: "#5D6B66"')
          .replace('>Active</span>', '>En pause</span>')
          .replace(/<span style=\{\{ (height: "34px"[^}]*) \}\}>Renouveler<\/span>/, '<span style={{ $1 }}>Reprendre</span>')
          .replace(/<span style=\{\{ height: "34px"[^}]*\}\}>Pause<\/span>/, '')
          .replace(/<span style=\{\{ height: "34px"[^}]*\}\}>Logement trouvé<\/span>/, '');
        out = out.slice(0, finBloc) + clone + out.slice(finBloc);
        n += 1;
      }
    }
    out = out.replace('(mesAnnonces.liste ?? []).map(', () => {
      n += 1;
      return '(mesAnnonces.liste ?? []).filter((a) => a.genre === gestes.onglet).map(';
    });
    // Les deux onglets.
    for (const [texte, valeur] of [
      ['Logement · {mesAnnonces.logement}', 'logement'],
      ['Emploi · {mesAnnonces.emploi}', 'emploi'],
    ]) {
      const at = out.indexOf(`>${texte}</span>`);
      if (at < 0) return null;
      const debut = out.lastIndexOf('<span', at);
      const style = styleDe(ouvrante(out, debut));
      if (style === null) return null;
      const actif = style.includes('background: "#fff"');
      const base = style.replace(/ ?background: "#fff",?/, '').replace(/ ?color: "#5D6B66",?/, '').replace(/,\s*$/, '');
      const ACTIF = `${base}, background: "#fff"`;
      const INACTIF = `${base}, color: "#5D6B66"`;
      void actif;
      const bouton = changerBalise(
        out,
        debut,
        'button',
        `type="button" onClick={() => gestes.onOnglet("${valeur}")} aria-pressed={gestes.onglet === "${valeur}"}`,
        NU,
      );
      if (bouton === null) return null;
      out = bouton;
      // Le style actif/inactif suit l'onglet courant : on le recompose.
      const at2 = out.indexOf(`>${texte}</button>`);
      const d2 = out.lastIndexOf('<button', at2);
      const o2 = ouvrante(out, d2);
      const neuveOuv = o2.replace(/style=\{\{ .* \}\}>$/s, `style={gestes.onglet === "${valeur}" ? { ${NU2}, ${ACTIF} } : { ${NU2}, ${INACTIF} }}>`);
      out = out.slice(0, d2) + neuveOuv + out.slice(d2 + o2.length);
      n += 1;
    }
    // Les puces.
    const re = /<span style=\{\{ (height: "34px"[^}]*) \}\}>(Renouveler|Pause|Reprendre|Logement trouvé|Trouvé|Supprimer|Modifier|Republier)<\/span>/g;
    out = out.replace(re, (_, style, libelle) => {
      n += 1;
      const p = PUCES_S09[libelle];
      const corps =
        p.type === 'lien'
          ? `<Link href={${p.href}} style={{ ${style}, textDecoration: "none", color: "inherit" }}>${libelle}</Link>`
          : `<button type="button" onClick={() => ${p.clic}} disabled={gestes.occupe} style={{ ${NU2}, ${style} }}>${libelle}</button>`;
      return p.logement === true ? `{a.genre === "logement" ? (${corps}) : null}` : corps;
    });
    // Le titre ouvre l'annonce.
    out = out.replace(/>\{a\.titre\}<\/div>/g, () => {
      n += 1;
      return `><Link href={a.href} style={{ ${SANS_LIEN} }}>{a.titre}</Link></div>`;
    });
    return n === 0 ? null : out;
  },
);

// ─── S10 ─────────────────────────────────────────────────────────────────────

const SV_S10 = sur(
  'SV_S10',
  ['(alertes.liste ?? []).map(', '{al.titre}', '"46px"'],
  'S10 : l’interrupteur de chaque alerte l’active / la met en pause, « Supprimer » la retire, la carte « Nouvelle alerte » enregistre (sur les deux largeurs).',
  ['formulaire', 'gestes'],
  (jsx) => {
    let out = jsx;
    let n = 0;
    // Les interrupteurs : `<span 46×26><span knob/></span>` → bouton `switch`.
    for (const couleur of ['#16785E', '#CBD5D1']) {
      const motif = `<span style={{ width: "46px", height: "26px", borderRadius: "999px", background: "${couleur}", position: "relative" }}>`;
      const at = out.indexOf(motif);
      if (at < 0) continue;
      const neuf = changerBalise(
        out,
        at,
        'button',
        'type="button" role="switch" aria-checked={al.active} aria-label={al.active ? "Mettre l’alerte en pause" : "Activer l’alerte"} onClick={() => gestes.onBasculer(al.id, al.active)} disabled={gestes.occupe}',
        NU,
      );
      if (neuf !== null) {
        out = neuf;
        n += 1;
      }
    }
    // « Supprimer », avant les interrupteurs.
    const premier = out.indexOf('{al.active ? (<>');
    if (premier >= 0) {
      const supprimer =
        '<button type="button" aria-label="Supprimer l’alerte" onClick={() => gestes.onSupprimer(al.id)} disabled={gestes.occupe} style={{ border: "none", background: "transparent", font: "inherit", fontSize: "12px", fontWeight: "700", color: "#B4581F", cursor: "pointer", padding: "4px 6px" }}>Supprimer</button>';
      out = out.slice(0, premier) + supprimer + out.slice(premier);
      n += 1;
    }
    // La carte « Nouvelle alerte ».
    const lib = out.indexOf('>NOUVELLE ALERTE</div>');
    if (lib >= 0) {
      const lab = autour(out, lib);
      const carte = lab === null ? null : parent(out, lab);
      if (carte !== null) {
        out = coupe(out, carte, '<CarteNouvelleAlerte f={formulaire} />');
        n += 1;
      }
      const creer = brancher(out, 'Créer une alerte</button>', 'button', 'href="#nouvelle-alerte"', 'a', 'textDecoration: "none"');
      if (creer !== null) out = creer;
    } else {
      const fin = out.indexOf('</Fragment>\n))}');
      if (fin >= 0) {
        const pos = fin + '</Fragment>\n))}'.length;
        out = out.slice(0, pos) + '<CarteNouvelleAlerte f={formulaire} />' + out.slice(pos);
        n += 1;
      }
    }
    return n === 0 ? null : out;
  },
);

// ─── S04 ─────────────────────────────────────────────────────────────────────

const SV_S04_OFFRES = sur(
  'SV_S04_OFFRES',
  ['(offres.liste ?? []).map(', '{o.sponsorisee ? ('],
  'S04 : la carte d’une offre ouvre sa fiche et son signet enregistre l’offre.',
  [],
  (jsx) => {
    const at = jsx.indexOf('{o.sponsorisee ? (');
    const entete = jsx.lastIndexOf('<div', at);
    const carte = jsx.lastIndexOf('<div', entete - 1);
    const neuf = carte < 0 ? null : changerBalise(jsx, carte, 'CadreCliquable', 'vers={o.href}', '');
    if (neuf === null) return null;
    const re = new RegExp(`<svg[^>]*>\\s*<path d="${MARQUE_SIGNET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" />\\s*</svg>`, 'g');
    return neuf.replace(re, '<BoutonEnregistrer type="JOB" id={o.id} />');
  },
);

const SV_S04_PUBLIER = sur(
  'SV_S04_PUBLIER',
  ['Publier une offre</button>', 'Profils disponibles</span>'],
  'S04 : « Publier une offre » mène au formulaire (S05).',
  [],
  (jsx) =>
    brancher(jsx, 'Publier une offre</button>', 'button', 'href="/services/emploi/nouveau"', 'Link', 'textDecoration: "none"'),
);

const SV_S04_PROFILS = sur(
  'SV_S04_PROFILS',
  ['(profils.liste ?? []).map(', '>Contacter</button>'],
  'S04 : « Contacter » un profil disponible ouvre la conversation.',
  ['vivant'],
  (jsx) =>
    brancher(jsx, '>Contacter</button>', 'button', 'type="button" onClick={() => vivant.onContacter(p.handle, p.prenom)} disabled={vivant.occupe}'),
);

const SV_ONGLETS_MOBILE = sur(
  'SV_ONGLETS_MOBILE',
  ['tabIndex={0}>', '>Mes annonces</span>', '>Annuaire</span>'],
  'S04 / S06 (390 px) : la bande d’onglets est une liste de liens.',
  ['onglets'],
  (jsx) => {
    const at = jsx.indexOf('tabIndex={0}>');
    const debut = jsx.lastIndexOf('<div', at);
    const fin = debut < 0 ? -1 : finElement(jsx, debut);
    return fin < 0 ? null : puces(jsx, [debut, fin], 'onglets');
  },
);

// ─── S06 ─────────────────────────────────────────────────────────────────────

const SV_S06 = sur(
  'SV_S06',
  ['(annuaire.fiches ?? []).map(', '>Voir</button>'],
  'S06 : « Voir » ouvre la fiche ; la recherche et les puces de métier filtrent (`?q=`).',
  [],
  (jsx) => {
    let out = jsx;
    let n = 0;
    for (;;) {
      const neuf = brancher(out, '>Voir</button>', 'button', 'href={p.href}', 'Link', 'textDecoration: "none"');
      if (neuf === null) break;
      out = neuf;
      n += 1;
    }
    // La boîte de recherche.
    const motif = out.includes('>Avocat · Lyon</div>') ? '>Avocat · Lyon</div>' : '>Avocat</div>';
    const at = out.indexOf(motif);
    if (at >= 0) {
      const boite = autour(out, at);
      if (boite !== null) {
        const ouv = ouvrante(out, boite[0]);
        const contenu = out.slice(boite[0] + ouv.length, boite[1] - '</div>'.length);
        const svg = /^<svg[\s\S]*?<\/svg>/.exec(contenu);
        const form =
          '<form action="/services/annuaire" method="get" style={{ flex: "1", display: "flex", minWidth: "0" }}>' +
          '<input key={annuaire.recherche} type="search" name="q" defaultValue={annuaire.recherche} placeholder="Avocat, comptable…" aria-label="Rechercher un professionnel" minLength={2} ' +
          'style={{ border: "none", background: "transparent", font: "inherit", color: "inherit", outline: "none", width: "100%", minWidth: "0" }} /></form>';
        out = coupe(out, boite, `${ouv}${svg === null ? '' : svg[0]}${form}</div>`);
        n += 1;
      }
    }
    // Les puces de métier (ordinateur).
    const comptable = out.indexOf('>Comptable</span>');
    if (comptable >= 0) {
      const sp = out.lastIndexOf('<span', comptable);
      const rangee = autour(out, sp);
      const refait = rangee === null ? null : puces(out, rangee, 'annuaire.metiers');
      if (refait !== null) {
        out = refait;
        n += 1;
      }
    }
    return n === 0 ? null : out;
  },
);

// ─── Registre ────────────────────────────────────────────────────────────────

export const ADAPTATIONS_SERVICES_VIVANT = [
  SV_RETOUR_S03,
  SV_RETOUR_S05,
  SV_RETOUR_S07,
  SV_RETOUR_S08,
  SV_SIGNET_S05,
  SV_SIGNET_S07,
  SV_S01_CARTES,
  SV_S01_PUBLIER,
  SV_S01_FILTRES,
  SV_S01_ONGLETS,
  SV_S01_PARTENAIRE,
  SV_S01_RECHERCHE,
  SV_S02_BUREAU,
  SV_S02_MOBILE,
  SV_S02_L0,
  SV_S02_CONTACT,
  SV_S03_BUREAU,
  SV_S03_MOBILE,
  SV_S05_BUREAU,
  SV_S05_MOBILE,
  SV_S05_LIEN,
  SV_S05_RECOMMANDER,
  SV_S07_BUREAU,
  SV_S07_MOBILE,
  SV_S08_BUREAU,
  SV_S08_MOBILE,
  SV_S09,
  SV_S10,
  SV_S04_OFFRES,
  SV_S04_PUBLIER,
  SV_S04_PROFILS,
  SV_ONGLETS_MOBILE,
  SV_S06,
].map((a) => ({
  ...a,
  apply(jsx) {
    const r = a.apply(jsx);
    return r.applied ? { jsx: dedoublerStyles(r.jsx), applied: true } : r;
  },
}));

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_SERVICES_VIVANT = {
  ChampsAnnonce: '@/components/services/champs-annonce',
  ChampsOffre: '@/components/services/champs-offre',
  ChampsFichePro: '@/components/services/champs-fiche-pro',
  CarteNouvelleAlerte: '@/components/services/carte-nouvelle-alerte',
  BoutonRetour: '@/components/services/bouton-retour',
  BoutonPartager: '@/components/services/partager',
  EncartPartenaire: '@/components/services/encart-partenaire',
  BoutonEnregistrer: '@/components/services/bouton-enregistrer',
  MasquerMembre: '@/components/services/masquer-membre',
};
