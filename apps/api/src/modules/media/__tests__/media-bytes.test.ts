import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { EXIF_IDENTIFIER, sniffType, stripMetadata } from '../media-bytes';

/**
 * LES OCTETS — 00-fondations.md §8.1 et §8.3.
 *
 * §8.3 : « type réel vérifié (**octets magiques**) ». §8.1 : « métadonnées EXIF
 * supprimées à l'import (elles contiennent souvent la position GPS) ».
 *
 * CE FICHIER NE TOUCHE NI LA BASE NI LE RÉSEAU, et c'est délibéré : ce qu'il
 * éprouve est une transformation d'octets, la partie la plus facile à casser et la
 * plus silencieuse quand elle l'est. Une image dont les EXIF restent s'affiche
 * parfaitement — rien ne se voit, sauf la position GPS de qui l'a prise.
 *
 * Les fabriques ci-dessous construisent de VRAIS conteneurs : pas de doublure, pas
 * de fichier d'essai binaire commité dont personne ne saurait dire ce qu'il
 * contient. Chaque marque cherchée est une marque qu'on a mise.
 */

// ── Fabriques ───────────────────────────────────────────────────────────────

const GPS_MARKER = 'GPS-POSITION-SECRETE-48N-2E';
const COMMENT_MARKER = 'COMMENTAIRE-A-RETIRER';

/** Un JPEG structurellement valide, porteur d'un APP1 Exif et d'un COM. */
function jpegAvecExif(options: { exif?: boolean; comment?: boolean } = {}): Buffer {
  const { exif = true, comment = true } = options;
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])]; // SOI

  if (exif) {
    const payload = Buffer.concat([
      EXIF_IDENTIFIER,
      Buffer.from('MM\0*', 'latin1'),
      Buffer.from([0x00, 0x00, 0x00, 0x08]),
      Buffer.from(GPS_MARKER, 'latin1'),
    ]);
    const header = Buffer.alloc(4);
    header.writeUInt16BE(0xffe1, 0);
    header.writeUInt16BE(payload.length + 2, 2);
    parts.push(header, payload);
  }

  if (comment) {
    const payload = Buffer.from(COMMENT_MARKER, 'latin1');
    const header = Buffer.alloc(4);
    header.writeUInt16BE(0xfffe, 0);
    header.writeUInt16BE(payload.length + 2, 2);
    parts.push(header, payload);
  }

  // DQT — un segment ORDINAIRE, qui doit SURVIVRE. Sans lui, le test ne
  // distinguerait pas « on retire les métadonnées » de « on retire tout ».
  const dqt = Buffer.alloc(4 + 1 + 64);
  dqt.writeUInt16BE(0xffdb, 0);
  dqt.writeUInt16BE(2 + 1 + 64, 2);
  dqt[4] = 0x00;
  dqt.fill(16, 5);
  parts.push(dqt);

  // SOF0 : hauteur 8, largeur 16.
  parts.push(
    Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00]),
  );
  // SOS, puis des octets d'image, puis EOI.
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]));
  parts.push(Buffer.from([0x12, 0x34, 0x56, 0x78]));
  parts.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (~c) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Un PNG 3×2 avec `tEXt`, `eXIf`, `tIME`, et un `gAMA` qui doit survivre. */
function pngAvecMetadonnees(): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(3, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const gama = Buffer.alloc(4);
  gama.writeUInt32BE(45_455);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', Buffer.from(`Author\0${GPS_MARKER}`, 'latin1')),
    pngChunk('eXIf', Buffer.from(`MM\0*${GPS_MARKER}`, 'latin1')),
    pngChunk('tIME', Buffer.from([0x07, 0xea, 0x01, 0x01, 0x00, 0x00, 0x00])),
    pngChunk('gAMA', gama),
    pngChunk('IDAT', deflateSync(Buffer.alloc(2 * (1 + 3 * 3)))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function riffChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(type, 0, 'latin1');
  header.writeUInt32LE(data.length, 4);
  const pad = data.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
  return Buffer.concat([header, data, pad]);
}

/** Un WebP ÉTENDU (`VP8X`) annonçant EXIF et XMP, et les portant. */
function webpEtenduAvecExif(): Buffer {
  const vp8x = Buffer.alloc(10);
  // Drapeaux : 0x08 = EXIF présent, 0x04 = XMP présent.
  vp8x[0] = 0x0c;
  // Largeur - 1 = 15, hauteur - 1 = 7, sur 24 bits petit-boutien.
  vp8x.writeUIntLE(15, 4, 3);
  vp8x.writeUIntLE(7, 7, 3);

  const payload = Buffer.concat([
    riffChunk('VP8X', vp8x),
    riffChunk('VP8 ', Buffer.alloc(16, 0x11)),
    riffChunk('EXIF', Buffer.from(`MM\0*${GPS_MARKER}`, 'latin1')),
    riffChunk('XMP ', Buffer.from(`<x>${GPS_MARKER}</x>`, 'latin1')),
  ]);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, payload]);
}

