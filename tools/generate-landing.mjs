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
 *  11. Pied de page : liens légaux vers `/p/cgu`, `/p/confidentialite`, `/p/cookies` ; « Charte de la communauté »
 *      (aucune page) et icônes de réseaux sociaux (aucune adresse) retirés.
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

// 9. Les liens « # » : le logo vers l'accueil, les autres vers la connexion (« #how » reste une ancre).
{
  const logo = '<a href="#" style="display:flex;align-items:center;gap:9px;flex-shrink:0">';
  corps = remplacerUneFois(corps, 'logo', logo, '<a href="/" style="display:flex;align-items:center;gap:9px;flex-shrink:0">');
  // Les liens légaux mènent aux pages statiques (`/p/:slug`, publiques) ; la charte n'a pas de page : retirée.
  const legaux = [
    ['Conditions d’utilisation', '/p/cgu'],
    ['Confidentialité', '/p/confidentialite'],
    ['Cookies', '/p/cookies'],
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
