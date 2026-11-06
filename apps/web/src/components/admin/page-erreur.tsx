'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarreAdmin } from './barre-admin';
import { RailAdmin } from './rail-admin';
import { C } from './ui';

/**
 * UNE PAGE D'ERREUR SOBRE POUR L'ADMINISTRATION — introuvable, ou plantage d'un écran.
 *
 * Elle rejoue la coque des écrans (rail, barre haute, colonne de contenu : mêmes repères `data-admin-*`, donc le
 * même repli responsive) parce que le rail n'est pas dans le layout mais dans chaque écran : sans cela, une adresse
 * inconnue laisserait la personne sans menu. Elle dit trois choses : ce qui s'est passé, que rien n'est perdu, où
 * aller. Jamais « Oups » ; jamais de trace technique à l'écran.
 */
export function PageErreur({ titre, children, action }: { readonly titre: string; readonly children: ReactNode; readonly action?: ReactNode }) {
  return (
    <div data-frame="desktop" style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', background: C.fond }}>
      <RailAdmin />
      <main id="contenu-admin" tabIndex={-1} data-admin-main="" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '0 24px 24px 0' }}>
        <BarreAdmin />
        <section role="alert" style={{ maxWidth: '520px', padding: '40px 8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.8px' }}>{titre}</h1>
          <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: C.gris }}>{children}</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
            {action}
            <Link
              href="/admin"
              className="admin-bouton"
              style={{ height: '44px', padding: '0 18px', borderRadius: '14px', background: C.aplat, color: C.encre, fontSize: '13.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              Retour au tableau de bord
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