// ── Le type RÉEL (§8.3) ─────────────────────────────────────────────────────

describe('type réel par octets magiques (§8.3)', () => {
  it('reconnaît JPEG, PNG, WebP et PDF, avec leurs dimensions', () => {
    expect(sniffType(jpegAvecExif())).toEqual({ mime: 'image/jpeg', width: 16, height: 8 });
    expect(sniffType(pngAvecMetadonnees())).toEqual({ mime: 'image/png', width: 3, height: 2 });
    expect(sniffType(webpEtenduAvecExif())).toEqual({ mime: 'image/webp', width: 16, height: 8 });
    expect(sniffType(Buffer.from('%PDF-1.7\n%%EOF\n', 'latin1'))).toEqual({
      mime: 'application/pdf',
      width: null,
      height: null,
    });
  });

  /**
   * LE CŒUR DE §8.3 : l'extension et le `Content-Type` du multipart viennent du
   * CLIENT. Un fichier nommé `photo.jpg`, annoncé `image/jpeg`, et commençant par
   * `%PDF-` est un PDF. Le servir à l'adresse d'une image, c'est le laisser
   * s'exécuter dans le lecteur du navigateur de qui le regarde.
   */
  it('un PDF déguisé en JPEG est reconnu comme PDF, pas comme image', () => {
    const menteur = Buffer.from('%PDF-1.4\n% je ne suis pas un JPEG\n%%EOF\n', 'latin1');
    expect(sniffType(menteur)?.mime).toBe('application/pdf');
  });

  /**
   * SVG : REFUSÉ, et c'est le refus le plus important de la liste.
   *
   * Un SVG est un document XML qui exécute du script dans le navigateur qui
   * l'affiche. Servi depuis le domaine des médias, il vaut une faille XSS — et
   * aucun octet magique ne le distingue d'un fichier texte, donc la seule défense
   * est une liste FERMÉE de types reconnus.
   */
  it('rend null sur un SVG, un script, un ZIP et un fichier vide — la liste est FERMÉE', () => {
    expect(sniffType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8'))).toBeNull();
    expect(sniffType(Buffer.from('<script>alert(1)</script>', 'utf8'))).toBeNull();
    expect(sniffType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]))).toBeNull();
    expect(sniffType(Buffer.alloc(0))).toBeNull();
    expect(sniffType(Buffer.from([0xff, 0xd8]))).toBeNull(); // SOI tronqué
  });
});

// ── Les métadonnées (§8.1) ──────────────────────────────────────────────────

