import { notFound } from 'next/navigation';
import { DemandeEcran } from '@/screens/entraide/demande-ecran';

/**
 * H02 — Demande d'entraide, détail (`/entraide/:id`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Composant SERVEUR : le
 * paramètre de route arrive en propriété, et l'écran client l'emploie pour appeler
 * `GET /help/:id`.
 *
 * L'IDENTIFIANT EST VALIDÉ AVANT L'APPEL. L'API attend un UUID (`uuidSchema` sur le
 * paramètre), et un segment qui n'en est pas un revient en `400 VALIDATION_FAILED` —
 * le membre verrait « Certaines informations sont incomplètes ou mal remplies » sur
 * une page qu'il n'a pas remplie. C'est mesuré, pas supposé : le script de relève a
 * reçu exactement ce `400` en construisant une URL avec un identifiant `undefined`,
 * et le message n'accusait pas la bonne chose.
 *
 * Une adresse qui n'est pas un UUID est donc une 404, ce qui est vrai : il n'existe
 * aucune demande à cette adresse.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function identifiant(segment: string): string | null {
  let decode: string;
  try {
    decode = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return UUID.test(decode) ? decode : null;
}

export default async function HelpRequestPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const demande = identifiant(id);
  if (demande === null) notFound();

  return <DemandeEcran id={demande} />;
}
