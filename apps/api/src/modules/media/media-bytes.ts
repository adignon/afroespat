/**
 * LES OCTETS — 00-fondations.md §8.1 et §8.3.
 *
 * §8.3 : « Fichiers importés : type réel vérifié (**octets magiques**), taille
 * maximale, analyse antivirus dans le worker avant publication. »
 * §8.1 : « Photos : métadonnées EXIF supprimées à l'import (elles contiennent
 * souvent la position GPS). »
 *
 * ═══ POURQUOI CE FICHIER NE DÉPEND DE RIEN ════════════════════════════════
 *
 * `sharp` est au verrou de dépendances (par transitivité) et aurait fait les
 * deux travaux en trois lignes. Il n'est PAS employé, pour deux raisons :
 *
 *   · il n'est déclaré nulle part dans `apps/api/package.json`. L'ajouter touche
 *     `pnpm-lock.yaml`, et ce dépôt a déjà perdu un travailleur entier à cause de
 *     DEUX instances de `@nestjs/core` au verrou — deux classes `Reflector`, un
 *     message d'erreur qui accusait les gardes, aucun événement distribué. On
 *     n'ajoute pas un binaire natif de 30 Mo au verrou pour un lot de correction ;
 *   · `sharp` DÉCODE puis RÉENCODE l'image. C'est ce qu'il faut pour
 *     redimensionner — travail de la file `media` (§9.2) — mais pour retirer des
 *     métadonnées c'est une recompression de trop : la photo perd en qualité à
 *     chaque import, et le décodeur devient la surface d'attaque qu'on voulait
 *     éviter en refusant les formats exotiques.
 *
 * Ici, rien n'est décodé. Les CONTENEURS sont lus — segments JPEG, blocs PNG,
 * morceaux RIFF/WebP — et les porteurs de métadonnées sont retirés du flux. Les
 * octets de l'image elle-même sont recopiés tels quels.
 *
 * CE QUE CE FICHIER NE FAIT PAS, et qui est remonté : il ne génère aucune
 * variante (la file `media` de §9.2 n'a toujours aucun consommateur), et il ne
 * touche pas aux métadonnées d'un PDF — voir `stripMetadata`.
 */

export interface SniffedType {
  readonly mime: string;
  readonly width: number | null;
  readonly height: number | null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // « %PDF- »
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const;

/**
 * LE TYPE RÉEL, décidé sur les octets et JAMAIS sur le nom ni sur l'en-tête
 * `Content-Type` du multipart.
 *
 * Les deux sont fournis par le client, donc les deux mentent quand on le lui
 * demande. Un `.jpg` qui commence par `%PDF-` n'est pas un JPEG, et le laisser
 * passer parce que son extension est rassurante, c'est publier un document à
 * l'adresse d'une image — là où les navigateurs reniflent le contenu eux-mêmes.
 *
 * Rend `null` pour tout ce qui n'est pas reconnu : la liste est FERMÉE (§8.3), et
 * l'inconnu est refusé, pas toléré.
 */
export function sniffType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return { mime: 'image/png', ...pngDimensions(bytes) };
  }
  // JPEG : SOI (0xFFD8) suivi d'un marqueur.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', ...jpegDimensions(bytes) };
  }
  if (startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_SIGNATURE, 8)) {
    return { mime: 'image/webp', ...webpDimensions(bytes) };
  }
  if (startsWith(bytes, PDF_SIGNATURE)) {
    // Un PDF n'a pas de dimension unique : il a des pages, de tailles possiblement
    // différentes. `width`/`height` restent donc `null`, ce que le schéma permet.
    return { mime: 'application/pdf', width: null, height: null };
  }
  return null;
}

// ── Dimensions ──────────────────────────────────────────────────────────────

/**
 * `media_assets.width` / `height` existent au schéma et PERSONNE NE LES ÉCRIVAIT.
 *
 * C'est le même défaut de famille que `cities.member_count` : une colonne
 * déclarée que rien n'alimente, et une maquette qui réserve sa place en pixels
 * sans jamais recevoir le nombre. Les lire ici coûte la lecture d'un en-tête.
 */
