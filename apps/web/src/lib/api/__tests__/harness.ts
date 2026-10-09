import { expect, vi } from 'vitest';

/**
 * Un faux serveur, pour éprouver le socle sans réseau.
 *
 * Il enregistre CHAQUE requête — méthode, URL, en-têtes, corps — parce que
 * plusieurs des règles à garder portent sur ce que le client ENVOIE, et non sur ce
 * qu'il fait de la réponse : l'absence d'un en-tête `Authorization` sur une route
 * d'équipe, le nombre d'appels à `/auth/refresh`, le fait qu'un appel soit rejoué.
 * Un espion qui ne garderait que le compte ne permettrait pas de les écrire.
 */

export interface RecordedCall {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
  readonly credentials: string | undefined;
}

export interface Reply {
  readonly status?: number;
  /** Le corps, tel quel. `undefined` = pas de corps du tout. */
  readonly json?: unknown;
  readonly text?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface FakeServer {
  readonly calls: readonly RecordedCall[];
  /** Les appels vers un chemin donné (sous-chaîne de l'URL). */
  matching(fragment: string): readonly RecordedCall[];
  restore(): void;
}

/**
 * @param handler Décide de la réponse pour chaque requête. Reçoit l'appel et son
 *   rang (1 pour le premier), ce qui permet d'écrire « la première fois
 *   `TOKEN_STALE`, la seconde fois `200` » — la séquence même que T4 §2 décrit.
 */
export function fakeServer(
  handler: (call: RecordedCall, index: number) => Reply,
): FakeServer {
  const calls: RecordedCall[] = [];

  /**
   * Pas `async` : le corps n'attend rien, et `require-await` a raison de le dire.
   * Le contrat de `fetch` est de rendre une PROMESSE, pas d'être asynchrone — d'où
   * `Promise.resolve` sur le seul retour, qui dit la même chose sans promettre une
   * attente qui n'existe pas.
   */
  const fetchStub = vi.fn((input: unknown, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      (init?.headers as Record<string, string> | undefined) ?? {},
    )) {
      headers[key.toLowerCase()] = value;
    }

    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      url: String(input),
      headers,
      body: typeof init?.body === 'string' ? init.body : null,
      credentials: init?.credentials,
    };
    calls.push(call);

    const reply = handler(call, calls.length);
    const status = reply.status ?? 200;

    const body =
      reply.text !== undefined
        ? reply.text
        : reply.json === undefined
          ? null
          : JSON.stringify(reply.json);

    return Promise.resolve(
      new Response(status === 204 || status === 205 ? null : body, {
        status,
        headers: {
          ...(body === null ? {} : { 'content-type': 'application/json' }),
          ...(reply.headers ?? {}),
        },
      }),
    );
  });

  vi.stubGlobal('fetch', fetchStub);

  return {
    calls,
    matching(fragment: string) {
      return calls.filter((c) => c.url.includes(fragment));
    },
    restore() {
      vi.unstubAllGlobals();
    },
  };
}

/** L'enveloppe d'erreur de §5.2, pour que les tests n'aient pas à la réécrire. */
export function errorBody(
  code: string,
  message = 'Refusé.',
  details?: Record<string, unknown>,
): { error: { code: string; message: string; details?: Record<string, unknown> } } {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/**
 * Une réponse `/me` VALIDE et complète, relevée sur l'API qui tourne.
 *
 * Elle est ici, en un seul endroit, pour que les tests qui éprouvent autre chose
 * n'aient pas à la reconstruire — et pour qu'un champ ajouté au schéma se corrige
 * une fois. Les valeurs sont celles d'un membre fraîchement inscrit : `L0`, pas de
 * profil, un numéro masqué, onboarding à l'étape 1.
 */
export function meBody(overrides: { level?: string; status?: string } = {}): unknown {
  return {
    user: {
      id: '01a0eff6-cbfc-7000-a918-b8477bf70047',
      handle: 'm01a0eff6cbfc7000a918b8477bf70',
      displayName: '',
      avatarUrl: null,
      phase: 'PRE_DEPARTURE',
      verificationLevel: overrides.level ?? 'L0',
      plan: 'FREE',
      status: overrides.status ?? 'ACTIVE',
      originCountryId: '01a0e1b0-03eb-7000-8568-a65c501769f6',
      cityId: null,
      arrivalDate: null,
      originCountryLocked: false,
    },
    profile: null,
    phones: [
      {
        id: '01a0eff6-cc27-7000-85ed-f29c4c6c7183',
        masked: '+229 •• •• •• 99',
        isDestination: false,
      },
    ],
    kyc: null,
    stats: {
      helpValidatedCount: 0,
      guideHelpfulVotes: 0,
      guideContributions: 0,
      mentorshipsCompleted: 0,
      eventsOrganized: 0,
    },
    consents: { outstanding: [] },
    onboarding: { step: 1, complete: false },
  };
}

/** Un jeton d'accès de forme plausible. Le socle ne le décode pas ; il le porte. */
export function fakeToken(label = 'v1'): string {
  return `entete.${label}.signature`;
}

/**
 * Affirme qu'AUCUN des appels enregistrés ne porte d'en-tête d'identification de
 * membre. Écrit ici parce que deux tests s'en servent et que la formulation exacte
 * est ce qui compte : c'est la règle dure 15 §2.1.
 */
export function expectNoBearer(calls: readonly RecordedCall[]): void {
  for (const call of calls) {
    expect(
      call.headers['authorization'],
      `${call.method} ${call.url} porte un en-tête Authorization. Un jeton de membre sur ` +
        `une route d’équipe est refusé par CROSS_DOMAIN_TOKEN (règle dure 15 §2.1).`,
    ).toBeUndefined();
  }
}
