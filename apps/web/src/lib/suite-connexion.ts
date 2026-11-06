/**
 * LA DESTINATION QUE LA CONNEXION DOIT RENDRE (`?suite=`).
 *
 * Quand la session meurt, ou qu'un visiteur ouvre une page membre, on l'envoie à
 * `/connexion?suite=<chemin>` pour qu'il retrouve ensuite l'écran qu'il voulait.
 * `suite` vient de l'URL, donc du public : c'est exactement la forme d'une
 * REDIRECTION OUVERTE (`?suite=//autre-site.tld`). Elle n'est donc jamais suivie
 * telle quelle : seul un CHEMIN INTERNE passe.
 *
 *   · il commence par UNE barre oblique, suivie d'autre chose qu'une barre oblique
 *     ou une contre-oblique (`//hote` et `/\hote` sont lus comme des hôtes par les
 *     navigateurs) ;
 *   · il ne contient ni caractère de contrôle ni espace blanc de tête de schéma ;
 *   · il ne mène pas à l'accès lui-même (`/connexion`, `/bienvenue`…) : on
 *     reviendrait sur la page d'où l'on vient, en boucle.
 */
const CHEMIN_INTERNE = /^\/[^/\\]/;
// eslint-disable-next-line no-control-regex -- on refuse justement les caractères de contrôle
const CONTROLE = /[\u0000-\u001f\u007f]/;
const PAGES_D_ACCES = /^\/(connexion|bienvenue|admin\/connexion)(?:[/?#]|$)/;

/** Le chemin interne à suivre, ou `null` si `valeur` n'en est pas un. */
export function suiteValide(valeur: string | null | undefined): string | null {
  if (typeof valeur !== 'string' || valeur.length === 0 || valeur.length > 512) return null;
  if (!CHEMIN_INTERNE.test(valeur) || CONTROLE.test(valeur)) return null;
  if (PAGES_D_ACCES.test(valeur)) return null;
  return valeur;
}

/** `/connexion?suite=…` pour revenir à `chemin` ; `/connexion` seul s'il n'est pas interne. */
export function adresseConnexion(chemin: string | null | undefined): string {
  const suite = suiteValide(chemin);
  return suite === null ? '/connexion' : `/connexion?suite=${encodeURIComponent(suite)}`;
}

const CLE_SUITE = 'dp_login_suite';

/** Garde la destination le temps du parcours téléphone → code (la page change entre les deux). */
export function memoriserSuite(valeur: string | null | undefined): void {
  const suite = suiteValide(valeur);
  try {
    if (suite === null) sessionStorage.removeItem(CLE_SUITE);
    else sessionStorage.setItem(CLE_SUITE, suite);
  } catch {
    // Stockage indisponible (navigation privée) : on perd seulement le retour direct.
  }
}

/** Relit la destination gardée, revalidée (le stockage est modifiable par le navigateur). */
export function suiteMemorisee(): string | null {
  try {
    return suiteValide(sessionStorage.getItem(CLE_SUITE));
  } catch {
    return null;
  }
}

export function oublierSuite(): void {
  try {
    sessionStorage.removeItem(CLE_SUITE);
  } catch {
    // Rien à oublier.
  }
}
