import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import sharp from 'sharp';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../../common/prisma.service';
import { jobIdOf } from '../../queue/job-id';
import { QueueService } from '../../queue/queue.service';
import { QUEUES } from '../../queue/queues';
import { STORAGE_PROVIDER, type StorageProvider } from '../../providers/providers';

/**
 * La file `media` (00 §9.2 : « redimensionnement, suppression EXIF, antivirus »).
 *
 * ── CE QUI RESTE SYNCHRONE, ET POURQUOI ─────────────────────────────────────
 *
 * L'antivirus et le retrait des métadonnées ont lieu DANS `POST /media`, avant la
 * ligne `READY` (`media.service.ts`). Les déplacer dans le worker obligerait chaque
 * écran qui attache un média à attendre `READY` (publication, avatar, couverture,
 * messages…), alors que ces écrans reçoivent aujourd'hui un média immédiatement
 * utilisable, et §8.3 exige l'analyse « avant publication ». Mesuré dans le code :
 * `feed.service.ts` et les autres refusent tout média qui n'est pas `READY`.
 *
 * ── CE QUE LE WORKER FAIT ───────────────────────────────────────────────────
 *
 * Ce qui peut se faire APRÈS : la VIGNETTE. `thumbnail` relit l'original, le
 * redimensionne (480 px max, jamais agrandi), le recode en WebP SANS métadonnées
 * (sharp n'en recopie aucune par défaut) et dépose `<clé>.thumb.webp`. `GET /media/<clé>.thumb.webp`
 * la sert, ou retombe sur l'original tant qu'elle n'existe pas : aucun écran
 * n'attend le worker.
 */
export const THUMB_SUFFIX = '.thumb.webp';
export const THUMB_MAX_PX = 480;

export interface MediaJob {
  readonly assetId: string;
}

@Injectable()
export class MediaThumbnailService {
  private readonly logger = new Logger(MediaThumbnailService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Idempotent : réécrire la même vignette est sans effet. Rend `false` si rien à faire. */
  async thumbnail(job: MediaJob): Promise<boolean> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: job.assetId },
      select: { storageKey: true, mime: true, status: true, deletedAt: true },
    });
    if (asset === null || asset.deletedAt !== null || asset.status !== 'READY') return false;
    if (!asset.mime.startsWith('image/') || asset.mime === 'image/svg+xml') return false;

    const original = await this.storage.get(asset.storageKey);
    if (original === null) return false;
    const thumb = await sharp(original.body)
      .rotate() // applique l'orientation EXIF AVANT que les métadonnées ne soient écartées
      .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    await this.storage.put(`${asset.storageKey}${THUMB_SUFFIX}`, thumb, 'image/webp');
    return true;
  }
}

@Injectable()
export class MediaConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MediaConsumer.name);
  private connection?: Redis;
  private worker?: Worker;

  constructor(private readonly thumbnails: MediaThumbnailService) {}

  onApplicationBootstrap(): void {
    const env = loadEnv();
    if (env.APP_ROLE !== 'worker') return;
    this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.worker = new Worker(
      QUEUES.MEDIA,
      async (job) => {
        await this.thumbnails.thumbnail(job.data as MediaJob);
      },
      { connection: this.connection, concurrency: 2 },
    );
    this.worker.on('error', (error) => this.logger.error(`file ${QUEUES.MEDIA} : ${error.message}`));
    this.worker.on('failed', (job, error) =>
      this.logger.error(`média ${job?.id ?? '?'} — tentative ${job?.attemptsMade ?? 0} : ${error.message}`),
    );
    this.logger.log(`Consommateur de la file « ${QUEUES.MEDIA} » démarré (vignettes).`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}

export const MEDIA_QUEUE = Symbol('MediaQueue');

export interface MediaQueuePort {
  enqueueThumbnail(job: MediaJob): Promise<void>;
}

@Injectable()
export class BullMediaQueue implements MediaQueuePort {
  constructor(private readonly queues: QueueService) {}

  async enqueueThumbnail(job: MediaJob): Promise<void> {
    await this.queues.get(QUEUES.MEDIA).add('thumbnail', job, {
      attempts: 4,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 600, count: 500 },
      removeOnFail: { age: 86_400 * 3 },
      jobId: jobIdOf('thumb', job.assetId),
    });
  }
}
