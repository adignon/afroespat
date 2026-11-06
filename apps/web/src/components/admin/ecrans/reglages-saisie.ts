/**
 * LA SAISIE TYPÉE DES PARAMÈTRES SYSTÈME.
 *
 * Avant : toute valeur s'éditait en JSON brut ; une virgule oubliée donnait « JSON invalide » sans dire quoi. Ici la
 * forme de la saisie suit la forme de la valeur actuelle : un nombre se saisit comme un nombre, un booléen s'active, une
 * liste se saisit une entrée par ligne (avec contrôle CIDR pour `admin_allowed_cidrs`). Les objets restent en JSON.
 * Le SERVEUR valide toujours selon le schéma de la clé ; ce module n'évite que les fautes de forme.
 */

export type TypeSaisie = 'nombre' | 'booleen' | 'liste' | 'cidr' | 'json';

export function typeSaisie(cle: string, valeur: unknown): TypeSaisie {
  if (typeof valeur === 'boolean') return 'booleen';
  if (typeof valeur === 'number') return 'nombre';
  if (Array.isArray(valeur) && valeur.every((x) => typeof x === 'string')) return cle.includes('cidr') ? 'cidr' : 'liste';
  return 'json';
}

export function valeurVersTexte(valeur: unknown, type: TypeSaisie): string {
  if (type === 'liste' || type === 'cidr') return (valeur as readonly string[]).join('\n');
  if (type === 'json') return JSON.stringify(valeur, null, 2);
  return String(valeur);
}

/** Un CIDR IPv4 (`10.0.0.0/8`) ou IPv6 (`2001:db8::/32`), ou une adresse seule. */
export function cidrValide(texte: string): boolean {
  const [adresse, masque, ...reste] = texte.split('/');
  if (reste.length > 0 || adresse === undefined || adresse === '') return false;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(adresse);
  if (v4 !== null) {
    if (!v4.slice(1).every((o) => Number(o) <= 255)) return false;
    return masque === undefined || (/^\d{1,2}$/.test(masque) && Number(masque) <= 32);
  }
  if (/^[0-9a-fA-F:]+$/.test(adresse) && adresse.includes(':') && adresse.split(':').length <= 8) {
    return masque === undefined || (/^\d{1,3}$/.test(masque) && Number(masque) <= 128);
  }
  return false;
}

export type Lecture = { readonly ok: true; readonly valeur: unknown } | { readonly ok: false; readonly erreur: string };

export function texteVersValeur(texte: string, type: TypeSaisie, booleen?: boolean): Lecture {
  switch (type) {
    case 'booleen':
      return { ok: true, valeur: booleen === true };
    case 'nombre': {
      const t = texte.trim().replace(',', '.');
      if (t === '' || !Number.isFinite(Number(t))) return { ok: false, erreur: 'Saisissez un nombre.' };
      return { ok: true, valeur: Number(t) };
    }
    case 'liste':
    case 'cidr': {
      const lignes = texte
        .split(/[\n,;]+/)
        .map((l) => l.trim())
        .filter((l) => l !== '');
      if (type === 'cidr') {
        const faute = lignes.find((l) => !cidrValide(l));
        if (faute !== undefined) return { ok: false, erreur: `« ${faute} » n’est pas une adresse ou un bloc réseau valide (p. ex. 203.0.113.0/24).` };
      }
      return { ok: true, valeur: [...new Set(lignes)] };
    }
    case 'json':
      try {
        return { ok: true, valeur: JSON.parse(texte) as unknown };
      } catch (e) {
        const detail = e instanceof SyntaxError ? ` (${e.message})` : '';
        return { ok: false, erreur: `La valeur n’est pas du JSON valide${detail}.` };
      }
  }
}

/** Le texte d'affichage COMPLET d'une valeur : jamais tronqué avec « … ». */
export function valeurAffichee(valeur: unknown): string {
  if (typeof valeur === 'string') return valeur;
  if (Array.isArray(valeur) && valeur.every((x) => typeof x === 'string')) return valeur.length === 0 ? '(liste vide)' : valeur.join(', ');
  return JSON.stringify(valeur) ?? '';
}
