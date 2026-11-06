#!/usr/bin/env node
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PAGE D'ACCUEIL — `docs/template/Landing Page v4.dc.html` → JSX          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Même principe que `generate-screens.mjs` : le style en ligne de la maquette devient celui du composant, à
 * l'identique ; ce qui s'écrit à la main, c'est la DONNÉE et le COMPORTEMENT (`screens/landing/data.ts`).
 *
 * Cette maquette n'est pas une « planche » à largeur fixe : c'est une page vivante (un état, des fenêtres, une
 * mise en page qui répond à la largeur). Elle n'entre donc pas dans les déclarations de `tools/screens/`, et ce
 * script, plus court, appelle directement le transcodeur (`dc-to-jsx.mjs`).
 *
 * ── LES ADAPTATIONS, et chacune doit s'appliquer EXACTEMENT UNE FOIS ───────────────────────────────────────
 * Une adaptation qui ne trouve plus sa cible fait échouer le script : jamais de disparition silencieuse quand la
 * maquette change.
 *
 *   1. « Des liens qui se tissent » (histoires, « Lire l'histoire ») : retirée — décision du porteur.
 *   2. Fenêtre d'inscription (e-mail + Google) : retirée. Le produit s'inscrit par téléphone (`/connexion`) ;
 *      « Rejoindre » et « Se connecter » y mènent.
 *   3. Boutons de l'application mobile (Google Play, App Store, « Télécharger l'application ») : retirés,
 *      l'application n'existe pas.
 *   4. Photos Unsplash : réécrites vers `/landing/<id>-<largeur>.jpg` (hébergées avec le site ; la politique de
 *      sécurité n'autorise aucune image externe, et un chargement tiers trahit la visite).
 *   5. `style-hover` : traduit en classes CSS `:hover` (`landing.generated.css`).
 *   6. `<image-slot>` : devient `<ImageLanding>`.
 *   7. Balises SVG auto-fermantes suivies de leur balise fermante : nettoyées.
 *   8. Chiffres écrits en dur (« 12 400 membres dans 38 villes », « 24 pays ») : remplacés par des liaisons, et les
 *      sections qui n'ont rien de vrai à montrer (compteurs sous le seuil, aucun événement, aucune citation,
 *      aucune statistique d'entraide, aucune ville) disparaissent au lieu d'afficher du vide ou du faux.
 *   9. Liens « # » : vers `/connexion` (le produit s'ouvre par le téléphone) ; le logo mène à `/`.
 *  10. « RÈGLES » d'un réseau : seulement quand le réseau en publie (la fiche publique n'en a pas).
 *  11. Pied de page : liens légaux vers `/p/cgu`, `/p/confidentialite`, `/p/cookies`, `/p/mentions-legales` ; « Charte de la
 *      communauté » (aucune page) et icônes de réseaux sociaux (aucune adresse) retirés ; année calculée.
 *  12. Structure et accessibilité : `<main>`, bouton de recherche, fenêtres `role="dialog"`, noms des boutons-icônes, sélecteur
 *      « Français » retiré (aucun effet), « Réessayer » quand un guide ou un réseau ne charge pas.
 *  13. Mise en page : points de rupture CSS (`landing.css`) à la place de `window.innerWidth` (plus de saut au montage).
 *  14. Catégories et villes : elles ouvrent le contenu public correspondant (recherche, fiche du réseau de la ville).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { remplacerLogo } from './logo-marque.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transcode } from './dc-to-jsx.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(RACINE, 'docs/template/Landing Page v4.dc.html');
const SORTIE = resolve(RACINE, 'apps/web/src/screens/landing');

const echec = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

/** Le bloc `ouvre … ferme` qui commence à `debut`, imbrications comprises ; rend l'indice de fin (exclu). */
function finDeBloc(html, debut, ouvre, ferme) {
  let profondeur = 0;
  let i = debut;
  for (;;) {
    const o = html.indexOf(ouvre, i);
    const f = html.indexOf(ferme, i);
    if (f === -1) return echec(`bloc ${ouvre} non refermé`);
    if (o !== -1 && o < f) {
      profondeur += 1;
      i = o + ouvre.length;
    } else {
      profondeur -= 1;
      i = f + ferme.length;
      if (profondeur === 0) return i;
    }
  }
}

