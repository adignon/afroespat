import { z } from 'zod';

/**
 * Le schéma d'une réponse SANS CORPS — les `204` de T4 §1 (« action sans retour :
 * `204` »).
 *
 * Il existe pour que personne n'ait à inventer le sien, et surtout pour qu'une
 * route sans corps se DÉCLARE. Le transport exige un schéma sur chaque appel : sans
 * ce constant, la tentation serait d'ajouter une surcharge « sans schéma », et c'est
 * par cette porte que la validation cesse d'être obligatoire.
 *
 * `z.undefined()` et non `z.void()` : le transport présente `undefined` au schéma
 * quand la réponse n'a pas de corps. `z.void()` accepterait aussi `null`, donc un
 * corps `null` inattendu — une route qui se met à répondre `200 null` là où elle
 * répondait `204` — passerait sans qu'on le remarque. Ce qui est précisément le
 * genre de changement silencieux que cette frontière existe pour attraper.
 */
export const voidResponse = z.undefined();
