'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, displayMessageFor } from '@/lib/api/index';

/**
 * LA COQUILLE QUI CHARGE — les trois états obligatoires de T1, et rien de plus.
 *
 * ── POURQUOI UN COMPOSANT CLIENT ────────────────────────────────────────────
 *
 * Le jeton d'accès vit en MÉMOIRE, dans la clôture de `lib/api/session.ts`, et il
 * n'existe que dans le navigateur — c'est la décision de `session.ts` et elle est
 * juste : « écrire le jeton d'accès dans un stockage lisible par JavaScript
 * rendrait ce soin inutile ». Un composant serveur n'a donc aucun moyen d'appeler
 * `/me` au nom du membre. Les dix écrans du module chargent côté client.
 *
 * Il n'y a rien à faire pour reprendre la session : le jeton meurt au
 * rechargement, le premier appel prend un `401`, et le TRANSPORT rafraîchit par le
 * cookie `httpOnly` puis rejoue — une fois, partagé en vol. Appeler
 * `resumeSession()` ici ajouterait un aller-retour au chargement de chaque page
 * pour refaire ce que le socle fait déjà, et deux rotations simultanées du jeton de
 * rafraîchissement sont exactement ce que `refreshOnce` existe pour empêcher.
 *
 * ── LA LIBERTÉ PRISE, ET ELLE EST DÉCLARÉE ──────────────────────────────────
 *
 * `08 Compte` NE DESSINE NI ATTENTE NI ÉCHEC. Aucune de ses planches ne montre un
 * squelette, un sablier ou un bandeau d'erreur. Les deux états ci-dessous sont donc
 * la seule chose de ces écrans qui ne soit pas transcodée, et il faut le dire —
 * c'est la même exigence d'honnêteté que le `⚠` du générateur pour un texte fourni
 * par le porteur.
 *
 * Ils sont réduits au strict nécessaire et n'emploient QUE des jetons de la
 * maquette : le fond `#F6F8F7` de `ScreenFrames`, le gris de texte `#5D6B66` et le
 * vert `#0F5C48` de ses liens. Aucune couleur n'est assombrie. Et ils sont ANNONCÉS
 * — `role="status"` pour l'attente, `role="alert"` pour l'échec — parce qu'un écran
 * qui change sans le dire est un écran qu'un lecteur d'écran ne suit pas.
 *
 * ── CE QUI EST DÉCIDÉ SUR `error.code`, ET JAMAIS SUR LE MESSAGE ─────────────
 *
 * `displayMessageFor` rend la phrase française pour n'importe quel échec, et elle
 * sait déjà ce que le front ne doit pas refaire :
 *
 *   · sur un `429`, elle n'affiche PAS le message du serveur — il dit « patientez
 *     un instant » pour une heure d'attente, trois routes de ce projet étant
 *     chiffrées à l'HEURE. Rien ne réessaie ici : rejouer un `429` le transforme
 *     en boucle ;
 *   · un `ApiShapeError` est un INCIDENT, pas une règle métier, et il n'hérite pas
 *     d'`ApiError` précisément pour qu'on ne puisse pas le confondre. Il est donc
 *     journalisé en console, là où un développeur le verra, avec la phrase
 *     générique à l'écran — le membre n'a rien à faire d'un contrat cassé ;
 *   · un `401` définitif veut dire « reconnectez-vous », et l'écran offre le lien
 *     plutôt que de laisser lire une erreur sans issue.
 */

type Etat<T> = { readonly phase: 'attente' } | { readonly phase: 'prêt'; readonly donnees: T } | { readonly phase: 'échec'; readonly erreur: unknown };

/**
 * Charge une fois, au montage.
 *
 * `annule` n'est pas une précaution de style : en développement, React monte
 * chaque composant deux fois, et sans lui le second démontage écrirait dans l'état
 * d'un composant parti — un avertissement que l'on finit par ignorer, donc une
 * vraie erreur que l'on n'aurait plus vue.
 */
export function useDonnees<T>(charger: () => Promise<T>): Etat<T> {
  const [etat, setEtat] = useState<Etat<T>>({ phase: 'attente' });

  useEffect(() => {
    let annule = false;
    charger().then(
      (donnees) => {
        if (!annule) setEtat({ phase: 'prêt', donnees });
      },
      (erreur: unknown) => {
        if (annule) return;
        /**
         * AUCUN `console.error` ICI, et ce n'est pas un oubli : `no-console` est
         * `error` dans la configuration de lint du dépôt, pour le code applicatif et
         * délibérément — cent vingt-quatre écrans qui journalisent chacun à leur
         * façon finissent par écrire n'importe quoi dans la console d'un membre.
         *
         * Le contrat cassé ne se perd pas pour autant : `ApiShapeError` porte la
         * route et le champ fautif, il remonte tel quel dans l'état, et
         * `displayMessageFor` le distingue d'une règle métier — il n'hérite PAS
         * d'`ApiError`, ce qui interdit structurellement de le prendre pour l'autre.
         * Le brancher sur un rapporteur d'incident est un geste d'application, pas
         * d'écran : il se fait une fois, au niveau du `layout`.
         */
        setEtat({ phase: 'échec', erreur });
      },
    );
    return () => {
      annule = true;
    };
    /**
     * `charger` EST DANS LES DÉPENDANCES, et il doit y être.
     *
     * La version précédente déclarait `[]` et désactivait la règle par un
     * commentaire — lequel nommait d'ailleurs une règle absente de la configuration,
     * donc ne désactivait rien. C'était un aveu déguisé : « je sais que la
     * dépendance manque ».
     *
     * Elle ne manque plus, et rien ne boucle, parce que les appelants fournissent une
     * fonction STABLE : les neuf pages passent une fonction de module
     * (`chargerK01`…), et K02 — la seule dont l'appel dépend d'un paramètre de route —
     * passe un `useCallback` mémoïsé sur le pseudo. Un appelant qui fournirait une
     * fonction anonyme rechargerait en boucle, et c'est une propriété qu'on veut
     * VISIBLE plutôt que masquée : la boucle se voit tout de suite, un rechargement
     * manqué ne se voit jamais.
     */
  }, [charger]);

  return etat;
}

const CADRE: React.CSSProperties = {
  minHeight: '60vh',
  background: '#F6F8F7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  textAlign: 'center',
};

/**
 * L'écran d'un module Compte, une fois ses données là.
 *
 * `children` reçoit les données : les cadres transcodés les lisent en propriétés,
 * et cette coquille ne connaît ni leur forme ni leur nombre.
 */
export function EcranDonnees<T>({
  charger,
  children,
}: {
  readonly charger: () => Promise<T>;
  readonly children: (donnees: T) => ReactNode;
}) {
  const etat = useDonnees(charger);

  if (etat.phase === 'attente') {
    return (
      <div style={CADRE} role="status" aria-live="polite">
        <span style={{ fontSize: '14px', color: '#5D6B66' }}>Chargement de votre compte…</span>
      </div>
    );
  }

  if (etat.phase === 'échec') {
    const perdue =
      etat.erreur instanceof ApiError && (etat.erreur.status === 401 || etat.erreur.status === 403);
    return (
      <div style={CADRE} role="alert">
        <span style={{ fontSize: '14px', color: '#5D6B66' }}>
          {displayMessageFor(etat.erreur)}
          {perdue ? (
            <>
              {' '}
              <a href="/connexion" style={{ color: '#0F5C48', fontWeight: 700 }}>
                Se reconnecter
              </a>
            </>
          ) : null}
        </span>
      </div>
    );
  }

  return <>{children(etat.donnees)}</>;
}