function retirer(html, nom, debut, fin) {
  if (debut < 0 || fin <= debut) echec(`adaptation « ${nom} » : cible introuvable`);
  return html.slice(0, debut) + html.slice(fin);
}

const source = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
const apresHelmet = source.indexOf('</helmet>');
const finDc = source.indexOf('</x-dc>');
if (apresHelmet < 0 || finDc < 0) echec('structure <x-dc>/<helmet> introuvable');
let corps = source.slice(apresHelmet + '</helmet>'.length, finDc);

// 0. Aucune personne ni aucun chiffre inventé : la légende « premier jour à Lyon » et la conversation d'exemple
//    (« Kofi B. », « Fatou N. », « 132 utiles ») n'existent pas dans la base ; seule la photo reste.
{
  const legende = /\n\s*<span style="position:absolute;left:-20px;bottom:10px;[^>]*>premier jour à Lyon<\/span>/;
  if (!legende.test(corps)) echec('adaptation « légende » : la légende « premier jour à Lyon » est introuvable');
  corps = corps.replace(legende, '');
  const debut = corps.indexOf('<div style="position:absolute;left:clamp(12px,4%,28px);top:clamp(12px,4%,28px);right:clamp(12px,4%,28px);max-width:330px;background:#fff');
  if (debut < 0) echec('adaptation « conversation » : la première carte est introuvable');
  const finPremiere = debut + finDeBloc(corps.slice(debut), 0, '<div', '</div>');
  const secondeDebut = corps.indexOf('<div', finPremiere);
  const fin = secondeDebut + finDeBloc(corps.slice(secondeDebut), 0, '<div', '</div>');
  if (!corps.slice(secondeDebut, fin).includes('132 utiles')) echec('adaptation « conversation » : la seconde carte est introuvable');
  corps = retirer(corps, 'conversation', debut, fin);
  {
    // Le faux avancement de parcours (« PARCOURS ÉTUDES · LYON », 58 %) : un chiffre et une ville inventés.
    const d = corps.indexOf('<div style="position:absolute;left:clamp(12px,4%,28px);right:clamp(12px,4%,28px);bottom:clamp(12px,4%,28px);background:#fff;border-radius:22px;padding:18px;max-width:340px">');
    if (d < 0) echec('adaptation « avancement » : la carte est introuvable');
    const f = d + finDeBloc(corps.slice(d), 0, '<div', '</div>');
    if (!corps.slice(d, f).includes('PARCOURS ÉTUDES')) echec('adaptation « avancement » : mauvaise carte');
    corps = retirer(corps, 'avancement', d, f);
  }

// 0 bis. Le crédit « Portraits : … sur Unsplash » du pied de page est retiré (demande du porteur).
{
  const credit = /<span>Portraits : [\s\S]*?sur <a [^>]*>Unsplash<\/a><\/span>/;
  if (!credit.test(corps)) echec('adaptation « crédit portraits » : le crédit est introuvable');
  corps = corps.replace(credit, '');
}
}

// 1. Les histoires.
{
  const i = corps.indexOf('list="{{ stories }}"');
  if (i < 0) echec('adaptation « histoires » : la boucle {{ stories }} est introuvable');
  const debut = corps.lastIndexOf('<section', i);
  const fin = corps.indexOf('</section>', i) + '</section>'.length;
  corps = retirer(corps, 'histoires', debut, fin);
}

// 2. La fenêtre d'inscription.
{
  const debut = corps.indexOf('<sc-if value="{{ isSignup }}"');
  corps = retirer(corps, 'inscription', debut, debut < 0 ? -1 : finDeBloc(corps, debut, '<sc-if', '</sc-if>'));
}

