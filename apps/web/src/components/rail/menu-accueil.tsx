import Link from 'next/link';
import { ENTREES_ACCUEIL } from './entrees-accueil';

/**
 * LES ENTRÉES DE LA CARTE « ACCUEIL » DES PAGES MESSAGES ET NOTIFICATIONS.
 *
 * La maquette de ces pages dessinait l'ancienne liste de SIX entrées, en `<span>` :
 * rien ne s'y cliquait, et un « 12 » était écrit en dur sur « Fil d'entraide ».
 * Elles prennent la liste de l'accueil (`entrees-accueil.ts`) — quatre entrées,
 * de vrais liens — avec le dessin de la maquette : rangées de 44 px, retrait
 * `0 12px`, rayon 14, tracé de 17 px, 13,5 px. Aucune n'est « active » : ces pages
 * ne sont pas des entrées du menu.
 *
 * AJOUT : la maquette ne dessine pas de liens ici. L'espace de 2 px entre les
 * rangées est celui du panneau de l'accueil, pour que les deux se superposent.
 */
export function MenuAccueil() {
  return (
    <div data-menu-accueil="" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {ENTREES_ACCUEIL.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          style={{
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '0 12px',
            borderRadius: '14px',
            background: 'transparent',
            color: '#16211D',
            fontWeight: 500,
            fontSize: '13.5px',
            textDecoration: 'none',
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={e.trace} />
          </svg>
          <span style={{ flex: 1 }}>{e.libelle}</span>
        </Link>
      ))}
    </div>
  );
}
