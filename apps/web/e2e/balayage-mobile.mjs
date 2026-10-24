/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ BALAYAGE MOBILE (390 px) — TOUTES LES ROUTES MEMBRE, UN COMPTE MONTÉ        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * AJOUT du lot W3A (phase 4 « mobile »). Hors CI lourde : ce n'est PAS un test
 * Playwright de la batterie `e2e/`, c'est un script autonome que l'on rejoue à la
 * main avant de livrer un écran. Il ne dépend que de `@playwright/test` (déjà
 * installé dans `apps/web`).
 *
 * ── CE QU'IL FAIT ───────────────────────────────────────────────────────────
 *
 *  1. monte DEUX comptes par les vraies routes du produit (OTP `123456`, numéro
 *     neuf, KYC « fake » puis numéro français → L2) ;
 *  2. sème un jeu de données minimal par l'API (guide, publication, demande
 *     d'entraide, événement, story, annonce, offre, parcours, réseau, parrain) afin
 *     que les routes dynamiques (`[id]`, `[slug]`, `[handle]`) se résolvent sur du
 *     VRAI contenu et pas sur un « introuvable » ;
 *  3. liste les routes membre (`find src/app -name page.tsx`, sans `(admin)` ;
 *     l'onboarding est joué par le compte SANS parcours, `--sans-onboarding` pour
 *     l'exclure), les résout, et ouvre
 *     chacune à 390 px de large ;
 *  4. sur chaque page, mesure :
 *       · DÉBORDEMENT : `document.documentElement.scrollWidth > innerWidth` ;
 *       · BOUTONS COUPÉS : boutons / liens / champs dont le rectangle sort de
 *         l'écran, ou que le `overflow: hidden` d'un ancêtre rogne (les bandes
 *         défilantes `overflow-x: auto` sont volontaires et ne comptent pas) ;
 *       · TEXTES TRONQUÉS : éléments dont le texte est rogné (`scrollWidth >
 *         clientWidth`) — avec points de suspension = INFO (choix de dessin),
 *         sans points de suspension = ERREUR (le texte est mangé en silence) ;
 *  5. imprime un tableau et SORT EN CODE 1 sur tout débordement ou bouton coupé
 *     (et sur texte rogné sans ellipse). `--strict-textes` y ajoute les ellipses.
 *
 * ── COMMENT LE REJOUER ──────────────────────────────────────────────────────
 *
 *   # 1. la pile (voir LOT-COMMUN §1) : API + web + Redis + Postgres démarrés
 *   # 2. depuis apps/web :
 *   API=http://localhost:3065/v1 WEB=http://localhost:3165 \
 *     node e2e/balayage-mobile.mjs
 *
 *   options (variables d'environnement ou drapeaux) :
 *     --largeur=1440        autre largeur (défaut 390)
 *     --captures=/chemin    enregistre une capture pleine page par route
 *     --seulement=entraide  ne joue que les routes dont le chemin contient ce texte
 *     --admin               ajoute les routes /admin (réservées au personnel : non gérées ici)
 *     --sans-feuilles       ne rouvre pas les fenêtres / feuilles (`data-modal-open`)
 *     --strict-textes       les ellipses comptent aussi comme erreurs
 *     CHROMIUM=/opt/pw-browsers/chromium   exécutable du navigateur
 *
 * ⚠ BUDGET OTP : un numéro NEUF par compte (déjà fait ici). Ne relance pas le script
 * en boucle serrée : 3 demandes par numéro et par heure, mais les numéros changent.
 * ⚠ Les tests d'intégration ne sont pas touchés ; ce script écrit des données de
 * décor dans la base visée (`E2E-BALAYAGE-…`) : vise toujours TA base de lot.
 */
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, request as pwRequest } from '@playwright/test';

const ARGS = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => a.replace(/^--/, '').split('='))
    .map(([k, v]) => [k, v ?? true]),
);
const API = process.env.API ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';
const WEB = process.env.WEB ?? 'http://localhost:3100';
const LARGEUR = Number(ARGS.largeur ?? 390);
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const SECRET = process.env.DIDIT_WEBHOOK_SECRET ?? 'dev-didit-webhook-secret-change-me';
const CODE = process.env.SMS_FAKE_FIXED_CODE ?? '123456';
const ICI = dirname(fileURLToPath(import.meta.url));
const APP = join(ICI, '..', 'src', 'app');
const MARQUE = `E2E-BALAYAGE-${Date.now().toString(36)}`;

