import type { Socket } from 'node:net';
import type { DemoState } from '../state';

/**
 * ClamAV — protocole `clamd` sur TCP. Commandes : `INSTREAM` (blocs `[longueur 4 octets
 * gros-boutiste][données]`, fin = longueur 0), `PING` → `PONG`, `VERSION`.
 *
 * Réponses : `stream: OK`, `stream: <signature> FOUND`, `<message> ERROR`, terminées par
 * `\0` en mode `z` (ou `\n` en mode `n`). Comme clamd, le serveur ferme la connexion
 * après la réponse.
 *
 * FICHIERS DE TEST :
 *   · chaîne EICAR            → `stream: Win.Test.EICAR_HDB-1 FOUND`
 *   · `DEMO-VIRUS-TEST`       → `stream: Demo.Test.Signature FOUND`
 *   · `DEMO-CLAMD-ERROR`      → `INSTREAM: Can't write to temporary file. ERROR` (panne simulée)
 *   · plus de 25 Mio          → `INSTREAM size limit exceeded. ERROR` (StreamMaxLength)
 */
export const STREAM_MAX_LENGTH = 25 * 1024 * 1024;

const COMMAND = /^[zn]?(INSTREAM|PING|VERSION|STATS|RELOAD)\b/;

/** Vrai si les premiers octets d'une connexion sont une commande clamd, pas du HTTP. */
export function looksLikeClamd(first: Buffer): boolean {
  return COMMAND.test(first.subarray(0, 16).toString('latin1'));
}

export function scanBuffer(data: Buffer): { reply: string } {
  const text = data.toString('latin1');
  if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) return { reply: 'stream: Win.Test.EICAR_HDB-1 FOUND' };
  if (text.includes('DEMO-VIRUS-TEST')) return { reply: 'stream: Demo.Test.Signature FOUND' };
  if (text.includes('DEMO-CLAMD-ERROR')) return { reply: "INSTREAM: Can't write to temporary file. ERROR" };
  return { reply: 'stream: OK' };
}

export function handleClamd(socket: Socket, first: Buffer, state: DemoState): void {
  let buffer = first;
  let terminator = '\0';
  let mode: 'command' | 'stream' = 'command';
  const pieces: Buffer[] = [];
  let total = 0;
  let finished = false;

  const reply = (text: string): void => {
    if (finished) return;
    finished = true;
    socket.end(`${text}${terminator}`);
  };

  const run = (): void => {
    for (;;) {
      if (finished) return;
      if (mode === 'command') {
        const m = /^([zn]?)([A-Z]+)(\0|\n)/.exec(buffer.toString('latin1', 0, 32));
        if (m === null) {
          // Pas encore de fin de commande : on attend (ou la commande est inconnue si trop longue).
          if (buffer.length > 64) return reply('UNKNOWN COMMAND');
          return;
        }
        terminator = m[1] === 'n' ? '\n' : '\0';
        buffer = buffer.subarray(m[0].length);
        const command = m[2];
        if (command === 'PING') return reply('PONG');
        if (command === 'VERSION') return reply('ClamAV 1.4.0-demo/27000/Mon Jan  1 00:00:00 2026');
        if (command === 'INSTREAM') {
          mode = 'stream';
          continue;
        }
        return reply('UNKNOWN COMMAND');
      }
      if (buffer.length < 4) return;
      const size = buffer.readUInt32BE(0);
      if (size === 0) {
        const verdict = scanBuffer(Buffer.concat(pieces));
        const text = verdict.reply;
        state.record({ kind: 'scan', provider: 'clamav', to: '-', body: text, meta: { bytes: total } });
        return reply(text);
      }
      if (total + size > STREAM_MAX_LENGTH) return reply('INSTREAM size limit exceeded. ERROR');
      if (buffer.length < 4 + size) return;
      pieces.push(Buffer.from(buffer.subarray(4, 4 + size)));
      total += size;
      buffer = buffer.subarray(4 + size);
    }
  };

  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    run();
  });
  socket.on('error', () => socket.destroy());
  run();
}
