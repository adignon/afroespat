#!/usr/bin/env node
/**
 * Transcodeur `.dc.html` → JSX.
 *
 * Les 88 écrans de docs/template sont du HTML à styles en ligne, produit par
 * Claude Design. Les réécrire à la main, écran par écran, introduit des écarts
 * de jugement — je l'ai vérifié à mes dépens sur A01 : les mesures concordaient,
 * mais un titre de page inventé, une pastille qui affichait le mauvais champ et
 * une variante de carte manquante s'étaient glissés dedans.
 *
 * Transcoder mécaniquement supprime la question : le style en ligne de la
 * maquette devient le style en ligne du composant, à l'identique. Ce qui
 * s'écrit à la main, c'est la DONNÉE et le COMPORTEMENT, pas la forme.
 *
 * Le dialecte à traduire est petit :
 *
 *   {{ expr }}                          → {expr}
 *   <sc-for list="{{ xs }}" as="x">…</> → {xs.map((x, i) => <Fragment key={i}>…</Fragment>)}
 *   <sc-if value="{{ c }}">…</sc-if>    → {c ? <>…</> : null}
 *   style="a:b;c:d"                     → style={{ a: 'b', c: 'd' }}
 *   onClick="{{ f }}"                   → onClick={f}
 *
 * Usage :
 *   node tools/dc-to-jsx.mjs <fichier.dc.html> <#id-de-section> > Ecran.tsx
 */
import { readFileSync } from 'node:fs';

// ─── Attributs HTML → JSX ────────────────────────────────────────────────────

const ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'clip-path': 'clipPath',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'text-anchor': 'textAnchor',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  viewbox: 'viewBox',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  autocomplete: 'autoComplete',
  readonly: 'readOnly',
  tabindex: 'tabIndex',
  contenteditable: 'contentEditable',
  srcset: 'srcSet',
};

/** Éléments sans contenu : JSX exige leur auto-fermeture. */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
  'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use',
]);

const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ─── Interpolations ──────────────────────────────────────────────────────────

const hasExpr = (s) => /\{\{[^}]*\}\}/.test(s);

/** `{{ a.b }}` → `a.b`, en retirant les espaces de garde. */
const unwrap = (s) => s.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '');

/**
 * Une valeur d'attribut qui mêle texte et expressions devient un littéral
 * gabarit : `border:{{ x }}` → `` `border:${x}` ``.
 */
function valueToJs(value) {
  const whole = /^\s*\{\{([^}]*)\}\}\s*$/.exec(value);
  if (whole !== null) return unwrap(value);

  if (!hasExpr(value)) return JSON.stringify(value);

  const template = value
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, expr) => `\${${expr}}`);
  return `\`${template}\``;
}

/**
 * Le texte d'un nœud : `Bonjour {{ nom }}` → `Bonjour {nom}`.
 *
 * En UN SEUL passage, et dans cet ordre : on découpe d'abord sur les
 * interpolations, puis on échappe les accolades qui restent dans le texte
 * littéral. L'inverse — échapper d'abord — casse les interpolations, puisque
 * leurs propres accolades se font échapper aussi.
 */
function textToJsx(text) {
  const parts = [];
  const re = /\{\{\s*([^}]*?)\s*\}\}/g;
  let last = 0;
  let m;

  const literal = (chunk) =>
    chunk.replace(/\{/g, "{'{'}").replace(/\}/g, "{'}'}");

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(literal(text.slice(last, m.index)));
    parts.push(`{${m[1]}}`);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(literal(text.slice(last)));
  return parts.join('');
}

// ─── Styles ──────────────────────────────────────────────────────────────────

/**
 * `style="width:76px;background:{{ x }}"` → objet JSX.
 *
 * Les valeurs sont conservées MOT POUR MOT : c'est tout l'intérêt du
 * transcodage. Aucune conversion vers un jeton, aucune interprétation.
 */
function styleToJsx(value) {
  const declarations = [];
  let depth = 0;
  let current = '';
  // Découpe sur `;` en ignorant ceux qui sont dans des parenthèses — les
  // dégradés et `calc()` en contiennent.
  for (const ch of value) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ';' && depth === 0) {
      declarations.push(current);
      current = '';
    } else current += ch;
  }
  declarations.push(current);

  const entries = [];
  for (const declaration of declarations) {
    const trimmed = declaration.trim();
    if (trimmed === '') continue;
    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;

    const property = trimmed.slice(0, colon).trim();
    const raw = trimmed.slice(colon + 1).trim();
    const key = property.startsWith('--') ? `'${property}'` : kebabToCamel(property);
    entries.push(`${key}: ${valueToJs(raw)}`);
  }
  return `{{ ${entries.join(', ')} }}`;
}

