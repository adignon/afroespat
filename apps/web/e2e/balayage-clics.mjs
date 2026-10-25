/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ BALAYAGE DE CLICS — CHAQUE ÉLÉMENT CLIQUABLE FAIT-IL QUELQUE CHOSE ?        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * AJOUT du lot W4A (phase 6 « qualité »). Hors CI lourde : script autonome, comme
 * `balayage-mobile.mjs` dont il réemploie `monterMembre` et `semer` (mêmes comptes
 * montés par les vraies routes, même décor semé par l'API).
 *
 * ── LA MÉTHODE (celle de l'audit) ───────────────────────────────────────────────
 *
 * Pour chaque route membre (et admin avec `--admin`) d'un compte monté :
 *   1. on liste les éléments visibles `<a>`, `<button>`, `[role=button]` et tout
 *      élément dont le style calculé est `cursor: pointer` (dédoublonnés : on garde
 *      le plus profond d'une chaîne qui ne se distingue pas) ;
 *   2. pour chacun, page rechargée, on clique et on observe 900 ms :
 *        · URL      l'adresse a changé ;
 *        · DOM      le document a changé (texte, fenêtre ouverte, élément ajouté/retiré) ;
 *        · RÉSEAU   une requête fetch/XHR est partie ;
 *        · FICHIER  un sélecteur de fichier s'est ouvert (écouteur `filechooser`) ;
 *        · INERTE   rien de tout cela. C'est le défaut que ce script cherche ;
 *   3. un lien externe (`http` hors de l'application, `mailto:`) n'est pas suivi : il
 *      compte comme URL.
 *
 * Il SORT EN CODE 1 sur tout INERTE absent de la liste blanche ci-dessous.
 *
 * ── LA LISTE BLANCHE (courte, et chaque ligne dit pourquoi) ─────────────────────
 *
 *   · désactivé   `disabled` / `aria-disabled="true"` : l'écran prévient, il ne ment pas
 *                 (bouton « Envoyer » tant que le formulaire est invalide...) ;
 *   · fichier     ouvre le sélecteur du système : compté FICHIER, jamais inerte ;
 *   · paiement    Premium, Mobile Money, Stripe, factures, abonnement : le paiement est
 *                 hors périmètre (décision du porteur, « tout est gratuit ») ;
 *   · compte      « Confirmer la suppression » (K08) : la suppression de compte n'est pas
 *                 branchée côté web par décision (action irréversible à 7 jours), le
 *                 bouton annonce la règle sans l'exécuter.
 *   · évités      on ne CLIQUE PAS « Se déconnecter » (détruit la session du balayage).
 *
 * ── COMMENT LE LANCER ───────────────────────────────────────────────────────────
 *
 *   # pile montée (API + web : `next build && next start` conseillé, `next dev` monte à
 *   # 10 Go sur une longue passe). Depuis apps/web :
 *   API=http://localhost:3075/v1 WEB=http://localhost:3175 node e2e/balayage-clics.mjs
 *
 *   --seulement=entraide,guides  routes dont le chemin contient l'un de ces textes
 *                                (OOM : jouer par morceaux, relancer le web entre deux)
 *   --largeur=390                mobile (défaut 1440)
 *   --admin                      ajoute les routes /admin (compte d'équipe : voir
 *                                EQUIPE_EMAIL / EQUIPE_MOT_DE_PASSE / EQUIPE_TOTP_SECRET ;
 *                                sans eux, les routes admin sont ignorées avec un avertissement)
 *   --max=60                     au plus N éléments par route (défaut 80)
 *   --verbeux                    imprime aussi les éléments qui répondent
 *   CHROMIUM=/opt/pw-browsers/chromium
 *
 * ⚠ Les clics ÉCRIVENT (publier, rejoindre, signaler...) dans la base visée : vise TA
 * base de lot. Budget OTP : deux numéros neufs par passe (déjà géré par `monterMembre`).
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { monterMembre, semer } from './balayage-mobile.mjs';

const ARGS = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? true]),
);
const WEB = process.env.WEB ?? 'http://localhost:3100';
const API = process.env.API ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';
const LARGEUR = Number(ARGS.largeur ?? 1440);
const MAX = Number(ARGS.max ?? 80);
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const ICI = dirname(fileURLToPath(import.meta.url));
const APP = join(ICI, '..', 'src', 'app');

/** Liste blanche : [motif du texte/aria-label, raison]. Voir l'en-tête. */
const BLANCHE = [
  [/premium|mobile money|stripe|factur|paiement|abonnement|carte bancaire/i, 'paiement : hors périmètre, tout est gratuit'],
  [/confirmer la suppression/i, 'compte : suppression non branchée côté web (décision)'],
];
const EVITES = /se d[ée]connecter|d[ée]connexion/i;

function pages(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (e === 'page.tsx') out.push(p);
  }
  return out;
}
function routeDe(fichier) {
  const segs = relative(APP, dirname(fichier)).split('/');
  return { route: '/' + segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@')).join('/'), groupe: segs[0] };
}

/** Même table que `balayage-mobile.mjs` pour les routes dynamiques (réduite aux essentielles). */
function resoudre(route, ids, a, b) {
  const p = ids.parcours ?? 'inconnu';
  const t = {
    '/[handle]': `/@${b.handle}`,
    '/agenda/[id]': `/agenda/${ids.evenement ?? 'inconnu'}`,
    '/entraide/[id]': `/entraide/${ids.aide ?? 'inconnu'}`,
    '/guides/[slug]': `/guides/${ids.guide ?? 'inconnu'}`,
    '/parcours/[id]': `/parcours/${p}`,
    '/parcours/publics/[id]': `/parcours/publics/${p}`,
    '/parrainage/[handle]': `/parrainage/${ids.parrain ?? b.handle}`,
    '/publications/[id]': `/publications/${ids.post ?? 'inconnu'}`,
    '/reseaux/[slug]': `/reseaux/${ids.reseau ?? 'inconnu'}`,
    '/services/emploi/[id]': `/services/emploi/${ids.emploi ?? 'inconnu'}`,
    '/services/logement/[id]': `/services/logement/${ids.logement ?? 'inconnu'}`,
    '/stories/[id]': `/stories/${ids.story ?? 'inconnu'}`,
    '/p/[slug]': '/p/conditions',
    '/villes/[slug]': `/villes/${a.ville?.slug ?? 'evry'}`,
  };
  if (t[route]) return t[route];
  if (route.includes('[')) return null; // sous-route dynamique non résolue : ignorée
  return route;
}

/** Dans la page : marque chaque candidat `data-bc="n"` et rend [{n, texte, tag, desactive, externe}]. */
function marquer(max) {
  document.querySelectorAll('[data-bc]').forEach((e) => e.removeAttribute('data-bc'));
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01 && s.pointerEvents !== 'none';
  };
  const brut = [...document.querySelectorAll('body *')].filter((el) => {
    if (!visible(el)) return false;
    if (el.matches('a[href], button, [role="button"], summary, label[for]')) return true;
    return getComputedStyle(el).cursor === 'pointer';
  });
  // On ne garde pas un conteneur `cursor:pointer` dont un descendant cliquable est déjà retenu.
  const set = new Set(brut);
  const retenus = brut.filter((el) => ![...el.querySelectorAll('*')].some((d) => set.has(d)) || el.matches('a[href], button, [role="button"]'));
  return retenus.slice(0, max).map((el, n) => {
    el.setAttribute('data-bc', String(n));
    const a = el.closest('a[href]');
    const href = a ? a.getAttribute('href') : null;
    const externe = href !== null && (/^mailto:|^tel:/.test(href) || (/^https?:/.test(href) && !href.startsWith(location.origin)));
    return {
      n,
      tag: el.tagName.toLowerCase(),
      texte: ((el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ')).slice(0, 50),
      desactive: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true' || !!el.closest('fieldset:disabled'),
      externe,
      href,
    };
  });
}

/** Une empreinte légère du document, pour voir qu'il a bougé. */
function empreinte() {
  return `${document.body.innerText.length}|${document.body.querySelectorAll('*').length}|${document.querySelectorAll('[role="dialog"],[data-modal-panel]').length}|${document.activeElement?.tagName}|${document.body.innerText.slice(0, 400)}`;
}

async function main() {
  console.log(`Balayage de clics ${LARGEUR}px — web ${WEB} — api ${API}`);
  const a = await monterMembre('Awa Konaté');
  const b = await monterMembre('Kofi Boateng', true);
  const ids = await semer(a, b);

  let routes = pages(APP)
    .map(routeDe)
    .filter((r) => r.groupe === '(app)' || (ARGS.admin && r.groupe === '(admin)'))
    .map((r) => r.route)
    .filter((r, i, t) => t.indexOf(r) === i)
    .sort();
  if (!ARGS.admin) routes = routes.filter((r) => !r.startsWith('/admin'));
  if (ARGS.admin && !process.env.EQUIPE_EMAIL) {
    console.log('(avertissement) --admin sans EQUIPE_EMAIL : les routes /admin sont ignorées.');
    routes = routes.filter((r) => !r.startsWith('/admin'));
  }

  const navigateur = await chromium.launch({ executablePath: CHROMIUM });
  const contexte = await navigateur.newContext({ viewport: { width: LARGEUR, height: 900 }, isMobile: LARGEUR < 700, hasTouch: LARGEUR < 700 });
  await contexte.addCookies([a.cookie]);
  const page = await contexte.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  const bilan = { URL: 0, DOM: 0, RESEAU: 0, FICHIER: 0, INERTE: 0, DESACTIVE: 0, BLANCHE: 0, EXTERNE: 0 };
  const inertes = [];
  let nbRoutes = 0;

  for (const modele of routes) {
    if (ARGS.seulement && !String(ARGS.seulement).split(',').some((x) => modele.includes(x))) continue;
    const url = resoudre(modele, ids, a, b);
    if (url === null || url.includes('inconnu')) continue;
    nbRoutes += 1;
    const ouvrir = async () => {
      await page.goto(`${WEB}${url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {});
      await page.waitForTimeout(500);
    };
    try {
      await ouvrir();
    } catch (e) {
      console.log(`ECHEC ${url} : ${String(e.message).slice(0, 120)}`);
      continue;
    }
    const cibles = await page.evaluate(marquer, MAX);
    const lignes = [];
    for (const c of cibles) {
      let verdict;
      if (c.desactive) verdict = 'DESACTIVE';
      else if (c.externe) verdict = 'EXTERNE';
      else if (EVITES.test(c.texte)) continue;
      else {
        let reseau = 0;
        let fichier = false;
        const surRequete = (r) => {
          if (['fetch', 'xhr'].includes(r.resourceType()) && !/_next\/|\/health/.test(r.url())) reseau += 1;
        };
        const surFichier = () => {
          fichier = true;
        };
        page.on('request', surRequete);
        page.on('filechooser', surFichier);
        const avant = await page.evaluate(empreinte).catch(() => '');
        const urlAvant = page.url();
        const clique = await page.locator(`[data-bc="${c.n}"]`).first().click({ timeout: 2_500, noWaitAfter: true }).then(() => true, () => false);
        await page.waitForTimeout(900);
        page.off('request', surRequete);
        page.off('filechooser', surFichier);
        if (!clique) {
          verdict = 'DESACTIVE'; // masqué ou recouvert au moment du clic : non cliquable pour un membre
        } else if (page.url() !== urlAvant) verdict = 'URL';
        else if (fichier) verdict = 'FICHIER';
        else if ((await page.evaluate(empreinte).catch(() => avant)) !== avant) verdict = 'DOM';
        else if (reseau > 0) verdict = 'RESEAU';
        else verdict = 'INERTE';
        if (verdict === 'INERTE') {
          const blanche = BLANCHE.find(([m]) => m.test(c.texte));
          if (blanche) verdict = 'BLANCHE';
        }
        // Toute action qui a bougé la page : on repart d'une page propre.
        if (verdict !== 'INERTE' && verdict !== 'BLANCHE') {
          await ouvrir().catch(() => {});
          await page.evaluate(marquer, MAX).catch(() => {});
        }
      }
      bilan[verdict] += 1;
      if (verdict === 'INERTE') inertes.push(`${url} · <${c.tag}> «${c.texte}»${c.href ? ` href=${c.href}` : ''}`);
      lignes.push(`${verdict.padEnd(9)} <${c.tag}> «${c.texte}»`);
    }
    const nbInertes = lignes.filter((l) => l.startsWith('INERTE')).length;
    console.log(`${nbInertes ? 'INERTE' : 'ok    '} ${url} — ${cibles.length} éléments${nbInertes ? `, ${nbInertes} inerte(s)` : ''}`);
    for (const l of lignes) if (ARGS.verbeux || l.startsWith('INERTE')) console.log(`      ${l}`);
  }
  await navigateur.close();
  await a.ctx.dispose();
  await b.ctx.dispose();
  console.log(`\n${nbRoutes} routes — ${JSON.stringify(bilan)}`);
  if (inertes.length) {
    console.log(`\n${inertes.length} élément(s) INERTE(S) hors liste blanche :`);
    for (const i of inertes) console.log(`  - ${i}`);
  }
  process.exit(inertes.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
