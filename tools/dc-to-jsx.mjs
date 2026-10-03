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
    if (colon < 0) {
      /**
       * ─── UNE DÉCLARATION SANS DEUX-POINTS : DEUX CAS, ET UN SEUL EST LICITE ───
       *
       * Ce `continue` était INCONDITIONNEL, et c'est le trou que trois agents ont
       * trouvé séparément — l'un sur une zébrure de tableau (D08, `v.fondLigne`),
       * l'autre sur un filet entre deux lignes.
       *
       * POUR DU CSS MAL FORMÉ, LE SAUT EST JUSTE. La maquette en contient — un `;`
       * de trop, un mot resté seul — et le navigateur l'ignore exactement de la
       * même façon. Transcrire fidèlement, c'est ignorer aussi.
       *
       * POUR UNE INTERPOLATION, LE SAUT EST FAUX, et il est faux de la pire
       * manière. Une déclaration de maquette peut être posée EN ENTIER par une
       * donnée :
       *
       *     style="…;padding:10px 0;{{ m.bord }}"
       *
       * Ce fragment n'est pas une paire `clé:valeur` — il n'a pas de deux-points —
       * donc il tombait ici et DISPARAISSAIT. Les quatre contrôles de `donnees`
       * (`tools/generate-screens.mjs`) le laissent tous passer : le premier compte
       * le littéral dans la maquette, le deuxième vérifie les motifs, le troisième
       * que rien n'est inventé, le quatrième que `devient` PORTE bien une
       * interpolation. Aucun ne vérifie que le JSX PRODUIT la porte encore. Le
       * journal annonçait donc « Donnée « m.bord » ← … » et le cadre ne la portait
       * pas : `grep` rendait 0 des deux côtés.
       *
       * UN JOURNAL QUI ANNONCE UNE LIAISON QUE LE JSX NE PORTE PAS EST PIRE QU'UN
       * MÉCANISME ABSENT : on croit l'écran branché, donc on ne le rebranche pas.
       *
       * On ARRÊTE donc la génération en nommant le fragment. Le refus est le bon
       * comportement plutôt qu'un repli : il n'existe aucune façon honnête de
       * rendre ce cas en JSX. `style={{ … }}` est un objet, et une interpolation en
       * position de déclaration vaudrait une PAIRE entière — ce que seul un
       * `...(expr)` exprimerait, c'est-à-dire une forme que `styleToJsx` n'émet pas
       * et dont `check-duplicate-spread-keys.mjs` existe précisément pour traquer
       * les dérives. La déclaration doit donc être réécrite en paire :
       * `background:{{ m.fond }}` plutôt que `{{ m.bord }}`.
       */
      if (trimmed.includes('{{')) {
        throw new Error(
          `une interpolation est posée à la place d’une DÉCLARATION ENTIÈRE dans un attribut ` +
            `style — « ${trimmed} » — et le JSX ne peut pas la porter : un objet de style ` +
            'se compose de paires `clé: valeur`. Elle serait SAUTÉE en silence, et le journal ' +
            'annoncerait une liaison que l’écran n’affiche pas. Réécrire la donnée en paire ' +
            '(`propriété:{{ expr }}`) dans sa déclaration d’écran.\n' +
            `  style complet : « ${value.length > 300 ? `${value.slice(0, 300)}…` : value} »`,
        );
      }
      continue;
    }

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
 * ── LE DÉCLENCHEUR DIT QUI IL OUVRE, MAIS AUSSI SUR QUOI ────────────────────
 *
 * `data-modal-open` nomme la FENÊTRE. Il ne disait pas le SUJET, et c'était un
 * défaut mesuré, pas une limite théorique : le « Commenter » du fil est écrit UNE
 * SEULE FOIS dans la maquette, à l'intérieur de la boucle sur les publications.
 * Toutes les cartes portaient donc exactement le même attribut, et l'écouteur
 * délégué de la page — qui ne voit que l'élément cliqué — ne pouvait pas savoir
 * LAQUELLE avait été touchée. Conséquence : les cinq publications du fil
 * ouvraient la même fenêtre de commentaires, celle d'aucune d'entre elles.
 *
 * `trigger.subject` répare cela en posant, À CÔTÉ du nom de la fenêtre, une
 * EXPRESSION du dialecte — `{{ p.postId }}` — que le transcodeur rend en
 * `data-modal-subject={p.postId}`. L'identifiant est donc évalué DANS la boucle,
 * une valeur par carte, et l'écouteur délégué le relit par `closest()`.
 *
 * Il est déclaré AVEC LE DÉCLENCHEUR (`tools/screens/*.mjs`) et non deviné ici :
 * le nom de la variable de boucle appartient à la maquette, et le transcodeur ne
 * le connaît pas. Un déclencheur hors boucle — la plupart — n'en déclare aucun et
 * ne change pas d'un octet.
 *
 * NE JAMAIS CORRIGER CELA DANS LE JSX GÉNÉRÉ : la régénération l'effacerait.
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
      /**
       * Le sujet est posé EN DIALECTE, pas en JSX : `markTriggers` tourne AVANT
       * `transcode`, sur le HTML de la maquette. Écrire `{p.postId}` ici donnerait
       * la chaîne littérale « {p.postId} » dans un attribut ; `{{ p.postId }}`
       * passe par `valueToJs` et devient l'expression attendue.
       */
      const subjectAttr =
        trigger.subject === undefined ? '' : ` data-modal-subject="{{ ${trigger.subject} }}"`;
      const attr = ` data-modal-open="${trigger.modal}"${subjectAttr}`;

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
 * ─── `liens` : LA NAVIGATION, QUE LA MAQUETTE DESSINE SANS LA CÂBLER ─────────
 *
 * LE DÉFAUT QUE CETTE CLÉ CORRIGE, mesuré sur les cadres produits et non supposé :
 *
 *   · les cinq entrées du rail membre — Accueil, Parcours, Entraide, Services,
 *     Agenda — sont des `<span>`. Ce ne sont pas des liens cassés : CE NE SONT PAS
 *     DES LIENS ;
 *   · 207 balises `<a>` dans les 250 cadres, et les 207 pointent vers `href="#"` ;
 *   · sur les quinze cadres d'équipe, ZÉRO balise de lien : neuf `<span>` sans
 *     `cursor: pointer`, et cliquer « Tableau de bord » ne change pas l'URL ;
 *   · sur les parcours, 132 entrées de panneau en `<span>` contre UNE en `<a>`.
 *
 * C'est la maquette qui est ainsi — elle DESSINE une barre de navigation, elle ne
 * la CÂBLE pas — et le transcodeur la recopie verbatim, comme le porteur l'a
 * demandé. Le générateur avait une table d'adaptation pour les boutons
 * (`BUTTON_ACTIONS`), une pour les déclencheurs de fenêtre (`markTriggers`), une
 * pour les noms accessibles (`ICON_BUTTON_NAMES`), une pour la donnée
 * (`applyData`). RIEN pour les liens.
 *
 * Personne ne l'avait signalé parce que TOUS les tests du dépôt visitent les
 * écrans en TAPANT L'URL, jamais en cliquant.
 *
 * ── UN SEUL APPAREIL POUR TROIS BESOINS ─────────────────────────────────────
 *
 * Aucun second mécanisme n'est inventé : c'est `markTriggers`, dont il reprend la
 * forme à la lettre — un MARQUEUR verbatim de la maquette, la remontée jusqu'à la
 * balise ouvrante qui le contient, la promotion de cette balise, et une
 * destination posée EN DIALECTE pour qu'elle puisse s'évaluer dans une boucle.
 *
 *   1. promouvoir un `<span>` DESSINÉ en LIEN — le rail, les onglets, les entrées
 *      de panneau ;
 *   2. donner une DESTINATION DÉCLARÉE à un `<a href="#">` que la maquette a bien
 *      balisé mais n'a pas adressé ;
 *   3. promouvoir un `<span>` en BOUTON avec une action — « Renvoyer » de l'écran
 *      du code en est un : la maquette le dessine en `<span>`, et il ne déclenche
 *      aucune fenêtre, donc `markTriggers` ne le voit pas.
 *
 * ── LA DESTINATION EST DÉCLARÉE, JAMAIS DEVINÉE DU LIBELLÉ ──────────────────
 *
 * C'est l'exigence dure de cette table, et elle n'est pas de principe : « Voir
 * tout » est écrit sur une dizaine d'écrans et ne mène pas deux fois au même
 * endroit ; « Accueil » est écrit dans le rail, dans un fil d'Ariane ET dans un
 * menu mobile. Une table indexée sur le seul libellé enverrait les trois au même
 * endroit, le journal dirait « lien branché », et la dérive serait invisible —
 * c'est exactement la leçon que `BUTTON_ACTIONS` a déjà payée avec le
 * « Continuer » d'A14, et que `ICON_BUTTON_NAMES` répète : « un tracé SVG est un
 * motif très large, et trois points alignés sert ailleurs de poignée de
 * réordonnancement ».
 *
 * D'où le BORNAGE PAR ÉCRAN (`screens` côté déclaration, un fichier par maquette),
 * PAR CADRE quand les deux largeurs ne dessinent pas le même contrôle (`frames`),
 * et par CONTENEUR quand un même mot est écrit deux fois dans un cadre (`dans`).
 *
 * ── LES TROIS DISCRIMINANTS, PARCE QUE LA MAQUETTE N'EN OFFRE PAS UN SEUL ───
 *
 * Mesuré sur A01 : sur ses huit `<a href="#">`, quatre portent un texte visible
 * (« Voir mon profil public », « Continuer », « Modifier », « Voir tout »), UN
 * porte un `aria-label` que la maquette écrit elle-même (« Réglages ») et TROIS
 * n'ont NI l'un NI l'autre — leur libellé est une interpolation (`{{ r.label }}`)
 * parce qu'ils sont dans une boucle. Un mécanisme qui n'offrirait que le texte
 * visible laisserait donc trois liens sur huit hors de portée. D'où :
 *
 *   · `texte`    — le texte visible, tel que la maquette l'écrit. L'apostrophe est
 *                  la COURBE : voir l'échappement de `BUTTON_ACTIONS`.
 *   · `aria`     — l'`aria-label` que la maquette écrit déjà.
 *   · `marqueur` — un fragment VERBATIM du balisage, pour un lien qui n'a ni
 *                  texte ni `aria-label`. C'est le `marker` de `markTriggers`,
 *                  même mot, même sens.
 *
 * UN SEUL des trois par déclaration : deux discriminants pour une cible, c'est
 * deux intentions, et on ne sait plus laquelle a servi.
 *
 * ── LE GARDE-FOU EST LE COMPTE, comme pour `donnees` ────────────────────────
 *
 * `fois` (défaut 1) dit combien d'éléments le discriminant doit désigner DANS CE
 * CADRE. Si le compte ne tombe pas juste, la génération S'ARRÊTE en nommant le
 * discriminant. Une retouche du designer qui dédouble une entrée de rail ne
 * produit donc pas un écran où un lien sur deux est mort : elle produit un arrêt
 * qui le nomme. C'est le même garde-fou que `applyData.fois`, et pour la même
 * raison — un JSX faux compile parfaitement.
 *
 * ── CE QUI EST AJOUTÉ AU DESSIN, ET POURQUOI C'EST PRÉFIXÉ ──────────────────
 *
 * Un `<a>` arrive avec trois valeurs de navigateur qu'un `<span>` n'avait pas :
 * `color: -webkit-link`, `text-decoration: underline`, `cursor: pointer`. Sans
 * les neutraliser, promouvoir la balise CHANGERAIT LE DESSIN — du bleu souligné
 * dans un rail vert foncé.
 *
 * Elles sont donc PRÉFIXÉES au style de la maquette, et non suffixées comme le
 * fait `markTriggers`. La différence n'est pas cosmétique : `styleToJsx` fusionne
 * par propriété en gardant la DERNIÈRE, donc
 *
 *   · préfixé  → ce sont des DÉFAUTS, et toute déclaration de la maquette gagne.
 *                Le rail d'équipe garde son `color:#CBD5D1`, son `font-weight`,
 *                son `background` ;
 *   · suffixé  → ce sont des SURCHARGES, et c'est la maquette qui perd.
 *
 * Pour un `<a>` on veut des défauts : on remplace les valeurs du NAVIGATEUR, pas
 * celles du designer. (Le suffixe de `markTriggers` est un risque mesuré, signalé
 * au porteur : son `padding:0` écrase le `padding:0 12px` d'un `<span>` promu en
 * bouton. Il n'est pas touché ici — le modifier déplacerait des cadres qui ne
 * relèvent pas de la navigation.)
 *
 * ── NAVIGABLE AU CLAVIER, ET NOMMÉ ──────────────────────────────────────────
 *
 * `<a href="…">` est focalisable nativement : aucun `tabIndex` n'est posé, et
 * c'est bien — un `tabIndex` sur un lien réel est du bruit. Le NOM, lui, est
 * EXIGÉ : si l'élément promu n'a ni texte, ni interpolation de texte, ni
 * `aria-label`, la génération REFUSE. Un lien sans nom est annoncé par son URL au
 * lecteur d'écran, ce qui est pire qu'un bouton muet — et `markTriggers` se
 * contente ici d'un `⚠`, ce qui a laissé passer des boutons muets jusqu'à ce
 * qu'axe les trouve en `critical`. On ne refait pas cette économie.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CONSIGNE — DÉCLARER LA NAVIGATION D'UN MODULE                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Un seul module est déclaré à ce jour : le rail d'équipe, dans
 * `tools/screens/10-administration.mjs`. C'est le MODÈLE À COPIER — il montre les
 * quatre clés dans leur emploi normal. Les 58 écrans qui restent se lisent dans le
 * récapitulatif « ── NAVIGATION ── » que la génération imprime en fin de course,
 * avec le compte de liens morts de chacun.
 *
 * LA RECETTE, dans cet ordre :
 *
 *  1. RELANCER LA GÉNÉRATION et lire le récapitulatif. Il nomme l'écran et combien
 *     de liens y sont morts. C'est la seule liste à jour : ne pas la recopier
 *     ailleurs, la relire.
 *
 *  2. REGARDER LE CADRE AVANT DE CHOISIR LE DISCRIMINANT. Sur les huit liens d'A01,
 *     quatre ont un texte, un a un `aria-label` écrit par la maquette, et TROIS
 *     n'ont ni l'un ni l'autre. Ouvrir le `*.generated.tsx` et lire les `<a>` un
 *     par un prend deux minutes et évite trois allers-retours.
 *       · du texte visible      → `texte: 'Voir tout'`
 *       · un `aria-label`       → `aria: 'Réglages'`
 *       · ni l'un ni l'autre    → `marqueur: '<un fragment VERBATIM>'`
 *
 *  3. ÉCRIRE LA DESTINATION, JAMAIS LA DEVINER. Elle vient de `T5 §11` ou de
 *     `apps/web/src/app/`, et elle est propre à CE lien sur CET écran : « Voir
 *     tout » est écrit sur une dizaine d'écrans et ne mène pas deux fois au même
 *     endroit. Dans une boucle, la destination est une DONNÉE :
 *     `vers: '{{ r.href }}'` — et c'est alors au `data.ts` du module de la fournir,
 *     comme n'importe quel autre champ.
 *
 *  4. BORNER. `dans: '<nav …>'` quand le même mot est écrit deux fois dans le
 *     cadre (un rail et un titre de page, par exemple). `frames: ['Desktop']`
 *     quand les deux largeurs ne dessinent pas le même contrôle. `fois: 2` quand
 *     la maquette dessine volontairement le lien deux fois — et seulement alors :
 *     le défaut de 1 est ce qui attrape un dédoublement involontaire.
 *
 *  5. NOMMER CE QUI N'A PAS DE NOM. `nom: 'Réglages'` sur un lien en icône seule.
 *     LE NOM SE RECOPIE DE LA MAQUETTE, jamais ne s'invente : elle écrit souvent
 *     le mot ailleurs, en légende ou à côté du même tracé. C'est la discipline que
 *     `ICON_BUTTON_NAMES` a déjà écrite, avec sa clé `source`.
 *
 *  6. POSER `navigationDeclaree: true` SUR L'ÉCRAN quand il ne reste plus un seul
 *     `href="#"` dessus. C'est ce qui fait passer le garde-fou de « ⚠ » à « refus »
 *     pour cet écran : le trou ne pourra plus s'y réouvrir. NE PAS le poser avant —
 *     la génération échouerait, et pas seulement pour vous.
 *
 *  7. CLIQUER DANS UN TEST. `apps/web/e2e/navigation-rail.spec.ts` est le modèle :
 *     partir d'un écran, CLIQUER, et vérifier que l'URL a changé. Une assertion sur
 *     le `href` ne prouve rien — c'est précisément parce que tous les tests du dépôt
 *     tapaient l'URL que 207 liens morts ont tenu quinze rapports verts.
 *
 * CE QUE LA TABLE NE FERA PAS POUR VOUS, et qu'il faut remonter plutôt que combler :
 * une entrée de menu que la maquette ne dessine pas. Le rail d'équipe a NEUF
 * entrées pour QUINZE pages ; six pages ne sont atteignables par aucune. En
 * dessiner cinq de plus serait décider de la structure du menu à la place du
 * porteur. On le DIT — c'est fait dans l'en-tête de `10-administration.mjs`.
 */