// ─── Analyse ─────────────────────────────────────────────────────────────────

function parseAttributes(raw) {
  const attrs = [];
  const re = /([:\w-]+)\s*=\s*"([^"]*)"|([:\w-]+)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m[3] !== undefined) attrs.push({ name: m[3], value: null });
    else attrs.push({ name: m[1], value: m[2] });
  }
  return attrs;
}

function renderAttributes(tag, attrs) {
  const out = [];
  for (const { name, value } of attrs) {
    if (name.startsWith('hint-')) continue; // aide de maquette, sans effet
    if (value === null) {
      out.push(kebabToCamel(name));
      continue;
    }
    if (name === 'style') {
      out.push(`style=${styleToJsx(value)}`);
      continue;
    }
    const jsxName =
      ATTR_MAP[name] ??
      (name.startsWith('data-') || name.startsWith('aria-') ? name : kebabToCamel(name));

    out.push(hasExpr(value) ? `${jsxName}={${valueToJs(value)}}` : `${jsxName}=${JSON.stringify(value)}`);
  }
  return out.length === 0 ? '' : ` ${out.join(' ')}`;
}

/** Transcode un fragment HTML en JSX. Appelée récursivement sur le corps des sc-*. */
function transcode(html, depth = 0) {
  let out = '';
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);

    if (lt < 0) {
      out += textToJsx(html.slice(i));
      break;
    }

    out += textToJsx(html.slice(i, lt));

    // Commentaire HTML.
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end < 0 ? html.length : end + 3;
      continue;
    }

    const gt = findTagEnd(html, lt);
    if (gt < 0) {
      out += textToJsx(html.slice(lt));
      break;
    }

    const inner = html.slice(lt + 1, gt);
    const closing = inner.startsWith('/');
    const selfClosed = inner.endsWith('/');
    const body = closing ? inner.slice(1) : selfClosed ? inner.slice(0, -1) : inner;
    const nameMatch = /^([\w-]+)/.exec(body.trim());
    const tag = nameMatch === null ? '' : nameMatch[1];
    const rawAttrs = body.trim().slice(tag.length);

    if (closing) {
      out += `</${tag}>`;
      i = gt + 1;
      continue;
    }

    // ── sc-for ──────────────────────────────────────────────────────────────
    if (tag === 'sc-for') {
      const attrs = Object.fromEntries(parseAttributes(rawAttrs).map((a) => [a.name, a.value]));
      const list = unwrap(attrs.list ?? '');
      const alias = attrs.as ?? 'item';
      const close = findMatchingClose(html, gt + 1, 'sc-for');
      const childHtml = html.slice(gt + 1, close.start);

      const child = transcode(childHtml, depth + 1).trim();
      out += `{(${list} ?? []).map((${alias}, ${alias}Index) => (\n<Fragment key={${alias}Index}>${child}</Fragment>\n))}`;
      i = close.end;
      continue;
    }

    // ── sc-if ───────────────────────────────────────────────────────────────
    if (tag === 'sc-if') {
      const attrs = Object.fromEntries(parseAttributes(rawAttrs).map((a) => [a.name, a.value]));
      const condition = unwrap(attrs.value ?? 'false');
      const close = findMatchingClose(html, gt + 1, 'sc-if');
      const childHtml = html.slice(gt + 1, close.start);

      const child = transcode(childHtml, depth + 1).trim();
      out += `{${condition} ? (<>${child}</>) : null}`;
      i = close.end;
      continue;
    }

    const attributes = renderAttributes(tag, parseAttributes(rawAttrs));

    if (selfClosed || VOID_ELEMENTS.has(tag)) {
      out += `<${tag}${attributes} />`;
      i = gt + 1;
      continue;
    }

    out += `<${tag}${attributes}>`;
    i = gt + 1;
  }

  return out;
}

/** Trouve le `>` qui ferme la balise ouverte en `from`, en sautant les guillemets. */
function findTagEnd(html, from) {
  let inQuote = false;
  for (let i = from + 1; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === '>' && !inQuote) return i;
  }
  return -1;
}

