import { notFound } from 'next/navigation';
import { ParrainEcran } from '@/screens/entraide/parrain-ecran';

/**
 * H06 — Fiche d'un parrain (`/parrainage/:handle`, module 08 §7.1).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Composant SERVEUR : les
 * paramètres de route arrivent en propriété, et l'écran client les reçoit.
 *
 * PAS DE CADRE MOBILE, et ce n'est pas un oubli : la maquette n'en dessine pas. Sa
 * planche « MOBILE » ne montre pas la fiche sur téléphone mais la FEUILLE DE DEMANDE
 * posée sur un voile — c'est-à-dire la modale, pas l'écran. Voir `parrain-ecran.tsx`.
 *
 * LA FEUILLE DE DEMANDE N'EST TOUJOURS PAS MONTÉE. Son cadre d'ordinateur est
 * dessiné en carte nue de 540 px — sans voile, sans panneau positionné — là où les
 * quatre modales du fil (`03 Accueil v2`) dessinent les deux. Il n'y a donc rien à
 * marquer pour `Modal`, et lui ajouter un voile serait dessiner à la place du
 * porteur. Remonté dans le rapport, pas comblé.
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
