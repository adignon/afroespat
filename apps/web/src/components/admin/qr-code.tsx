import qrcode from 'qrcode-generator';
import { C } from './ui';

/**
 * AJOUT — le code QR d'enrôlement TOTP (D01, 15 §2.1), rendu LOCALEMENT.
 *
 * Le secret TOTP ne doit sortir ni vers un service de génération de QR, ni vers un
 * CDN : l'URI `otpauth://` est encodée ici, dans le navigateur, par
 * `qrcode-generator` (une trentaine de ko, sans dépendance, MIT), puis dessinée en
 * SVG en ligne — un seul `<path>` de carrés, sans image externe.
 *
 * Aucune couleur nouvelle : encre du site sur blanc, avec la zone de silence de
 * quatre modules que la norme impose (sans elle, certains lecteurs n'accrochent pas).
 */
export function QrCode({ valeur, libelle, taille = 176 }: { valeur: string; libelle: string; taille?: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(valeur);
  qr.make();
  const n = qr.getModuleCount();
  const silence = 4;
  let d = '';
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (qr.isDark(y, x)) d += `M${x + silence} ${y + silence}h1v1h-1z`;
    }
  }
  const cote = n + silence * 2;
  return (
    <svg
      role="img"
      aria-label={libelle}
      data-admin-qr=""
      width={taille}
      height={taille}
      viewBox={`0 0 ${cote} ${cote}`}
      shapeRendering="crispEdges"
      style={{ background: '#fff', borderRadius: '12px', alignSelf: 'center', flexShrink: 0 }}
    >
      <path d={d} fill={C.encre} />
    </svg>
  );
}