/** Trouve la fermeture d'un `sc-for` / `sc-if`, en tenant compte de l'imbrication. */
function findMatchingClose(html, from, tag) {
  const open = new RegExp(`<${tag}[\\s>]`, 'g');
  const close = new RegExp(`</${tag}>`, 'g');
  open.lastIndex = from;
  close.lastIndex = from;

  let depth = 1;
  let cursor = from;
  for (;;) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);
    if (nextClose === null) return { start: html.length, end: html.length };

    if (nextOpen !== null && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + 1;
      continue;
    }
    depth -= 1;
    if (depth === 0) return { start: nextClose.index, end: nextClose.index + nextClose[0].length };
    cursor = nextClose.index + 1;
  }
}

/**
 * Les enfants DIRECTS d'un fragment de balisage, avec leur étendue.
 *
 * Nécessaire aux modales : l'adaptation qui les concerne porte sur le voile et
 * le panneau, qui sont les enfants directs du cadre — jamais sur les `position:
 * absolute` internes du panneau, dont il y a des dizaines et qui sont du design.
 * Un remplacement par expression régulière sur tout le fragment les toucherait
 * tous, et le décalage ne se verrait qu'à l'œil, sur un écran monté.
 */
function directChildren(html) {
  const children = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<' || html[i + 1] === '/' || html[i + 1] === '!') {
      i += 1;
      continue;
    }
    const tagMatch = /^<([a-zA-Z][\w-]*)/.exec(html.slice(i, i + 40));
    if (tagMatch === null) {
      i += 1;
      continue;
    }
    const tag = tagMatch[1];
    const openEnd = findTagEnd(html, i);
    if (openEnd === -1) break;
    // Une balise auto-fermante ou vide n'a pas de fermeture à chercher.
    if (html[openEnd - 1] === '/' || VOID_ELEMENTS.has(tag.toLowerCase())) {
      children.push({ tag, start: i, end: openEnd + 1 });
      i = openEnd + 1;
      continue;
    }
    const close = findMatchingClose(html, openEnd + 1, tag);
    children.push({ tag, start: i, end: close.end, openEnd: openEnd + 1 });
    i = close.end;
  }
  return children;
}


/**
 * Adapte le cadre d'une MODALE — deux transformations, et deux seulement.
 *
 * La maquette dessine une modale dans un cadre de taille fixe, ce qui impose deux
 * artifices qu'un écran réel ne doit pas hériter :
 *
 *   1. **le fond fantôme.** Un premier enfant à `opacity:.5` esquisse l'écran
 *      sous-jacent, pour que la planche se lise seule. Dans l'application, ce
 *      qu'il y a derrière est le VRAI écran : ce calque doit disparaître, sinon il
 *      dessine une seconde interface par-dessus la première.
 *      Il n'est pas toujours là — deux des huit cadres n'en ont pas — donc son
 *      absence est licite, et c'est le COMPTE qui est rapporté : un fantôme qui
 *      apparaîtrait ailleurs, ou disparaîtrait ici, se verrait.
 *
 *   2. **`position: absolute` → `position: fixed`**, sur le voile et le panneau
 *      uniquement. Dans la maquette ils se calent sur le cadre de 1440 px, qui est
 *      leur parent positionné ; dans l'application une modale doit couvrir la
 *      FENÊTRE. Appliquée aux seuls enfants directs : le panneau contient des
 *      dizaines de `position: absolute` internes qui sont du design et ne doivent
 *      pas bouger.
 *
 *      HONNÊTETÉ SUR CETTE LIGNE : avec le composant `Modal`, elle ne change RIEN.
 *      Son enveloppe est déjà `position: fixed; inset: 0`, donc un enfant
 *      `absolute` s'y cale et couvre exactement la même surface. Vérifié par
 *      mutation : remettre `absolute` laisse les quatorze tests VERTS, alors que
 *      muter la largeur du panneau en fait tomber un. L'adaptation reste, parce
 *      qu'elle rend le panneau juste même rendu SANS cette enveloppe — dans
 *      `ScreenFrames`, dont le conteneur est `position: relative`, un panneau
 *      `absolute` serait enfermé dans le cadre. C'est une ceinture en plus de la
 *      bretelle, et aucun test ne distingue les deux aujourd'hui.
 *
 * Tout le reste — largeur de 720 px, rayons, la feuille à 88 % et sa poignée sur
 * mobile — est transcodé à la lettre. La maquette dessine DÉJÀ les deux formes,
 * il n'y a rien à inventer.
 */