/** Les balises qu'une déclaration de lien peut promouvoir, ou ré-adresser. */
const PROMOTABLE = /^<(a|button|span|div)[\s>]/;

/** Ce que le journal et les refus appellent la cible, pour qu'on la retrouve. */
const nommerLien = (lien) =>
  lien.texte !== undefined
    ? `texte « ${lien.texte} »`
    : lien.aria !== undefined
      ? `aria-label « ${lien.aria}»`
      : `marqueur « ${lien.marqueur} »`;

/**
 * Le nom accessible qu'aura l'élément promu : son texte, interpolations comprises.
 *
 * Les `<svg>` sont retirés d'abord — un tracé n'est pas un nom, et c'est la même
 * lecture que `markTriggers` fait de son contenu. Une interpolation COMPTE comme
 * un nom : `{{ r.label }}` est bien un libellé, simplement calculé.
 */
const nomAccessible = (contenu) =>
  contenu
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();

/**
 * ─── LES LIAISONS DE BOUCLE QUI ENGLOBENT UNE POSITION ──────────────────────
 *
 * Rend les noms que les `<sc-for as="…">` encore OUVERTS à `at` mettent à la
 * disposition du balisage — `['r']` pour un élément dans la boucle du rail,
 * `['p', 'o']` pour un élément dans le sondage d'une publication.
 *
 * On empile à l'ouverture, on dépile à la fermeture, et on s'arrête à `at` : ce
 * qui reste sur la pile est exactement ce qui englobe la position. Compter les
 * `<sc-for>` DEPUIS LE DÉBUT plutôt que remonter depuis `at` est ce qui rend les
 * boucles imbriquées justes — une remontée naïve prendrait le premier `as=` vu en
 * arrière, qui peut être celui d'une boucle SŒUR déjà refermée.
 */