// 3. L'application mobile.
{
  const badges = /\n?\s*<span style="font-size:13\.5px;font-weight:700;margin-top:8px">Télécharger l’application<\/span>\s*<div style="display:flex;gap:8px;flex-wrap:wrap"><a [^>]*>[\s\S]*?Google Play<\/span><\/a><a [^>]*>[\s\S]*?App Store<\/span><\/a><\/div>/;
  if (!badges.test(corps)) echec('adaptation « application » : les badges du pied de page sont introuvables');
  corps = corps.replace(badges, '');
  const bouton = /<a href="#" style="height:52px;padding:0 22px;border-radius:999px;background:rgba\(255,255,255,\.16\)[^>]*>Télécharger l’application<\/a>/;
  if (!bouton.test(corps)) echec('adaptation « application » : le bouton de la dernière section est introuvable');
  corps = corps.replace(bouton, '');
}

// 8. Les chiffres et sections vivants.
function envelopper(html, nom, debut, fin, condition) {
  if (debut < 0 || fin <= debut) echec(`adaptation « ${nom} » : cible introuvable`);
  return `${html.slice(0, debut)}<sc-if value="{{ ${condition} }}" hint-placeholder-val="{{ true }}">${html.slice(debut, fin)}</sc-if>${html.slice(fin)}`;
}
function remplacerUneFois(html, nom, avant, apres) {
  const i = html.indexOf(avant);
  if (i < 0 || html.indexOf(avant, i + 1) >= 0) echec(`adaptation « ${nom} » : « ${avant.slice(0, 40)} » doit figurer exactement une fois`);
  return html.replace(avant, () => apres);
}
function sectionDe(html, repere) {
  const i = html.indexOf(repere);
  if (i < 0) return echec(`section introuvable : « ${repere.slice(0, 40)} »`);
  return [html.lastIndexOf('<section', i), html.indexOf('</section>', i) + '</section>'.length];
}
{
  // La ligne du héros : les visages et « N membres dans N villes ».
  corps = remplacerUneFois(corps, 'chiffres du héros', '12 400 membres dans 38 villes', '{{ heroStat }}');
  {
    const i = corps.indexOf('{{ heroStat }}');
    const debut = corps.lastIndexOf('<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#5D6B66">', i);
    const fin = corps.indexOf('</div>', i) + '</div>'.length;
    corps = envelopper(corps, 'ligne du héros', debut, fin, 'showHeroStat');
  }
  // Le bandeau des pays.
  corps = remplacerUneFois(corps, 'pays', 'Des membres venus de 24 pays', '{{ countriesLabel }}');
  {
    const [d, e] = sectionDe(corps, '{{ countriesLabel }}');
    corps = envelopper(corps, 'bandeau des pays', d, e, 'showCountries');
  }
  // Les événements à venir.
  {
    const [d, e] = sectionDe(corps, 'Rencontres à venir près de chez vous');
    corps = envelopper(corps, 'événements', d, e, 'hasEvents');
  }
  // Les trois tuiles de statistiques d'entraide (pas la section entière : elle porte aussi le texte).
  {
    const i = corps.indexOf('list="{{ entraideStats }}"');
    const ouverture = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:4px">';
    const debut = corps.lastIndexOf(ouverture, i);
    if (debut < 0) echec('adaptation « statistiques d’entraide » : la grille est introuvable');
    const fin = debut + finDeBloc(corps.slice(debut), 0, '<div', '</div>');
    corps = envelopper(corps, 'statistiques d’entraide', debut, fin, 'hasEntraide');
  }
  // Les villes.
  {
    const [d, e] = sectionDe(corps, 'Une communauté dans votre ville');
    corps = envelopper(corps, 'villes', d, e, 'hasCities');
  }
  // Les citations.
  {
    const [d, e] = sectionDe(corps, 'Ils racontent leur arrivée');
    corps = envelopper(corps, 'citations', d, e, 'hasQuotes');
  }
}