/**
 * Les DÉCLENCHEURS de modale, marqués sur l'écran qui les porte.
 *
 * Le fil ouvre deux fenêtres, et la maquette le dit sous ses planches :
 * « Commentaires — ouverts depuis « Commenter » » et « Partager ». Ces deux
 * contrôles existent déjà dans le fil ; il ne manque que le lien.
 *
 * Le marquage se fait ici plutôt qu'en injectant un `onClick` dans le JSX, pour la
 * même raison que les fermetures : les fichiers générés restent de la pure
 * présentation, et aucune propriété n'a besoin de traverser le fil pour atteindre
 * un bouton enfoui à cinq niveaux dans une boucle.
 *
 * LES MARQUEURS INCLUENT LE `</svg>` QUI PRÉCÈDE, et ce n'est pas une coquetterie :
 * « Partager » apparaît DEUX FOIS dans le cadre mobile — une fois comme bouton
 * d'action, une fois dans le texte d'invite du composeur (« Partager avec la
 * communauté… »). Sans le `</svg>`, c'est l'invite qui devenait cliquable, et le
 * vrai bouton restait mort. Le défaut aurait été invisible à la relecture.
 */
export function markTriggers(html, triggers) {
  let out = html;
  const applied = [];
  const missed = [];

  for (const trigger of triggers ?? []) {
    const at = out.indexOf(trigger.marker);
    if (at < 0) {
      missed.push(trigger);
      continue;
    }

    // Remonter jusqu'à la balise ouvrante qui contient le marqueur.
    let openIdx = at;
    let tag = null;
    while (openIdx > 0) {
      openIdx = out.lastIndexOf('<', openIdx - 1);
      if (openIdx < 0) break;
      const m = /^<(button|span|div)[\s>]/.exec(out.slice(openIdx, openIdx + 10));
      if (m !== null) {
        tag = m[1];
        break;
      }
    }
    if (tag === null) {
      missed.push(trigger);
      continue;
    }

    const openEnd = findTagEnd(out, openIdx) + 1;
    const openTag = out.slice(openIdx, openEnd);

    if (tag === 'button') {
      // Déjà un bouton : on ne touche QUE l'attribut. Le style, le type et un
      // éventuel `onClick` de la maquette restent intacts.
      out = out.slice(0, openEnd - 1) + ` data-modal-open="${trigger.modal}"` + out.slice(openEnd - 1);
    } else {
      const close = findMatchingClose(out, openEnd, tag);
      const style = /style="([^"]*)"/.exec(openTag);
      const styleAttr =
        style === null
          ? ' style="border:none;padding:0;font:inherit;cursor:pointer"'
          : ` style="${style[1]};border:none;padding:0;font:inherit;cursor:pointer"`;
      out =
        out.slice(0, openIdx) +
        `<button type="button" data-modal-open="${trigger.modal}"${styleAttr}>` +
        out.slice(openEnd, close.start) +
        '</button>' +
        out.slice(close.end);
    }
    applied.push(trigger);
  }

  return { html: out, applied, missed };
}

/**
 * Les FERMETURES d'une modale, promues en vrais boutons.
 *
 * La maquette les dessine en `<span>`, comme tous ses contrôles : une image n'a
 * pas besoin d'être opérable. Un écran, si. Sans cette promotion, la seule façon
 * de fermer serait la touche Échap et le clic sur le voile — ni l'un ni l'autre
 * n'est annoncé à un lecteur d'écran, et ni l'un ni l'autre n'est atteignable au
 * clavier depuis l'intérieur du panneau.
 *
 * DEUX signatures, structurelles et non textuelles :
 *
 *   · la CROIX de l'ordinateur — un rond de 40 px qui contient le tracé de la
 *     croix. Le tracé seul ne suffit pas : le fil de commentaires en porte un
 *     second, de 14 px, qui retire la citation d'une réponse. Le confondre avec
 *     la fermeture aurait fermé la modale en voulant effacer une citation.
 *   · la POIGNÉE de la feuille mobile — 40 × 5 px, arrondie. C'est le seul
 *     contrôle que la feuille porte : elle n'a pas de croix.
 *
 * Les styles de la maquette sont conservés, et trois déclarations sont AJOUTÉES —
 * `border:none;padding:0;font:inherit`. Un `<button>` arrive avec une bordure, un
 * remplissage et une police du navigateur que le `<span>` n'avait pas : sans elles,
 * promouvoir la balise changerait le dessin. `cursor:pointer` dit que c'est
 * cliquable, ce que le `<span>` ne disait pas non plus.
 *
 * Ce qui n'est PAS fait, et qu'il faut savoir : le glissement vers le bas pour
 * refermer la feuille. La poignée l'annonce visuellement ; elle est opérable au
 * clic et au clavier, pas encore au geste.
 */
