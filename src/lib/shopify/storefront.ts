/**
 * Shopify Storefront API client (ONE-111).
 * Uses SHOPIFY_STOREFRONT_ACCESS_TOKEN and store domain from env.
 * For server-side use only (e.g. API routes).
 */

const STOREFRONT_API_VERSION = "2025-01";

export type StorefrontConfig = {
  storeDomain: string;
  accessToken: string;
  endpoint: string;
};

/**
 * Reads Storefront API config from env.
 * Prefers SHOPIFY_STOREFRONT_ACCESS_TOKEN (server); store domain from
 * NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN or SHOPIFY_STORE_DOMAIN.
 */
export function getStorefrontConfig(): StorefrontConfig | null {
  const storeDomain =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ??
    process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!storeDomain?.trim() || !accessToken?.trim()) {
    return null;
  }

  const domain = storeDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const endpoint = `https://${domain}/api/${STOREFRONT_API_VERSION}/graphql.json`;

  return { storeDomain: domain, accessToken, endpoint };
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; locations?: unknown; path?: unknown }>;
};

/**
 * Runs a GraphQL request against the Storefront API.
 * Headers: X-Shopify-Storefront-Access-Token, Content-Type: application/json.
 */
export async function storefrontRequest<T>(
  config: StorefrontConfig,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": config.accessToken,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });

  if (!res.ok) {
    throw new Error(
      `Storefront API HTTP ${res.status}: ${res.statusText}`
    );
  }

  const json = (await res.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Storefront API GraphQL errors: ${msg}`);
  }

  if (json.data === undefined) {
    throw new Error("Storefront API returned no data");
  }

  return json.data;
}

const CART_CREATE_MUTATION = `
mutation cartCreate($input: CartInput) {
  cartCreate(input: $input) {
    cart {
      id
      checkoutUrl
    }
    userErrors {
      field
      message
      code
    }
  }
}
`;

export type CartCreateResult = {
  id: string;
  checkoutUrl: string;
};

type CartCreatePayload = {
  cartCreate: {
    cart: { id: string; checkoutUrl: string } | null;
    userErrors: Array<{ field: string[]; message: string; code?: string }>;
  };
};

/**
 * Creates an empty cart via Storefront API.
 * Returns cart id and checkoutUrl. Throws on missing config or API errors.
 */
export async function cartCreate(
  config: StorefrontConfig
): Promise<CartCreateResult> {
  const data = await storefrontRequest<CartCreatePayload>(
    config,
    CART_CREATE_MUTATION,
    { input: {} }
  );

  const { cart, userErrors } = data.cartCreate;

  if (userErrors.length > 0) {
    const msg = userErrors.map((e) => e.message).join("; ");
    throw new Error(`cartCreate userErrors: ${msg}`);
  }

  if (!cart?.id || !cart?.checkoutUrl) {
    throw new Error("cartCreate returned no cart or missing id/checkoutUrl");
  }

  return { id: cart.id, checkoutUrl: cart.checkoutUrl };
}
