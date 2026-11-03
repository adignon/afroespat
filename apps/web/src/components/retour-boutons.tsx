'use client';

import { useEffect } from 'react';

/**
 * LE RETOUR VISUEL DES BOUTONS D'ACTION, POUR TOUT LE PRODUIT.
 *
 * Constat : cliquer sur un bouton (inscription, envoi d'un code, publier, rejoindre…) ne change rien à l'écran tant que
 * la réponse n'est pas arrivée ; on ne sait pas si le clic a été pris. Les écrans sont transcodés des maquettes (plus de
 * quatre cents boutons) : traiter chaque bouton à la main serait fragile et oublierait les suivants. Le retour vit donc
 * ICI, une fois, pour tous les boutons :
 *
 *   · APPUYÉ — `:active` assombrit et enfonce le bouton (règles dans `globals.css`) ;
 *   · EN COURS — un clic qui déclenche une requête d'ÉCRITURE (POST, PUT, PATCH, DELETE) dans les secondes qui suivent
 *     met le bouton en `aria-busy` : un rond tourne à la place du libellé et les clics répétés sont ignorés, jusqu'à ce
 *     que toutes les requêtes déclenchées soient terminées (réussies ou non).
 *
 * Les lectures (GET) ne comptent pas : elles tournent aussi en tâche de fond (rafraîchissements, temps réel) et ne
 * sont pas « l'action » que le membre vient de lancer.
 */

/** Le délai entre le clic et la requête : un captcha, un rafraîchissement de session peuvent s'intercaler. */
const FENETRE_MS = 6000;
/** Le rond reste au moins ce temps : un aller-retour très court ne doit pas faire clignoter le bouton. */
const DUREE_MIN_MS = 350;
/** Un bouton que l'écran désactive dans ce délai après le clic est « en cours » (c'est le geste de l'écran). */
const ATTENTE_DESACTIVATION_MS = 600;
/** Garde-fou : un bouton qui reste désactivé plus longtemps n'est plus « en cours », il est simplement indisponible. */
const DUREE_MAX_DESACTIVE_MS = 20000;

const ECRITURES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface Clic {
  readonly bouton: HTMLElement;
  readonly a: number;
}

function boutonDe(cible: EventTarget | null): HTMLElement | null {
  if (!(cible instanceof Element)) return null;
  const b = cible.closest<HTMLElement>('button, [role="button"]');
  if (b === null || (b instanceof HTMLButtonElement && b.disabled) || b.getAttribute('aria-disabled') === 'true') return null;
  return b;
}

export function RetourBoutons() {
  useEffect(() => {
    let dernier: Clic | null = null;
    const compteurs = new WeakMap<HTMLElement, { n: number; depuis: number; position: string | null }>();
    const natif = window.fetch.bind(window);

    const occuper = (b: HTMLElement) => {
      const etat = compteurs.get(b);
      if (etat !== undefined) {
        etat.n += 1;
        return;
      }
      const style = getComputedStyle(b);
      // Le rond se place en absolu au centre du bouton : le bouton doit être son repère.
      const position = style.position === 'static' ? '' : null;
      if (position !== null) b.style.position = 'relative';
      b.style.setProperty('--rond-couleur', style.color);
      b.setAttribute('aria-busy', 'true');
      compteurs.set(b, { n: 1, depuis: Date.now(), position });
    };
    const liberer = (b: HTMLElement) => {
      const etat = compteurs.get(b);
      if (etat === undefined) return;
      etat.n -= 1;
      if (etat.n > 0) return;
      const fin = () => {
        compteurs.delete(b);
        b.removeAttribute('aria-busy');
        b.style.removeProperty('--rond-couleur');
        if (etat.position !== null) b.style.removeProperty('position');
      };
      const reste = DUREE_MIN_MS - (Date.now() - etat.depuis);
      if (reste > 0) setTimeout(fin, reste);
      else fin();
    };

    window.fetch = function fetchSuivi(...args: Parameters<typeof fetch>) {
      const requete = args[0];
      const methode = (args[1]?.method ?? (requete instanceof Request ? requete.method : 'GET')).toUpperCase();
      const cible = dernier !== null && ECRITURES.has(methode) && Date.now() - dernier.a < FENETRE_MS && dernier.bouton.isConnected ? dernier.bouton : null;
      if (cible !== null) occuper(cible);
      const promesse = natif(...args);
      if (cible !== null) {
        const fini = () => liberer(cible);
        promesse.then(fini, fini);
      }
      return promesse;
    };

    /**
     * LES ÉCRANS QUI DÉSACTIVENT LEUR PROPRE BOUTON (« Continuer » → `disabled` pendant l'envoi) : le bouton devient
     * « en cours » dès qu'il est désactivé juste après le clic, et le reste jusqu'à ce qu'il se réactive. Cela couvre
     * aussi le temps passé AVANT la requête (jeton anti-robot, validation) que la fenêtre de `fetch` ne voit pas.
     */
    const suivreDesactivation = (b: HTMLElement) => {
      if (!(b instanceof HTMLButtonElement)) return;
      let engage = false;
      let garde: ReturnType<typeof setTimeout> | undefined;
      const finir = () => {
        observateur.disconnect();
        if (garde !== undefined) clearTimeout(garde);
        if (engage) liberer(b);
      };
      const observateur = new MutationObserver(() => {
        if (!engage && b.disabled && b.getAttribute('aria-busy') !== 'true') {
          engage = true;
          occuper(b);
          garde = setTimeout(finir, DUREE_MAX_DESACTIVE_MS);
        } else if (engage && !b.disabled) finir();
      });
      observateur.observe(b, { attributes: true, attributeFilter: ['disabled'] });
      setTimeout(() => {
        if (!engage) observateur.disconnect();
      }, ATTENTE_DESACTIVATION_MS);
    };

    // En capture : un bouton déjà en cours ne doit pas relancer son action (ni par la souris, ni par le clavier).
    const surClic = (e: MouseEvent) => {
      const b = boutonDe(e.target);
      if (b === null) return;
      if (b.getAttribute('aria-busy') === 'true') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      dernier = { bouton: b, a: Date.now() };
      suivreDesactivation(b);
    };
    document.addEventListener('click', surClic, true);

    return () => {
      document.removeEventListener('click', surClic, true);
      window.fetch = natif;
    };
  }, []);

  return null;
}
