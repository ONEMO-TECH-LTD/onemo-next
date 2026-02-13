import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  storefrontRequest,
  type StorefrontConfig,
} from "../storefront";

const mockConfig: StorefrontConfig = {
  storeDomain: "onemo-dev.myshopify.com",
  accessToken: "test-token",
  endpoint: "https://onemo-dev.myshopify.com/api/2025-01/graphql.json",
};

describe("storefrontRequest", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(""))));
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.restoreAllMocks();
  });

  it("(a) successful query returns data", async () => {
    const data = { shop: { name: "DEV" } };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await storefrontRequest<{ shop: { name: string } }>(
      mockConfig,
      "query { shop { name } }"
    );

    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith(
      mockConfig.endpoint,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": mockConfig.accessToken,
        },
      })
    );
  });

  it("(b) GraphQL error response throws", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ message: "Access denied" }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(
      storefrontRequest(mockConfig, "query { shop { name } }")
    ).rejects.toThrow("Storefront API GraphQL errors: Access denied");
  });

  it("(c) network error throws", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network failure"));

    await expect(
      storefrontRequest(mockConfig, "query { shop { name } }")
    ).rejects.toThrow("Network failure");
  });
});