const liaisonsEnglobantes = (html, at) => {
  const pile = [];
  const motifs = /<sc-for\b[^>]*>|<\/sc-for\s*>/g;
  for (let m = motifs.exec(html); m !== null && m.index < at; m = motifs.exec(html)) {
    if (m[0].startsWith('</')) {
      pile.pop();
      continue;
    }
    const as = /\bas="([^"]*)"/.exec(m[0]);
    pile.push(as === null ? null : as[1]);
  }
  return pile.filter((x) => x !== null && x !== '');
};

/**
 * ─── CE QUE `vers` INTERROGE, QUAND IL EST ÉCRIT EN DIALECTE ────────────────
 *
 * `'{{ r.href }}'` → `'r'`. `'/accueil'` → `null`, et il n'y a alors rien à
 * vérifier : une destination littérale ne dépend d'aucune boucle.
 */
const racineInterpolee = (vers) => {
  const m = /\{\{\s*([A-Za-z_$][\w$]*)/.exec(vers ?? '');
  return m === null ? null : m[1];
};

export function markLinks(html, liens, section = '', frameName = '') {
  let out = html;
  const applied = [];
  const ou = `${section} ${frameName}`.trim();

  for (const lien of liens ?? []) {
    const attendu = lien.fois ?? 1;
    const quoi = nommerLien(lien);

    const discriminants = ['texte', 'aria', 'marqueur'].filter((k) => lien[k] !== undefined);
    if (discriminants.length !== 1) {
      throw new Error(
        `${ou} : une déclaration de lien porte ${discriminants.length} discriminant(s) ` +
          `(${discriminants.join(', ') || 'aucun'}) ; il en faut exactement un parmi ` +
          '« texte », « aria » et « marqueur ».',
      );
    }
    if ((lien.vers === undefined) === (lien.action === undefined)) {
      throw new Error(
        `${ou} : le lien ${quoi} doit déclarer « vers » (une destination) OU « action » ` +
          '(un gestionnaire), et exactement l’un des deux.',
      );
    }

    /**
     * LA RÉGION OÙ CHERCHER — `dans`, et c'est ce qui rend un libellé répété
     * utilisable. « Référentiels » est écrit DEUX fois dans le cadre de D08 : dans
     * le rail, en 13 px, et comme TITRE DE PAGE, en 28 px. C'est le même mot ; seul
     * le conteneur les distingue. Même raison que la taille déclarée avec le titre
     * dans `tools/screens/10-administration.mjs`.
     *
     * `dans` doit figurer EXACTEMENT UNE FOIS, comme l'`anchor` d'un emprunt :
     * sinon on ne sait pas dans quelle région le lien atterrit.
     */
    let debut = 0;
    let fin = out.length;
    if (lien.dans !== undefined) {
      const fois = out.split(lien.dans).length - 1;
      if (fois !== 1) {
        throw new Error(
          `${ou} : le conteneur « ${lien.dans.slice(0, 80)}… » du lien ${quoi} figure ${fois} ` +
            'fois dans ce cadre ; il en faut exactement une.',
        );
      }
      const balise = /^<([a-zA-Z][\w-]*)/.exec(lien.dans);
      if (balise === null) {
        throw new Error(`${ou} : « dans » doit commencer par une balise ouvrante. Reçu « ${lien.dans.slice(0, 40)} ».`);
      }
      const at = out.indexOf(lien.dans);
      debut = at;
      fin = findMatchingClose(out, at + lien.dans.length, balise[1]).start;
    }

    const marqueur =
      lien.texte ?? (lien.aria !== undefined ? `aria-label="${lien.aria}"` : lien.marqueur);

    /**
     * TOUTES LES CIBLES D'ABORD, LES REMPLACEMENTS ENSUITE — et de la dernière à
     * la première.
     *
     * `markTriggers` fait glisser un curseur et recalcule les décalages à chaque
     * insertion ; ce calcul lui a déjà coûté une boucle infinie, documentée dans
     * son corps. Compter avant de toucher évite la question, et c'est AUSSI ce qui
     * rend le garde-fou possible : on ne peut pas vérifier un compte qu'on
     * découvre en modifiant.
     */
    const cibles = [];
    let from = debut;
    for (;;) {
      const at = out.indexOf(marqueur, from);
      if (at < 0 || at >= fin) break;
      from = at + marqueur.length;

      let openIdx = at;
      let tag = null;
      while (openIdx > 0) {
        openIdx = out.lastIndexOf('<', openIdx - 1);
        if (openIdx < 0) break;
        const m = PROMOTABLE.exec(out.slice(openIdx, openIdx + 10));
        if (m !== null) {
          tag = m[1];
          break;
        }
      }
      if (tag === null || openIdx < 0) continue;
      // Deux marqueurs peuvent remonter au MÊME élément : on ne le promeut qu'une
      // fois. Même garde que le `data-modal-open=` déjà posé de `markTriggers`.
      if (cibles.some((c) => c.openIdx === openIdx)) continue;
      cibles.push({ openIdx, tag });
    }

    if (cibles.length !== attendu) {
      throw new Error(
        `${ou} : le lien ${quoi} désigne ${cibles.length} élément(s) promouvable(s) dans ce ` +
          `cadre, et la déclaration en attend ${attendu}. Si la maquette a changé, mettre ` +
          '« liens » à jour dans sa déclaration d’écran ; ne jamais laisser un lien mourir en ' +
          'silence. (Préciser « dans » pour borner la recherche à un conteneur, ou « fois ».)',
      );
    }

    for (const cible of [...cibles].sort((a, b) => b.openIdx - a.openIdx)) {
      const { openIdx, tag } = cible;
      const openEnd = findTagEnd(out, openIdx) + 1;
      const openTag = out.slice(openIdx, openEnd);

      /**
       * `vers` passe EN DIALECTE, comme le `subject` d'un déclencheur : `markLinks`
       * tourne AVANT `transcode`, donc `href="{{ r.href }}"` devient
       * `href={r.href}` et s'évalue DANS la boucle, une destination par carte.
       * Écrire `{r.href}` ici donnerait la chaîne littérale.
       */
      const destination =
        lien.vers === undefined ? null : ` href="${lien.vers}"`;
      const gestionnaire =
        lien.action === undefined ? null : ` onClick="{{ ${lien.action} }}"`;

      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LA DESTINATION D'UNE BOUCLE DOIT ÊTRE LIÉE PAR CETTE BOUCLE-LÀ       ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * C'est le garde-fou PROPRE AUX BOUCLES, et il n'existait pas : les trois
       * discriminants (`texte`, `aria`, `marqueur`) distinguent un élément dans le
       * BALISAGE, et `fois` compte les cibles — mais rien ne vérifiait que
       * `vers: '{{ r.href }}'` ait un `r` à interroger À CET ENDROIT.
       *
       * LES DEUX FAÇONS DONT ÇA CASSE, et seule la première est rattrapée ailleurs :
       *
       *   · LA LIAISON N'EXISTE PAS — le designer renomme `as="r"` en `as="e"`, ou
       *     sort le lien de la boucle. Le JSX produit référence un `r` qui n'est
       *     déclaré nulle part ; `tsc` le voit (« Cannot find name 'r' »), donc le
       *     mal est borné — mais il est signalé à des centaines de lignes de la
       *     DÉCLARATION qui l'a causé, dans un fichier qu'on n'a pas le droit de
       *     corriger à la main.
       *
       *   · LA LIAISON EXISTE, MAIS CE N'EST PAS LA BONNE — et c'est le cas GRAVE,
       *     celui que rien n'attrape. Si le lien se retrouve dans une boucle
       *     IMBRIQUÉE dont la boucle extérieure s'appelle aussi `r`, ou si deux
       *     boucles sœurs emploient la même lettre, `{{ r.href }}` compile
       *     parfaitement et mène AILLEURS. Un lien qui marche et qui va au mauvais
       *     endroit est pire qu'un lien mort : le lien mort se voit.
       *
       * On exige donc que la racine de l'interpolation figure parmi les liaisons
       * ENCORE OUVERTES à l'endroit promu. C'est la même discipline que `donnees` :
       * une destination déclarée pour une entrée qui n'existe plus ARRÊTE la
       * génération en se nommant, au lieu de s'effacer en silence.
       */
      const racine = racineInterpolee(lien.vers);
      if (racine !== null) {
        const liees = liaisonsEnglobantes(out, openIdx);
        if (!liees.includes(racine)) {
          throw new Error(
            `${ou} : la destination « ${lien.vers} » du lien ${quoi} interroge « ${racine} », ` +
              `mais aucune boucle <sc-for as="${racine}"> n’englobe l’élément promu ` +
              `(liaisons ouvertes ici : ${liees.length === 0 ? 'aucune' : liees.map((l) => `« ${l} »`).join(', ')}). ` +
              'Soit la maquette a renommé son « as », soit le lien n’est plus dans la boucle. ' +
              'Mettre « vers » à jour dans sa déclaration d’écran — une destination qui ne ' +
              's’évalue pas mène AILLEURS, ce qui est pire qu’un lien mort.',
          );
        }
      }

      if (tag === 'a') {
        if (gestionnaire !== null) {
          throw new Error(
            `${ou} : le lien ${quoi} est DÉJÀ une balise <a> ; « action » n’a pas de sens ` +
              'dessus. Déclarer « vers ».',
          );
        }
        if (!openTag.includes('href="#"')) {
          throw new Error(
            `${ou} : le lien ${quoi} vise une balise <a> qui ne porte pas « href="#" » — ` +
              `« ${openTag.slice(0, 120)} ». Soit elle a déjà une destination, soit le ` +
              'discriminant désigne autre chose.',
          );
        }
        const close = findMatchingClose(out, openEnd, 'a');
        const nom = nomAccessible(out.slice(openEnd, close.start));
        const nomme = openTag.includes('aria-label=') || nom !== '';
        if (!nomme && lien.nom === undefined) {
          throw new Error(
            `${ou} : le lien ${quoi} n’a AUCUN nom accessible — ni texte, ni interpolation, ni ` +
              '`aria-label`. Un lecteur d’écran l’annoncerait par son URL. Déclarer « nom ».',
          );
        }
        const labelAttr = nomme || lien.nom === undefined ? '' : ` aria-label="${lien.nom}"`;
        // Le nom va DANS la balise ouvrante, avant son `>` : `openTag` le porte.
        const reAdresse =
          openTag.slice(0, -1).replace('href="#"', destination.trim()) + labelAttr + '>';
        out = out.slice(0, openIdx) + reAdresse + out.slice(openEnd);
        continue;
      }

      const close = findMatchingClose(out, openEnd, tag);
      const contenu = out.slice(openEnd, close.start);
      const nom = nomAccessible(contenu);
      const nomme = openTag.includes('aria-label=') || nom !== '';
      if (!nomme && lien.nom === undefined) {
        throw new Error(
          `${ou} : le ${gestionnaire === null ? 'lien' : 'bouton'} ${quoi} ne contient aucun ` +
            'texte : il serait muet au lecteur d’écran. Déclarer « nom ».',
        );
      }
      const labelAttr = nomme || lien.nom === undefined ? '' : ` aria-label="${lien.nom}"`;

      /**
       * Les valeurs du NAVIGATEUR que la promotion doit remplacer, PRÉFIXÉES au
       * style de la maquette : voir l'en-tête. Un `<button>` apporte en plus une
       * bordure et un remplissage, un `<a>` non.
       */
      const neutralise =
        gestionnaire === null
          ? 'color:inherit;text-decoration:none;cursor:pointer'
          : 'border:none;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;text-align:inherit';
      const style = /style="([^"]*)"/.exec(openTag);
      const styleAttr =
        style === null ? ` style="${neutralise}"` : ` style="${neutralise};${style[1]}"`;
      /**
       * Les autres attributs de la maquette sont gardés MOT POUR MOT : seuls le nom
       * de balise et le style changent. Un `data-modal-open` déjà posé par
       * `markTriggers` survit donc à la promotion, au lieu de disparaître en
       * silence — ce qui serait une fenêtre devenue inatteignable.
       */
      const autres = openTag
        .slice(1 + tag.length, openTag.endsWith('/>') ? -2 : -1)
        .replace(/\s*style="[^"]*"/, '')
        .replace(/\s+$/, '');

      const ouvrante =
        gestionnaire === null
          ? `<a${destination}${labelAttr}${styleAttr}${autres}>`
          : `<button type="button"${gestionnaire}${labelAttr}${styleAttr}${autres}>`;
      const fermante = gestionnaire === null ? '</a>' : '</button>';

      out =
        out.slice(0, openIdx) + ouvrante + contenu + fermante + out.slice(close.end);
    }

    applied.push({ ...lien, quoi, count: cibles.length, promus: cibles.map((c) => c.tag) });
  }

  return { html: out, applied };
}

