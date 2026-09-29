import { ScreenFrames } from '@/screens/frames';
import { K03Desktop } from '@/screens/k03/desktop.generated';
import { K03Mobile } from '@/screens/k03/mobile.generated';

/**
 * K03 — « Vérification et niveaux » (`/compte/verification`, 01 §3).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html`. Rien n'est
 * réécrit ; la page ne fait que servir les deux cadres de la maquette.
 *
 * CE QUE LA PLANCHE PORTE, et qui vient du dossier :
 *   · les trois niveaux N0 / N1 / N2 avec ce que chacun débloque ;
 *   · N2 exige « un numéro FRANÇAIS » — le pays de DESTINATION, pas celui
 *     d'origine : « Ajoutez un numéro français. Un code vous sera envoyé par
 *     SMS. » C'est la règle de 01 §3, dessinée ;
 *   · les quatre états KYC, dont « Mineur · Disponible à partir de 18 ans » —
 *     01 §5 : un membre mineur voit son compte désactivé.
 *
 * Aucun de ces états n'est un composant à piloter : la maquette les dessine tous
 * les quatre côte à côte, dans la colonne « ÉTATS KYC ». C'est sa façon de les
 * montrer, et la transcrire autrement serait redessiner.
 */
export default function VerificationPage() {
  return <ScreenFrames screen="K03" desktop={<K03Desktop />} mobile={<K03Mobile />} />;
}
