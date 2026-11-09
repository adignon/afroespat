'use client';

import { useCallback, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { handleSchema } from '@app/shared';
import type { MembreChoisiView } from '../a08t/vivant';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE MEMBRE CHOISI DANS L'ONGLET « MEMBRES » VIT DANS L'URL                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le clic affiche leur profil avec l'option back ». Le choix est
 * `?membre=<handle>` : le bouton « Retour » du navigateur, celui de la page et la
 * touche Échap font alors le même geste, et un lien copié rouvre l'aperçu.
 *
 * ── POURQUOI `history.pushState` ET PAS `router.push` ─────────────────────────
 *
 * Next 15 branche `pushState` / `replaceState` sur `useSearchParams` : l'adresse
 * change et l'écran suit à l'instant, SANS aller-retour serveur. `router.push` sur
 * la même route redemande la page au serveur, et l'aperçu attendrait ce voyage pour
 * un simple changement de panneau.
 *
 * ── « RETOUR » : REVENIR, OU À DÉFAUT RETIRER ─────────────────────────────────
 *
 * Si c'est CETTE page qui a poussé l'entrée (`pousse`), « Retour » est `history.back()` :
 * l'historique reste propre, et le retour du navigateur se comporte pareil. Sinon
 * (lien direct `?membre=…`, rechargement) il n'y a rien à quoi revenir dans l'app :
 * on REMPLACE l'adresse par celle de la liste, pour ne pas renvoyer hors du site.
 *
 * Le pseudo est validé par `handleSchema` avant tout usage : l'adresse est une
 * entrée, et un `?membre=../x` ne doit jamais composer un appel.
 */
export function useMembreChoisi(): MembreChoisiView {
  const params = useSearchParams();
  const pathname = usePathname();
  const pousse = useRef(false);

  const brut = params.get('membre');
  const handle = useMemo(() => {
    if (brut === null) return null;
    const propre = brut.startsWith('@') ? brut.slice(1) : brut;
    return handleSchema.safeParse(propre).success ? propre : null;
  }, [brut]);

  const adresse = useCallback(
    (membre: string | null): string => {
      const suivant = new URLSearchParams(params.toString());
      if (membre === null) suivant.delete('membre');
      else suivant.set('membre', membre);
      const texte = suivant.toString();
      return texte === '' ? pathname : `${pathname}?${texte}`;
    },
    [params, pathname],
  );

  const onOuvrir = useCallback(
    (cible: string) => {
      pousse.current = true;
      window.history.pushState(null, '', adresse(cible));
    },
    [adresse],
  );

  const onRetour = useCallback(() => {
    if (pousse.current) {
      pousse.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', adresse(null));
  }, [adresse]);

  return useMemo(() => ({ handle, onOuvrir, onRetour }), [handle, onOuvrir, onRetour]);
}
