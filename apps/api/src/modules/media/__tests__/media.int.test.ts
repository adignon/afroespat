import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { newId } from '@app/db';
import {
  MEDIA_KIND_POLICIES,
  MEDIA_MAX_IMAGE_BYTES,
  MEDIA_MEMBER_UPLOADABLE_KINDS,
} from '@app/shared';
import { AppModule } from '../../../app.module';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { EXIF_IDENTIFIER } from '../media-bytes';

/**
 * ENVOI DE MÉDIA — 00-fondations.md §8.1 à §8.3, 01-identite.md §4.2.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ════════════════════════════════════════════
 *
 * AUCUNE ROUTE D'ENVOI N'EXISTAIT DANS TOUTE L'API : aucun contrôleur ne
 * mentionnait `media_assets`, aucun ne contenait « upload », et la file `media`
 * de §9.2 n'avait pas de consommateur. Trois choses étaient donc impossibles :
 * publier une annonce d'OFFRE de logement (10 §2.1 exige au moins une photo),
 * créer une fiche pro (10 §4.1 exige un justificatif), et avoir un portrait
 * (01 §4.2, `PUT /me/avatar` — rien n'écrivait `users.avatar_asset_id`, que cinq
 * services lisent).
 *
 * ═══ IL PASSE PAR HTTP, ET C'EST LE POINT ═════════════════════════════════
 *
 * Un test de service appellerait `MediaService.upload()` avec un `Buffer` fabriqué
 * à la main. Il ne vérifierait ni l'analyse du multipart, ni le plafond dur de
 * multer, ni le branchement du décorateur de capacité, ni le filtre d'erreurs —
 * c'est-à-dire rien de ce qu'un navigateur rencontre. Les fichiers partent donc
 * par `supertest`, en `multipart/form-data`, comme un formulaire les enverrait.
 *
 * ═══ ET IL RELIT LES OCTETS ═══════════════════════════════════════════════
 *
 * `FakeStorageProvider.put` écrit VRAIMENT sur le disque — c'est écrit dans son
 * commentaire, et c'est pour cela. Chaque envoi réussi est donc relu depuis le
 * disque, et l'on compare l'octet. Un test qui se contenterait de la réponse JSON
 * dirait « exifStripped: true » sans que personne n'ait jamais ouvert le fichier.
 */

const GPS_MARKER = 'GPS-POSITION-SECRETE-48N-2E';
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

interface MediaResponse {
  id: string;
  kind: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  status: string;
  exifStripped: boolean;
  url: string;
}

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

// ── Fabriques d'octets ─────────────────────────────────────────────────────

function jpegAvecExif(): Buffer {
  const payload = Buffer.concat([
    EXIF_IDENTIFIER,
    Buffer.from('MM\0*', 'latin1'),
    Buffer.from([0x00, 0x00, 0x00, 0x08]),
    Buffer.from(GPS_MARKER, 'latin1'),
  ]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);

  const dqt = Buffer.alloc(4 + 1 + 64);
  dqt.writeUInt16BE(0xffdb, 0);
  dqt.writeUInt16BE(2 + 1 + 64, 2);
  dqt.fill(16, 5);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app1,
    payload,
    dqt,
    Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08, 0x00, 0x10, 0x01, 0x01, 0x11, 0x00]),
    Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]),
    Buffer.from([0x12, 0x34, 0x56, 0x78]),
    Buffer.from([0xff, 0xd9]),
  ]);
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