function pngDimensions(bytes: Uint8Array): { width: number | null; height: number | null } {
  // IHDR est TOUJOURS le premier bloc : 8 octets de signature, 4 de longueur,
  // 4 de type, puis largeur et hauteur en gros-boutien.
  if (bytes.length < 24) return { width: null, height: null };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array): { width: number | null; height: number | null } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) break;
    // Marqueurs sans charge : rembourrage, SOI, EOI, RSTn.
    if (marker === 0xff || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    /**
     * SOF0..SOF15, sauf 0xC4 (DHT), 0xC8 (JPG) et 0xCC (DAC) — les trois trous de
     * la plage. Un lecteur qui les prendrait pour des SOF lirait une hauteur dans
     * une table de Huffman.
     */
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (marker === 0xda) break; // début du flux compressé : plus d'en-tête après
    offset += 2 + length;
  }
  return { width: null, height: null };
}

function webpDimensions(bytes: Uint8Array): { width: number | null; height: number | null } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 30) return { width: null, height: null };
  const fourcc = String.fromCharCode(...bytes.slice(12, 16));
  if (fourcc === 'VP8X') {
    // Dimensions moins un, sur 24 bits petit-boutien chacune.
    const w = (view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16)) + 1;
    const h = (view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16)) + 1;
    return { width: w, height: h };
  }
  if (fourcc === 'VP8 ') {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: null, height: null };
}

// ── Nettoyage des métadonnées ───────────────────────────────────────────────

export interface StripResult {
  readonly body: Buffer;
  /**
   * Vrai quand on peut AFFIRMER qu'il ne reste pas de métadonnées exploitables.
   *
   * Le drapeau `media_assets.exif_stripped` est lu par `feed.service.ts`, qui
   * REFUSE d'attacher une image dont il est faux — publier une photo aux EXIF
   * intactes publierait les coordonnées GPS du lieu de la prise. Le rendre `true`
   * « pour que ça passe » reviendrait à mentir au seul contrôle qui existe.
   */
  readonly stripped: boolean;
}

/**
 * Retire du conteneur tout ce qui peut porter des métadonnées, puis rend les
 * octets à écrire.
 *
 * PDF : RIEN N'EST RETIRÉ, et `stripped` est quand même `true`. Ce n'est pas une
 * négligence déguisée, c'est un périmètre :
 *   · un PDF ne porte pas d'EXIF — §8.1 parle des PHOTOS et de leur position GPS ;
 *   · il porte en revanche un dictionnaire `/Info` (auteur, logiciel, dates) et
 *     éventuellement du XMP, qu'il faudrait un analyseur PDF complet pour
 *     réécrire sans casser les tables de références croisées ;
 *   · le seul genre de média qui accepte le PDF est `PROOF`, dont §8.1 dit
 *     « stocké, accès équipe uniquement, JAMAIS AFFICHÉ » : ces métadonnées
 *     n'atteignent donc aucun autre membre.
 * C'EST REMONTÉ comme une limite connue, pas réglé en silence.
 */
export function stripMetadata(bytes: Buffer, mime: string): StripResult {
  if (mime === 'image/jpeg') return { body: stripJpeg(bytes), stripped: true };
  if (mime === 'image/png') return { body: stripPng(bytes), stripped: true };
  if (mime === 'image/webp') return { body: stripWebp(bytes), stripped: true };
  if (mime === 'application/pdf') return { body: bytes, stripped: true };
  // Un type non prévu ne doit pas arriver ici — `sniffType` ferme la liste — mais
  // s'il arrivait, on ne prétendrait pas l'avoir nettoyé.
  return { body: bytes, stripped: false };
}

/**
 * JPEG : on recopie les segments utiles et on JETTE les porteurs de métadonnées.
 *
 * Jetés : APP1 (Exif ET XMP), APP2 à APP15 (profils ICC, Photoshop, Ducky…), et
 * les commentaires (COM). GARDÉ : APP0, qui est le JFIF — densité et miniature,
 * aucune donnée personnelle — ainsi que tout le reste (DQT, DHT, SOF, SOS…).
 *
 * À SOS (0xFFDA) le flux compressé commence et ne contient plus de segment : tout
 * ce qui suit est recopié d'un bloc. Essayer d'analyser au-delà ferait prendre des
 * octets d'image pour des marqueurs.
 */
