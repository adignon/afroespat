/**
 * LA SESSION D'ÉQUIPE PERDUE EN COURS DE ROUTE.
 *
 * La session se prolonge à l'activité et expire à 30 min d'inactivité (8 h au plus). La vérification faite une fois
 * au montage ne suffit donc pas : le premier appel qui reçoit `401 STAFF_SESSION_REQUIRED` doit renvoyer vers la
 * connexion, une seule fois même si dix appels échouent ensemble, avec la page d'origine en `suite`.
 */

export const MESSAGE_SESSION_EXPIREE = 'Session expirée par inactivité. Reconnectez-vous pour reprendre.';

type Gestionnaire = (urlConnexion: string) => void;
let gestionnaire: Gestionnaire | null = null;
let dejaSignale = false;

/** `suite` n'est suivie que si c'est un chemin interne de l'administration (jamais une URL externe). */
export function suiteValide(suite: string | null | undefined): string | null {
  if (typeof suite !== 'string' || suite === '') return null;
  if (!suite.startsWith('/admin') || suite.startsWith('//') || suite.includes(String.fromCharCode(92)) || suite.includes('..')) return null;
  if (suite === '/admin/connexion' || suite.startsWith('/admin/connexion?') || suite.startsWith('/admin/connexion/')) return null;
  if (!/^\/admin(?:[/?#][\w\-./?=&%#]*)?$/.test(suite)) return null;
  return suite;
}

export function urlConnexion(chemin: string, expiree: boolean): string {
  const suite = suiteValide(chemin);
  const params = new URLSearchParams();
  if (suite !== null) params.set('suite', suite);
  if (expiree) params.set('expiree', '1');
  const q = params.toString();
  return q === '' ? '/admin/connexion' : `/admin/connexion?${q}`;
}

/** Le fournisseur de session branche ici son `router.replace` ; renvoie le désabonnement. */
export function surSessionPerdue(g: Gestionnaire): () => void {
  gestionnaire = g;
  dejaSignale = false;
  return () => {
    if (gestionnaire === g) gestionnaire = null;
  };
}

/** Une session vient d'être ouverte : une perte ultérieure doit de nouveau être signalée. */
export function sessionRetablie(): void {
  dejaSignale = false;
}

/** Appelé par le transport équipe. Les routes `/auth/*` sont exclues : leurs 401 sont des erreurs de connexion. */
export function signalerSessionPerdue(path: string): void {
  if (path.startsWith('/auth/')) return;
  if (dejaSignale || gestionnaire === null) return;
  dejaSignale = true;
  const courant = typeof window === 'undefined' ? '/admin' : `${window.location.pathname}${window.location.search}`;
  gestionnaire(urlConnexion(courant, true));
}

