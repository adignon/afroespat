/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « UNE STORY VIENT D'ÊTRE LUE » — DIT AU FIL, SANS ATTENDRE UN ALLER-RETOUR ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Il faut rafraîchir pour savoir ce qui est lu ou pas. »
 *
 * MESURÉ : l'anneau restait vert (3 px) après la fermeture de la fenêtre, et ne
 * passait au gris (1 px) qu'au rechargement de la page. C'est normal et c'était
 * incomplet : la story s'ouvre dans une FENÊTRE — une route interceptée, montée
 * À CÔTÉ du fil, pas dedans — donc rien ne redescend du lecteur vers le bandeau.
 *
 * ── POURQUOI UN ÉVÉNEMENT, ET PAS UN ÉTAT PARTAGÉ ──────────────────────────
 *
 * Les deux arbres sont des routes PARALLÈLES de Next : le fil ne rend pas la
 * fenêtre, et la fenêtre ne rend pas le fil. Un état commun demanderait un
 * fournisseur au-dessus des deux, c'est-à-dire dans la disposition — un objet
 * global de plus, monté sur chaque page du produit, pour une information qui ne
 * concerne que ces deux-là.
 *
 * ── POURQUOI PAS UN SIMPLE RE-APPEL DU RUBAN ───────────────────────────────
 *
 * Parce qu'il arriverait TROP TARD et pas toujours : la fenêtre se ferme, le
 * membre regarde déjà son fil, et l'anneau changerait sous ses yeux une seconde
 * plus tard. Le serveur, lui, a déjà enregistré la vue — `GET /stories/:id`
 * l'écrit. On ne demande donc pas une vérité qu'on connaît : on la pose.
 */

/** Le nom de l'événement. Écrit une fois, pour que les deux côtés ne divergent pas. */
const NOM = 'dp:story-vue';

/** Signale que cette story vient d'être LUE — le serveur l'a déjà enregistrée. */
export function signalerStoryVue(storyId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(NOM, { detail: storyId }));
}

/** S'abonne aux lectures. Rend la fonction de désabonnement. */
export function ecouterStoriesVues(onVue: (storyId: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const relais = (evenement: Event): void => {
    const { detail } = evenement as CustomEvent<unknown>;
    if (typeof detail === 'string' && detail !== '') onVue(detail);
  };
  window.addEventListener(NOM, relais);
  return () => {
    window.removeEventListener(NOM, relais);
  };
}
