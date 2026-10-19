import type { CSSProperties, ReactNode } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LE MARKDOWN RESTREINT DES PAGES STATIQUES (15 §4.1)                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les pages (`cgu`, `confidentialite`, `cookies`, `mentions-legales`…) sont écrites en
 * Markdown par l'équipe et lues par tous : ce rendu est donc volontairement PETIT et
 * SÛR — aucun HTML n'est jamais interprété, tout texte passe par React (échappé). Il
 * comprend : titres `## `, paragraphes, listes `- `, citations `> ` (l'encart
 * « BROUILLON »), `**gras**` et liens `[texte](url)` (http, https, ou chemin du site).
 *
 * Les styles sont ceux du document P03 de la maquette : titre de section 19 px / 700,
 * paragraphe 15 px / 1,7, liste 15 px / 1,8 ; le titre reçoit un `id` (ancre du
 * sommaire) dérivé de son texte.
 */

export interface Section {
  readonly id: string;
  readonly titre: string;
}

export function ancre(titre: string): string {
  return titre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Les sections (titres `## `) d'un corps — de quoi bâtir le sommaire. */
export function sectionsDe(corps: string): readonly Section[] {
  return corps
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim())
    .map((titre) => ({ id: ancre(titre), titre }));
}

const LIEN_SUR = /^(https?:\/\/|\/(?!\/)|#)/;

function enLigne(texte: string, cle: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let dernier = 0;
  let n = 0;
  for (let m = re.exec(texte); m !== null; m = re.exec(texte)) {
    if (m.index > dernier) out.push(texte.slice(dernier, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${cle}-${n}`}>{m[1]}</strong>);
    else if (m[2] !== undefined && m[3] !== undefined) {
      out.push(
        LIEN_SUR.test(m[3]) ? (
          <a key={`${cle}-${n}`} href={m[3]} style={{ fontWeight: 700, textDecoration: 'underline' }}>
            {m[2]}
          </a>
        ) : (
          m[2]
        ),
      );
    }
    n += 1;
    dernier = m.index + m[0].length;
  }
  if (dernier < texte.length) out.push(texte.slice(dernier));
  return out;
}

const P: CSSProperties = { margin: '10px 0 0', fontSize: '15px', lineHeight: 1.7 };

export function CorpsMarkdown({ corps }: { readonly corps: string }) {
  const blocs = corps.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <>
      {blocs.map((bloc, i) => {
        const b = bloc.trim();
        if (b === '') return null;
        if (b.startsWith('## ')) {
          const titre = b.slice(3).split('\n')[0] ?? '';
          const reste = b.split('\n').slice(1).join('\n').trim();
          return (
            <div key={i}>
              <h2 id={ancre(titre)} style={{ margin: i === 0 ? '24px 0 0' : '32px 0 0', fontSize: '19px', fontWeight: 700, letterSpacing: '-0.3px', scrollMarginTop: '24px' }}>
                {titre}
              </h2>
              {reste === '' ? null : <p style={P}>{enLigne(reste, `h${i}`)}</p>}
            </div>
          );
        }
        if (b.split('\n').every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} style={{ margin: '12px 0 0', paddingLeft: '20px', fontSize: '15px', lineHeight: 1.8 }}>
              {b.split('\n').map((l, j) => (
                <li key={j}>{enLigne(l.slice(2), `l${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.startsWith('>')) {
          return (
            <div key={i} role="note" style={{ margin: '16px 0 0', background: '#FBE3D4', color: '#B4581F', borderRadius: '14px', padding: '12px 16px', fontSize: '13.5px', fontWeight: 600, lineHeight: 1.6 }}>
              {enLigne(b.split('\n').map((l) => l.replace(/^>\s?/, '')).join(' '), `q${i}`)}
            </div>
          );
        }
        return (
          <p key={i} style={P}>
            {enLigne(b.replace(/\n/g, ' '), `p${i}`)}
          </p>
        );
      })}
    </>
  );
}
