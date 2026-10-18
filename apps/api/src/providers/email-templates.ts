/**
 * Les modèles d'email — 12 §2.5 : « texte + HTML simple, désinscription en pied ».
 *
 * Composés ICI et non chez Brevo : un modèle tenu dans la console du fournisseur
 * serait une seconde source de textes, hors dépôt, que personne ne relirait au
 * moment de changer de fournisseur. Les textes suivent T2 (vouvoiement, phrases
 * courtes).
 *
 * Chaque valeur interpolée est ÉCHAPPÉE dans la version HTML : le titre d'une
 * notification peut porter le pseudo d'un membre, c'est-à-dire un texte saisi par
 * un tiers.
 */

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const SUBJECTS: Record<string, string> = {
  welcome: 'Bienvenue',
  journey_deadline_j1: 'Une échéance de votre parcours arrive demain',
  mentorship_request_received: 'Vous avez reçu une demande de parrainage',
  guide_proposal_received: 'Une proposition de modification sur votre guide',
  weekly_digest: 'Votre résumé de la semaine',
  security: 'Sécurité de votre compte',
  moderation: 'Information de modération',
  invoice: 'Votre facture',
  email_verification: 'Votre code de vérification',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

export function renderEmail(
  template: string,
  variables: Record<string, unknown>,
  appName: string,
): RenderedEmail {
  const subject = `${SUBJECTS[template] ?? str(variables['title']) ?? 'Notification'} — ${appName}`;
  const lines: string[] = [];

  if (template === 'email_verification') {
    const code = str(variables['code']) ?? '';
    lines.push(
      `Voici votre code pour vérifier cette adresse : ${code}`,
      'Il expire dans 15 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
    );
  } else {
    const title = str(variables['title']);
    const body = str(variables['body']);
    if (title !== null) lines.push(title);
    if (body !== null) lines.push(body);
    const url = str(variables['url']);
    if (url !== null) lines.push(url);
  }

  const unsubscribe = str(variables['unsubscribeUrl']);
  const footer =
    unsubscribe === null
      ? []
      : ['', `Ne plus recevoir ces emails : ${unsubscribe}`];

  const text = [...lines, ...footer].join('\n');
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#16211D">' +
    lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('') +
    (unsubscribe === null
      ? ''
      : `<p style="font-size:12px;color:#5D6B66"><a href="${escapeHtml(unsubscribe)}">Ne plus recevoir ces emails</a></p>`) +
    '</div>';

  return { subject, text, html };
}
