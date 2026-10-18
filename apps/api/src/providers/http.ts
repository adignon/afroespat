/**
 * L'appel HTTP des fournisseurs réels — un seul endroit pour trois règles.
 *
 *   · UN DÉLAI, TOUJOURS. `fetch` n'en a aucun par défaut : un fournisseur qui
 *     accepte la connexion et ne répond jamais tiendrait la requête du membre — et
 *     une connexion du bassin Prisma, si l'appel est dans une transaction —
 *     indéfiniment.
 *   · `fetch` EST INJECTABLE. Aucun compte fournisseur n'existe : les adaptateurs
 *     sont éprouvés avec un `fetch` simulé qui vérifie ce qui PART (adresse,
 *     en-têtes, corps) et rend ce que le fournisseur documente. C'est la seule
 *     façon d'éprouver le format sans appel sortant.
 *   · L'ERREUR NE PORTE JAMAIS LE CORPS ENVOYÉ. Un SMS porte un code OTP, un email
 *     une adresse : les recopier dans un message d'erreur les ferait entrer dans le
 *     journal et dans `outbound_messages.error`. Seuls le statut et un extrait de la
 *     RÉPONSE y entrent.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number | null,
    message: string,
    /** Vrai quand réessayer a un sens : 429, 5xx, coupure réseau, délai. */
    readonly retryable: boolean,
  ) {
    super(`${provider} : ${message}`);
    this.name = 'ProviderError';
  }
}

export interface HttpOptions {
  readonly fetch?: FetchLike | undefined;
  readonly timeoutMs?: number | undefined;
}

export async function callProvider(
  provider: string,
  url: string,
  init: RequestInit,
  options: HttpOptions = {},
): Promise<Response> {
  const doFetch: FetchLike = options.fetch ?? ((input, i) => fetch(input, i));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = await doFetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const aborted = controller.signal.aborted;
    throw new ProviderError(
      provider,
      null,
      aborted ? 'délai dépassé' : `réseau : ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let extract = '';
    try {
      extract = (await response.text()).slice(0, 200);
    } catch {
      /* corps illisible : le statut suffit */
    }
    throw new ProviderError(
      provider,
      response.status,
      `HTTP ${response.status}${extract === '' ? '' : ` — ${extract}`}`,
      response.status === 429 || response.status >= 500,
    );
  }
  return response;
}

export async function callProviderJson<T>(
  provider: string,
  url: string,
  init: RequestInit,
  options: HttpOptions = {},
): Promise<T> {
  const response = await callProvider(provider, url, init, options);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError(provider, response.status, 'réponse JSON illisible', false);
  }
}