// ───────────────────────────── 1. comptes ──────────────────────────────────

async function json(r, quoi) {
  if (!r.ok()) throw new Error(`${quoi} ${r.status()} : ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

let compteur = 0;
function numeroBenin() {
  compteur += 1;
  const t = String(Date.now() % 100_000).padStart(5, '0');
  const m = String((Math.floor(Math.random() * 100) + compteur * 7) % 100).padStart(2, '0');
  return `+229019${t}${m}`;
}

/** Monte un membre L2 ; rend son contexte d'API, son jeton frais et son cookie. */
async function monterMembre(nom, parrain = false) {
  const ctx = await pwRequest.newContext();
  const phone = numeroBenin();
  const dem = await json(
    await ctx.post(`${API}/auth/otp/request`, {
      data: { phone, countryIso2: 'BJ', captchaToken: 'fake', acceptTerms: true },
    }),
    'otp/request',
  );
  const ses = await json(
    await ctx.post(`${API}/auth/otp/verify`, { data: { challengeId: dem.challengeId, code: CODE } }),
    'otp/verify',
  );
  let jeton = ses.accessToken;
  const auth = () => ({ authorization: `Bearer ${jeton}` });
  const pays = (await json(await ctx.get(`${API}/places/countries?limit=50`), 'pays')).items;
  const villes = (await json(await ctx.get(`${API}/places/cities?limit=100`), 'villes')).items;
  const brut = ses.user.id.replace(/-/g, '');
  const handle = `m-${brut.slice(-12)}`;
  const ville = villes.find((v) => v.name === 'Évry') ?? villes[0];
  await json(
    await ctx.patch(`${API}/me`, {
      headers: auth(),
      data: {
        displayName: nom,
        handle,
        phase: parrain ? 'SETTLED' : 'RECENT_ARRIVAL',
        ...(parrain ? { arrivalDate: '2023-06-01' } : {}),
        originCountryId: pays.find((c) => c.iso2 === 'BJ')?.id,
        cityId: ville?.id,
      },
    }),
    'PATCH /me',
  );
  await json(
    await ctx.patch(`${API}/me/profile`, {
      headers: auth(),
      data: {
        bio: 'Profil de décor du balayage mobile.',
        occupationStatus: 'STUDENT',
        availableToHelp: true,
        helpTypes: ['PAPERWORK', 'JOB'],
        isPublic: true,
      },
    }),
    'PATCH /me/profile',
  );
  // L1 : KYC « fake » + webhook signé.
  const kyc = await json(await ctx.post(`${API}/me/kyc/session`, { headers: auth(), data: {} }), 'kyc');
  const corps = JSON.stringify({ sessionId: kyc.sessionId, status: 'APPROVED', isAdult: true });
  await json(
    await ctx.post(`${API}/webhooks/didit`, {
      headers: {
        'content-type': 'application/json',
        'x-signature': createHmac('sha256', SECRET).update(corps).digest('hex'),
      },
      data: corps,
    }),
    'webhook',
  );
  jeton = (await json(await ctx.post(`${API}/auth/refresh`, { data: {} }), 'refresh L1')).accessToken;
  // L2 : un numéro français vérifié.
  const fr = `+3361${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const dep = await json(
    await ctx.post(`${API}/me/phones`, {
      headers: auth(),
      data: { phone: fr, countryIso2: 'FR', captchaToken: 'fake' },
    }),
    'phones',
  );
  await json(
    await ctx.post(`${API}/me/phones/verify`, {
      headers: auth(),
      data: { challengeId: dep.challengeId, code: CODE },
    }),
    'phones/verify',
  );
  jeton = (await json(await ctx.post(`${API}/auth/refresh`, { data: {} }), 'refresh L2')).accessToken;
  const cookie = (await ctx.storageState()).cookies.filter((c) => c.name === 'dp_refresh').at(-1);
  return { ctx, handle, nom, ville, villes, auth, cookie, id: ses.user.id };
}

/** Un compte L0 de plus, pour atteindre le minimum d'invités d'un réseau. Rend son pseudo. */
async function membreMinimal(nom) {
  const ctx = await pwRequest.newContext();
  const dem = await json(
    await ctx.post(`${API}/auth/otp/request`, {
      data: { phone: numeroBenin(), countryIso2: 'BJ', captchaToken: 'fake', acceptTerms: true },
    }),
    'otp/request',
  );
  const ses = await json(
    await ctx.post(`${API}/auth/otp/verify`, { data: { challengeId: dem.challengeId, code: CODE } }),
    'otp/verify',
  );
  const handle = `m-${ses.user.id.replace(/-/g, '').slice(-12)}`;
  await json(
    await ctx.patch(`${API}/me`, {
      headers: { authorization: `Bearer ${ses.accessToken}` },
      data: { displayName: nom, handle },
    }),
    'PATCH /me (invité)',
  );
  await ctx.dispose();
  return handle;
}

// ───────────────────────────── 2. décor ────────────────────────────────────

/** Chaque semis est tenté seul : un échec est signalé, jamais fatal. */
async function semer(a, b) {
  const ids = {};
  const essai = async (cle, f) => {
    try {
      ids[cle] = await f();
    } catch (e) {
      console.log(`  (décor) ${cle} : ${String(e.message).slice(0, 160)}`);
    }
  };
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await essai('guide', async () => {
    const g = await json(
      await b.ctx.post(`${API}/guides`, {
        headers: b.auth(),
        data: {
          title: `Déclarer son médecin traitant ${MARQUE}`,
          body: 'Pour déclarer votre médecin traitant, remplissez le formulaire S3704 et remettez-le à votre caisse d assurance maladie. Le médecin doit cosigner le formulaire : sans sa signature, la caisse le refuse et vous devrez recommencer la démarche depuis le début. Comptez environ trois semaines avant que la déclaration soit prise en compte, et conservez une copie du formulaire signé : la caisse la redemande parfois. Tant que la déclaration n est pas enregistrée, vos consultations sont remboursées à un taux réduit, ce qui surprend beaucoup de nouveaux arrivants.',
          category: 'DAILY_LIFE',
          scope: 'UNIVERSAL',
        },
      }),
      'POST /guides',
    );
    await json(await b.ctx.post(`${API}/guides/${g.id}/publish`, { headers: b.auth() }), 'publish');
    return g.slug;
  });
  await essai('post', async () => {
    const p = await json(
      await b.ctx.post(`${API}/posts`, {
        headers: b.auth(),
        data: { type: 'QUESTION', body: `Comment ouvrir un compte bancaire sans justificatif ? ${MARQUE}` },
      }),
      'POST /posts',
    );
    return p.id ?? p.post?.id;
  });
  await essai('aide', async () => {
    const r = await json(
      await b.ctx.post(`${API}/help`, {
        headers: b.auth(),
        data: {
          kind: 'REQUEST',
          type: 'MATERIAL',
          title: `Une petite table pour mon studio ${MARQUE}`,
          body: 'Je cherche une petite table, récupération possible en voiture samedi matin si besoin.',
          cityId: b.ville?.id,
        },
      }),
      'POST /help',
    );
    return r.request.id;
  });
  await essai('aideA', async () => {
    const r = await json(
      await a.ctx.post(`${API}/help`, {
        headers: a.auth(),
        data: {
          kind: 'REQUEST',
          type: 'MATERIAL',
          title: `Un fer à repasser ${MARQUE}`,
          body: 'Je cherche un fer à repasser pour quelques semaines, merci d’avance à qui peut aider.',
          cityId: a.ville?.id,
        },
      }),
      'POST /help (A)',
    );
    await a.ctx.post(`${API}/help/${ids.aide}/responses`, {
      headers: a.auth(),
      data: { body: 'J’ai une table pliante à donner, je peux te la déposer samedi.' },
    });
    return r.request.id;
  });
  await essai('evenement', async () => {
    const e = await json(
      await b.ctx.post(`${API}/events`, {
        headers: b.auth(),
        data: {
          type: 'COOKING',
          title: `Repas partagé ${MARQUE}`,
          description: 'Chacun apporte un plat du pays.',
          cityId: b.ville?.id,
          venueName: 'Maison des Associations',
          addressText: '28 rue Denfert-Rochereau',
          startsAt: `${demain}T12:00:00+02:00`,
          endsAt: `${demain}T16:00:00+02:00`,
          capacity: 40,
        },
      }),
      'POST /events',
    );
    return e.id;
  });
  await essai('story', async () => {
    const s = await json(
      await b.ctx.post(`${API}/stories`, {
        headers: b.auth(),
        data: {
          type: 'CONSEIL',
          body: 'Le dossier Visale se monte en ligne, comptez deux jours.',
          backgroundColor: '#2D6A4F',
          textStyle: 'BOLD',
          category: 'LOGEMENT',
          audience: 'ALL',
          allowMessages: true,
        },
      }),
      'POST /stories',
    );
    return s.id ?? s.story?.id;
  });
  await essai('logement', async () => {
    const h = await json(
      await b.ctx.post(`${API}/housing`, {
        headers: b.auth(),
        data: {
          kind: 'SEEKING_HOUSING',
          title: `Cherche studio calme ${MARQUE}`,
          description:
            'Étudiante en master, je cherche un studio ou une colocation calme pour la rentrée. Visite sur place possible en semaine, dossier complet avec garant.',
          cityId: b.ville?.id,
          district: '7e · Jean Macé',
          photoAssetIds: [],
        },
      }),
      'POST /housing',
    );
    return h.id;
  });
  await essai('emploi', async () => {
    const o = await json(
      await b.ctx.post(`${API}/jobs`, {
        headers: b.auth(),
        data: {
          kind: 'JOB',
          title: `Chargé d’accueil ${MARQUE}`,
          description:
            'Accueil et suivi des adhérents, en français et en bambara. Débutant·e accepté·e, formation assurée sur place.',
          companyName: 'Association Sankofa',
          cityId: b.ville?.id,
          contractType: 'CDI',
          sector: 'Services',
          externalUrl: 'https://sankofa.example/offre',
        },
      }),
      'POST /jobs',
    );
    return o.id;
  });
  await essai('parcours', async () => {
    const t = (await json(await a.ctx.get(`${API}/journey-templates`, { headers: a.auth() }), 'modèles')).items;
    const modele = t.find((x) => x.code === 'FAMILY') ?? t[0];
    const j = await json(
      await a.ctx.post(`${API}/journeys`, { headers: a.auth(), data: { templateId: modele.id } }),
      'POST /journeys',
    );
    return j.id ?? j.journey?.id;
  });
  await essai('parrain', async () => {
    await json(
      await b.ctx.put(`${API}/me/mentor-profile`, {
        headers: b.auth(),
        data: { bio: 'Installé depuis longtemps, je peux guider vos premières démarches.', maxMentees: 3 },
      }),
      'PUT mentor-profile',
    );
    return b.handle;
  });
  await essai('reseau', async () => {
    const invites = [];
    for (let i = 0; i < 5; i += 1) invites.push(await membreMinimal(`Invité ${i + 1}`));
    const c = await json(
      await b.ctx.post(`${API}/communities`, {
        headers: b.auth(),
        data: {
          name: `Entrepreneurs ${MARQUE.slice(-5)}`,
          description: 'Réseau de décor.',
          category: 'entrepreneuriat',
          visibility: 'PUBLIC',
          inviteHandles: invites,
        },
      }),
      'POST /communities',
    );
    const slug = c.slug ?? c.community?.slug;
    const id = c.id ?? c.community?.id;
    if (id) {
      const t = await b.ctx.post(`${API}/communities/${id}/topics`, {
        headers: b.auth(),
        data: { title: 'Bienvenue dans le réseau', body: 'Présentez-vous en quelques mots, nous sommes là.' },
      });
      if (t.ok()) ids.sujet = ((await t.json()).id ?? (await t.json()).topic?.id);
    }
    return slug;
  });
  return ids;
}

// ───────────────────────────── 3. routes ───────────────────────────────────

function pages(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (e === 'page.tsx') out.push(p);
  }
  return out;
}

/** `(app)/guides/[slug]/page.tsx` → `/guides/[slug]` ; les groupes `(x)` et `@x` disparaissent. */
function routeDe(fichier) {
  const segs = relative(APP, dirname(fichier)).split('/');
  const gardes = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
  return { route: '/' + gardes.join('/'), groupe: segs[0] };
}

function resoudre(route, ids, a, b) {
  const t = {
    '/[handle]': `/@${b.handle}`,
    '/agenda/[id]': `/agenda/${ids.evenement ?? 'inconnu'}`,
    '/agenda/[id]/presence': `/agenda/${ids.evenement ?? 'inconnu'}/presence`,
    '/entraide/[id]': `/entraide/${ids.aide ?? 'inconnu'}`,
    '/guides/[slug]': `/guides/${ids.guide ?? 'inconnu'}`,
    '/guides/[slug]/corriger': `/guides/${ids.guide ?? 'inconnu'}/corriger`,
    '/guides/[slug]/modifier': `/guides/${ids.guide ?? 'inconnu'}/modifier`,
    '/guides/[slug]/propositions': `/guides/${ids.guide ?? 'inconnu'}/propositions`,
    '/guides/[slug]/signalements': `/guides/${ids.guide ?? 'inconnu'}/signalements`,
    '/guides/[slug]/p/[pageSlug]': `/guides/${ids.guide ?? 'inconnu'}/p/introduction`,
    '/messages/[id]': `/messages`,
    '/parcours/[id]': `/parcours/${ids.parcours ?? 'inconnu'}`,
    '/parcours/[id]/abouti': `/parcours/${ids.parcours ?? 'inconnu'}/abouti`,
    '/parcours/[id]/discussion': `/parcours/${ids.parcours ?? 'inconnu'}/discussion`,
    '/parcours/[id]/documents': `/parcours/${ids.parcours ?? 'inconnu'}/documents`,
    '/parcours/[id]/equipe': `/parcours/${ids.parcours ?? 'inconnu'}/equipe`,
    '/parcours/[id]/etapes': `/parcours/${ids.parcours ?? 'inconnu'}/etapes`,
    '/parcours/[id]/etapes/[etape]': `/parcours/${ids.parcours ?? 'inconnu'}/etapes/1`,
    '/parcours/[id]/export': `/parcours/${ids.parcours ?? 'inconnu'}/export`,
    '/parcours/[id]/historique': `/parcours/${ids.parcours ?? 'inconnu'}/historique`,
    '/parcours/[id]/reglages': `/parcours/${ids.parcours ?? 'inconnu'}/reglages`,
    '/parcours/publics/[id]': `/parcours/publics/${ids.parcours ?? 'inconnu'}`,
    '/parrainage/[handle]': `/parrainage/${ids.parrain ?? b.handle}`,
    '/publications/[id]': `/publications/${ids.post ?? 'inconnu'}`,
    '/reseaux/[slug]': `/reseaux/${ids.reseau ?? 'inconnu'}`,
    '/reseaux/[slug]/sujets/[id]': `/reseaux/${ids.reseau ?? 'inconnu'}/sujets/${ids.sujet ?? 'inconnu'}`,
    '/services/annuaire/[id]': `/services/annuaire/inconnu`,
    '/services/emploi/[id]': `/services/emploi/${ids.emploi ?? 'inconnu'}`,
    '/services/logement/[id]': `/services/logement/${ids.logement ?? 'inconnu'}`,
    '/stories/[id]': `/stories/${ids.story ?? 'inconnu'}`,
    '/p/[slug]': '/p/conditions',
    '/villes/[slug]': `/villes/${a.ville?.slug ?? 'evry'}`,
  };
  return t[route] ?? route;
}

// ───────────────────────────── 4. mesures ──────────────────────────────────

/** Exécutée DANS la page : rend un objet sérialisable. */
function mesurer(L) {
  // `L` est la largeur DEMANDÉE, pas `innerWidth` : en émulation mobile le navigateur
  // élargit sa fenêtre de mise en page jusqu'à la largeur du contenu, et `innerWidth`
  // se mettrait alors à mentir (419 px mesurés « sur 419 »).
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01;
  };
  const decrire = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cl = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const cadre = el.closest('[data-screen-label]')?.getAttribute('data-screen-label') ?? '';
    return `${el.tagName.toLowerCase()}${id}${cl ? '.' + cl : ''} «${txt}»${cadre ? ' [' + cadre + ']' : ''}`;
  };
  // Rectangle visible une fois rogné par les ancêtres qui coupent.
  const rogne = (el) => {
    let r = el.getBoundingClientRect();
    let left = r.left;
    let right = r.right;
    let defile = false;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none') return null;
      if (s.position === 'fixed') break;
      const ox = s.overflowX;
      if (ox === 'auto' || ox === 'scroll') {
        // bande défilante volontaire : l'élément y est atteignable
        if (p.scrollWidth > p.clientWidth + 1) defile = true;
      }
      if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') {
        const pr = p.getBoundingClientRect();
        left = Math.max(left, pr.left);
        right = Math.min(right, pr.right);
      }
    }
    return { left, right, defile, largeur: r.width, brutLeft: r.left, brutRight: r.right };
  };

  const racine = document.documentElement;
  const out = {
    L,
    scrollWidth: racine.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    debordement: racine.scrollWidth > L,
    coupes: [],
    tronques: [],
    larges: [],
  };

  if (out.debordement) {
    // Les coupables : éléments visibles dont le bord droit dépasse l'écran, hors bandes défilantes.
    const vus = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= L + 0.5 && r.left >= -0.5) continue;
      const g = rogne(el);
      if (g === null || g.defile) continue;
      if (g.right <= L + 0.5 && g.left >= -0.5) continue;
      const s = getComputedStyle(el);
      if (s.position === 'fixed') continue;
      // On ne retient que le plus haut ancêtre fautif (pas tout le sous-arbre).
      if (el.parentElement && vus.has(el.parentElement)) {
        vus.add(el);
        continue;
      }
      vus.add(el);
      if (out.larges.length < 12) out.larges.push(`${decrire(el)} droite=${Math.round(r.right)} gauche=${Math.round(r.left)}`);
    }
  }

  const cibles = document.querySelectorAll('button, a[href], [role="button"], input, select, textarea, [role="tab"]');
  for (const el of cibles) {
    if (!visible(el)) continue;
    const g = rogne(el);
    if (g === null || g.defile) continue;
    const s = getComputedStyle(el);
    if (s.position === 'fixed' && el.getBoundingClientRect().right <= L + 0.5) continue;
    const dehors = g.brutLeft < -1 || g.brutRight > L + 1;
    const rogneeAu = g.largeur > 0 && (g.right - g.left) / g.largeur < 0.9;
    if (dehors || rogneeAu) {
      out.coupes.push(`${decrire(el)} x=[${Math.round(g.brutLeft)};${Math.round(g.brutRight)}] visible=[${Math.round(g.left)};${Math.round(g.right)}]`);
    }
  }

  // Une fenêtre ou une feuille ouverte : son panneau doit tenir dans l'écran.
  for (const p of document.querySelectorAll('[data-modal-panel]')) {
    if (!visible(p)) continue;
    const r = p.getBoundingClientRect();
    if (r.left < -1 || r.right > L + 1 || r.top < -1 || r.bottom > window.innerHeight + 1) {
      out.coupes.push(`PANNEAU ${decrire(p)} x=[${Math.round(r.left)};${Math.round(r.right)}] y=[${Math.round(r.top)};${Math.round(r.bottom)}]`);
    }
  }

  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length) continue;
    const aTexte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!aTexte || !visible(el)) continue;
    const s = getComputedStyle(el);
    const coupe = s.overflowX === 'hidden' || s.overflowX === 'clip';
    if (!coupe) continue;
    // Un texte « pour lecteur d'écran » (clip 1×1 px) est caché exprès : pas une troncature.
    if (el.clientWidth < 4 || el.getBoundingClientRect().height < 4) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    out.tronques.push({
      d: decrire(el),
      ellipse: s.textOverflow === 'ellipsis',
      dims: `${el.scrollWidth}>${el.clientWidth}`,
    });
  }
  return out;
}