function markClosers(html) {
  const NEUTRALISE = ';border:none;padding:0;font:inherit;cursor:pointer';
  let out = html;
  let closers = 0;

  /**
   * Fusionne les déclarations PAR PROPRIÉTÉ, la dernière gagnant.
   *
   * Sans cela, `padding: 0` de la neutralisation et `padding: 10px 24px` de la
   * poignée coexistaient dans le même style. À l'exécution la seconde gagne, donc
   * le rendu était juste — mais l'objet JSX produit portait DEUX FOIS la clé
   * `padding`, ce qu'ESLint refuse (`no-dupe-keys`), et c'est exactement le motif
   * « deux écritures pour une clé » qui a déjà coûté un filtre de visibilité et
   * une fuite de profils dans ce dépôt. Une clé, une valeur.
   */
  const mergeStyle = (...parts) => {
    const seen = new Map();
    for (const part of parts.join(';').split(';')) {
      const trimmed = part.trim();
      if (trimmed === '') continue;
      const colon = trimmed.indexOf(':');
      if (colon < 0) continue;
      seen.set(trimmed.slice(0, colon).trim(), trimmed.slice(colon + 1).trim());
    }
    return [...seen].map(([k, v]) => `${k}:${v}`).join(';');
  };

  const promote = (openIdx, openEnd, closeStart, closeEnd, label, extra = '') => {
    const openTag = out.slice(openIdx, openEnd);
    const style = /style="([^"]*)"/.exec(openTag);
    const base = style === null ? '' : style[1];
    const styleAttr = ` style="${mergeStyle(base, NEUTRALISE, extra)}"`;
    out =
      out.slice(0, openIdx) +
      `<button type="button" aria-label="${label}" data-modal-close=""${styleAttr}>` +
      out.slice(openEnd, closeStart) +
      '</button>' +
      out.slice(closeEnd);
    closers += 1;
  };

  // La croix : un rond de 40 px qui contient le tracé de la croix.
  const roundRe = /<span style="([^"]*width:40px;height:40px;border-radius:999px[^"]*)"[^>]*>/g;
  let m;
  while ((m = roundRe.exec(out)) !== null) {
    const openEnd = m.index + m[0].length;
    const close = findMatchingClose(out, openEnd, 'span');
    if (!out.slice(openEnd, close.start).includes('M18 6 6 18M6 6l12 12')) continue;
    promote(m.index, openEnd, close.start, close.end, 'Fermer');
    break;
  }

  // La poignée de la feuille : 40 × 5 px, arrondie.
  const handleRe = /<span style="([^"]*width:40px;height:5px[^"]*)"[^>]*>/;
  const h = handleRe.exec(out);
  if (h !== null) {
    const openEnd = h.index + h[0].length;
    const close = findMatchingClose(out, openEnd, 'span');
    /**
     * LA POIGNÉE MESURE 40 × 5 px — une cible tactile de CINQ pixels de haut.
     *
     * C'est juste comme dessin : une poignée doit être discrète. C'est inutilisable
     * comme bouton, et c'est le SEUL contrôle de la feuille mobile — donc sur un
     * téléphone, la seule façon de refermer par un contrôle.
     *
     * La barre visible reste à 40 × 5 px, au pixel près. Ce qui grandit est la
     * zone cliquable, par du remplissage : `box-sizing: content-box` laisse la
     * boîte de contenu à 40 × 5, le remplissage porte la cible à 88 × 25, et
     * `background-clip: content-box` ne peint le fond QUE dans la boîte de contenu
     * — sans quoi la pastille grise s'étendrait sur tout le remplissage et la
     * poignée deviendrait un gros rectangle.
     *
     * `margin-top` passe à 0 : les 10 px d'origine séparaient la poignée du bord,
     * et le remplissage les fournit désormais. Les garder décalerait la feuille.
     */
    promote(
      h.index,
      openEnd,
      close.start,
      close.end,
      'Fermer',
      ';box-sizing:content-box;padding:10px 24px;margin-top:0;background-clip:content-box',
    );
  }

  return { html: out, closers };
}