function pngAvecTexte(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(3, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', Buffer.from(`Author\0${GPS_MARKER}`, 'latin1')),
    pngChunk('IDAT', deflateSync(Buffer.alloc(2 * (1 + 3 * 3)))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const PDF = Buffer.from('%PDF-1.4\n% justificatif d’essai\n%%EOF\n', 'latin1');

describe('envoi de média (00 §8.1–§8.3, 01 §4.2)', () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;
  let prisma: PrismaService;
  let tokens: TokenService;

  const createdUserIds: string[] = [];
  let countryId: string;

  /** Où `FakeStorageProvider` écrit : le test doit regarder au même endroit. */
  const storageRoot =
    process.env.STORAGE_FAKE_DIR ?? join(tmpdir(), 'afroespat-dev-storage');

  /** Le chemin sur disque d'un média, depuis l'URL que l'API a rendue. */
  function cheminDe(media: MediaResponse): string {
    expect(media.url.startsWith('/media/'), `URL inattendue : ${media.url}`).toBe(true);
    return resolve(storageRoot, media.url.slice('/media/'.length));
  }

  async function membre(level: 'L0' | 'L1' | 'L2'): Promise<{ id: string; token: string }> {
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `med${id.slice(-10)}`,
        displayName: 'Membre média',
        phase: 'SETTLED',
        verificationLevel: level,
        originCountryId: countryId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(id);
    return {
      id,
      token: tokens.sign({
        sub: id,
        // Un `sid` qui ne désigne aucune session : `assertTokenFresh` laisse
        // passer une session introuvable (une absence n'est pas une révocation).
        sid: newId(),
        level,
        plan: 'FREE',
        status: 'ACTIVE',
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    };
  }

  function envoyer(token: string, kind: string, bytes: Buffer, nom: string, type: string) {
    return request(server())
      .post('/v1/media')
      .set('authorization', `Bearer ${token}`)
      .field('kind', kind)
      .attach('file', bytes, { filename: nom, contentType: type });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();

    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = country.id;
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      // Les `media_assets` ne tombent pas avec le membre (`owner_user_id` est
      // `SetNull`) : on les retire explicitement, sinon ce fichier laisserait des
      // lignes derrière lui à chaque exécution.
      await prisma.mediaAsset.deleteMany({ where: { ownerUserId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app?.close();
  });

  // ── Le chemin qui débloque le produit ────────────────────────────────────

  /**
   * LE TEST CENTRAL : un fichier part, des octets arrivent, et on les RELIT.
   *
   * MUTATION TÉMOIN — remplacer `stripMetadata(...)` par
   * `{ body: file.buffer, stripped: true }` dans le service fait échouer les deux
   * attentes sur les octets relus, alors que la réponse JSON reste identique.
   */
  it('[§8.1] une photo HOUSING est écrite sur le stockage, et ses EXIF n’y sont PLUS', async () => {
    const { token } = await membre('L2');
    const original = jpegAvecExif();
    expect(original.includes(GPS_MARKER), 'la fabrique ne met pas la marque').toBe(true);

    const res = await envoyer(token, 'HOUSING', original, 'photo.jpg', 'image/jpeg');
    expect(res.status).toBe(201);
    const media = res.body as MediaResponse;

    expect(media.kind).toBe('HOUSING');
    expect(media.mime).toBe('image/jpeg');
    expect(media.status).toBe('READY');
    expect(media.exifStripped).toBe(true);
    // `width`/`height` existaient au schéma et PERSONNE ne les écrivait.
    expect(media.width).toBe(16);
    expect(media.height).toBe(8);

    // ON RELIT LE FICHIER. C'est la seule affirmation qui ne peut pas mentir.
    const chemin = cheminDe(media);
    expect(existsSync(chemin), `aucun octet à ${chemin}`).toBe(true);
    const relu = await readFile(chemin);
    expect(relu.includes(GPS_MARKER), 'la position GPS est sur le stockage').toBe(false);
    expect(relu.includes(EXIF_IDENTIFIER), 'la marque Exif est sur le stockage').toBe(false);
    // Toujours un JPEG, et c'est bien CE JPEG : ses octets d'image sont là.
    expect(relu.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(relu.includes(Buffer.from([0x12, 0x34, 0x56, 0x78]))).toBe(true);
    // La taille ANNONCÉE est celle du fichier DÉPOSÉ, pas celle du fichier reçu.
    expect(media.sizeBytes).toBe(relu.length);
    expect(media.sizeBytes).toBeLessThan(original.length);
  });

  it('[§8.1] un PNG perd son tEXt, et le fichier relu reste un PNG', async () => {
    const { token } = await membre('L1');
    const res = await envoyer(token, 'POST', pngAvecTexte(), 'image.png', 'image/png');
    expect(res.status).toBe(201);
    const media = res.body as MediaResponse;

    const relu = await readFile(cheminDe(media));
    expect(relu.includes(Buffer.from('tEXt', 'latin1'))).toBe(false);
    expect(relu.includes(GPS_MARKER)).toBe(false);
    expect(relu.includes(Buffer.from('IDAT', 'latin1'))).toBe(true);
    expect(media.width).toBe(3);
    expect(media.height).toBe(2);
  });

  it('[10 §4.1] un justificatif PDF est accepté et relisible', async () => {
    const { token } = await membre('L2');
    const res = await envoyer(token, 'PROOF', PDF, 'sirene.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    const media = res.body as MediaResponse;
    expect(media.mime).toBe('application/pdf');
    expect(await readFile(cheminDe(media))).toEqual(PDF);
  });

  // ── §8.3 : le type RÉEL ──────────────────────────────────────────────────

  /**
   * MUTATION TÉMOIN — remplacer `sniffType(file.buffer)` par le `mimetype`
   * déclaré fait passer ce fichier de 415 à 201, et écrit un PDF à l'adresse
   * d'une image.
   */
  it('[§8.3] un PDF renommé .jpg et annoncé image/jpeg est REFUSÉ, et rien n’est écrit', async () => {
    const { token } = await membre('L2');
    const avant = await prisma.mediaAsset.count();
    const res = await envoyer(token, 'HOUSING', PDF, 'photo.jpg', 'image/jpeg');

    expect(res.status).toBe(415);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('MEDIA_TYPE_REJECTED');
    // Le détail dit le type DÉCLARÉ et le type TROUVÉ : c'est ce qui permet au
    // front d'expliquer le refus au lieu de le subir.
    expect(body.error.details?.declaredMime).toBe('image/jpeg');
    expect(body.error.details?.detectedMime).toBe('application/pdf');
    // AUCUNE ligne de plus : un refus de type ne laisse pas de trace de média.
    expect(await prisma.mediaAsset.count()).toBe(avant);
  });

  it('[§8.3] un SVG est REFUSÉ — un SVG exécute du script dans le navigateur', async () => {
    const { token } = await membre('L1');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', 'utf8');
    const res = await envoyer(token, 'POST', svg, 'logo.svg', 'image/svg+xml');
    expect(res.status).toBe(415);
    expect((res.body as ErrorBody).error.details?.detectedMime).toBeNull();
  });

  // ── §8.3 : l'antivirus AVANT publication ────────────────────────────────

  /**
   * MUTATION TÉMOIN — remplacer l'appel à `antivirus.scan` par
   * `{ clean: true }` fait passer ce test de 422 à 201, et dépose le fichier
   * infecté dans le stockage.
   */
  it('[§8.3] un fichier infecté est refusé, laisse une ligne REJECTED et AUCUN octet', async () => {
    const { token, id } = await membre('L1');
    const infecte = Buffer.concat([jpegAvecExif(), Buffer.from(EICAR, 'latin1')]);

    const res = await envoyer(token, 'POST', infecte, 'photo.jpg', 'image/jpeg');
    expect(res.status).toBe(422);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('MEDIA_INFECTED');
    expect(body.error.details?.signature).toBe('EICAR-Test-File');

    // LA TRACE EXISTE — §8.3 attache l'analyse à `media_assets.status`.
    const rows = await prisma.mediaAsset.findMany({
      where: { ownerUserId: id },
      select: { status: true, storageKey: true, exifStripped: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('REJECTED');
    expect(rows[0]?.exifStripped).toBe(false);

    // ET LES OCTETS N'EXISTENT PAS. La clé est réservée, rien n'est déposé
    // dessus : un fichier infecté ne doit jamais atteindre le seau, même une
    // seconde, même sous un statut qui le cache.
    const chemin = resolve(storageRoot, rows[0]?.storageKey ?? 'inexistant');
    expect(existsSync(chemin), 'un fichier infecté a été déposé').toBe(false);
  });

  // ── §8.3 : la taille ─────────────────────────────────────────────────────

  /**
   * MUTATION TÉMOIN — neutraliser la comparaison `file.buffer.length >
   * policy.maxBytes` fait passer ce test de 413 à 201.
   */
  it('[§8.3] au-delà du plafond du genre, 413 MEDIA_TOO_LARGE avec le plafond dans les détails', async () => {
    const { token } = await membre('L2');
    const lourd = Buffer.concat([jpegAvecExif(), Buffer.alloc(MEDIA_MAX_IMAGE_BYTES)]);

    const res = await envoyer(token, 'HOUSING', lourd, 'photo.jpg', 'image/jpeg');
    expect(res.status).toBe(413);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('MEDIA_TOO_LARGE');
    expect(body.error.details?.maxBytes).toBe(MEDIA_MAX_IMAGE_BYTES);
  });

  it('[§5.2] le 413 du plafond DUR de multer garde la forme d’erreur de §5.2', async () => {
    const { token } = await membre('L2');
    // Au-delà du plafond de multer (le plus haut des genres) : la lecture du corps
    // est COUPÉE, et c'est Nest qui lève. Sans la branche 413 du filtre d'erreurs,
    // la réponse sortait en `INTERNAL_ERROR` — « une erreur est survenue de notre
    // côté » pour un fichier trop lourd.
    const enorme = Buffer.concat([
      jpegAvecExif(),
      Buffer.alloc(MEDIA_KIND_POLICIES.PROOF.maxBytes + 1024),
    ]);
    const res = await envoyer(token, 'PROOF', enorme, 'gros.pdf', 'application/pdf');
    expect(res.status).toBe(413);
    expect((res.body as ErrorBody).error.code).toBe('MEDIA_TOO_LARGE');
    expect(typeof (res.body as ErrorBody).error.message).toBe('string');
  });

  it('[§5.2] sans fichier, 422 MEDIA_EMPTY — et non un 500 opaque', async () => {
    const { token } = await membre('L1');
    const res = await request(server())
      .post('/v1/media')
      .set('authorization', `Bearer ${token}`)
      .field('kind', 'POST');
    expect(res.status).toBe(422);
    expect((res.body as ErrorBody).error.code).toBe('MEDIA_EMPTY');
  });

  // ── La capacité, GENRE PAR GENRE ─────────────────────────────────────────

  /**
   * LA RÈGLE QUI NE TIENT PAS AU SEUL DÉCORATEUR.
   *
   * La route déclare `post.create` (L1), qui est le plancher honnête des genres
   * qu'elle accepte. Mais la politique de CHAQUE genre peut exiger davantage, et
   * sans le contrôle par genre dans le service un L1 déposerait la photo (écrite
   * dans le seau) : seul `POST /housing` refuserait ensuite — trop tard.
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE CAS LISTAIT QUATRE GENRES « L1 ». IL N'EN RESTE QUE TROIS             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il gelait `EVENT_COVER` parmi les genres qu'un L1 envoie, et il avait raison
   * quand `event.create` valait L1. La refonte des niveaux du porteur
   * (2026-10-09) range « faire tout le reste » en N2, et créer un événement en
   * fait partie : la couverture suit la capacité de la route qui l'attachera,
   * comme `HOUSING` et `PROOF` le font depuis toujours. `GUIDE`, arrivé avec les
   * images dans le corps des guides, demande `guide.write` — N2 lui aussi.
   *
   * (Décision du porteur du 2026-10-24 : `event.attend` passe en L1 — s'inscrire — mais
   * `event.create` RESTE en L2 : c'est lui qui garde la couverture, donc `EVENT_COVER` reste
   * refusé à un L1 et ce cas n'a pas à bouger.)
   *
   * CE N'EST DONC PAS LA RÈGLE QUI EST CORRIGÉE ICI, C'EST LE CAS : il figeait un
   * arbitrage que le porteur a remplacé, et un test qui survit à l'arbitrage qu'il
   * décrit transforme chaque décision du porteur en échec rouge.
   *
   * MUTATION TÉMOIN — désactiver `levelSatisfies(...)` dans le service fait passer
   * les quatre premières attentes de 403 à 201.
   */
  it('[10 §2.1, §4.1] un L1 n’envoie que les trois genres de son niveau — logement, justificatif, couverture et image de guide sont en L2', async () => {
    const { token, id } = await membre('L1');

    for (const kind of ['HOUSING', 'PROOF', 'EVENT_COVER', 'GUIDE'] as const) {
      const res = await envoyer(token, kind, jpegAvecExif(), 'photo.jpg', 'image/jpeg');
      expect(res.status, `${kind} accepté en L1`).toBe(403);
      const body = res.body as ErrorBody;
      expect(body.error.code).toBe('LEVEL_REQUIRED');
      expect(body.error.details?.capability).toBe(MEDIA_KIND_POLICIES[kind].capability);
      expect(body.error.details?.requiredLevel).toBe('L2');
      expect(body.error.details?.currentLevel).toBe('L1');
    }

    // Aucun octet, aucune ligne : le refus coûte zéro écriture.
    expect(await prisma.mediaAsset.count({ where: { ownerUserId: id } })).toBe(0);

    // Et les trois genres qui RESTENT en L1 passent, eux.
    for (const kind of ['POST', 'MESSAGE', 'ALBUM'] as const) {
      const ok = await envoyer(token, kind, jpegAvecExif(), 'photo.jpg', 'image/jpeg');
      expect(ok.status, `${kind} refusé en L1`).toBe(201);
    }
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE CAS A DIT LES DEUX CHOSES TOUR À TOUR, ET VOICI POURQUOI              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ÉTAT 1 — il gelait « le plancher de `POST /media` est L1 », parce que la route
   * porte `post.create` et que `post.create` valait L1.
   *
   * ÉTAT 2 — le porteur, après avoir vu la photo refusée dans le composeur de
   * story : « Autorise pour tout le monde la possibilité de publier des stories
   * AVEC TOUT CE QUI VA AVEC. » `post.create` est passée en L0, et ce cas a été
   * retourné : l'envoi passait pour un compte non vérifié.
   *
   * ÉTAT 3, celui-ci — la refonte des niveaux (2026-10-09) range explicitement
   * « publier dans le fil d'actualité et stories » en N1. L'instruction la plus
   * récente l'emporte, `post.create` est revenue en L1, et la CONSÉQUENCE est
   * écrite dans `capabilities.ts` : « un L0 ne peut plus déposer d'image ». C'est
   * exactement ce que ce cas mesure maintenant.
   *
   * CE QUI NE BOUGE PAS D'UN ÉTAT À L'AUTRE, et c'est la raison de garder ce cas
   * plutôt que de le supprimer : LE PORTRAIT. `PUT /me/avatar` est à
   * `content.read` (L0), parce que 01 §4.2 ne fait pas du portrait une récompense
   * de vérification. Un compte à un SMS a donc un visage, et pas de photo dans le
   * fil — et le jour où quelqu'un fermera l'avatar « par cohérence », ce cas
   * tombera.
   *
   * ⚠ CE QUE ÇA COÛTE, ET CE N'EST PAS RIEN : le refus arrive sur la route
   * MÉDIA, donc AVANT le composeur. Le front doit éteindre le bouton d'image dès
   * L0 (`lib/capacites.ts` lit la même table) ; sans cela le membre choisit un
   * fichier, attend l'envoi, et reçoit un 403 — le pire moment pour l'apprendre.
   */
  it('un L0 ne dépose pas d’image — mais pose toujours son portrait', async () => {
    const { token } = await membre('L0');

    const envoi = await envoyer(token, 'POST', jpegAvecExif(), 'photo.jpg', 'image/jpeg');
    expect(envoi.status, JSON.stringify(envoi.body)).toBe(403);
    const body = envoi.body as ErrorBody;
    expect(body.error.code).toBe('LEVEL_REQUIRED');
    expect(body.error.details?.capability).toBe('post.create');
    expect(body.error.details?.requiredLevel).toBe('L1');
    expect(body.error.details?.currentLevel).toBe('L0');

    // `PUT /me/avatar` est à `content.read` (L0) : 01 §4.2 ne fait pas du
    // portrait une récompense de vérification.
    const avatar = await request(server())
      .put('/v1/me/avatar')
      .set('authorization', `Bearer ${token}`)
      .attach('file', jpegAvecExif(), { filename: 'moi.jpg', contentType: 'image/jpeg' });
    expect(avatar.status).toBe(200);
  });

  /**
   * LES GENRES QUE LE SERVEUR SEUL PRODUIT sont fermés à la route, et le schéma
   * de corps est la première barrière. `LOGO` relève de l'ÉQUIPE (14 §5), et
   * 00 §7.4 fait des deux domaines des domaines HERMÉTIQUES : le glisser ici
   * serait la passerelle que la règle interdit.
   */
  it('EXPORT, INVOICE, LOGO et AVATAR sont refusés par POST /media', async () => {
    const { token } = await membre('L2');
    for (const kind of ['EXPORT', 'INVOICE', 'LOGO', 'AVATAR']) {
      const res = await envoyer(token, kind, jpegAvecExif(), 'x.jpg', 'image/jpeg');
      expect(res.status, `${kind} accepté`).toBe(400);
      expect((res.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
    }

    /**
     * Et la liste acceptée est bien celle de la politique, sans AVATAR.
     *
     * `GUIDE` S'Y EST AJOUTÉ : les guides portent désormais des images dans leur
     * corps (05 §2.1, table `guide_media`), et la politique du genre demande
     * `guide.write` (L2) — voir `MEDIA_KIND_POLICIES`. Ce cas liste les genres
     * envoyables à la main EXPRÈS : l'ajout d'un genre à `MediaKind` doit obliger
     * quelqu'un à venir dire ici qu'un membre a le droit de l'envoyer.
     */
    expect([...MEDIA_MEMBER_UPLOADABLE_KINDS].sort()).toEqual([
      'ALBUM',
      'AVATAR',
      'EVENT_COVER',
      'GUIDE',
      'HOUSING',
      'MESSAGE',
      'POST',
      'PROOF',
    ]);
  });

  it('sans jeton, 401 — l’envoi n’est jamais anonyme', async () => {
    const res = await request(server())
      .post('/v1/media')
      .field('kind', 'POST')
      .attach('file', jpegAvecExif(), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  // ── La clé de stockage, et ce qu'elle protège ───────────────────────────

  /**
   * L'ADRESSE D'UN MÉDIA NE DOIT PAS LAISSER DEVINER CELLE D'UN AUTRE.
   *
   * `/media/<storage_key>` est l'adresse publique : c'est ce que `users`,
   * `housing`, `feed` et `communities` construisent, donc ce que le navigateur
   * reçoit, et il n'y a AUCUN second contrôle derrière un objet servi par le
   * stockage. Une clé déduite du seul identifiant serait énumérable :
   * `newId()` rend un UUID v7, dont les 48 premiers bits sont l'horodatage.
   * Connaissant l'adresse de la photo d'une annonce, on lirait les justificatifs
   * d'activité déposés à la même milliseconde — ceux dont §8.1 dit « accès équipe
   * uniquement ».
   *
   * MUTATION TÉMOIN — remplacer le segment aléatoire par une chaîne vide fait
   * échouer les deux dernières attentes : la clé redevient `kind/an/mois/<id>.jpg`,
   * donc calculable à partir de l'identifiant que l'API vient de rendre.
   */
  it('[§8.2] la clé de stockage porte un secret aléatoire : connaître un id ne donne pas l’adresse', async () => {
    const { token } = await membre('L2');
    const a = (await envoyer(token, 'HOUSING', jpegAvecExif(), 'a.jpg', 'image/jpeg'))
      .body as MediaResponse;
    const b = (await envoyer(token, 'HOUSING', jpegAvecExif(), 'b.jpg', 'image/jpeg'))
      .body as MediaResponse;

    const cle = (m: MediaResponse): string => m.url.slice('/media/'.length);
    expect(cle(a)).not.toBe(cle(b));

    // La clé contient l'identifiant — pour relier un objet du seau à sa ligne —
    // ET un segment qui ne s'en déduit pas.
    expect(cle(a)).toContain(a.id);
    const suffixe = cle(a).slice(cle(a).indexOf(a.id) + a.id.length);
    expect(suffixe, 'aucun segment aléatoire après l’identifiant').toMatch(/^-[0-9a-f]{32}\./);

    // LA PREUVE PAR L'ÉNUMÉRATION : l'adresse « évidente » — celle qu'on
    // calculerait depuis l'identifiant seul — ne désigne aucun fichier.
    const devinee = cle(a).replace(/-[0-9a-f]{32}\./, '.');
    expect(devinee).not.toBe(cle(a));
    expect(existsSync(resolve(storageRoot, devinee)), 'la clé était devinable').toBe(false);
  });

  // ── `PUT /me/avatar` (01 §4.2) ──────────────────────────────────────────

  /**
   * LA ROUTE N'EXISTAIT PAS, et `users.avatar_asset_id` n'était écrit par
   * PERSONNE : `PATCH /me` n'accepte pas le champ (01 §4.2 en donne la liste
   * close) et aucun service ne le posait. Cinq services la LISENT pourtant pour
   * construire l'`avatarUrl` d'un profil, d'une annonce, d'un contact, d'une
   * fiche pro et d'un membre de réseau. Une colonne lue partout, écrite nulle part
   * — le même défaut que `cities.member_count`.
   */
  it('[01 §4.2] PUT /me/avatar pose users.avatar_asset_id, et le profil rend enfin une avatarUrl', async () => {
    const { token, id } = await membre('L1');
    const res = await request(server())
      .put('/v1/me/avatar')
      .set('authorization', `Bearer ${token}`)
      .attach('file', jpegAvecExif(), { filename: 'moi.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    const media = res.body as MediaResponse;
    expect(media.kind).toBe('AVATAR');

    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { avatarAssetId: true },
    });
    expect(user.avatarAssetId).toBe(media.id);

    // Et la colonne sert : le compte du membre porte l'adresse.
    const me = await request(server()).get('/v1/me').set('authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).toContain(media.url);
  });

  /**
   * LE REMPLACEMENT RETIRE L'ANCIEN, OCTETS COMPRIS.
   *
   * §8.1 impose la minimisation : garder une photo de chaque changement
   * d'avatar, que plus aucune ligne ne désigne, est une collecte sans finalité —
   * et un fichier qu'aucune suppression de compte n'atteindra jamais.
   *
   * MUTATION TÉMOIN — ce test a trouvé un défaut RÉEL en cours de route :
   * `FakeStorageProvider.delete` se contentait de JOURNALISER. La ligne passait
   * bien à `deleted_at` et le fichier restait sur le disque. Remettre le `delete`
   * muet (`void fs.access(target)` au lieu de `fs.unlink`) fait échouer la
   * dernière attente ci-dessous.
   */
  it('[§8.1] un second avatar retire le premier : ligne supprimée ET octets effacés', async () => {
    const { token, id } = await membre('L1');

    const premier = (
      await request(server())
        .put('/v1/me/avatar')
        .set('authorization', `Bearer ${token}`)
        .attach('file', jpegAvecExif(), { filename: 'un.jpg', contentType: 'image/jpeg' })
    ).body as MediaResponse;
    const cheminPremier = cheminDe(premier);
    expect(existsSync(cheminPremier)).toBe(true);

    const second = (
      await request(server())
        .put('/v1/me/avatar')
        .set('authorization', `Bearer ${token}`)
        .attach('file', pngAvecTexte(), { filename: 'deux.png', contentType: 'image/png' })
    ).body as MediaResponse;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { avatarAssetId: true },
    });
    expect(user.avatarAssetId).toBe(second.id);

    const ancien = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: premier.id },
      select: { deletedAt: true },
    });
    expect(ancien.deletedAt, 'l’ancien avatar n’est pas marqué supprimé').not.toBeNull();

    expect(existsSync(cheminPremier), 'les octets de l’ancien avatar sont encore là').toBe(false);
    expect(existsSync(cheminDe(second)), 'le nouvel avatar n’a pas d’octets').toBe(true);
  });

  // ── Le bout en bout : ce que l'envoi DÉBLOQUE ───────────────────────────

  /**
   * LA RAISON D'ÊTRE DU LOT.
   *
   * `POST /housing` exige au moins une photo pour une OFFRE (10 §2.1) et
   * `PUT /me/pro-profile` exige un justificatif à la création (10 §4.1). Les deux
   * étaient donc INATTEIGNABLES par l'API : un agent n'avait pu produire ses
   * charges d'essai qu'en insérant les médias en base, ce qu'un navigateur ne peut
   * pas faire. Ce test fait le parcours entier par HTTP, sans toucher la base.
   */
  it('[10 §2.1, §4.1] une annonce d’offre et une fiche pro se publient de bout en bout, par HTTP seul', async () => {
    const { token, id } = await membre('L2');
    const auth = `Bearer ${token}`;

    const photo1 = (await envoyer(token, 'HOUSING', jpegAvecExif(), 'a.jpg', 'image/jpeg'))
      .body as MediaResponse;
    const photo2 = (await envoyer(token, 'HOUSING', pngAvecTexte(), 'b.png', 'image/png'))
      .body as MediaResponse;

    const city = await prisma.city.findFirstOrThrow({
      where: { isActive: true, mergedIntoCityId: null },
      select: { id: true },
    });

    const annonce = await request(server())
      .post('/v1/housing')
      .set('authorization', auth)
      .send({
        kind: 'RENT',
        title: 'Studio meuble proche metro',
        description:
          'Studio clair de 22 m2, proche des transports, charges comprises. Disponible tout de suite, bail d un an renouvelable.',
        cityId: city.id,
        priceCents: 75_000,
        photoAssetIds: [photo1.id, photo2.id],
      });
    expect(annonce.status).toBe(201);
    expect(JSON.stringify(annonce.body)).toContain(photo1.url);

    // Et la règle tient toujours : sans photo, une OFFRE est refusée.
    const sansPhoto = await request(server())
      .post('/v1/housing')
      .set('authorization', auth)
      .send({
        kind: 'RENT',
        title: 'Studio sans la moindre photo',
        description:
          'Studio clair de 22 m2, proche des transports, charges comprises. Disponible tout de suite, bail d un an renouvelable.',
        cityId: city.id,
        priceCents: 75_000,
        photoAssetIds: [],
      });
    expect(sansPhoto.status).toBe(400);

    const justificatif = (await envoyer(token, 'PROOF', PDF, 'sirene.pdf', 'application/pdf'))
      .body as MediaResponse;
    const profession = await prisma.profession.findFirstOrThrow({ select: { id: true } });

    const fiche = await request(server())
      .put('/v1/me/pro-profile')
      .set('authorization', auth)
      .send({
        professionId: profession.id,
        businessName: 'Cabinet d essai',
        description:
          'Accompagnement des demarches administratives du quotidien, en francais et en fon.',
        contactMethod: 'PLATFORM_MESSAGE',
        cityIds: [city.id],
        proofAssetId: justificatif.id,
      });
    expect(fiche.status).toBe(200);
    // §4.1 : le justificatif est « accès équipe uniquement, jamais affiché » — la
    // fiche dit qu'il EXISTE, jamais lequel.
    expect(fiche.body).toMatchObject({ hasProof: true });
    expect(JSON.stringify(fiche.body)).not.toContain(justificatif.id);
    expect(JSON.stringify(fiche.body)).not.toContain(justificatif.url);

    // Nettoyage de ce que ce test a publié : la base est partagée.
    await prisma.housingListing.deleteMany({ where: { authorUserId: id } });
    await prisma.proProfile.deleteMany({ where: { userId: id } });
  });

  /**
   * LE MÉDIA D'AUTRUI N'EST PAS ATTACHABLE.
   *
   * `assertOwnedPhotos` le vérifie déjà dans `housing.service.ts`, et ce test le
   * FIXE depuis l'extérieur : l'envoi de média crée des identifiants que l'API
   * rend au membre, donc un membre en connaît forcément quelques-uns. Sans ce
   * contrôle, il afficherait dans son annonce la photo de n'importe qui.
   */
  it('[10 §2.1] on ne peut pas attacher à son annonce la photo d’un autre membre', async () => {
    const a = await membre('L2');
    const b = await membre('L2');
    const photoDeA = (await envoyer(a.token, 'HOUSING', jpegAvecExif(), 'a.jpg', 'image/jpeg'))
      .body as MediaResponse;

    const city = await prisma.city.findFirstOrThrow({
      where: { isActive: true, mergedIntoCityId: null },
      select: { id: true },
    });

    const vol = await request(server())
      .post('/v1/housing')
      .set('authorization', `Bearer ${b.token}`)
      .send({
        kind: 'RENT',
        title: 'Studio avec la photo du voisin',
        description:
          'Studio clair de 22 m2, proche des transports, charges comprises. Disponible tout de suite, bail d un an renouvelable.',
        cityId: city.id,
        priceCents: 75_000,
        photoAssetIds: [photoDeA.id],
      });
    expect(vol.status).toBe(400);
    expect((vol.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  /**
   * UN MÉDIA `REJECTED` NE S'ATTACHE PAS — §8.3, « avant publication ».
   *
   * L'envoi refusé par l'antivirus laisse une ligne `REJECTED` dont la clé est
   * RÉSERVÉE : rien n'est déposé dessus. Les trois points de rattachement du dépôt
   * — logement, justificatif pro, photo d'album — ne regardaient que le
   * propriétaire et le genre. Tant qu'aucune route d'envoi n'existait, aucun asset
   * non `READY` ne pouvait naître et l'omission ne coûtait rien ; elle en coûte
   * maintenant, et c'est exactement ce que l'envoi OUVRE.
   *
   * MUTATION TÉMOIN — retirer `status: 'READY'` de `assertOwnedPhotos` fait passer
   * ce test de 400 à 201, et l'annonce afficherait une photo sans octets.
   */
  it('[§8.3] un média REJECTED par l’antivirus ne peut pas être attaché à une annonce', async () => {
    const { token, id } = await membre('L2');
    const infecte = Buffer.concat([jpegAvecExif(), Buffer.from(EICAR, 'latin1')]);
    await envoyer(token, 'HOUSING', infecte, 'photo.jpg', 'image/jpeg');

    const rejete = await prisma.mediaAsset.findFirstOrThrow({
      where: { ownerUserId: id, status: 'REJECTED' },
      select: { id: true },
    });

    const city = await prisma.city.findFirstOrThrow({
      where: { isActive: true, mergedIntoCityId: null },
      select: { id: true },
    });
    const res = await request(server())
      .post('/v1/housing')
      .set('authorization', `Bearer ${token}`)
      .send({
        kind: 'RENT',
        title: 'Studio avec une photo refusee',
        description:
          'Studio clair de 22 m2, proche des transports, charges comprises. Disponible tout de suite, bail d un an renouvelable.',
        cityId: city.id,
        priceCents: 75_000,
        photoAssetIds: [rejete.id],
      });
    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  /**
   * LE GENRE EST UNE AUTORISATION, pas une étiquette.
   *
   * Un média envoyé en `POST` ne doit pas servir de photo de logement : §2.1 fait
   * du logement un L2 « sans exception », et accepter un asset de genre `POST`
   * rendrait ce plancher contournable par un L1 qui monterait ensuite en L2… ou
   * pire, par un L2 qui n'aurait jamais passé le contrôle du genre.
   */
  it('[10 §2.1] un média de genre POST ne peut pas servir de photo de logement', async () => {
    const { token } = await membre('L2');
    const media = (await envoyer(token, 'POST', jpegAvecExif(), 'a.jpg', 'image/jpeg'))
      .body as MediaResponse;

    const city = await prisma.city.findFirstOrThrow({
      where: { isActive: true, mergedIntoCityId: null },
      select: { id: true },
    });
    const res = await request(server())
      .post('/v1/housing')
      .set('authorization', `Bearer ${token}`)
      .send({
        kind: 'RENT',
        title: 'Studio au mauvais genre de media',
        description:
          'Studio clair de 22 m2, proche des transports, charges comprises. Disponible tout de suite, bail d un an renouvelable.',
        cityId: city.id,
        priceCents: 75_000,
        photoAssetIds: [media.id],
      });
    expect(res.status).toBe(400);
  });
});