// ───────────────────────────── 5. exécution ────────────────────────────────

async function main() {
  console.log(`Balayage ${LARGEUR}px — web ${WEB} — api ${API}`);
  const a = await monterMembre('Awa Konaté');
  const b = await monterMembre('Kofi Boateng', true);
  console.log(`comptes : ${a.handle} (viewer), ${b.handle} (auteur)`);
  const ids = await semer(a, b);
  console.log('décor :', JSON.stringify(ids));

  let fichiers = pages(APP)
    .map(routeDe)
    .filter((r) => r.groupe === '(app)' || (ARGS.admin && r.groupe === '(admin)') || (!ARGS['sans-onboarding'] && r.groupe === '(onboarding)') || r.route === '/')
    .map((r) => r.route)
    .filter((r) => !r.includes('(.)'))
    // les fenêtres interceptées (@fenetre) doublent /stories/* : déjà couvertes
    .filter((r, i, t) => t.indexOf(r) === i)
    .sort();
  // Variantes d'une même route que le fichier `page.tsx` ne distingue pas (`?vue=`).
  fichiers.push('/villes?vue=carte');

  const navigateur = await chromium.launch({ executablePath: CHROMIUM });
  const contexte = await navigateur.newContext({
    viewport: { width: LARGEUR, height: 844 },
    deviceScaleFactor: 1,
    isMobile: LARGEUR < 700,
    hasTouch: LARGEUR < 700,
  });
  await contexte.addCookies([a.cookie]);
  const pageA = await contexte.newPage();
  // L'onboarding se joue avec le compte SANS parcours (variante « sans parcours » de O05).
  const contexteB = await navigateur.newContext({
    viewport: { width: LARGEUR, height: 844 },
    isMobile: LARGEUR < 700,
    hasTouch: LARGEUR < 700,
  });
  await contexteB.addCookies([b.cookie]);
  const pageB = await contexteB.newPage();
  if (ARGS.captures) mkdirSync(String(ARGS.captures), { recursive: true });

  let erreurs = 0;
  const lignes = [];
  for (const modele of fichiers) {
    if (ARGS.seulement && !modele.includes(String(ARGS.seulement))) continue;
    const url = resoudre(modele, ids, a, b);
    const page = modele.startsWith('/bienvenue') || modele.startsWith('/connexion') || modele.startsWith('/p/') ? pageB : pageA;
    const rapporter = async (etiquette, nomCapture) => {
      const m = await page.evaluate(mesurer, LARGEUR);
      const sansEllipse = m.tronques.filter((t) => !t.ellipse);
      const avecEllipse = m.tronques.filter((t) => t.ellipse);
      const echec = m.debordement || m.coupes.length > 0 || sansEllipse.length > 0 || (ARGS['strict-textes'] && avecEllipse.length > 0);
      if (echec) erreurs += 1;
      lignes.push({ url: etiquette, modele, m, sansEllipse, avecEllipse, echec });
      const fin = new URL(page.url()).pathname;
      console.log(`${echec ? 'ECHEC' : 'ok   '} ${etiquette}${fin !== url.split('?')[0] && !etiquette.includes('[feuille') ? ' → ' + fin : ''}  scrollWidth=${m.scrollWidth}/${m.L}${m.coupes.length ? ' coupés=' + m.coupes.length : ''}${sansEllipse.length ? ' rognés=' + sansEllipse.length : ''}${avecEllipse.length ? ' ellipses=' + avecEllipse.length : ''}`);
      for (const l of m.larges) console.log(`      large   ${l}`);
      for (const c of m.coupes.slice(0, 8)) console.log(`      coupé   ${c}`);
      for (const t of sansEllipse.slice(0, 6)) console.log(`      rogné   ${t.d} ${t.dims}`);
      if (ARGS['strict-textes'] || ARGS.verbeux) for (const t of avecEllipse.slice(0, 6)) console.log(`      ellipse ${t.d} ${t.dims}`);
      if (ARGS.captures) {
        await page.screenshot({ path: join(String(ARGS.captures), `${nomCapture}.png`), fullPage: !etiquette.includes('[feuille') });
      }
    };
    try {
      await page.goto(`${WEB}${url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {});
      await page.waitForTimeout(700);
      await rapporter(url, modele.replace(/[^a-z0-9]+/gi, '_'));
      // Chaque fenêtre / feuille que l'écran sait ouvrir (`data-modal-open`), l'une après l'autre.
      if (!ARGS['sans-feuilles']) {
        const cles = await page.$$eval('[data-modal-open]', (els) => [
          ...new Set(els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getAttribute('data-modal-open'))),
        ]);
        for (const cle of cles) {
          const bouton = page.locator(`[data-modal-open="${cle}"]`).filter({ visible: true }).first();
          const clique = await bouton.click({ timeout: 3_000 }).then(() => true, () => false);
          if (!clique) continue;
          await page.waitForTimeout(700);
          await rapporter(`${url} [feuille ${cle}]`, `${modele.replace(/[^a-z0-9]+/gi, '_')}__${cle}`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          // Une feuille qui ne se ferme pas à Échap : on recharge plutôt que de mesurer à travers elle.
          if ((await page.locator('[data-modal-panel]').filter({ visible: true }).count()) > 0) {
            await page.goto(`${WEB}${url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
            await page.waitForTimeout(1500);
          }
        }
      }
    } catch (e) {
      erreurs += 1;
      console.log(`ECHEC ${url} : ${String(e.message).slice(0, 200)}`);
    }
  }
  await navigateur.close();
  await a.ctx.dispose();
  await b.ctx.dispose();
  console.log(`\n${lignes.length} routes — ${erreurs} en échec.`);
  process.exit(erreurs > 0 ? 1 : 0);
}

// Importable (monterMembre, semer) par un script de capture ; lancé seul, il balaie.
export { monterMembre, semer };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
