import Link from 'next/link';

/**
 * L'ÉTAT D'UNE PAGE LÉGALE QUE LE PORTEUR N'A PAS ENCORE PUBLIÉE.
 *
 * `/p/cgu`, `/p/confidentialite`, `/p/cookies` et `/p/mentions-legales` sont des adresses que le produit annonce (pied de
 * page, inscription) : un 404 y ferait croire à un lien cassé. Tant qu'aucune version n'est en vigueur, la page le dit
 * simplement — sans inventer le moindre texte juridique (D12 : le contenu est rédigé et publié depuis l'administration).
 * Elle est `noindex` (voir `generateMetadata`) et absente du plan du site.
 */
export function BientotDisponible({ titre }: { readonly titre: string }) {
  return (
    <main
      id="contenu"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#FBFCFB', color: '#16211D' }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px' }}>{titre}</h1>
        <p role="status" style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#5D6B66' }}>
          Cette page sera bientôt disponible.
        </p>
        <Link
          href="/"
          style={{ marginTop: 8, height: 48, padding: '0 22px', borderRadius: 999, background: '#16785E', color: '#fff', fontSize: 14.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
