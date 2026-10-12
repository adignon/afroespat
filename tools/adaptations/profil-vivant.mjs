/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « PROFIL VIVANT » — K02, LE PROFIL D'UN AUTRE MEMBRE                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, sur le profil visité :
 *
 *   « Même quand la demande est envoyée le bouton affiche toujours “Envoyer une
 *   demande”. […] La fonctionnalité de recommandation fait quoi ? Aussi le bouton
 *   d'option ? […] Sur mobile certaines choses ne s'affichent pas (comme
 *   parrainages, événements, options…). “RH · CAF · Français · Wolof ·
 *   Disponible pour aider…” cette ligne est dynamique aussi. »
 *
 * Six adaptations, appliquées APRÈS toutes celles de `generate-screens.mjs`
 * (elles partent donc de cadres déjà branchés : `onEcrire`, `onRecommander`,
 * `data-modal-open="K02C"`). Chacune est déclarée pour K02 seul, et le journal
 * dira « introuvable » sur le cadre qui ne dessine pas son motif — c'est le sens
 * du piège n° 7, pas une adaptation inutile.
 *
 * ⚠ ÉCARTS À LA MAQUETTE, remontés au porteur : la planche de 390 px ne dessine
 * ni les deux derniers compteurs, ni les étiquettes, ni la ligne « en commun »,
 * ni le « ··· ». Ils y sont AJOUTÉS, dans le dessin de leurs équivalents (les
 * cartes de compteur clonées de « guides », le rond « ··· » cloné du rond retour
 * du bandeau), parce que le porteur a demandé que le téléphone les montre.
 */
import { finElement } from './reseau-vivant.mjs';

/** Le premier `<span …>` de `jsx` qui porte EXACTEMENT ce texte, et son style. */
function etiquetteDessinee(jsx, texte) {
  const fin = jsx.indexOf(`>${texte}</span>`);
  if (fin < 0) return null;
  const debut = jsx.lastIndexOf('<span style={{', fin);
  if (debut < 0) return null;
  const style = /style=\{\{ ([^}]*) \}\}/.exec(jsx.slice(debut, fin + 1));
  return style === null ? null : { debut, fin: fin + `>${texte}</span>`.length, style: style[1] };
}

/**
 * ── 1. LES ÉTIQUETTES ET « DISPONIBLE POUR AIDER » ───────────────────────────
 *
 * À 1 440 px, quatre `<span>` en dur (« RH », « CAF », « Français », « Wolof »)
 * puis la pastille verte « Disponible pour aider · {membre.aides} », montrée à
 * tous. Ils deviennent : une boucle sur `membre.etiquettes` (compétences puis
 * langues), et la pastille SEULEMENT si `membre.disponible`, sans « · » final
 * quand aucun type d'aide n'est coché. La rangée entière disparaît si elle est
 * vide.
 *
 * À 390 px, la planche ne dessine que la pastille, sous `membre.aides ? … :
 * null` : on garde son conteneur, et on y pose les mêmes étiquettes, dans le
 * style gris de l'ordinateur.
 */
const STYLE_ETIQUETTE =
  'background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap"';

const pastilleDisponible = (style) =>
  `{membre.disponible ? (<span style={{ ${style} }}>Disponible pour aider{membre.aides === "" ? "" : \` · \${membre.aides}\`}</span>) : null}`;

const boucleEtiquettes = (style) =>
  `{(membre.etiquettes ?? []).map((et) => (<span key={et} style={{ ${style} }}>{et}</span>))}`;

const K02_ETIQUETTES = {
  screens: ['K02'],
  nom: 'K02_ETIQUETTES',
  why: 'Les étiquettes du profil (compétences puis langues) et « Disponible pour aider » viennent de `skills`, `languages` et `availableToHelp` — la maquette écrivait « RH · CAF · Français · Wolof » en dur et montrait la disponibilité à tous.',
  provides: ['membre'],
  apply(jsx) {
    const rh = etiquetteDessinee(jsx, 'RH');
    const dispo = jsx.indexOf('>Disponible pour aider · {membre.aides}</span>');
    if (rh !== null && dispo > rh.debut) {
      // Ordinateur : le conteneur flexible juste avant « RH ».
      const conteneur = jsx.lastIndexOf('<div style={{', rh.debut);
      const ouvre = jsx.slice(conteneur, jsx.indexOf('>', conteneur) + 1);
      const fin = finElement(jsx, conteneur);
      const debutDispo = jsx.lastIndexOf('<span style={{', dispo);
      const styleDispo = /style=\{\{ ([^}]*) \}\}/.exec(jsx.slice(debutDispo, dispo + 1))[1];
      const neuf =
        '{(membre.etiquettes ?? []).length > 0 || membre.disponible ? (' +
        ouvre +
        boucleEtiquettes(rh.style) +
        pastilleDisponible(styleDispo) +
        '</div>) : null}';
      return { jsx: jsx.slice(0, conteneur) + neuf + jsx.slice(fin), applied: true };
    }

    // Téléphone : `{membre.aides ? (<div …><span …>Disponible…</span></div>) : null}`.
    const motif = /\{membre\.aides \? \((<div style=\{\{ [^}]* \}\}>)<span style=\{\{ ([^}]*) \}\}>Disponible pour aider · \{membre\.aides\}<\/span><\/div>\) : null\}/;
    const m = motif.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const neuf =
      '{(membre.etiquettes ?? []).length > 0 || membre.disponible ? (' +
      m[1] +
      boucleEtiquettes(STYLE_ETIQUETTE) +
      pastilleDisponible(m[2]) +
      '</div>) : null}';
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

