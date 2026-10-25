import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DemoConfig } from '../config';
import type { DemoState } from '../state';

export interface Ctx {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly url: URL;
  readonly body: Buffer;
  readonly config: DemoConfig;
  readonly state: DemoState;
}

export type Handler = (ctx: Ctx) => Promise<void> | void;