// 11. Structure et accessibilité : <main>, boutons nommés, fenêtres (role="dialog"), sélecteur de langue retiré.
{
  const h = corps.indexOf('</header>');
  const f = corps.indexOf('<footer');
  if (h < 0 || f <= h) echec('adaptation « main » : l’en-tête ou le pied de page est introuvable');
  const finEntete = h + '</header>'.length;
  corps = `${corps.slice(0, finEntete)}\n<main id="contenu" style="display:block">${corps.slice(finEntete, f)}</main>\n${corps.slice(f)}`;

  // Le sélecteur « Français » n'a aucun effet (une seule langue) : retiré plutôt qu'un faux contrôle.
  {
    const i = corps.indexOf('Français</span>');
    if (i < 0) echec('adaptation « langue » : le sélecteur « Français » est introuvable');
    const debut = corps.lastIndexOf('<sc-if', i);
    corps = retirer(corps, 'langue', debut, debut + finDeBloc(corps.slice(debut), 0, '<sc-if', '</sc-if>'));
  }

  // L'icône de recherche de l'en-tête était un <span onClick> : un vrai bouton, nommé.
  {
    const icone = /<span onClick="\{\{ openSearch \}\}" style="cursor:pointer;(width:36px[^"]*)">((?:(?!<\/span>)[\s\S])*)<\/span>/;
    if (!icone.test(corps)) echec('adaptation « icône de recherche » : le <span onClick> est introuvable');
    corps = corps.replace(icone, (_, style, contenu) => `<button type="button" aria-label="Rechercher" onClick="{{ openSearch }}" style="cursor:pointer;border:none;padding:0;${style}">${contenu}</button>`);
  }
  corps = remplacerUneFois(corps, 'bouton de recherche mobile', 'title="Rechercher"', 'title="Rechercher" aria-label="Rechercher"');

  // Les boutons-icônes des fenêtres portent un nom ; les champs, une étiquette ; la foire aux questions, son état.
  {
    const noms = { close: 'Fermer', backToSearch: 'Retour', backFromCity: 'Fermer' };
    let n = 0;
    corps = corps.replace(/<button onClick="\{\{ (close|backToSearch|backFromCity) \}\}"/g, (_, nom) => {
      n += 1;
      return `<button type="button" aria-label="${noms[nom]}" onClick="{{ ${nom} }}"`;
    });
    if (n !== 6) echec(`adaptation « boutons-icônes » : 6 boutons attendus, ${n} trouvés`);
  }
  corps = remplacerUneFois(corps, 'champ de recherche', '<input value="{{ q }}"', '<input aria-label="Rechercher un guide, une communauté ou une ville" value="{{ q }}"');
  corps = remplacerUneFois(corps, 'champ de ville', '<input value="{{ cq }}"', '<input aria-label="Rechercher une ville" value="{{ cq }}"');
  corps = remplacerUneFois(corps, 'questions fréquentes', '<button onClick="{{ f.toggle }}"', '<button type="button" aria-expanded="{{ f.open }}" onClick="{{ f.toggle }}"');
  corps = remplacerUneFois(corps, 'onglets de recherche', '<button onClick="{{ t.on }}"', '<button type="button" aria-pressed="{{ t.pressed }}" onClick="{{ t.on }}"');

  // Les fenêtres : role="dialog", aria-modal, nom (aria-labelledby ou aria-label), repère pour le piège du focus.
  const fenetre = (nom, apres, ouverture, attributs) => {
    const i = corps.indexOf(apres);
    if (i < 0) echec(`adaptation « fenêtre ${nom} » : repère introuvable`);
    const j = corps.indexOf(ouverture, i);
    if (j < 0) echec(`adaptation « fenêtre ${nom} » : ouverture introuvable`);
    const reste = ouverture.slice('<div'.length);
    corps = `${corps.slice(0, j)}<div ${attributs} data-lp-dialog="${nom}"${reste}${corps.slice(j + ouverture.length)}`;
  };
  fenetre('search', '<sc-if value="{{ isSearch }}"', '<div style="position:relative;width:min(720px,100%)', 'role="dialog" aria-modal="true" aria-label="Recherche"');
  fenetre('city', '<sc-if value="{{ isCity }}"', '<div style="position:relative;width:min(460px,100%)', 'role="dialog" aria-modal="true" aria-labelledby="lp-ville-titre"');
  fenetre('guide', '<sc-if value="{{ isGuide }}"', '<div style="position:fixed;inset:0;z-index:80', 'role="dialog" aria-modal="true" aria-labelledby="lp-guide-titre"');
  fenetre('group', '<sc-if value="{{ isGroup }}"', '<div style="position:fixed;inset:0;z-index:80', 'role="dialog" aria-modal="true" aria-labelledby="lp-groupe-titre"');
  corps = remplacerUneFois(corps, 'titre de la fenêtre des villes', '<span style="flex:1;font-size:19px;font-weight:800;letter-spacing:-0.4px">Choisir une ville</span>', '<span id="lp-ville-titre" style="flex:1;font-size:19px;font-weight:800;letter-spacing:-0.4px">Choisir une ville</span>');
  corps = remplacerUneFois(corps, 'titre du guide', '<h1 style="margin:14px 0 0;font-size:clamp(28px,4vw,38px)', '<h1 id="lp-guide-titre" style="margin:14px 0 0;font-size:clamp(28px,4vw,38px)');
  corps = remplacerUneFois(corps, 'titre du réseau', '<div style="font-size:clamp(24px,3.4vw,32px);font-weight:800;letter-spacing:-0.8px">{{ group.name }}</div>', '<div id="lp-groupe-titre" style="font-size:clamp(24px,3.4vw,32px);font-weight:800;letter-spacing:-0.8px">{{ group.name }}</div>');
  // Les fonds cliquables des fenêtres sont décoratifs (Échap et le bouton de fermeture font le travail au clavier).
  for (const nom of ['close', 'backFromCity']) {
    corps = remplacerUneFois(corps, `fond de fenêtre ${nom}`, `<div onClick="{{ ${nom} }}" style="position:absolute;inset:0"></div>`, `<div aria-hidden="true" onClick="{{ ${nom} }}" style="position:absolute;inset:0"></div>`);
  }

  // Le chargement qui échoue : un message et « Réessayer » au lieu d'un « Chargement… » perpétuel.
  {
    const reessayer = (cible, texte) =>
      `<sc-if value="{{ ${cible}.error }}" hint-placeholder-val="{{ false }}"><button type="button" onClick="{{ ${cible}.retry }}" style="margin-top:14px;height:46px;padding:0 20px;border-radius:14px;border:none;background:#16785E;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer;align-self:flex-start">${texte}</button></sc-if>`;
    const actions = '<div style="display:flex;gap:8px;margin-top:28px;flex-wrap:wrap">';
    const debut = corps.indexOf(actions);
    if (debut < 0 || corps.indexOf(actions, debut + 1) >= 0) echec('adaptation « actions du guide » : la rangée doit figurer exactement une fois');
    const fin = debut + finDeBloc(corps.slice(debut), 0, '<div', '</div>');
    corps = `${corps.slice(0, debut)}${reessayer('guide', 'Réessayer')}<sc-if value="{{ guide.ok }}" hint-placeholder-val="{{ true }}">${corps.slice(debut, fin)}</sc-if>${corps.slice(fin)}`;
    const desc = '<p style="margin:0;font-size:15px;line-height:1.7;text-wrap:pretty">{{ group.desc }}</p>';
    corps = remplacerUneFois(corps, 'description du réseau', desc, `${desc}${reessayer('group', 'Réessayer')}`);
  }
}