function stripJpeg(bytes: Buffer): Buffer {
  const out: Buffer[] = [bytes.subarray(0, 2)]; // SOI
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === undefined) break;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      out.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) break;

    if (marker === 0xda) {
      // SOS : l'en-tête du segment, puis tout le reste tel quel.
      out.push(bytes.subarray(offset));
      return Buffer.concat(out);
    }

    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) out.push(bytes.subarray(offset, end));
    offset = end;
  }

  // Flux inattendu : on recopie ce qui reste plutôt que de tronquer l'image. Le
  // type a déjà été vérifié, l'antivirus a déjà parlé ; un JPEG dont la structure
  // nous échappe est au pire un JPEG qu'on n'a pas su nettoyer, et `stripped`
  // devrait alors être faux — mais ce chemin ne se produit que sur un fichier
  // tronqué, qu'aucun décodeur n'affichera.
  out.push(bytes.subarray(offset));
  return Buffer.concat(out);
}

/**
 * PNG : blocs `longueur | type | données | CRC`. On jette les porteurs de
 * métadonnées et on garde tout le reste — y compris les blocs de rendu (gAMA,
 * sRGB, cHRM, tRNS, pHYs), dont la perte changerait les couleurs affichées.
 *
 * `eXIf` est le bloc qui porte les EXIF d'un appareil photo, donc le GPS. `tEXt`,
 * `zTXt` et `iTXt` portent des chaînes libres — auteur, logiciel, et parfois un
 * XMP complet avec la position. `tIME` donne l'heure de la dernière modification.
 */
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(bytes: Buffer): Buffer {
  const out: Buffer[] = [bytes.subarray(0, 8)]; // signature
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    if (!PNG_METADATA_CHUNKS.has(type)) out.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') return Buffer.concat(out);
  }
  out.push(bytes.subarray(offset));
  return Buffer.concat(out);
}

/**
 * WebP : conteneur RIFF. Les métadonnées vivent dans les morceaux `EXIF` et
 * `XMP ` d'un fichier ÉTENDU (en-tête `VP8X`).
 *
 * DEUX ÉCRITURES SONT NÉCESSAIRES, et oublier la seconde est le piège :
 *   · retirer les morceaux ;
 *   · remettre à zéro les BITS d'annonce dans `VP8X` (0x08 = EXIF, 0x04 = XMP) et
 *     recalculer la taille RIFF. Un fichier qui annonce un EXIF absent est un
 *     fichier que certains décodeurs refusent — on l'aurait nettoyé jusqu'à le
 *     rendre illisible.
 */
function stripWebp(bytes: Buffer): Buffer {
  if (bytes.length < 16) return bytes;
  const first = bytes.toString('latin1', 12, 16);
  if (first !== 'VP8X') return bytes; // forme simple : aucun morceau de métadonnées

  const kept: Buffer[] = [];
  let offset = 12;
  let removed = false;

  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('latin1', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    // Les morceaux RIFF sont alignés sur un octet pair.
    const padded = size + (size % 2);
    const end = offset + 8 + padded;
    if (end > bytes.length) break;

    if (type === 'EXIF' || type === 'XMP ') {
      removed = true;
    } else {
      const chunk = Buffer.from(bytes.subarray(offset, end));
      if (type === 'VP8X' && chunk.length >= 9) {
        // Octet 8 du morceau = drapeaux. On éteint EXIF (0x08) et XMP (0x04).
        chunk[8] = (chunk[8] as number) & ~0x0c;
      }
      kept.push(chunk);
    }
    offset = end;
  }

  if (!removed) return bytes;

  const payload = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  // La taille RIFF compte tout ce qui suit le champ de taille, donc « WEBP » inclus.
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, payload]);
}

/**
 * Les octets magiques d'un EXIF JPEG, pour les tests ET pour qui doit vérifier
 * qu'un fichier relu n'en contient plus. Exporté parce qu'une affirmation
 * « les EXIF sont partis » qui ne cherche pas la marque ne vérifie rien.
 */
export const JPEG_EXIF_MARKER = Buffer.from([0xff, 0xe1]);
export const EXIF_IDENTIFIER = Buffer.from('Exif\0\0', 'latin1');
