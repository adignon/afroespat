'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Une modale — « fenêtre sur web, feuille sur mobile », comme la maquette l'écrit
 * elle-même sous chacune de ses quatre planches (A01C, A01P, A01G, A01S).
 *
 * CE QUE CE COMPOSANT NE FAIT PAS : le dessin. Le voile, le panneau de 720 px,
 * la feuille du bas et sa poignée sont TRANSCODÉS de la maquette, styles en ligne
 * compris. Ce fichier n'apporte que ce qu'une image ne peut pas contenir — le
 * comportement — et le mouvement vit en CSS (`packages/ui/src/styles.css`), ciblé
 * par les attributs que le transcodeur pose sur le voile et le panneau.
 *
 * UN SEUL CADRE EST RENDU, contrairement à `ScreenFrames` qui rend les deux et en
 * masque un. La raison n'est pas l'économie : c'est que les deux cadres portent le
 * MÊME identifiant de titre (`a01c-titre`), et deux fois le même `id` dans un
 * document rend `aria-labelledby` ambigu — il désignerait le premier trouvé, qui
 * peut être celui qui est masqué. La boîte de dialogue perdrait son nom.
 *
 * Choisir en JavaScript est ici sans danger, alors que `ScreenFrames` ne peut pas
 * se le permettre : une modale n'existe QU'APRÈS une action du membre, donc jamais
 * dans le rendu du serveur. Il n'y a pas d'hydratation à faire concorder. (Le jour
 * où une modale devra s'ouvrir au premier rendu — un lien profond vers une
 * publication, par exemple — il faudra y revenir.)
 */

const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Ce qui peut recevoir le focus dans le panneau.
 *
 * `[data-modal-close]` n'est pas listé à part : le transcodeur en fait un vrai
 * `<button>`, donc il entre par la première clause. C'était l'intérêt de la
 * promotion — un `<span>` cliquable n'aurait jamais été atteignable au clavier.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  titleId,
  name,
  desktop,
  mobile,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  /** L'`id` du `<h2>` que le transcodeur a promu dans le panneau. */
  readonly titleId: string;
  /** Le nom de la planche — `A01C`… — pour que les tests désignent la bonne modale. */
  readonly name: string;
  readonly desktop: ReactNode;
  readonly mobile: ReactNode;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<Element | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);

  // La largeur est relue à chaque ouverture ET suivie ensuite : une fenêtre
  // redimensionnée, ou un téléphone qu'on tourne, doit changer de forme.
  useEffect(() => {
    if (!open) return undefined;
    const query = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(query.matches);
    const onChange = (event: MediaQueryListEvent): void => setIsDesktop(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [open]);

  /**
   * Le défilement de la page est BLOQUÉ pendant l'ouverture.
   *
   * Sans cela, la molette fait défiler le fil derrière le voile : le membre voit
   * bouger ce qu'il ne peut pas toucher. La largeur de la barre de défilement est
   * compensée, sinon la page saute de quelques pixels à l'ouverture — un
   * tremblement qu'on attribue au mouvement de la modale alors qu'il vient de là.
   */
  useEffect(() => {
    if (!open) return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [open]);

  /**
   * Le focus entre dans le panneau à l'ouverture, et REVIENT d'où il venait à la
   * fermeture.
   *
   * Le retour est la moitié qu'on oublie : sans lui, refermer une modale renvoie
   * le focus au début du document, et un membre au clavier doit re-parcourir tout
   * le fil pour revenir au bouton qu'il venait d'actionner.
   */
  useEffect(() => {
    if (!open) return undefined;
    restoreTo.current = document.activeElement;
    const first = root.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root.current)?.focus();
    return () => {
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, [open]);

  /**
   * Échap ferme, et Tab tourne EN ROND dans le panneau.
   *
   * Le piège au clavier n'est pas un raffinement : `aria-modal="true"` promet à un
   * lecteur d'écran que le reste de la page est hors de portée. Si Tab en sort
   * quand même, la promesse est fausse et le membre se retrouve à parcourir un fil
   * qu'il ne voit plus, sans comprendre où il est.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  /**
   * La fermeture est DÉLÉGUÉE, et c'est ce qui permet aux fichiers générés de
   * rester de la pure présentation.
   *
   * Le voile et les boutons de fermeture portent les attributs que le transcodeur
   * a posés — `data-modal-overlay`, `data-modal-close`. Aucun `onClick` n'est donc
   * injecté dans le JSX transcodé, qui reste la maquette à l'identique, et aucune
   * propriété `onClose` n'a besoin de traverser les composants générés.
   *
   * On ne ferme JAMAIS sur un clic dans le panneau : un membre qui sélectionne du
   * texte et relâche hors de la zone perdrait ce qu'il écrivait.
   */
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-modal-close]') !== null) {
        onClose();
        return;
      }
      if (target.closest('[data-modal-panel]') !== null) return;
      if (target.closest('[data-modal-overlay]') !== null) onClose();
    },
    [onClose],
  );

  if (!open) return null;
  // `document` n'existe pas au rendu serveur ; une modale n'y arrive jamais,
  // mais la garde évite que ce fichier devienne impossible à rendre côté serveur
  // si quelqu'un l'appelle depuis un composant qui l'est.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-modal={name}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={onClick}
      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
    >
      {isDesktop ? desktop : mobile}
    </div>,
    document.body,
  );
}