export function adaptModalFrame(inner) {
  const children = directChildren(inner);
  let ghosts = 0;
  let fixed = 0;
  let overlays = 0;
  let panels = 0;

  // À rebours, pour que les indices restent valides pendant qu'on modifie.
  let out = inner;
  for (const child of [...children].reverse()) {
    const openTag = out.slice(child.start, child.openEnd ?? child.end);
    if (/opacity:\.5/.test(openTag)) {
      out = out.slice(0, child.start) + out.slice(child.end);
      ghosts += 1;
      continue;
    }
    if (!openTag.includes('position:absolute')) continue;

    /**
     * LE VOILE ET LE PANNEAU SONT MARQUÉS ICI, et non reconnus à l'exécution.
     *
     * Le composant `Modal` a besoin de savoir lequel est lequel : un clic sur le
     * voile ferme, un clic dans le panneau non. Le lui faire deviner dans le DOM —
     * « le dernier enfant », « celui qui a un fond blanc » — serait une règle
     * fragile écrite loin de la maquette, qui casserait en silence le jour où une
     * modale ajoute un troisième calque.
     *
     * La distinction est nette dans la maquette : le voile a `inset: 0` et un fond
     * `rgba(…)` translucide ; le panneau a une géométrie et un fond opaque. Elle
     * est donc lue une fois, au transcodage, et posée en attribut. Les comptes
     * remontent, pour qu'un cadre qui n'aurait pas exactement un voile et un
     * panneau se signale.
     */
    const isOverlay = openTag.includes('inset:0') && /background:rgba\(/.test(openTag);
    const marker = isOverlay ? ' data-modal-overlay=""' : ' data-modal-panel=""';
    if (isOverlay) overlays += 1;
    else panels += 1;

    const replaced = openTag.replace('position:absolute', 'position:fixed').replace(/>$/, `${marker}>`);
    out = out.slice(0, child.start) + replaced + out.slice(child.openEnd ?? child.end);
    fixed += 1;
  }

  const closed = markClosers(out);
  return { inner: closed.html, ghosts, fixed, overlays, panels, closers: closed.closers };
}

// ─── Extraction d'une section ────────────────────────────────────────────────

/** Isole `<section id="A01" …>…</section>` dans le fichier de maquette. */
export function extractSection(html, id) {
  const open = new RegExp(`<section[^>]*id="${id}"[^>]*>`);
  const m = open.exec(html);
  if (m === null) throw new Error(`Section « ${id} » introuvable`);

  const from = m.index + m[0].length;
  const close = findMatchingClose(html, from, 'section');
  return html.slice(from, close.start);
}

/**
 * Isole le premier cadre d'écran d'une section — le `div` de 1440 px pour
 * l'ordinateur, celui de 390 px pour le mobile. La section contient aussi son
 * titre de planche et ses variantes, qui n'appartiennent pas à l'écran.
 */
/**
 * Le cadre d'une largeur donnée dans une section.
 *
 * `occurrence` sert aux sections qui montrent DEUX cadres de même largeur —
 * O05 présente ainsi ses deux atterrissages en 700 px. Sans ce paramètre, les
 * deux variantes seraient transcodées à l'identique, et l'erreur passerait
 * inaperçue : le fichier produit compile parfaitement.
 */
export function extractFrame(sectionHtml, width, occurrence = 0) {
  const re = new RegExp(`<div style="width:${width}px[^"]*"[^>]*>`, 'g');
  let m = null;
  for (let i = 0; i <= occurrence; i += 1) {
    m = re.exec(sectionHtml);
    if (m === null) {
      throw new Error(`Cadre de ${width} px n° ${occurrence + 1} introuvable`);
    }
  }

  const from = m.index + m[0].length;
  const close = findMatchingClose(sectionHtml, from, 'div');
  return { openTag: m[0], inner: sectionHtml.slice(from, close.start) };
}

export { transcode };

// ─── Ligne de commande ───────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('dc-to-jsx.mjs')) {
  const [, , file, sectionId, widthArg] = process.argv;
  if (file === undefined || sectionId === undefined) {
    console.error('usage : dc-to-jsx.mjs <fichier.dc.html> <id-section> [largeur]');
    process.exit(1);
  }
  const html = readFileSync(file, 'utf8');
  const section = extractSection(html, sectionId.replace(/^#/, ''));
  const width = widthArg === undefined ? null : Number(widthArg);
  const source = width === null ? section : extractFrame(section, width).inner;
  process.stdout.write(transcode(source));
}