describe('suppression des métadonnées à l’import (§8.1)', () => {
  it('JPEG : l’APP1 Exif et le commentaire partent, le DQT et l’image restent', () => {
    const original = jpegAvecExif();
    expect(original.includes(EXIF_IDENTIFIER)).toBe(true);
    expect(original.includes(GPS_MARKER)).toBe(true);
    expect(original.includes(COMMENT_MARKER)).toBe(true);

    const { body, stripped } = stripMetadata(original, 'image/jpeg');
    expect(stripped).toBe(true);
    expect(body.includes(EXIF_IDENTIFIER), 'la marque Exif est encore là').toBe(false);
    expect(body.includes(GPS_MARKER), 'la position GPS est encore là').toBe(false);
    expect(body.includes(COMMENT_MARKER)).toBe(false);

    // CE QUI DOIT RESTER : l'image est toujours un JPEG lisible, avec son SOI,
    // son DQT, son SOF, son SOS et ses octets d'image.
    expect(body.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(body.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
    expect(body.includes(Buffer.from([0xff, 0xdb])), 'le DQT a disparu').toBe(true);
    expect(body.includes(Buffer.from([0xff, 0xda])), 'le SOS a disparu').toBe(true);
    expect(body.includes(Buffer.from([0x12, 0x34, 0x56, 0x78])), 'les octets d’image').toBe(true);
    // Et le type RÉEL du résultat est toujours un JPEG, dimensions comprises.
    expect(sniffType(body)).toEqual({ mime: 'image/jpeg', width: 16, height: 8 });
  });

  it('JPEG déjà propre : le nettoyage ne le change pas', () => {
    const propre = jpegAvecExif({ exif: false, comment: false });
    const { body } = stripMetadata(propre, 'image/jpeg');
    expect(body).toEqual(propre);
  });

  it('PNG : tEXt, eXIf et tIME partent ; IHDR, gAMA, IDAT et IEND restent', () => {
    const original = pngAvecMetadonnees();
    const { body, stripped } = stripMetadata(original, 'image/png');
    expect(stripped).toBe(true);

    for (const type of ['tEXt', 'eXIf', 'tIME']) {
      expect(body.includes(Buffer.from(type, 'latin1')), `${type} est resté`).toBe(false);
    }
    expect(body.includes(GPS_MARKER)).toBe(false);

    // `gAMA` est un bloc de RENDU : le retirer changerait les couleurs affichées.
    for (const type of ['IHDR', 'gAMA', 'IDAT', 'IEND']) {
      expect(body.includes(Buffer.from(type, 'latin1')), `${type} a disparu`).toBe(true);
    }
    expect(sniffType(body)).toEqual({ mime: 'image/png', width: 3, height: 2 });
  });

  /**
   * WebP : LES DEUX ÉCRITURES.
   *
   * Retirer les morceaux ne suffit pas : les BITS d'annonce de `VP8X` doivent être
   * éteints et la taille RIFF recalculée. Un fichier qui annonce un EXIF absent est
   * un fichier que certains décodeurs refusent — on l'aurait nettoyé jusqu'à le
   * rendre illisible, ce qu'aucune recherche de chaîne ne verrait.
   */
  it('WebP : les morceaux EXIF et XMP partent, les drapeaux VP8X sont éteints, la taille RIFF est juste', () => {
    const original = webpEtenduAvecExif();
    expect(original.includes(Buffer.from('EXIF', 'latin1'))).toBe(true);

    const { body, stripped } = stripMetadata(original, 'image/webp');
    expect(stripped).toBe(true);
    expect(body.includes(Buffer.from('EXIF', 'latin1'))).toBe(false);
    expect(body.includes(Buffer.from('XMP ', 'latin1'))).toBe(false);
    expect(body.includes(GPS_MARKER)).toBe(false);

    // Les drapeaux : octet 20 du fichier = octet 8 du morceau VP8X.
    expect(body[20]! & 0x0c, 'VP8X annonce encore un EXIF ou un XMP absent').toBe(0);
    // La taille RIFF compte tout ce qui suit le champ de taille, « WEBP » inclus.
    expect(body.readUInt32LE(4)).toBe(body.length - 8);
    expect(sniffType(body)).toEqual({ mime: 'image/webp', width: 16, height: 8 });
  });

  /**
   * PDF : rien n'est retiré, et `stripped` vaut quand même `true`. C'est un
   * PÉRIMÈTRE, écrit dans `media-bytes.ts` : un PDF n'a pas d'EXIF, son `/Info`
   * demanderait un analyseur complet, et le seul genre qui l'accepte (`PROOF`) est
   * « accès équipe uniquement, jamais affiché » (§8.1).
   */
  it('PDF : inchangé, et le drapeau le dit honnêtement', () => {
    const pdf = Buffer.from('%PDF-1.4\n/Author (Quelqu’un)\n%%EOF\n', 'latin1');
    const { body, stripped } = stripMetadata(pdf, 'application/pdf');
    expect(body).toEqual(pdf);
    expect(stripped).toBe(true);
  });

  /**
   * UN TYPE INCONNU NE MENT PAS SUR LUI-MÊME.
   *
   * `exif_stripped` est lu par `feed.service.ts`, qui REFUSE d'attacher une image
   * dont il est faux. Renvoyer `stripped: true` par défaut ferait de ce contrôle
   * une formalité, et c'est le seul qui existe.
   */
  it('type inconnu : `stripped` est FAUX, jamais vrai par défaut', () => {
    const { stripped } = stripMetadata(Buffer.from('n’importe quoi', 'utf8'), 'image/gif');
    expect(stripped).toBe(false);
  });
});