/**
 * ─── `rail` : LES ENTRÉES DE MENU QUE LA MAQUETTE N'A PAS DESSINÉES ───────────
 *
 * `markLinks` PROMEUT ce que la maquette dessine : il transforme un `<span>` en
 * `<a>`, il adresse un `href="#"`, il ne sait RIEN AJOUTER. C'est volontaire, et
 * son en-tête le dit : « une entrée de menu que la maquette ne dessine pas […] en
 * dessiner cinq de plus serait décider de la structure du menu à la place du
 * porteur ».
 *
 * LE PORTEUR A TRANCHÉ. Verbatim : « Le rail d'équipe a 9 entrées pour 15 pages
 * c'est à corriger et pour toutes les autres ». Il veut ces pages joignables.
 * Cette clé est l'appareil de cet arbitrage — et PAS un deuxième `liens` : elle
 * n'adresse rien, elle AJOUTE des entrées, puis `markLinks` les promeut avec les
 * autres, par le chemin déjà éprouvé. Une seule mécanique de lien, toujours.
 *
 * ── CE QUE LE RELEVÉ DIT, ET IL A ÉTÉ FAIT TROIS FOIS ───────────────────────
 *
 * La surbrillance (`background:#fff` dans le `<nav>`) dit quelle rubrique la
 * maquette considère comme courante. Relevée indépendamment trois fois, avec le
 * même résultat :
 *
 *   D02 → Tableau de bord   D03 → Membres          D04 → Modération
 *   D05 → Modération        D06 → Parcours         D07 → Parcours      ← orpheline
 *   D08 → Référentiels      D09 → Contenu ← orph.  D10 → Services
 *   D11 → Contenu ← orph.   D12 → Contenu          D13 → Revenus ← orph.
 *   D14 → Revenus           D15 → Réglages         D16 → Tabl. bord ← orph.
 *
 * Cinq pages n'ont AUCUNE entrée : D07, D09, D11, D13, D16. Et pour D16 le défaut
 * est le plus trompeur du lot — le rapport d'impact s'annonce « Tableau de bord »,
 * c'est-à-dire sous le nom d'une autre page.
 *
 * AUCUN CHEMIN N'EST DESSINÉ VERS ELLES, et c'est mesuré, pas supposé : ZÉRO
 * balise `<a>` et ZÉRO `cursor:pointer` dans toute la maquette d'administration ;
 * aucun « Voir… / Ouvrir… / Gérer… / Accéder… » dans D02, D06, D12, D14. Les trois
 * occurrences lexicales sont des faux amis, ouvertes une par une : « GUIDES » dans
 * D02 est une LÉGENDE de tuile d'indicateur (10,5 px, `letter-spacing:1px`,
 * `color:#8A958F`, au-dessus de « Publiés 386 / À vérifier 22 ») ; « Arnaque (1) »
 * dans D05 est une ventilation de motifs de signalement ; « GUIDE LIÉ » dans D07
 * est une étiquette de champ. Il n'y a donc RIEN à promouvoir : il faut ajouter.
 *
 * ── CE QUI EST RECOPIÉ, ET CE QUI EST DÉDUIT ────────────────────────────────
 *
 * RECOPIÉ — tout le dessin. Une entrée ajoutée est le CLONE VERBATIM de son
 * parent, celui que le designer a lui-même désigné par la surbrillance : même
 * balise, même `height:42px`, même `padding:0 12px`, même `border-radius:12px`,
 * même `font-size:13px`, mêmes hexadécimaux. AUCUNE valeur n'est écrite ici — pas
 * un pixel, pas un `#`. Si la maquette change sa géométrie de rail, les entrées
 * ajoutées changent avec elle, sans qu'on y revienne.
 *
 * RECOPIÉ — le libellé, pris dans le `data-screen-label` de la planche :
 * « Bibliothèque d'étapes », « Guides », « Alertes arnaques », « Partenaires »,
 * « Rapport d'impact ». Aucun mot inventé.
 *
 * DÉDUIT, et il faut le dire — L'ICÔNE. Aucun tracé de cette maquette ne
 * représente ces cinq rubriques : hors rail, les cinq planches orphelines ne
 * dessinent que le logo, une loupe « Rechercher », un `+` (« Nouvelle étape »,
 * « Nouvelle alerte ») et une flèche de téléchargement — des icônes d'ACTION.
 * Reprendre le `+` pour « Bibliothèque d'étapes » ferait dire « ajouter » à une
 * entrée de menu. Le clone reprend donc le tracé DU PARENT, et deux entrées
 * partagent alors une icône. C'est une DÉDUCTION, pas un relevé : elle est
 * remontée au porteur plutôt que maquillée.
 *
 * ── PAS DE RETRAIT, PAS DE GROUPEMENT : L'ORDRE PORTE LA HIÉRARCHIE ─────────
 *
 * Un rail PLAT de quatorze entrées, chaque enfant immédiatement APRÈS son parent.
 * L'ordre relatif des neuf entrées d'origine est préservé ; on n'insère que cinq.
 * Un retrait aurait exigé d'INVENTER une valeur — `padding:0 12px` est le seul
 * remplissage que la maquette donne au rail — et un groupement aurait exigé un
 * titre de section, donc un texte d'interface que la maquette n'écrit pas.
 *
 * ── LES DEUX STYLES SONT LUS DANS LE NAV, PAS ÉCRITS ICI ────────────────────
 *
 * Déplacer la surbrillance demande de connaître le style « au repos » et le style
 * « actif ». Les écrire ici serait recopier six hexadécimaux à la main, donc les
 * laisser dériver. Ils sont DÉDUITS DE LA STRUCTURE : le `<nav>` d'une planche
 * porte EXACTEMENT DEUX styles distincts, et celui que porte UNE SEULE entrée est
 * l'actif. Vérifié sur les quinze planches — un style de repos, un style d'actif,
 * à l'octet près. Si la maquette cesse d'être ainsi, la génération S'ARRÊTE au
 * lieu de peindre au hasard.
 *
 * ── `aria-current="page"`, ET POURQUOI IL DEVIENT LÉGITIME ──────────────────
 *
 * L'en-tête de `10-administration.mjs` refusait de le poser, et avait raison : le
 * déduire du style aurait été « un SECOND mécanisme, qui lirait du dessin pour en
 * tirer un état ». Ce n'est plus le cas — la page courante est maintenant
 * DÉCLARÉE (`actif`), planche par planche, et c'est cette déclaration qui peint.
 * Poser l'attribut ne lit donc plus le dessin : il écrit la même déclaration dans
 * l'arbre d'accessibilité. Il survit à la promotion de `markLinks`, qui garde les
 * attributs de la maquette mot pour mot.
 *
 * C'est aussi ce qui rend la preuve TESTABLE sans toucher au style : un test qui
 * lirait `background:#fff` testerait le dessin ; `[aria-current="page"]` teste
 * l'état annoncé.
 *
 * ── CE QUE CETTE CLÉ NE FAIT PAS ────────────────────────────────────────────
 *
 * Elle n'adresse AUCUN lien : les quatorze destinations restent déclarées dans
 * `liens`, et c'est `markLinks` qui promeut les quatorze `<span>` — les neuf
 * dessinés et les cinq ajoutés — par le même chemin. Son garde-fou `fois: 1` est
 * donc AUSSI le contrôle de cette clé : si une injection échouait, ou doublait une
 * entrée, `markLinks` arrêterait la génération en nommant le libellé.
 */

