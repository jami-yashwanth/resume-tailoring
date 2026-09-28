import { describe, expect, it } from "vitest";
import { OAUTH_BETA, clientOptions, createClient, resolveCredentials } from "./anthropic";

const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv;

describe("resolveCredentials", () => {
  it("uses an API key when one is set", () => {
    expect(resolveCredentials(env({ ANTHROPIC_API_KEY: "sk-ant-abc" }))).toEqual({
      kind: "api_key",
      value: "sk-ant-abc",
    });
  });

  it("uses an OAuth token when that is all there is", () => {
    expect(resolveCredentials(env({ ANTHROPIC_AUTH_TOKEN: "oauth-xyz" }))).toEqual({
      kind: "oauth",
      value: "oauth-xyz",
    });
  });

  it("prefers the API key, matching the SDK's own precedence", () => {
    const resolved = resolveCredentials(
      env({ ANTHROPIC_API_KEY: "sk-ant-abc", ANTHROPIC_AUTH_TOKEN: "oauth-xyz" }),
    );
    expect(resolved).toEqual({ kind: "api_key", value: "sk-ant-abc" });
  });

  it("returns null when neither is set", () => {
    expect(resolveCredentials(env({}))).toBeNull();
  });

  it("ignores a variable that is present but blank", () => {
    /* An empty assignment in .env.local is the common way this breaks, and it
       should fall through rather than send an empty credential. */
    const resolved = resolveCredentials(
      env({ ANTHROPIC_API_KEY: "   ", ANTHROPIC_AUTH_TOKEN: "oauth-xyz" }),
    );
    expect(resolved).toEqual({ kind: "oauth", value: "oauth-xyz" });
  });

  it("trims surrounding whitespace", () => {
    expect(resolveCredentials(env({ ANTHROPIC_AUTH_TOKEN: " oauth-xyz\n" }))).toEqual({
      kind: "oauth",
      value: "oauth-xyz",
    });
  });
});

describe("createClient", () => {
  it("sends an API key as the api key, with no OAuth beta flag", () => {
    const client = createClient({ kind: "api_key", value: "sk-ant-abc" });
    expect(client.apiKey).toBe("sk-ant-abc");
    expect(client.authToken).toBeNull();
  });

  it("sends an OAuth token as a bearer token", () => {
    /* The SDK puts authToken on `Authorization: Bearer`, never on x-api-key. */
    const client = createClient({ kind: "oauth", value: "oauth-xyz" });
    expect(client.authToken).toBe("oauth-xyz");
    expect(client.apiKey).toBeNull();
  });

  it("adds the OAuth beta flag, which the SDK does not add itself", () => {
    expect(clientOptions({ kind: "oauth", value: "oauth-xyz" })).toMatchObject({
      defaultHeaders: { "anthropic-beta": OAUTH_BETA },
    });
  });

  it("does not put the OAuth beta flag on an API-key client", () => {
    expect(clientOptions({ kind: "api_key", value: "sk-ant-abc" })).not.toHaveProperty(
      "defaultHeaders",
    );
  });
});
