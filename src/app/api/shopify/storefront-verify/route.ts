// TEMPORARY: Smoke-test route — remove after Storefront API connectivity is verified (ONE-111)
import { errorResponse, okResponse } from "@/lib/api/response";
import {
  cartCreate,
  getStorefrontConfig,
} from "@/lib/shopify/storefront";

/**
 * ONE-111: Verify Storefront API connectivity from Next.js.
 * GET: calls cartCreate against DEV store and returns cart id + checkoutUrl.
 */
export async function GET() {
  const config = getStorefrontConfig();

  if (!config) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Storefront configuration is unavailable (missing store domain or access token).",
      500
    );
  }

  try {
    const cart = await cartCreate(config);
    return okResponse({
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Storefront API request failed";
    return errorResponse(
      "UPSTREAM_UNAVAILABLE",
      message,
      502,
      err instanceof Error ? { name: err.name } : undefined
    );
  }
}