/** Le libellé visible d'une entrée de rail : son texte, icône retirée. */
const libelleEntree = (entree) => nomAccessible(entree.contenu);

/** Le style en ligne d'une entrée, tel que la maquette l'écrit. */
const styleEntree = (entree) => {
  const m = /style="([^"]*)"/.exec(entree.ouvrante);
  return m === null ? null : m[1];
};

/**
 * Les entrées de premier rang d'un conteneur, découpées STRUCTURELLEMENT.
 *
 * `dans` doit figurer exactement une fois, même exigence et même raison que pour
 * `markLinks` : sinon on ne sait pas dans quelle région on écrit.
 */
function lireEntrees(html, dans, ou) {
  const fois = html.split(dans).length - 1;
  if (fois !== 1) {
    throw new Error(
      `${ou} : le conteneur de rail « ${dans.slice(0, 80)}… » figure ${fois} fois dans ce ` +
        'cadre ; il en faut exactement une.',
    );
  }
  const balise = /^<([a-zA-Z][\w-]*)/.exec(dans);
  if (balise === null) {
    throw new Error(
      `${ou} : « dans » doit commencer par une balise ouvrante. Reçu « ${dans.slice(0, 40)} ».`,
    );
  }
  const at = html.indexOf(dans);
  const debut = at + dans.length;
  const fin = findMatchingClose(html, debut, balise[1]).start;

  const entrees = [];
  let i = debut;
  while (i < fin) {
    if (html[i] !== '<') {
      // Du texte nu entre deux entrées : la maquette n'en écrit pas, et s'y mettre
      // changerait ce découpage. On refuse plutôt que de l'ignorer.
      const reste = html.slice(i, fin).trim();
      if (reste === '') break;
      throw new Error(
        `${ou} : le rail contient du texte hors entrée — « ${reste.slice(0, 40)} ». ` +
          'Le découpage des entrées ne vaut plus ; relire la maquette.',
      );
    }
    const tag = /^<([a-zA-Z][\w-]*)/.exec(html.slice(i, i + 20));
    if (tag === null) {
      throw new Error(`${ou} : balise illisible dans le rail — « ${html.slice(i, i + 40)} ».`);
    }
    const openEnd = findTagEnd(html, i) + 1;
    const close = findMatchingClose(html, openEnd, tag[1]);
    entrees.push({
      openIdx: i,
      openEnd,
      closeStart: close.start,
      closeEnd: close.end,
      tag: tag[1],
      ouvrante: html.slice(i, openEnd),
      contenu: html.slice(openEnd, close.start),
      fermante: html.slice(close.start, close.end),
    });
    i = close.end;
  }
  return { debut, fin, entrees };
}

