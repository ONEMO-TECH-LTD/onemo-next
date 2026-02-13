import { createHash } from "node:crypto";

/**
 * Cloudinary signed upload signature.
 * Params (except file, cloud_name, resource_type, api_key) are sorted,
 * joined as key=value&, API secret appended, then SHA-1 hex digest.
 * See: https://cloudinary.com/documentation/authentication_signatures
 */
export function signUploadParams(
  params: Record<string, string | number>,
  apiSecret: string
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const toSign = sorted + apiSecret;
  return createHash("sha1").update(toSign).digest("hex");
}
