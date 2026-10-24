import { notFound } from 'next/navigation';
import { ParrainEcran } from '@/screens/entraide/parrain-ecran';

/**
 * H06 — Fiche d'un parrain (`/parrainage/:handle`, module 08 §7.1).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Composant SERVEUR : les
 * paramètres de route arrivent en propriété, et l'écran client les reçoit.
 *
 * CADRE MOBILE = AJOUT : la maquette n'en dessine pas (sa planche « MOBILE » montre la
 * FEUILLE DE DEMANDE sur un voile, pas l'écran). Il est composé dans
 * `components/entraide/parrain-fiche-mobile.tsx`. Voir `parrain-ecran.tsx`.
 *
 * LA FEUILLE DE DEMANDE est montée par `BoutonDemander` (`components/entraide/parrainage-vivant.tsx`),
 * sur le bureau comme sur téléphone : message de cinquante caractères, parcours facultatif.
 *
 * LE SEGMENT EST DÉCODÉ AVANT D'ÊTRE PASSÉ, et le pseudo est VALIDÉ : `handleSchema`
 * n'accepte que minuscules, chiffres, tiret et souligné. Sans ce filtre, un chemin
 * fantaisiste partirait en appel API pour revenir en `400 VALIDATION_FAILED` — un
 * message d'erreur là où une 404 est la bonne réponse. `decodeURIComponent` peut
 * lever sur une séquence `%` invalide : une URL malformée est une 404, pas un 500.
 */
function pseudo(segment: string): string | null {
  let decode: string;
  try {
    decode = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/.test(decode) ? decode : null;
}

export default async function MentorProfilePage({
  params,
}: {
  readonly params: Promise<{ readonly handle: string }>;
}) {
  const { handle } = await params;
  const nom = pseudo(handle);
  if (nom === null) notFound();

  return <ParrainEcran pseudo={nom} />;
}