/**
 * Ajoute au rail les entrées que la maquette ne dessine pas, et déplace la
 * surbrillance sur celle de la page courante.
 *
 * Rend le compte de ce qui a été fait, pour que l'appelant l'inscrive dans le
 * journal — un ajout silencieux serait exactement ce qu'on cherche à éviter.
 */
export function completerRail(html, rail, section = '', frameName = '') {
  if (rail === undefined || rail === null) {
    return { html, ajoutees: [], actif: null, entrees: 0 };
  }
  const ou = `${section} ${frameName}`.trim();

  if (rail.dans === undefined || rail.actif === undefined) {
    throw new Error(
      `${ou} : « rail » doit déclarer « dans » (le conteneur) ET « actif » (la page courante).`,
    );
  }

  /**
   * LES DEUX STYLES, LUS AVANT TOUTE MODIFICATION. Après injection il y aurait
   * deux entrées au style actif — celle de la maquette et le clone de son parent —
   * et « l'actif est celui que porte une seule entrée » ne tiendrait plus.
   */
  const avant = lireEntrees(html, rail.dans, ou);
  const parStyle = new Map();
  for (const e of avant.entrees) {
    const s = styleEntree(e);
    if (s === null) {
      throw new Error(
        `${ou} : une entrée de rail n’a pas de style en ligne — « ${e.ouvrante.slice(0, 60)} ».`,
      );
    }
    parStyle.set(s, (parStyle.get(s) ?? 0) + 1);
  }
  if (parStyle.size !== 2) {
    throw new Error(
      `${ou} : le rail porte ${parStyle.size} style(s) distinct(s) ; il en faut exactement deux — ` +
        'le repos et la surbrillance. La maquette a changé : relire son <nav> avant de régénérer.',
    );
  }
  const actifTrouve = [...parStyle].find(([, n]) => n === 1);
  if (actifTrouve === undefined) {
    throw new Error(
      `${ou} : aucun des deux styles du rail n’est porté par UNE SEULE entrée ; on ne sait pas ` +
        'laquelle la maquette met en surbrillance.',
    );
  }
  const styleActif = actifTrouve[0];
  const styleRepos = [...parStyle].find(([s]) => s !== styleActif)[0];

  // ── 1. L'INJECTION, une entrée à la fois, le rail relu à chaque tour ───────
  let out = html;
  const ajoutees = [];
  for (const ajout of rail.ajoutees ?? []) {
    if (ajout.apres === undefined || ajout.libelle === undefined) {
      throw new Error(
        `${ou} : un ajout de rail doit déclarer « apres » (l’entrée parente) ET « libelle ».`,
      );
    }
    const { entrees } = lireEntrees(out, rail.dans, ou);

    const deja = entrees.filter((e) => libelleEntree(e) === ajout.libelle);
    if (deja.length !== 0) {
      throw new Error(
        `${ou} : le rail dessine DÉJÀ une entrée « ${ajout.libelle} » (${deja.length}). ` +
          'La maquette a comblé le manque : retirer cet ajout et la déclarer dans « liens ».',
      );
    }
    const parents = entrees.filter((e) => libelleEntree(e) === ajout.apres);
    if (parents.length !== 1) {
      throw new Error(
        `${ou} : l’entrée parente « ${ajout.apres} » de l’ajout « ${ajout.libelle} » figure ` +
          `${parents.length} fois dans le rail ; il en faut exactement une.`,
      );
    }
    const parent = parents[0];

    /**
     * LE CLONE : la balise du parent, son icône, et le libellé de la page ajoutée.
     * Le parent est « icône puis texte » — on l'EXIGE plutôt que de le supposer,
     * sinon un changement de maquette produirait une entrée au libellé collé à
     * autre chose, ce qui compile parfaitement.
     */
    const coupe = parent.contenu.lastIndexOf('</svg>');
    if (coupe < 0) {
      throw new Error(
        `${ou} : l’entrée parente « ${ajout.apres} » ne dessine aucune icône ; le clone ne ` +
          'saurait pas où s’arrête le tracé et où commence le libellé.',
      );
    }
    const apresIcone = parent.contenu.slice(coupe + '</svg>'.length);
    if (apresIcone !== ajout.apres) {
      throw new Error(
        `${ou} : l’entrée parente « ${ajout.apres} » n’est pas « icône puis texte » — après son ` +
          `</svg> vient « ${apresIcone.slice(0, 40)} ». Relire la maquette.`,
      );
    }

    const clone =
      parent.ouvrante.replace(/style="[^"]*"/, `style="${styleRepos}"`) +
      parent.contenu.slice(0, coupe + '</svg>'.length) +
      ajout.libelle +
      parent.fermante;

    out = out.slice(0, parent.closeEnd) + clone + out.slice(parent.closeEnd);
    ajoutees.push({ libelle: ajout.libelle, apres: ajout.apres, pourquoi: ajout.pourquoi });
  }

  // ── 2. LA SURBRILLANCE, DÉCLARÉE et non plus seulement peinte ──────────────
  const apres = lireEntrees(out, rail.dans, ou);
  const vises = apres.entrees.filter((e) => libelleEntree(e) === rail.actif);
  if (vises.length !== 1) {
    throw new Error(
      `${ou} : la page courante déclarée « ${rail.actif} » désigne ${vises.length} entrée(s) du ` +
        'rail ; il en faut exactement une. Vérifier le libellé, ou l’ajout qui devait la créer.',
    );
  }

  // De la DERNIÈRE à la PREMIÈRE : les décalages des précédentes restent justes.
  for (const e of [...apres.entrees].sort((a, b) => b.openIdx - a.openIdx)) {
    const estActive = libelleEntree(e) === rail.actif;
    const style = estActive ? styleActif : styleRepos;
    let ouvrante = e.ouvrante.replace(/style="[^"]*"/, `style="${style}"`);
    // L'état courant est DÉCLARÉ : l'annoncer n'est plus lire le dessin.
    ouvrante = ouvrante.replace(/\s*aria-current="[^"]*"/, '');
    if (estActive) ouvrante = `${ouvrante.slice(0, -1)} aria-current="page">`;
    out = out.slice(0, e.openIdx) + ouvrante + out.slice(e.openEnd);
  }

  return { html: out, ajoutees, actif: rail.actif, entrees: apres.entrees.length };
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
  /**
   * LE VOILE, QUAND LA SECTION N'EN DESSINE AUCUN.
   *
   * `04 Parcours` s'en tirait : ses fenêtres d'ordinateur sont des cartes nues,
   * mais ses planches MOBILES dessinent le voile, dans la même section, et
   * `adaptModalFrame` le leur emprunte.
   *
   * `08 Compte` ne le peut pas : ses trois fenêtres — « Ajouter aux contacts »,
   * « Payer avec Mobile Money », « Supprimer mon compte » — n'ont AUCUNE planche
   * mobile, et le fichier entier ne contient pas un seul `inset:0` translucide.
   * Compté : zéro. Sans voile, `Modal` reçoit un panneau seul — un clic hors du
   * panneau ne ferme plus rien, et le générateur le dit déjà (« 0 voile et
   * 1 panneau »). Le membre à la souris se retrouve devant une fenêtre qui ne se
   * ferme qu'à Échap ou à la croix.
   *
   * La valeur n'est PAS inventée : c'est celle des quatre fenêtres d'A01C, A01G,
   * A01P et A01S — les mêmes planches dont le centrage est déjà recopié
   * ci-dessus. Elles écrivent toutes les quatre `rgba(22,33,29,.55)`, et
   * `04 Parcours` n'en écrit pas d'autre non plus. Un voile et un centrage venus
   * du même objet restent un objet ; en mélanger deux sources serait recomposer
   * une fenêtre qui n'existe nulle part.
   *
   * Le générateur vérifie que ce motif figure encore dans la maquette d'origine
   * et refuse de produire sinon — même discipline que pour le centrage.
   */
  veil: '<div style="position:absolute;inset:0;background:rgba(22,33,29,.55)">',
};

