'use client';

/**
 * AJOUT HORS MAQUETTE — UN SEUL DES DEUX CADRES EST MONTÉ.
 *
 * `ScreenFrames` rend LES DEUX cadres (ordinateur et mobile) et en masque un par CSS :
 * c'est voulu pour les cadres transcodés, qui ne font aucun appel. Les VUES de ce
 * dossier, elles, lisent l'API et portent des champs : montées deux fois, elles
 * doubleraient chaque requête, chaque geste (deux « Invitations » dans le document, deux
 * champs `id="creer-titre"`) et laisseraient un lecteur d'écran lire le cadre caché.
 *
 * `CadreActif` ne monte ses enfants que dans le cadre que le seuil de 1024 px (§10.1)
 * désigne. Avant le premier effet — donc au rendu serveur — il ne monte RIEN : la page
 * est alors dans son état d'attente, comme pour tout écran qui lit ses données.
 */

import { useEffect, useState, type ReactNode } from 'react';

const ORDINATEUR = '(min-width: 1024px)';

export function useCadreActif(compact: boolean): boolean {
  const [actif, setActif] = useState(false);
  useEffect(() => {
    const requete = window.matchMedia(ORDINATEUR);
    const maj = () => setActif(compact ? !requete.matches : requete.matches);
    maj();
    requete.addEventListener('change', maj);
    return () => requete.removeEventListener('change', maj);
  }, [compact]);
  return actif;
}

export function CadreActif({ compact, children }: { readonly compact: boolean; readonly children: ReactNode }) {
  return useCadreActif(compact) ? <>{children}</> : null;
}
