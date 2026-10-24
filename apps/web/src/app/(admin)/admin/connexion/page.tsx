import { ScreenFrames } from '@/screens/frames';
import { D01Identifiants } from '@/screens/d01/identifiants.generated';

/**
 * D01 — la connexion d'équipe. `/admin/connexion` (15 §2.1, T5 D01).
 *
 * UNE SEULE CARTE, TROIS ÉTATS. La maquette dessine trois cartes côte à côte
 * (« 1 · IDENTIFIANTS », « 2 · CODE TOTP », « ENRÔLEMENT FORCÉ ») ; ce sont des ÉTATS
 * du même écran, et `ConnexionEquipe` (posée dans la carte par l'adaptation
 * `ADMIN_CONNEXION`) les parcourt dans l'ordre que le serveur impose : mot de passe,
 * puis code TOTP — ou enrôlement si le compte n'a pas encore d'application
 * d'authentification. Le paramètre `?etape=` n'existe plus : un état de connexion ne
 * s'adresse pas par l'URL, et un lien direct vers « code TOTP » n'aurait pas de défi.
 *
 * Les deux autres planches générées (`totp`, `enrolement`) ne sont plus montées ; la
 * maquette reste la source de leur dessin, l'adaptation les remplace aussi.
 *
 * COMPOSANT SERVEUR : voir l'ancien en-tête — `useSearchParams()` aurait servi un HTML
 * vide. Ici rien n'est lu dans l'URL.
 */
export default function Page() {
  return (
    <ScreenFrames
      screen="D01"
      direction="column"
      desktop={
        // La carte de 420 px se CENTRE : la maquette la pose sur une planche de documentation,
        // pas sur une page. Sans cela elle restait collée en haut à gauche.
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', minHeight: '100vh', width: '100%' }}>
          <D01Identifiants />
        </div>
      }
    />
  );
}