/**
 * ── 2. « CONNECTÉE À 3 DE VOS CONTACTS · 2 RÉSEAUX EN COMMUN » ──────────────
 *
 * En dur à 1 440 px. Il devient `membre.commun`, composé depuis
 * `GET /users/:handle/mutual-connections`, et la ligne se tait quand il n'y a
 * rien en commun. À 390 px, absente de la planche : posée sous les compteurs,
 * dans le style de l'ordinateur.
 */
const LIGNE_COMMUN_DESSINEE = 'Connectée à 3 de vos contacts · 2 réseaux en commun';
const STYLE_COMMUN = 'fontSize: "12.5px", color: "#5D6B66"';

const K02_COMMUN = {
  screens: ['K02'],
  nom: 'K02_COMMUN',
  why: '« Connecté·e à N de vos contacts · M réseaux en commun » vient de `GET /users/:handle/mutual-connections` (contacts ET réseaux en commun) et se tait quand il n’y a rien — la maquette l’écrivait en dur.',
  provides: ['membre'],
  apply(jsx) {
    const at = jsx.indexOf(`>${LIGNE_COMMUN_DESSINEE}</div>`);
    if (at >= 0) {
      const debut = jsx.lastIndexOf('<div style={{', at);
      const fin = at + `>${LIGNE_COMMUN_DESSINEE}</div>`.length;
      const ouvre = jsx.slice(debut, at + 1);
      const neuf = `{membre.commun === "" ? null : (${ouvre}{membre.commun}</div>)}`;
      return { jsx: jsx.slice(0, debut) + neuf + jsx.slice(fin), applied: true };
    }
    return { jsx, applied: false };
  },
};

/**
 * ── 3. LES COMPTEURS DU TÉLÉPHONE : PARRAINAGES ET ÉVÉNEMENTS ───────────────
 *
 * La planche de 390 px n'en dessine que deux (« entraides », « guides »), dans
 * une grille de deux colonnes. On CLONE la carte « guides » deux fois — même
 * dessin, autre nombre, autre mot — et la grille passe naturellement sur deux
 * rangées. Puis la ligne « en commun » se pose juste sous la grille.
 */
const K02_COMPTEURS_MOBILE = {
  screens: ['K02'],
  nom: 'K02_COMPTEURS_MOBILE',
  why: 'À 390 px, « parrainages » et « événements » rejoignent « entraides » et « guides » (cartes clonées de « guides »), et la ligne « en commun » se pose sous la grille — la planche ne les dessinait pas.',
  provides: ['membre'],
  apply(jsx) {
    const marque = '>guides</div></div>';
    const at = jsx.indexOf(marque);
    // L'ordinateur écrit « guides utiles » : seul le téléphone porte ce mot nu.
    if (at < 0 || jsx.includes('{membre.parrainages}')) return { jsx, applied: false };
    const debutCarte = jsx.lastIndexOf('<div style={{ background: "#fff"', at);
    const finCarte = at + marque.length;
    const carte = jsx.slice(debutCarte, finCarte);
    const clone = (valeur, mot) =>
      carte.replace('{membre.guides}', `{membre.${valeur}}`).replace('>guides</div>', `>${mot}</div>`);
    const grilleFin = finCarte + '</div>'.length;
    const ajout =
      clone('parrainages', 'parrainages') +
      clone('evenements', 'événements');
    const ligne = `{membre.commun === "" ? null : (<div style={{ ${STYLE_COMMUN} }}>{membre.commun}</div>)}`;
    return {
      jsx: jsx.slice(0, finCarte) + ajout + jsx.slice(finCarte, grilleFin) + ligne + jsx.slice(grilleFin),
      applied: true,
    };
  },
};

/**
 * ── 4. LE BOUTON DE CONTACT, SELON LA RELATION ───────────────────────────────
 *
 * Le porteur : « même quand la demande est envoyée, le bouton affiche toujours
 * “Envoyer une demande” ». Le bouton dessiné (`data-modal-open="K02C"`, qui ouvre
 * la fenêtre de la maquette) ne reste que pour `contact.etat === "aucune"`. Pour
 * les autres états, le même bouton — même style, sans l'icône « + » — porte
 * `contact.libelle` (1 440 px) ou `contact.libelleCourt` (390 px), éteint quand
 * il n'y a rien à faire (« Demande envoyée », « Dans vos contacts ») et actif
 * pour « Accepter la demande ».
 */