// 12. Mise en page qui répond à la largeur : des points de rupture CSS (landing.css) à la place de `window.innerWidth`.
//     Le rendu serveur et le premier rendu du navigateur sont désormais identiques à toute largeur : plus de saut.
{
  // Les blocs conditionnels par largeur deviennent des enveloppes `display:contents`, masquées par media query.
  let n = 0;
  const ouverture = /<sc-if value="\{\{ (wide|narrowNav|showLogin|hero3|narrow) \}\}" hint-placeholder-val="\{\{ (?:true|false) \}\}">/;
  for (;;) {
    const m = ouverture.exec(corps);
    if (m === null) break;
    const fin = m.index + finDeBloc(corps.slice(m.index), 0, '<sc-if', '</sc-if>');
    const interieur = corps.slice(m.index + m[0].length, fin - '</sc-if>'.length);
    corps = `${corps.slice(0, m.index)}<span class="lp-r-${m[1]}" style="display:contents">${interieur}</span>${corps.slice(fin)}`;
    n += 1;
  }
  if (n !== 9) echec(`adaptation « largeurs » : 9 blocs attendus, ${n} trouvés`);

  corps = remplacerUneFois(corps, 'colonnes du héros', '<div style="max-width:1240px;margin:0 auto;padding:48px 20px 64px;display:grid;grid-template-columns:{{ heroCols }};', '<div class="lp-hero-grid" style="max-width:1240px;margin:0 auto;padding:48px 20px 64px;display:grid;grid-template-columns:1fr;');
  corps = remplacerUneFois(corps, 'colonnes de « Comment ça marche »', '<div style="position:relative;display:grid;grid-template-columns:{{ howCols }};', '<div class="lp-how-grid" style="position:relative;display:grid;grid-template-columns:1fr;');
  corps = remplacerUneFois(corps, 'étapes de « Comment ça marche »', '<div style="position:relative;background:#fff;border:1px solid #E6EBE9;border-radius:24px;padding:24px;display:flex;gap:16px;align-items:flex-start;grid-column:{{ s.col }};max-width:{{ s.mw }};', '<div class="lp-how-item" style="position:relative;background:#fff;border:1px solid #E6EBE9;border-radius:24px;padding:24px;display:flex;gap:16px;align-items:flex-start;grid-column:auto;max-width:100%;');
  corps = remplacerUneFois(corps, 'ordre du texte', 'display:flex;flex-direction:column;gap:18px;order:{{ textOrder }}">', 'display:flex;flex-direction:column;gap:18px;order:0">');
  corps = corps.replace('<div style="display:flex;flex-direction:column;gap:18px;order:0">', '<div class="lp-text-order" style="display:flex;flex-direction:column;gap:18px;order:0">');
  if (!corps.includes('lp-text-order')) echec('adaptation « ordre du texte » : l’en-tête de colonne est introuvable');
  {
    let k = 0;
    corps = corps.replace(/(<div [^>]*?)style="([^"]*)border-radius:\{\{ sheetRadius \}\}/g, (_, tete, avant) => {
      k += 1;
      return `${tete}class="lp-sheet" style="${avant}border-radius:28px`;
    });
    if (k !== 2) echec(`adaptation « coins des fenêtres » : 2 fenêtres attendues, ${k} trouvées`);
  }
}

