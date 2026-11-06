import type { ReactNode } from 'react';

/**
 * LA PAGE D'ERREUR DU MEMBRE — « introuvable », « une erreur est survenue ».
 *
 * Même rôle que `components/admin/page-erreur` pour l'équipe, au dessin de l'application
 * membre : fond `#F6F8F7`, carte blanche, vert de la maquette. Jamais de rouge (garde-fou
 * couleurs) : un échec se dit par les mots, pas par la teinte.
 *
 * Aucun lien ne dépend de Next ici (`<a>`), pour que la même page serve aussi là où le
 * routeur n'existe plus.
 */
const BOUTON: React.CSSProperties = {
  minHeight: '44px',
  padding: '0 20px',
  borderRadius: '14px',
  font: 'inherit',
  fontSize: '14px',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  border: 'none',
};

export function PageErreurMembre({
  titre,
  children,
  onReessayer,
}: {
  readonly titre: string;
  readonly children: ReactNode;
  /** Présent : un bouton « Réessayer » s'ajoute au lien vers l'accueil. */
  readonly onReessayer?: () => void;
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F6F8F7',
        color: '#16211D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'inherit',
      }}
    >
      <section
        role="alert"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#fff',
          border: '1px solid #E6EBE9',
          borderRadius: '22px',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.6px' }}>{titre}</h1>
        <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: '#5D6B66' }}>{children}</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
          {onReessayer === undefined ? null : (
            <button type="button" onClick={onReessayer} style={{ ...BOUTON, background: '#16785E', color: '#fff' }}>
              Réessayer
            </button>
          )}
          <a
            href="/accueil"
            style={{
              ...BOUTON,
              background: onReessayer === undefined ? '#16785E' : '#EEF2F0',
              color: onReessayer === undefined ? '#fff' : '#16211D',
            }}
          >
            Retour à l’accueil
          </a>
        </div>
      </section>
    </main>
  );
}