/** Le voile d'une modale, reconnu à sa géométrie et à son fond translucide. */
const VEIL_RE = /<div style="position:absolute;inset:0;background:rgba\([^"]*"[^>]*>/;

const MODAL_VEIL_FALLBACK = MODAL_WINDOW_SOURCE.veil;

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
  /** D'où vient le voile : « section » s'il est dessiné là, « source » s'il est emprunté. */
  let veilFrom = null;

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

    /**
     * Le voile vient de la SECTION quand elle en dessine un, de la maquette source
     * sinon. `veilFrom` dit lequel, pour que le journal le dise aussi : un emprunt
     * hors maquette est une liberté, et une liberté se lit.
     *
     * Sans ce repli, une maquette qui ne dessine AUCUN voile — `08 Compte` n'en a
     * pas un seul — produisait une fenêtre sans voile : un clic à côté ne fermait
     * rien, et le journal disait « 0 voile et 1 panneau » sans que personne ne le
     * lise. Trois fenêtres du module étaient dans ce cas.
     */
    const borrowed = veil === null ? MODAL_VEIL_FALLBACK : veil[0];
    veilFrom = veil === null ? 'source' : 'section';
    const head =
      borrowed.replace('position:absolute', 'position:fixed').replace(/>$/, ' data-modal-overlay="">') +
      '</div>';
    overlays += 1;
    fixed += 1;
    borrowedVeil = true;

    const closed = markClosers(`${head}${panelTag}${inner}</div>`);
    return { inner: closed.html, ghosts, fixed, overlays, panels, scenery, borrowedVeil, veilFrom, closers: closed.closers };
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
/** Un fragment de style est une chaîne littérale : ses `.` et `(` ne sont pas du motif. */
const escapeForRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * UNE PLANCHE EST DÉSIGNÉE PAR LA LARGEUR QU'ELLE DÉCLARE — jamais par la place de
 * cette déclaration dans son style.
 *
 * Le motif était ANCRÉ sur le début du style : il ne reconnaissait qu'un `<div>`
 * dont le style COMMENCE par `width:`. Deux conséquences, toutes deux mesurées :
 *
 *   · les trois planches d'ordinateur de la fenêtre « Contribuer » de A12T écrivent
 *     `position:relative;width:760px;…` — leur voile et leur panneau se calent sur
 *     elles. Elles étaient INTROUVABLES, et sans erreur : silencieusement absentes
 *     de l'inventaire. DEUX lots successifs les ont manquées ; un troisième les a
 *     retrouvées en refaisant son audit sans ancrage. Un contournement les a
 *     rendues joignables en déclarant le préfixe (`stylePrefix`), c'est-à-dire en
 *     déclarant LA FORME de leur style — la planche restait désignée par la façon
 *     dont elle est écrite, pas par ce qu'elle est ;
 *
 *   · la largeur ne pouvait être qu'un NOMBRE DE PIXELS. La carte utile du composeur
 *     de `03 Accueil` est un `<div style="width:100%…">` : aucune valeur de
 *     `width` ne pouvait la désigner, donc elle était intranscodable.
 *
 * CE QUI IDENTIFIE UNE PLANCHE ICI, désormais :
 *
 *   · `width` — la largeur qu'elle DÉCLARE. Un nombre vaut des pixels (`760` →
 *     `760px`) ; une chaîne est prise telle quelle, ce qui rend `'100%'` et toute
 *     autre valeur CSS exprimables. La déclaration est reconnue où qu'elle soit
 *     dans le style, mais elle doit bien être une DÉCLARATION : `width:` ouvre le
 *     style ou suit un `;`. C'est ce qui empêche le motif d'attraper `min-width:` ou
 *     `max-width:`, et c'est la seule part de l'ancrage qui servait vraiment à
 *     quelque chose.
 *
 *   · `requires` — un fragment de style que la planche doit AUSSI porter. C'est le
 *     discriminant, et il a le même rôle que celui d'un titre : distinguer la
 *     planche d'un élément qui lui ressemble. Relâcher l'ancrage fait apparaître un
 *     second candidat de 390 px dans J01M — une colonne de mise en page qui porte
 *     l'étiquette de planche « MOBILE · FEUILLE “MES PARCOURS” » ET le téléphone,
 *     et qui déclare sa largeur au milieu de son style. `height:844px` dit que c'est
 *     le TÉLÉPHONE qu'on veut, ce qu'un `occurrence: 1` n'aurait pas dit — et ce
 *     qu'une planche insérée avant n'invalidera pas.
 *
 * `occurrence` reste : une section peut montrer DEUX planches de même largeur, et
 * O05 présente ainsi ses deux atterrissages en 700 px. Sans lui, les deux variantes
 * seraient transcodées à l'identique, et l'erreur passerait inaperçue — le fichier
 * produit compile parfaitement.
 *
 * LA RENUMÉROTATION A ÉTÉ MESURÉE, pas supposée : sur les 248 sélections déclarées,
 * 247 désignent exactement la même planche qu'avant, et une seule — J01M en 390 px —
 * voit un candidat apparaître devant elle. Elle porte donc son discriminant.
 */
export function extractFrame(sectionHtml, width, occurrence = 0, requires = '') {
  const value = typeof width === 'number' ? `${width}px` : width;
  const re = new RegExp(`<div style="(?:[^"]*;)?width:${escapeForRe(value)}[^"]*"[^>]*>`, 'g');
  let m = null;
  for (let seen = -1; seen < occurrence; ) {
    m = re.exec(sectionHtml);
    if (m === null) {
      throw new Error(
        `Cadre de ${value} n° ${occurrence + 1} introuvable` +
          (requires === '' ? '' : ` (style portant « ${requires} »)`),
      );
    }
    if (requires === '' || m[0].includes(requires)) seen += 1;
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