// 13. Les cartes qui pointaient toutes vers la connexion ouvrent le contenu public qui leur correspond : la recherche
//     (catégories), la fiche du réseau de la ville (cartes et pastilles de villes). « href » reste /connexion sans JS.
{
  corps = remplacerUneFois(corps, 'catégories', '<a href="#" style="flex:0 0 170px;', '<a href="#" onClick="{{ c.open }}" style="flex:0 0 170px;');
  corps = remplacerUneFois(corps, 'cartes de villes', '<a href="#" style="position:relative;display:block;border-radius:28px;', '<a href="#" onClick="{{ c.open }}" style="position:relative;display:block;border-radius:28px;');
  corps = remplacerUneFois(corps, 'pastilles de villes', '<a href="#" style="height:40px;padding:0 16px;border-radius:999px;background:#F2F5F4;', '<a href="#" onClick="{{ c.open }}" style="height:40px;padding:0 16px;border-radius:999px;background:#F2F5F4;');
}

// 13 bis. La photo d'une ville se décrit par le nom de la ville, pas par « Photo de la ville ».
corps = remplacerUneFois(corps, 'texte alternatif des villes', 'placeholder="Photo de la ville"', 'placeholder="Photo de {{ c.n }}"');

// 14. Pied de page : l'année est celle du jour, et « Mentions légales » rejoint les liens légaux.
{
  corps = remplacerUneFois(corps, 'année', '© 2026 afroexpates.com', '© {{ annee }} afroexpates.com');
  const cookies = /<a href="#"( style="[^"]*"[^>]*)>Cookies<\/a>/;
  const m = cookies.exec(corps);
  if (!m) echec('adaptation « mentions légales » : le lien « Cookies » est introuvable');
  corps = corps.replace(cookies, () => `${m[0]}<a href="#"${m[1]}>Mentions légales</a>`);
}