const K02_CONTACT = {
  screens: ['K02'],
  nom: 'K02_CONTACT',
  why: 'Le bouton « Ajouter aux contacts » / « Ajouter » suit la relation (`relation` du profil public) : il ouvre la fenêtre de la maquette sans relation, dit « Demande envoyée » ou « Dans vos contacts » (éteint) et « Accepter la demande » quand ce membre m’en a envoyé une.',
  provides: ['contact'],
  apply(jsx) {
    const marque = jsx.indexOf('data-modal-open="K02C"');
    if (marque < 0 || jsx.includes('contact.etat')) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<button', marque);
    const fin = finElement(jsx, debut);
    const original = jsx.slice(debut, fin);
    const ms = /style=\{\{ ([^}]*) \}\}/.exec(original);
    if (ms === null) return { jsx, applied: false };
    const court = original.includes('>Ajouter</button>');
    const style =
      ms[1] + ', cursor: contact.inactif ? "default" : "pointer", opacity: contact.inactif ? ".7" : "1"';
    const autre =
      '<button type="button" onClick={contact.onAction} disabled={contact.inactif} ' +
      `data-profil-contact={contact.etat} style={{ ${style} }}>` +
      `{contact.${court ? 'libelleCourt' : 'libelle'}}</button>`;
    const neuf = `{contact.etat === "aucune" ? (${original}) : (${autre})}`;
    return { jsx: jsx.slice(0, debut) + neuf + jsx.slice(fin), applied: true };
  },
};

/**
 * ── 5. LE « ··· » DE L'ORDINATEUR DEVIENT UN MENU ────────────────────────────
 *
 * `<button aria-label="Menu">` sans geste. Il devient `MenuRond` : le même
 * dessin (passé en `rondStyle`, icône en enfant), et la liste `options` —
 * retirer des contacts, signaler, bloquer. Sur mon propre profil la liste est
 * vide, et `MenuRond` rend le rond inerte.
 */
const K02_OPTIONS = {
  screens: ['K02'],
  nom: 'K02_OPTIONS',
  why: 'Le « ··· » du profil ouvre un menu — Retirer des contacts, Signaler, Bloquer — au lieu d’être un bouton sans geste.',
  provides: ['options'],
  apply(jsx) {
    const m = /<button aria-label="Menu" style=\{\{ ([^}]*) \}\}>(<svg[\s\S]*?<\/svg>)<\/button>/.exec(jsx);
    if (m === null) return { jsx, applied: false };
    const neuf = `<MenuRond entrees={options ?? []} rondStyle={{ ${m[1]} }} libelle="Plus d’options">${m[2]}</MenuRond>`;
    return { jsx: jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length), applied: true };
  },
};

/**
 * ── 6. LE « ··· » DU TÉLÉPHONE, QUE LA PLANCHE NE DESSINE PAS ────────────────
 *
 * Le bandeau de 390 px porte un seul rond, le retour, à gauche (`top: 50px`,
 * `left: 12px`). On le CLONE à droite (`right: 12px`) avec l'icône « ··· » de
 * l'ordinateur, en `MenuRond` nourri par `optionsMobile` — les entrées de
 * l'ordinateur précédées de « Recommander », que le téléphone ne dessine pas
 * non plus.
 */
const POINTS =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>';

const K02_OPTIONS_MOBILE = {
  screens: ['K02'],
  nom: 'K02_OPTIONS_MOBILE',
  why: 'À 390 px, un rond « ··· » (clone du rond retour, à droite du bandeau) ouvre Recommander, Retirer des contacts, Signaler et Bloquer — la planche ne dessine ni ce menu ni « Recommander ».',
  provides: ['optionsMobile'],
  apply(jsx) {
    const m =
      /<span style=\{\{ position: "absolute", top: "50px", left: "12px" \}\}><span style=\{\{ ([^}]*) \}\}><svg[\s\S]*?<\/svg><\/span><\/span>/.exec(
        jsx,
      );
    if (m === null || jsx.includes('optionsMobile')) return { jsx, applied: false };
    const rond =
      '<span style={{ position: "absolute", top: "50px", right: "12px", zIndex: 25 }}>' +
      `<MenuRond entrees={optionsMobile ?? []} rondStyle={{ ${m[1]} }} libelle="Plus d’options">${POINTS}</MenuRond></span>`;
    const fin = m.index + m[0].length;
    return { jsx: jsx.slice(0, fin) + rond + jsx.slice(fin), applied: true };
  },
};

export const ADAPTATIONS_PROFIL_VIVANT = [
  K02_ETIQUETTES,
  K02_COMMUN,
  K02_COMPTEURS_MOBILE,
  K02_CONTACT,
  K02_OPTIONS,
  K02_OPTIONS_MOBILE,
];
