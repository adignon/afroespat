'use client';

/**
 * L'ERREUR DU LAYOUT RACINE — quand même `app/error.tsx` ne peut pas s'afficher.
 *
 * Elle remplace le document entier : elle porte ses propres `<html>` et `<body>`, et ne
 * dépend ni des polices du layout ni de composants partagés (styles en ligne).
 */
export default function ErreurGlobale({ reset }: { readonly error: Error; readonly reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: '#F6F8F7', color: '#16211D', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          <section role="alert" style={{ maxWidth: '460px', background: '#fff', border: '1px solid #E6EBE9', borderRadius: '22px', padding: '32px 28px' }}>
            <h1 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 800 }}>DiasporyPlus n’a pas pu s’afficher</h1>
            <p style={{ margin: '0 0 20px', fontSize: '14.5px', lineHeight: 1.6, color: '#5D6B66' }}>
              Un problème est survenu. Vos données n’ont pas été modifiées. Réessayez, ou revenez à l’accueil.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={reset}
                style={{ minHeight: '44px', padding: '0 20px', borderRadius: '14px', border: 'none', background: '#16785E', color: '#fff', font: 'inherit', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                Réessayer
              </button>
              <a
                href="/accueil"
                style={{ minHeight: '44px', padding: '0 20px', borderRadius: '14px', background: '#EEF2F0', color: '#16211D', fontSize: '14px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                Retour à l’accueil
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