// 9. Les liens « # » : le logo vers l'accueil, les autres vers la connexion (« #how » reste une ancre).
{
  const logo = '<a href="#" style="display:flex;align-items:center;gap:9px;flex-shrink:0">';
  corps = remplacerUneFois(corps, 'logo', logo, '<a href="/" style="display:flex;align-items:center;gap:9px;flex-shrink:0">');
  // Les liens légaux mènent aux pages statiques (`/p/:slug`, publiques) ; la charte n'a pas de page : retirée.
  const legaux = [
    ['Conditions d’utilisation', '/p/cgu'],
    ['Confidentialité', '/p/confidentialite'],
    ['Cookies', '/p/cookies'],
    ['Mentions légales', '/p/mentions-legales'],
  ];
  for (const [libelle, chemin] of legaux) {
    const lien = new RegExp(`<a href="#"( style="[^"]*"[^>]*)>${libelle}</a>`);
    if (!lien.test(corps)) echec(`adaptation « liens légaux » : « ${libelle} » est introuvable`);
    corps = corps.replace(lien, (_, reste) => `<a href="${chemin}"${reste}>${libelle}</a>`);
  }
  {
    const charte = /<a href="#"[^>]*>Charte de la communauté<\/a>/;
    if (!charte.test(corps)) echec('adaptation « charte » : le lien est introuvable');
    corps = corps.replace(charte, '');
  }
  // Les réseaux sociaux : aucune adresse dans la maquette (tous menaient à « # ») — retirés avec leur grille.
  {
    const grille = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:32px;padding:40px 0">';
    const debut = corps.indexOf(grille);
    if (debut < 0 || !corps.slice(debut).includes('list="{{ socials }}"')) echec('adaptation « réseaux sociaux » : la grille est introuvable');
    corps = retirer(corps, 'réseaux sociaux', debut, debut + finDeBloc(corps.slice(debut), 0, '<div', '</div>'));
  }
  corps = corps.replace(/<a href="#"/g, '<a href="/connexion"');
}

// 10. Les règles d'un réseau.
{
  const regles = /<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#8A958F;margin-top:8px">RÈGLES<\/div>\s*<sc-for list="\{\{ group\.rules \}\}"[\s\S]*?<\/sc-for>/;
  const m = regles.exec(corps);
  if (!m) echec('adaptation « règles » : le bloc RÈGLES est introuvable');
  corps = corps.replace(regles, () => `<sc-if value="{{ group.hasRules }}" hint-placeholder-val="{{ false }}">${m[0]}</sc-if>`);
}

// 4. Les photos : vers /landing/<id>-<largeur>.jpg
{
  const photo = /https:\/\/images\.unsplash\.com\/photo-([\w-]+)\?auto=format&amp;fit=crop&amp;w=(\d+)&amp;q=70/g;
  if (!photo.test(corps)) echec('adaptation « photos » : aucune photo Unsplash trouvée');
  corps = corps.replace(photo, '/landing/$1-$2.jpg');
}

let jsx = transcode(corps);

// 7. SVG : `<circle … /></circle>` → `<circle … />`
jsx = jsx.replace(/\/><\/(circle|path|rect|line|polyline|polygon|ellipse)>/g, '/>');

// 6. <image-slot> → <ImageLanding>
{
  const avant = (jsx.match(/<image-slot/g) ?? []).length;
  if (avant === 0) echec('adaptation « image-slot » : aucune balise trouvée');
  jsx = jsx.replace(/<image-slot/g, '<ImageLanding').replace(/<\/image-slot>/g, '</ImageLanding>');
}

