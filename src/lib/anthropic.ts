import Anthropic from "@anthropic-ai/sdk";

/**
 * How Rezz authenticates to the Claude API.
 *
 * Two ways in, matching the SDK's own precedence: an API key, or an OAuth
 * access token. The token is for local development — `docs/01-product.md`
 * settled that a personal Claude subscription can't serve other users, so
 * production runs on an API key.
 */

/** OAuth access tokens need this beta flag. The SDK sends the Bearer header
 *  itself but does not add the flag, so it goes on as a default header. */
export const OAUTH_BETA = "oauth-2025-04-20";

export type Credentials =
  | { kind: "api_key"; value: string }
  | { kind: "oauth"; value: string };

export const MISSING_CREDENTIALS =
  "No Claude credentials. Set ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN with an " +
  "OAuth access token, in .env.local.";

/**
 * API key first, then OAuth token — the same order the SDK resolves them in, so
 * behaviour doesn't change depending on whether we construct the client
 * explicitly or let it read the environment.
 */
export function resolveCredentials(env: NodeJS.ProcessEnv = process.env): Credentials | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (apiKey) return { kind: "api_key", value: apiKey };

  const authToken = env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (authToken) return { kind: "oauth", value: authToken };

  return null;
}

/** Split out from `createClient` so the OAuth beta flag can be asserted without
 *  reaching into the SDK's private options. */
export function clientOptions(credentials: Credentials): ConstructorParameters<typeof Anthropic>[0] {
  if (credentials.kind === "api_key") {
    return { apiKey: credentials.value };
  }
  return {
    authToken: credentials.value,
    defaultHeaders: { "anthropic-beta": OAUTH_BETA },
  };
}

export function createClient(credentials: Credentials): Anthropic {
  return new Anthropic(clientOptions(credentials));
}
