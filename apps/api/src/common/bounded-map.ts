/**
 * Une `Map` à taille bornée, pour les caches en mémoire.
 *
 * Les caches du processus (réseau commun, calendrier, bureaux de ville, barre
 * latérale) étaient indexés par membre : sans borne, ils croissent avec le
 * nombre de membres vus depuis le démarrage. À l'insertion d'une NOUVELLE clé
 * au-delà de `maxEntries`, la plus ancienne (ordre d'insertion) est évincée.
 * La péremption (TTL) reste vérifiée par l'appelant à la lecture, comme avant.
 */
export class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly maxEntries: number) {
    super();
  }

  override set(key: K, value: V): this {
    if (this.has(key)) {
      // Réinsérer la clé la rend « la plus récente ».
      this.delete(key);
    } else {
      while (this.size >= this.maxEntries) {
        const oldest = this.keys().next();
        if (oldest.done === true) break;
        this.delete(oldest.value);
      }
    }
    return super.set(key, value);
  }
}

/** Plafond commun des caches en mémoire par membre. */
export const CACHE_MAX_ENTRIES = 5_000;
