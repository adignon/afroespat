import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider } from './providers';

/**
 * Stockage objet réel — tout service compatible S3 (AWS, Scaleway, OVH, MinIO),
 * région UE en production (règle dure 00 §8.2).
 *
 * Le client officiel `@aws-sdk/client-s3` est employé plutôt qu'une signature
 * SigV4 écrite à la main : l'installation passe, et une signature maison est
 * exactement le genre de code dont une erreur d'un octet ne se voit qu'en
 * production, contre un vrai seau.
 *
 * ── LES OCTETS RESTENT SERVIS PAR L'API ─────────────────────────────────────
 *
 * `get` relit l'objet et l'API le sert par `GET /media/*` : neuf endroits
 * composent `/media/<clé>` à la main (voir `StorageProvider.get`), et une seconde
 * convention d'adresse — l'URL signée du seau — ferait apprendre deux formes au
 * front. `createDownloadUrl` reste pour l'archive RGPD, dont l'adresse expire.
 *
 * ── `get` RENVOIE `null` POUR UNE CLÉ ABSENTE ───────────────────────────────
 *
 * `NoSuchKey` (404) devient `null`, toute autre erreur est relancée : l'appelant
 * répond « disparu » pour une purge de rétention, mais ne doit pas prendre une
 * panne du seau pour une absence. `delete` est idempotent par nature chez S3
 * (204 même si la clé n'existe pas).
 *
 * Le `mime` rendu par `get` est celui que S3 a gardé au dépôt ; l'appelant tient
 * de toute façon le type réel dans `media_assets.mime` (octets magiques).
 */
export interface S3Config {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** `true` pour MinIO : l'adresse est `endpoint/seau/clé`. */
  readonly forcePathStyle: boolean;
}

/** La part du client dont l'adaptateur a besoin — c'est ce que les tests simulent. */
export interface S3Like {
  send(command: unknown): Promise<unknown>;
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client | S3Like;

  constructor(
    private readonly config: S3Config,
    client?: S3Like,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      });
  }

  async createUploadUrl(key: string, mime: string): Promise<{ url: string }> {
    const url = await getSignedUrl(
      this.client as S3Client,
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: mime }),
      { expiresIn: 600 },
    );
    return { url };
  }

  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client as S3Client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
        // Le chiffrement au repos du seau est la règle (00 §8.1) ; on le demande
        // explicitement quand le service le supporte.
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async get(key: string): Promise<{ body: Buffer; mime: string } | null> {
    try {
      const out = (await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      )) as { Body?: { transformToByteArray(): Promise<Uint8Array> }; ContentType?: string };
      if (out.Body === undefined) return null;
      const bytes = await out.Body.transformToByteArray();
      return { body: Buffer.from(bytes), mime: out.ContentType ?? 'application/octet-stream' };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}

function isNotFound(error: unknown): boolean {
  if (error instanceof S3ServiceException) {
    return error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404;
  }
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}
