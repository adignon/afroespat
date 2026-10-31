/**
 * Captcha — Cloudflare Turnstile, côté navigateur (01 §2.1 : « captcha obligatoire
 * avant tout envoi d'OTP »).
 *
 * ── UNE FONCTION, PAS UN COMPOSANT ──────────────────────────────────────────
 *
 * Trois endroits envoyaient `captchaToken: 'dev'` en dur (`use-onboarding-flow.ts`
 * deux fois, `fenetre-numero.tsx`). Aucun n'a de place dessinée pour un widget, et un
 * jeton Turnstile est À USAGE UNIQUE : il doit être obtenu AU MOMENT de l'envoi, pas
 * au chargement de l'écran (il expire en 5 minutes, et « Renvoyer » en demande un
 * nouveau). `obtenirJetonCaptcha()` rend donc une promesse, appelée juste avant
 * `POST /auth/otp/request` et `POST /me/phones`.
 *
 * ── LES TROIS CAS ───────────────────────────────────────────────────────────
 *
 *   · AUCUNE CLÉ DE SITE (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` vide) : développement avec
 *     la doublure. On rend le jeton de TEST OFFICIEL de Cloudflare,
 *     `XXXX.DUMMY.TOKEN.XXXX`, que la doublure serveur accepte et que le vrai
 *     vérificateur accepte avec le secret de test `1x0000000000000000000000000000000AA`.
 *     Aucun script tiers n'est chargé.
 *   · CLÉ DE SITE POSÉE : le script de Cloudflare est chargé UNE fois, un widget est
 *     rendu en mode `interaction-only` (invisible tant que Cloudflare est sûr de
 *     lui) et exécuté. S'il exige une interaction, il apparaît au centre de l'écran,
 *     dans un cadre, puis disparaît. Le widget est détruit après usage.
 *   · ÉCHEC (script bloqué, délai de 30 s dépassé, erreur Cloudflare) : la promesse
 *     REJETTE avec un message lisible. On n'envoie JAMAIS un jeton vide « pour voir » :
 *     le serveur refuserait, et le membre lirait un message sans rapport.
 */

/** Le jeton factice des clés de test de Cloudflare. */
export const JETON_CAPTCHA_DE_TEST = 'XXXX.DUMMY.TOKEN.XXXX';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const DELAI_MS = 30_000;

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(container: HTMLElement | string): void;
  remove(widgetId: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let chargement: Promise<Turnstile> | null = null;

function chargerScript(): Promise<Turnstile> {
  if (window.turnstile !== undefined) return Promise.resolve(window.turnstile);
  chargement ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = (): void => {
      if (window.turnstile === undefined) {
        chargement = null;
        reject(new CaptchaError('La vérification anti-robot n’a pas pu démarrer.'));
      } else resolve(window.turnstile);
    };
    script.onerror = (): void => {
      chargement = null; // permet un nouvel essai
      reject(new CaptchaError('La vérification anti-robot est bloquée. Désactivez votre bloqueur et réessayez.'));
    };
    document.head.appendChild(script);
  });
  return chargement;
}

/** Une erreur dont le MESSAGE est déjà écrit pour le membre (`displayMessageFor` le montre tel quel). */
export class CaptchaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptchaError';
  }
}

export function cleDeSite(): string {
  return process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY']?.trim() ?? '';
}

export async function obtenirJetonCaptcha(): Promise<string> {
  const siteKey = cleDeSite();
  if (siteKey === '') return JETON_CAPTCHA_DE_TEST;

  const turnstile = await chargerScript();

  // Cadre centré : invisible (taille nulle) sauf si Cloudflare demande une interaction.
  const cadre = document.createElement('div');
  cadre.setAttribute('data-captcha', 'turnstile');
  Object.assign(cadre.style, {
    position: 'fixed', inset: '0', zIndex: '2147483000', display: 'none',
    alignItems: 'center', justifyContent: 'center', background: 'rgba(22,33,29,0.45)',
  });
  const boite = document.createElement('div');
  Object.assign(boite.style, { background: '#fff', borderRadius: '16px', padding: '16px' });
  cadre.appendChild(boite);
  document.body.appendChild(cadre);

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | null = null;
    const fin = (): void => {
      clearTimeout(minuteur);
      if (widgetId !== null) {
        try { turnstile.remove(widgetId); } catch { /* déjà retiré */ }
      }
      cadre.remove();
    };
    const minuteur = setTimeout(() => {
      fin();
      reject(new CaptchaError('La vérification anti-robot a pris trop de temps. Réessayez.'));
    }, DELAI_MS);

    try {
      widgetId = turnstile.render(boite, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        language: 'fr',
        'before-interactive-callback': () => { cadre.style.display = 'flex'; },
        'after-interactive-callback': () => { cadre.style.display = 'none'; },
        callback: (jeton: string) => { fin(); resolve(jeton); },
        // Cloudflare donne un code (`110200` : domaine non autorisé pour cette clé de site,
        // `110100`/`110110` : clé invalide…). Le garder dans le message évite de deviner ;
        // `true` dit à Turnstile que l'erreur est traitée.
        'error-callback': (code?: unknown): boolean => {
          fin();
          const suffixe = typeof code === 'string' || typeof code === 'number' ? ` (code ${String(code)})` : '';
          reject(new CaptchaError(`La vérification anti-robot a échoué${suffixe}. Réessayez.`));
          return true;
        },
        'timeout-callback': () => { fin(); reject(new CaptchaError('La vérification anti-robot a expiré. Réessayez.')); },
      });
      turnstile.execute(boite);
    } catch (error) {
      fin();
      reject(error instanceof CaptchaError ? error : new CaptchaError('La vérification anti-robot a échoué.'));
    }
  });
}
