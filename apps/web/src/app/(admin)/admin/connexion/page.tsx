import { ScreenFrames } from '@/screens/frames';
import { D01Identifiants } from '@/screens/d01/identifiants.generated';
import { D01Totp } from '@/screens/d01/totp.generated';
import { D01Enrolement } from '@/screens/d01/enrolement.generated';

/**
 * D01 — la connexion d'équipe. `/admin/connexion` (15 §2.1, T5 D01).
 *
 * TROIS CARTES, UNE SEULE ROUTE. La maquette dessine les trois moments de la
 * connexion côte à côte, étiquetés « 1 · IDENTIFIANTS », « 2 · CODE TOTP » et
 * « ENRÔLEMENT FORCÉ ». Ce sont des ÉTATS du même écran, pas trois pages : le
 * paramètre `?etape=` choisit la planche, comme `?etat=` le fait dans le module
 * Parcours.
 *
 * COMPOSANT SERVEUR, et ce n'est pas un détail de style : `useSearchParams()`
 * force le rendu côté client, et le HTML servi est alors VIDE — la page ne
 * s'affiche qu'après l'hydratation, et un test qui lit la réponse ne voit rien.
 * Cinq pages de ce dépôt y sont déjà tombées. Les paramètres arrivent donc en
 * propriété.
 *
 * RIEN N'EST BRANCHÉ. 15 §2.1 veut un mot de passe argon2id, un TOTP obligatoire
 * et une session en cookie `HttpOnly` `Strict` de 8 h — pas le jeton porteur des
 * membres. Ce lot est du transcodage : le bouton « Continuer » est celui de la
 * maquette, inerte, et la saisie reste dessinée. Ce qui compte ici est que
 * l'écran ne SUPPOSE rien d'autre : aucun appel, aucun stockage local, aucune
 * trace d'un jeton membre.
 *
 * Le verrouillage après cinq échecs (§2.1) est écrit à l'écran par la maquette —
 * « Compte verrouillé après 5 échecs. » — sur la carte du code.
 */
const ETAPES = {
  totp: { ecran: 'D01T', planche: <D01Totp /> },
  enrolement: { ecran: 'D01E', planche: <D01Enrolement /> },
} as const;

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const demande = params['etape'];
  const etape =
    typeof demande === 'string' && demande in ETAPES ? ETAPES[demande as keyof typeof ETAPES] : null;

  return (
    <ScreenFrames
      screen={etape?.ecran ?? 'D01'}
      desktop={etape?.planche ?? <D01Identifiants />}
      direction="column"
    />
  );
}
