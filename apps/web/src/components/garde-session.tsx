'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { BandeauAnnonce } from './bandeau-annonce';
import { FenetreConsentement } from './fenetre-consentement';

/**
 * LA GARDE DE SESSION — un visiteur non identifié est renvoyé vers la connexion.
 *
 * Elle n'existait pas. Pas « elle était mal branchée » : aucun middleware, aucune
 * redirection, et pas même de `layout.tsx` pour le groupe `(app)` où une garde
 * aurait pu vivre. Un visiteur sans session voyait la coquille de l'application —
 * rail, colonnes, en-tête de recherche — avec des écrans vides derrière.
 *
 * ── POURQUOI CE N'EST PAS UN MIDDLEWARE, ET CE N'EST PAS UN CHOIX ───────────
 *
 * Un middleware Next serait meilleur : redirection côté serveur, aucun clignotement.
 * Il est IMPOSSIBLE ici, et c'est mesuré plutôt que supposé :
 *
 *   · le jeton d'accès vit en MÉMOIRE (`api/session.ts` explique pourquoi : le
 *     mettre dans `localStorage` annulerait le soin pris à rendre le jeton de
 *     rafraîchissement `httpOnly`). Le serveur de rendu n'en voit donc aucun ;
 *   · le cookie de rafraîchissement, lui, existe — mais il porte
 *     `path: '/v1/auth'` et il est posé par l'API sur SON origine. Le navigateur
 *     ne l'envoie qu'aux chemins commençant par `/v1/auth`. Un middleware qui
 *     tourne sur `/accueil` ne le reçoit jamais, et conclurait « pas de session »
 *     pour tout le monde.
 *
 * Le serveur ne peut donc pas savoir. La garde est côté client, et elle attend que
 * la reprise ait TRANCHÉ — rediriger avant déconnecterait une session valide à
 * chaque rechargement, puisque le jeton meurt avec l'onglet.
 *
 * ── POURQUOI ELLE N'ESCAMOTE PAS LE CONTENU PENDANT L'ATTENTE ──────────────
 *
 * Rendre `null` tant que la reprise n'a pas répondu serait le réflexe. Ce serait
 * une régression : ce composant est client, donc il rendrait `null` AUSSI au rendu
 * serveur — et le HTML servi redeviendrait vide. Deux tests existent précisément
 * pour l'empêcher (`e2e/shell.spec.ts`, « rendu serveur »), écrits après que cinq
 * pages de ce produit ont été servies vides, dont une qui faisait 8 Ko de script
 * et zéro mot.
 *
 * On rend donc les enfants, et on redirige dès que la reprise a échoué. Le coût
 * est un aller-retour réseau pendant lequel la coquille est visible — le même
 * délai qu'avant, à ceci près qu'il se termine maintenant par une redirection.
 *
 * ── CE QUE CETTE CORRECTION OUVRE ──────────────────────────────────────────
 *
 * La question est obligatoire sur ce projet : une correction d'authentification y
 * a déjà ouvert une élévation de privilège. Celle-ci n'installe aucun droit et ne
 * lit aucun niveau — elle ne décide que « a-t-on une session, oui ou non », et
 * c'est le serveur qui répond. Elle ne remplace AUCUN contrôle d'accès : chaque
 * route de l'API garde le sien, et une garde de front qui s'y substituerait serait
 * une garde qu'on peut retirer avec un outil de développement.
 */
export function GardeSession({ children }: { readonly children: React.ReactNode }) {
  const router = useRouter();
  const chemin = usePathname();
  const [tranchee, setTranchee] = useState(() => hasAccessToken());

  useEffect(() => {
    if (tranchee) return;

    let vivant = true;
    void resumeSession().then((ouverte) => {
      if (!vivant) return;
      if (ouverte) {
        setTranchee(true);
        return;
      }
      /**
       * `replace` et non `push` : l'écran qu'on quitte n'était pas consultable, le
       * laisser dans l'historique ferait qu'un retour arrière y revienne pour être
       * aussitôt renvoyé — une boucle visible.
       *
       * `suite` porte la destination voulue pour que la connexion y ramène. Elle
       * est encodée, et c'est la connexion qui devra vérifier qu'elle est bien un
       * chemin interne : une redirection ouverte se construit exactement comme ça.
       */
      const suite = chemin === null ? '' : `?suite=${encodeURIComponent(chemin)}`;
      router.replace(`/connexion${suite}`);
    });

    return () => {
      vivant = false;
    };
  }, [tranchee, router, chemin]);

  /**
   * Deux ajouts du lot « contenu légal », posés ICI parce que c'est le seul endroit où l'on
   * sait qu'une session existe : le bandeau d'annonce d'équipe (15 §4.2) et la fenêtre qui
   * redemande le consentement quand un document légal change (01 §2.10). Ni l'un ni l'autre
   * ne s'ouvre sans session — le rendu serveur (`tranchee` faux) n'en montre rien.
   */
  return (
    <>
      {tranchee ? <BandeauAnnonce /> : null}
      {children}
      {tranchee ? <FenetreConsentement /> : null}
    </>
  );
}
