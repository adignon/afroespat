import { createConnection } from 'node:net';
import type { AntivirusProvider } from './providers';

/**
 * Antivirus réel — ClamAV, protocole `clamd` INSTREAM sur TCP (§8.3).
 *
 * Le protocole, tel que `man clamd` le décrit : on envoie `zINSTREAM\0`, puis des
 * blocs `[longueur sur 4 octets en gros-boutiste][données]`, puis un bloc de
 * longueur zéro. clamd répond `stream: OK\0` ou `stream: <signature> FOUND\0`, ou
 * `... ERROR\0` (par exemple `INSTREAM size limit exceeded`).
 *
 * ── UNE PANNE REFUSE ────────────────────────────────────────────────────────
 *
 * Connexion refusée, délai dépassé, réponse `ERROR` : l'adaptateur LÈVE, il ne
 * rend jamais `clean: true`. Un antivirus qui laisse passer quand il est
 * injoignable ne protège de rien — il suffirait de le saturer. L'appelant
 * (`media.service.ts`) transforme l'exception en échec d'envoi : le membre
 * réessaie, rien n'est publié sans analyse.
 *
 * Le découpage en blocs (≤ 64 Kio) évite de dépasser `StreamMaxLength` d'un
 * seul bloc et laisse clamd traiter au fil de l'eau.
 */
export interface ClamAvConfig {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;
}

const CHUNK = 64 * 1024;

export function buildInstream(buffer: Buffer): Buffer[] {
  const parts: Buffer[] = [Buffer.from('zINSTREAM\0')];
  for (let offset = 0; offset < buffer.length; offset += CHUNK) {
    const chunk = buffer.subarray(offset, offset + CHUNK);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(chunk.length, 0);
    parts.push(size, chunk);
  }
  parts.push(Buffer.alloc(4)); // bloc de longueur zéro : fin du flux
  return parts;
}

export function parseClamdReply(raw: string): { clean: boolean; signature?: string } {
  const reply = raw.replace(/\0/g, '').trim();
  if (/\bOK$/.test(reply)) return { clean: true };
  const found = /^stream:\s*(.+?)\s+FOUND$/.exec(reply);
  if (found !== null) return { clean: false, signature: found[1] as string };
  throw new Error(`ClamAV : réponse inattendue « ${reply.slice(0, 120)} »`);
}

export class ClamAvAntivirusProvider implements AntivirusProvider {
  constructor(private readonly config: ClamAvConfig) {}

  scan(buffer: Buffer): Promise<{ clean: boolean; signature?: string }> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.config.host, port: this.config.port });
      const chunks: Buffer[] = [];
      let settled = false;
      const done = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        fn();
      };

      socket.setTimeout(this.config.timeoutMs, () =>
        done(() => reject(new Error('ClamAV : délai dépassé'))),
      );
      socket.on('error', (error) =>
        done(() => reject(new Error(`ClamAV : ${error.message}`))),
      );
      socket.on('data', (data) => chunks.push(data));
      socket.on('end', () =>
        done(() => {
          try {
            resolve(parseClamdReply(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }),
      );
      socket.on('connect', () => {
        for (const part of buildInstream(buffer)) socket.write(part);
      });
    });
  }
}
