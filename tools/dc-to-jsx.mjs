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

  /**
   * UN SEUL PARCOURS ICI AUSSI, et ce n'était pas le cas.
   *
   * Deux `replace` enchaînés s'appliquaient l'un au résultat de l'autre : le
   * premier posait `{'{'}` pour chaque `{`, et le second venait échapper le `}`
   * que ce remplacement venait d'introduire. « pour {ville} » devenait
   * `pour {'{'{'}'}ville{'}'}`, un JSX qui ne compile pas.
   *
   * Le défaut dormait depuis le début : aucune des maquettes 01 à 09 n'écrit une
   * accolade dans son texte. `10 Administration` est la première — D07 dessine le
   * gabarit de description d'une étape, « Constituez votre dossier pour {ville}
   * avant {échéance}. », où les accolades sont le VOCABULAIRE DU PRODUIT (les
   * variables d'un gabarit d'étape) et non du dialecte de maquette.
   *
   * `tsc` l'a dit tout de suite, ce qui est une chance : un échappement à moitié
   * faux qui compile serait invisible.
   */
  const literal = (chunk) => chunk.replace(/[{}]/g, (c) => `{'${c}'}`);

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
 *
 * UNE SEULE ENTRÉE PAR PROPRIÉTÉ, la DERNIÈRE l'emportant — comme en CSS.
 *
 * `04 Parcours` écrit ses boutons avec un gabarit suivi de surcharges :
 * `height:44px;…;white-space:nowrap;height:38px`. En CSS la seconde gagne, donc
 * la maquette s'affiche juste. Transcrit tel quel, l'objet JSX portait DEUX FOIS
 * la clé `height` : `tsc` le refuse (TS1117) sur 34 styles de cette maquette —
 * `03 Accueil` n'en avait aucun, ce qui explique que le défaut ait attendu ici.
 *
 * Le rendu aurait pourtant été correct : en JavaScript aussi la dernière clé
 * gagne. C'est précisément ce qui rend le motif dangereux, et c'est celui que ce
 * dépôt a déjà payé deux fois (voir `tools/check-duplicate-spread-keys.mjs`).
 * Fusionner ici donne UNE valeur par propriété, celle que le navigateur aurait
 * appliquée — la fidélité au dessin est intacte, l'ambiguïté disparaît.
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

  /**
   * UNE PROPRIÉTÉ, UNE VALEUR — la DERNIÈRE, comme en CSS.
   *
   * La maquette écrit parfois deux fois la même propriété dans un seul attribut
   * `style`, et cinquante-six fois dans « 03 Accueil v2 » :
   *
   *   background:#EEF2F0; … ; background:rgba(255,255,255,.9)
   *
   * En CSS c'est licite et la seconde gagne — le navigateur affiche donc le fond
   * translucide. Dans un objet JSX, deux fois la même clé est une ERREUR de
   * compilation (`TS1117`), et c'est une chance : c'est exactement le motif « deux
   * écritures pour une clé » qui a déjà coûté un filtre de visibilité et une fuite
   * de profils dans ce dépôt. `markClosers` le traite déjà ainsi pour les styles
   * qu'il fusionne ; il fallait le faire une fois pour toutes, ici.
   *
   * Garder la DERNIÈRE reproduit exactement ce que le navigateur fait de la
   * maquette : ce n'est pas une décision de design, c'est la sémantique de CSS.
   */
  const entries = [];
  for (const declaration of declarations) {
    const trimmed = declaration.trim();
    if (trimmed === '') continue;
    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;

    const property = trimmed.slice(0, colon).trim();
    const raw = trimmed.slice(colon + 1).trim();
    const key = property.startsWith('--') ? `'${property}'` : kebabToCamel(property);
    entries.push({ key, value: valueToJs(raw) });
  }

  /**
   * UNE PROPRIÉTÉ DÉCLARÉE DEUX FOIS : la dernière gagne, et l'ancienne DISPARAÎT.
   *
   * Les maquettes composent leurs styles par AJOUT : elles recopient le style de base
   * d'un bouton puis lui collent la variante à la fin —
   * `height:44px;…;flex-shrink:0;height:50px`. En CSS c'est licite et sans surprise :
   * la dernière déclaration l'emporte. Dans un objet JSX, c'est la clé écrite deux
   * fois, et TypeScript la refuse (TS1117), ESLint aussi (`no-dupe-keys`).
   *
   * Le compte est loin d'être anecdotique : 59 attributs `style` dans `05 Entraide`,
   * 6 dans `07 Agenda`, 56 dans `03 Accueil v2`. Sans cette fusion, vingt-sept des
   * vingt-sept cadres de ce lot ne compilaient pas.
   *
   * LA DERNIÈRE OCCURRENCE GARDE SA PLACE, elle ne remonte pas à celle de la première.
   * L'ordre d'un objet de style n'est pas décoratif : `backgroundClip` posé entre deux
   * `background` serait réinitialisé par le raccourci s'il passait après lui. Remonter
   * la valeur à la position de la première occurrence inverserait ce rapport, en
   * silence et sans erreur — exactement le genre d'écart que le transcodage existe
   * pour supprimer.
   */
  const lastIndex = new Map();
  entries.forEach((entry, i) => lastIndex.set(entry.key, i));
  const merged = entries.filter((entry, i) => lastIndex.get(entry.key) === i);

  return `{{ ${merged.map((e) => `${e.key}: ${e.value}`).join(', ')} }}`;
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
    /**
     * `all: true` — MARQUER TOUTES LES OCCURRENCES, pas seulement la première.
     *
     * « Je suis bloqué·e » est dessiné DEUX FOIS dans le cadre d'ordinateur de
     * J01 : une fois dans la carte du panneau de gauche, une fois dans la carte
     * de l'étape en cours. Les deux doivent ouvrir la même feuille. Marquer la
     * première seulement laissait le bouton de la timeline — celui que le membre
     * voit et vise — parfaitement inerte, sans que rien ne le signale.
     *
     * Le défaut par défaut reste « la première », parce que c'est ce dont un
     * marqueur posé DANS une boucle a besoin : `03 Accueil` écrit un seul
     * « Commenter » pour toutes ses publications.
     */
    let from = 0;
    let marked = 0;
    let silent = 0;
    for (;;) {
      const at = out.indexOf(trigger.marker, from);
      if (at < 0) {
        if (marked === 0) missed.push(trigger);
        break;
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
        if (marked === 0) missed.push(trigger);
        break;
      }

      const openEnd = findTagEnd(out, openIdx) + 1;
      const openTag = out.slice(openIdx, openEnd);
      const attr = ` data-modal-open="${trigger.modal}"`;

      /**
       * UN ÉLÉMENT NE REÇOIT PAS DEUX FOIS L'ATTRIBUT.
       *
       * Deux marqueurs peuvent remonter au MÊME élément : sur la planche
       * d'ordinateur de J05, le tracé du « + » se trouve dans un bouton déjà
       * marqué par « Je suis bloqué·e ». Le JSX produit portait alors
       * `data-modal-open="J03" data-modal-open="J05I"` — que `tsc` refuse
       * (TS17001), et dont React n'aurait de toute façon gardé qu'une valeur.
       * On passe à l'occurrence suivante plutôt que de s'arrêter : le marqueur
       * a peut-être une autre cible, légitime, plus loin.
       */
      if (openTag.includes('data-modal-open=')) {
        from = at + trigger.marker.length;
        continue;
      }

      if (tag === 'button') {
        // Déjà un bouton : on ne touche QUE l'attribut. Le style, le type et un
        // éventuel `onClick` de la maquette restent intacts.
        out = out.slice(0, openEnd - 1) + attr + out.slice(openEnd - 1);
        // Reprendre APRÈS le marqueur à sa NOUVELLE position : l'attribut a été
        // inséré avant lui, donc il a glissé d'autant. Repartir de `at` ferait
        // retomber le tour suivant sur le même bouton, indéfiniment.
        from = at + attr.length + trigger.marker.length;
      } else {
        const close = findMatchingClose(out, openEnd, tag);
        const style = /style="([^"]*)"/.exec(openTag);
        const styleAttr =
          style === null
            ? ' style="border:none;padding:0;font:inherit;cursor:pointer"'
            : ` style="${style[1]};border:none;padding:0;font:inherit;cursor:pointer"`;

        /**
         * UN BOUTON CRÉÉ AUTOUR D'UNE ICÔNE N'A AUCUN NOM ACCESSIBLE.
         *
         * Trouvé par axe-core, en `critical` (`button-name`), et SEULEMENT à la
         * largeur mobile : la planche d'ordinateur de J05 écrit « Inviter » à
         * côté de son icône, la planche mobile réduit le contrôle à un « + » nu.
         * Le déclencheur visait alors le tracé de l'icône, et le `<button>` créé
         * ne contenait qu'un `<svg>` — muet au lecteur d'écran.
         *
         * Le nom est donc DÉCLARÉ avec le déclencheur, comme le titre d'une
         * modale, et le compte de déclencheurs muets remonte pour qu'un oubli se
         * signale au lieu de passer.
         */
        const contenu = out
          .slice(openEnd, close.start)
          .replace(/<svg[\s\S]*?<\/svg>/g, '')
          .replace(/<[^>]+>/g, '')
          .trim();
        const labelAttr =
          trigger.label === undefined ? '' : ` aria-label="${trigger.label}"`;
        if (contenu === '' && trigger.label === undefined) silent += 1;

        /**
         * LA CIBLE TACTILE D'UN CONTRÔLE EN ICÔNE, portée à 44 px SANS DÉPLACER
         * UN PIXEL.
         *
         * `T1` §2.3 demande 44 px. La maquette dessine ses ronds d'action à
         * 40 × 40 — juste comme dessin, court comme cible : c'est le « + » de
         * l'en-tête Équipe, visé au pouce sur un téléphone.
         *
         * Le calcul est celui de l'interrupteur (`TOUCH_TARGET_ADAPTATIONS`),
         * avec une marge en plus :
         *   · `box-sizing: content-box` laisse la boîte de contenu à 40 × 40 ;
         *   · `padding: 2px` porte la boîte de bordure — donc la cible — à 44 ;
         *   · `background-clip: content-box` ne peint QUE les 40 px du milieu,
         *     sinon la pastille grise s'étendrait sur tout le remplissage ;
         *   · `margin: -2px` rend au voisinage les 4 px que le remplissage a
         *     pris. Sans elle, la ligne de l'en-tête passait de 40 à 44 px de
         *     haut et tout ce qui suit descendait d'autant.
         *
         * `box-sizing` est explicite : la préparation Tailwind met tout en
         * `border-box`, où `height: 40px` avec ce remplissage ne laisserait que
         * 36 px de contenu et la pastille rétrécirait.
         */
        const rond = /width:40px;height:40px;border-radius:999px/.test(styleAttr);
        const cible = rond
          ? ';box-sizing:content-box;padding:2px;margin:-2px;background-clip:content-box'
          : '';
        const styleFinal =
          cible === '' ? styleAttr : styleAttr.replace(/"$/, `${cible}"`);

        const replacement = `<button type="button"${attr}${labelAttr}${styleFinal}>`;
        out =
          out.slice(0, openIdx) +
          replacement +
          out.slice(openEnd, close.start) +
          '</button>' +
          out.slice(close.end);
        from = at + replacement.length - (openEnd - openIdx) + trigger.marker.length;
      }

      marked += 1;
      if (trigger.all !== true) break;
    }

    // Un déclencheur est RAPPORTÉ une fois, avec le NOMBRE de boutons marqués :
    // c'est ce chiffre qui dira qu'une maquette a cessé d'en dessiner deux.
    if (marked > 0) applied.push({ ...trigger, count: marked, silent });
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

/**
 * LE CENTRAGE D'UNE FENÊTRE DE MODALE, tel que les maquettes l'écrivent.
 *
 * `04 Parcours.dc.html` dessine ses deux modales — J03 « Je suis bloqué·e » et
 * J04 « Partager un jalon » — en CARTE NUE posée sur la planche : 540 px de
 * large, fond blanc, coins de 28 px, même remplissage de 24 px, mais sans voile
 * et sans positionnement. Le texte de la planche dit pourtant « modale sur
 * ordinateur, feuille du bas sur mobile ».
 *
 * La forme manquante n'est donc pas à inventer : `03 Accueil v2.dc.html` la
 * DESSINE pour ses propres fenêtres (A01G, A01S, A01P), et c'est exactement le
 * même objet — carte blanche de 28 px de rayon, 24 px de remplissage. Les trois
 * déclarations ci-dessous sont recopiées de ces panneaux, mot pour mot.
 *
 * `MODAL_WINDOW_SOURCE` existe pour que la recopie ne DÉRIVE pas : le générateur
 * vérifie que ce motif figure encore dans la maquette d'origine et refuse de
 * produire sinon — la même discipline que les libellés d'`INTERACTIVE_ROLES`.
 */
export const MODAL_WINDOW_CENTRING = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%)';
export const MODAL_WINDOW_SOURCE = {
  file: 'docs/template/03 Accueil v2.dc.html',
  pattern: 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)',
};

/** Le voile d'une modale, reconnu à sa géométrie et à son fond translucide. */
const VEIL_RE = /<div style="position:absolute;inset:0;background:rgba\([^"]*"[^>]*>/;

/**
 * @param inner    le contenu du cadre, tel qu'`extractFrame` le rend
 * @param openTag  la balise ouvrante du cadre — nécessaire quand le cadre EST le panneau
 * @param section  la section entière, où chercher le voile que la planche d'ordinateur omet
 */
export function adaptModalFrame(inner, openTag = null, section = '') {
  let ghosts = 0;
  let fixed = 0;
  let overlays = 0;
  let panels = 0;
  let scenery = 0;
  let borrowedVeil = false;

  /**
   * UNE CARTE NUE : le cadre lui-même est le panneau.
   *
   * Aucun enfant direct n'est positionné — donc la planche ne dessine ni voile ni
   * panneau, elle dessine la carte TOUTE SEULE. C'est la forme que `04 Parcours`
   * emploie pour ses fenêtres d'ordinateur. Le cadre devient alors le panneau, et
   * le voile est emprunté à la MÊME SECTION : ses planches mobiles le dessinent,
   * avec sa valeur exacte. S'il n'y en a aucune, on n'en invente pas — le compte
   * reste à zéro et le générateur le dit.
   */
  const bare =
    openTag !== null && !directChildren(inner).some((c) => inner.slice(c.start, c.openEnd ?? c.end).includes('position:absolute'));

  if (bare) {
    const veil = VEIL_RE.exec(section);
    const style = /style="([^"]*)"/.exec(openTag);
    const panelStyle = style === null ? MODAL_WINDOW_CENTRING : `${MODAL_WINDOW_CENTRING};${style[1]}`;
    const panelTag = `<div style="${panelStyle}" data-modal-panel="">`;
    panels += 1;
    fixed += 1;

    let head = '';
    if (veil !== null) {
      head = veil[0].replace('position:absolute', 'position:fixed').replace(/>$/, ' data-modal-overlay="">') + '</div>';
      overlays += 1;
      fixed += 1;
      borrowedVeil = true;
    }

    const closed = markClosers(`${head}${panelTag}${inner}</div>`);
    return { inner: closed.html, ghosts, fixed, overlays, panels, scenery, borrowedVeil, closers: closed.closers };
  }

  const children = directChildren(inner);

  // À rebours, pour que les indices restent valides pendant qu'on modifie.
  let out = inner;
  for (const child of [...children].reverse()) {
    const childTag = out.slice(child.start, child.openEnd ?? child.end);
    if (/opacity:\.5/.test(childTag)) {
      out = out.slice(0, child.start) + out.slice(child.end);
      ghosts += 1;
      continue;
    }
    /**
     * LE DÉCOR TOMBE, et pas seulement le fond fantôme.
     *
     * `03 Accueil` esquisse l'écran sous-jacent avec `opacity:.5` — un fantôme,
     * reconnaissable. `04 Parcours` le dessine PLEIN : la planche mobile de J01M
     * porte l'en-tête « Mes études à Lyon » en clair, au-dessus du voile dans
     * l'ordre du document. Transcodé tel quel, cet en-tête se retrouvait DANS la
     * boîte de dialogue, qui affichait donc deux fois le titre de l'écran.
     *
     * Un enfant direct qui n'est ni le voile ni le panneau est le décor de
     * l'écran de DERRIÈRE : cet écran est déjà rendu par la page, sous la modale.
     * Le garder le dupliquerait. Le compte remonte, parce qu'une planche qui
     * perdrait soudain son panneau se signalerait par là.
     */
    if (!childTag.includes('position:absolute')) {
      out = out.slice(0, child.start) + out.slice(child.end);
      scenery += 1;
      continue;
    }
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
    const isOverlay = childTag.includes('inset:0') && /background:rgba\(/.test(childTag);
    const marker = isOverlay ? ' data-modal-overlay=""' : ' data-modal-panel=""';
    if (isOverlay) overlays += 1;
    else panels += 1;

    const replaced = childTag.replace('position:absolute', 'position:fixed').replace(/>$/, `${marker}>`);
    out = out.slice(0, child.start) + replaced + out.slice(child.openEnd ?? child.end);
    fixed += 1;
  }

  const closed = markClosers(out);
  return { inner: closed.html, ghosts, fixed, overlays, panels, scenery, borrowedVeil, closers: closed.closers };
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
