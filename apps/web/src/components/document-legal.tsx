'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { StaticPagePublic } from '@app/shared';
import { CorpsMarkdown, sectionsDe } from './markdown-legal';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — P03 · LE DOCUMENT LÉGAL, SERVI PAR L'API (15 §4.1, 01 §2.10)        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche P03 de la maquette est « Politique de confidentialité · Version 3 · En
 * vigueur depuis le 1er septembre 2026 », transcodée en dur — alors que la base disait
 * version 0 et que `/p/cgu` répondait 404. Ce composant en garde le DESSIN (sommaire de
 * 220 px, carte de 760 px, pastilles « Version » et « En vigueur depuis », titre à 32 px,
 * pied « Dernière mise à jour ») et en tire tout le CONTENU de `GET /pages/:slug` :
 *
 *   · le titre, le corps (Markdown restreint, voir `markdown-legal.tsx`) ;
 *   · la version — celle que `consents.version` référence ;
 *   · la date d'entrée en vigueur (`publishedAt`) ;
 *   · le sommaire, calculé sur les titres `## ` — chaque entrée a une ANCRE réelle (la
 *     maquette écrivait cinq `href="#"` qui ne visaient rien).
 *
 * Le fournisseur reçoit la page déjà lue côté serveur (`app/(onboarding)/p/[slug]`) : le
 * texte part dans la première réponse HTML, et un slug inconnu y rend un vrai 404.
 *
 * MOBILE (la maquette ne dessine que 1 440 px) : le sommaire passe AU-DESSUS du document,
 * en rangée défilante ; la carte prend toute la largeur, avec un retrait réduit.
 */

const Ctx = createContext<StaticPagePublic | null>(null);

export function FournisseurPageLegale({ page, children }: { readonly page: StaticPagePublic; readonly children: ReactNode }) {
  return <Ctx.Provider value={page}>{children}</Ctx.Provider>;
}

const date = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

export function DocumentLegal() {
  const page = useContext(Ctx);
  if (page === null) return null;
  const sections = sectionsDe(page.body);
  const enVigueur = date(page.publishedAt).replace(/^1 /, '1er ');

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 px-4 py-6 lg:flex-row lg:gap-12 lg:px-10 lg:py-12">
      {sections.length === 0 ? null : (
        <nav aria-label="Sommaire" className="flex flex-row gap-1 overflow-x-auto lg:sticky lg:top-0 lg:w-[220px] lg:flex-none lg:flex-col lg:self-start lg:overflow-visible">
          <div className="hidden px-3 pb-2.5 text-[11px] font-bold tracking-[1px] text-[#8A958F] lg:block">SOMMAIRE</div>
          {sections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex h-10 flex-none items-center whitespace-nowrap rounded-xl px-3 text-[13.5px]"
              style={{ fontWeight: i === 0 ? 700 : 500, background: i === 0 ? '#E3F0EB' : 'transparent', color: i === 0 ? '#0F5C48' : '#5D6B66' }}
            >
              {s.titre}
            </a>
          ))}
        </nav>
      )}
      <article className="w-full rounded-[22px] border border-[#E6EBE9] bg-white px-5 py-6 lg:w-[760px] lg:px-12 lg:py-10">
        <div className="flex flex-wrap gap-2">
          <span style={{ background: '#E3F0EB', color: '#0F5C48', fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '999px' }}>Version {page.version}</span>
          <span style={{ background: '#F2F5F4', color: '#5D6B66', fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '999px' }}>En vigueur depuis le {enVigueur}</span>
        </div>
        <h1 style={{ margin: '18px 0 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>{page.title}</h1>
        <CorpsMarkdown corps={page.body} />
        <div style={{ marginTop: '40px', paddingTop: '18px', borderTop: '1px solid #EAEEEC', fontSize: '12.5px', color: '#8A958F' }}>Dernière mise à jour le {enVigueur}</div>
      </article>
    </div>
  );
}
