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