// 5. style-hover → classes CSS
const regles = new Map();
jsx = jsx.replace(/ styleHover="([^"]*)"/g, (_, decl) => {
  let nom = regles.get(decl);
  if (nom === undefined) {
    nom = `lp-h-${regles.size + 1}`;
    regles.set(decl, nom);
  }
  return ` className="${nom}"`;
});
if (regles.size === 0) echec('adaptation « style-hover » : aucun style au survol trouvé');
if ((jsx.match(/ className=".*?" className=/g) ?? []).length > 0) echec('un élément porte déjà un className : conflit avec le survol');

// Les noms que le composant reçoit : tout identifiant de tête d'une liaison {{ … }}, sauf les variables de boucle.
const boucles = new Set([...corps.matchAll(/as="(\w+)"/g)].map((m) => m[1]));
// `q` est aussi la variable de boucle des citations : elle reste une liaison (le champ de recherche la lit).
const LIAISONS_FORCEES = ['q'];
const noms = [...new Set([...[...corps.matchAll(/\{\{\s*([A-Za-z_]\w*)/g)].map((m) => m[1]), ...LIAISONS_FORCEES])]
  .filter((n) => n !== 'true' && n !== 'false' && (!boucles.has(n) || LIAISONS_FORCEES.includes(n)))
  .sort();

const css = [
  '/* GÉNÉRÉ par tools/generate-landing.mjs — ne pas modifier à la main. */',
  ...[...regles].map(([decl, nom]) => {
    const proprietes = decl
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => `${d} !important`)
      .join('; ');
    return `.lp-root .${nom}:hover { ${proprietes}; }`;
  }),
  '',
].join('\n');

const entete = `// GÉNÉRÉ depuis docs/template/Landing Page v4.dc.html — ne pas modifier à la main :
// relancer \`node tools/generate-landing.mjs\`. Les adaptations sont décrites dans ce script.
//
// Le style en ligne est celui de la maquette, à l'identique. La donnée et le comportement vivent dans \`data.ts\`.
import { Fragment } from 'react';
import { ImageLanding } from '@/components/landing/image-landing';
import type { LandingVals } from './data';
import './landing.generated.css';

export function LandingView(props: LandingVals) {
  const { ${noms.join(', ')} } = props;
  return (
    <div className="lp-root">
${jsx}
    </div>
  );
}
`;

// Le logo DiasporyPlus (4a) remplace l'ancienne marque et le nom provisoire « afroexpates » de la maquette.
const NOMS = [
  ['fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.4px" }}>afroexpates<span style={{ color: "#E0733A" }}>.</span>com', 'fontWeight: "600", color: "#0F5C48", letterSpacing: "-0.4px" }}>Diaspory<span style={{ color: "#E0733A" }}>plus</span>'],
  ['afroexpates. <span style={{ color: "#7FC4A8" }}>', 'Diaspory<span style={{ color: "#F0C3A4" }}>plus</span> <span style={{ color: "#7FC4A8" }}>'],
  ['afroexpates.com</span>', 'DiasporyPlus</span>'],
  ['placeholder="Photo : quais de Lyon"', 'placeholder="Photo : quais au bord de l’eau"'],
];
let finale = remplacerLogo(entete);
for (const [a, b] of NOMS) {
  if (finale.split(a).length !== 2) {
    console.error(`adaptation du nom : « ${a.slice(0, 50)}… » doit apparaître exactement une fois`);
    process.exit(1);
  }
  finale = finale.replace(a, b);
}

mkdirSync(SORTIE, { recursive: true });
writeFileSync(resolve(SORTIE, 'landing.generated.tsx'), finale);
writeFileSync(resolve(SORTIE, 'landing.generated.css'), css);
writeFileSync(resolve(SORTIE, 'landing.bindings.json'), `${JSON.stringify(noms, null, 2)}\n`);
console.log(`✓ landing.generated.tsx (${jsx.length} caractères JSX), ${regles.size} règles de survol, ${noms.length} liaisons :`);
console.log(`  ${noms.join(', ')}`);
