import { randomFillSync } from 'node:crypto';

/**
 * UUID v7 (RFC 9562) — identifiants triables chronologiquement, générés par
 * l'application, jamais par la base (00-fondations.md §6.1).
 *
 * Pourquoi v7 plutôt que v4 : l'ordre d'insertion suit l'ordre temporel, donc les
 * index B-tree restent compacts et la pagination par curseur peut s'appuyer sur
 * l'identifiant. Pourquoi pas de dépendance : 40 lignes et un test valent mieux
 * qu'un paquet de plus dans la chaîne d'approvisionnement.
 *
 * Disposition :
 *   48 bits  horodatage en millisecondes Unix
 *    4 bits  version (0b0111)
 *   12 bits  compteur monotone — départage les appels d'une même milliseconde
 *    2 bits  variante (0b10)
 *   62 bits  aléatoire
 */

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

let lastMs = -1;
let counter = 0;

const scratch = new Uint8Array(16);

/**
 * Deux appels dans la même milliseconde restent ordonnés grâce au compteur.
 * Si le compteur sature (4096 identifiants dans la même milliseconde), on
 * emprunte sur la milliseconde suivante plutôt que de casser la monotonie.
 */
function nextTimestampAndCounter(nowMs: number): { ms: number; counter: number } {
  if (nowMs > lastMs) {
    lastMs = nowMs;
    counter = 0;
    return { ms: nowMs, counter };
  }
  // Horloge stagnante ou reculée : on garde la dernière valeur et on incrémente.
  counter += 1;
  if (counter > 0x0fff) {
    lastMs += 1;
    counter = 0;
  }
  return { ms: lastMs, counter };
}

function format(ms: number, seq: number): string {
  randomFillSync(scratch, 6, 10);

  // 48 bits d'horodatage, gros-boutien.
  scratch[0] = (ms / 2 ** 40) & 0xff;
  scratch[1] = (ms / 2 ** 32) & 0xff;
  scratch[2] = (ms / 2 ** 24) & 0xff;
  scratch[3] = (ms / 2 ** 16) & 0xff;
  scratch[4] = (ms / 2 ** 8) & 0xff;
  scratch[5] = ms & 0xff;

  // Version 7 sur les 4 bits hauts de l'octet 6, puis 12 bits de compteur.
  scratch[6] = 0x70 | ((seq >>> 8) & 0x0f);
  scratch[7] = seq & 0xff;

  // Variante RFC (0b10) sur les 2 bits hauts de l'octet 8 ; le reste est aléatoire.
  scratch[8] = 0x80 | (scratch[8]! & 0x3f);

  // `scratch` fait exactement 16 octets et HEX couvre les 256 valeurs possibles :
  // aucun accès ne peut être hors bornes. Le helper isole l'unique assertion.
  const byteAt = (i: number): string => HEX[scratch[i] as number] as string;

  return (
    byteAt(0) + byteAt(1) + byteAt(2) + byteAt(3) +
    '-' +
    byteAt(4) + byteAt(5) +
    '-' +
    byteAt(6) + byteAt(7) +
    '-' +
    byteAt(8) + byteAt(9) +
    '-' +
    byteAt(10) + byteAt(11) + byteAt(12) + byteAt(13) + byteAt(14) + byteAt(15)
  );
}

/** Un nouvel identifiant, horodaté à maintenant. */
export function newId(): string {
  const { ms, counter: seq } = nextTimestampAndCounter(Date.now());
  return format(ms, seq);
}

/**
 * Un identifiant horodaté à un instant donné. Réservé aux données de départ et
 * aux tests : le code applicatif emploie `newId()`.
 */
export function newIdAt(date: Date): string {
  return format(date.getTime(), 0);
}

/** Extrait l'horodatage porté par un UUID v7. Utile aux curseurs et au débogage. */
export function timestampOf(id: string): Date {
  const hex = id.replace(/-/g, '').slice(0, 12);
  return new Date(Number.parseInt(hex, 16));
}
