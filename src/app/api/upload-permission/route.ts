import { errorResponse, okResponse } from "@/lib/api/response";
import { getPrivateFolder } from "@/lib/cloudinary/paths";
import { signUploadParams } from "@/lib/cloudinary/upload-signature";
import { requireAuth } from "@/lib/supabase/session-server";

const MAX_BYTES = 10_485_760; // 10MB
const ALLOWED_FORMATS = ["png", "jpg", "jpeg"] as const;
const VALID_PURPOSE = "private_design_upload" as const;

export async function POST(request: Request) {
  const authResult = await requireAuth();

  if (authResult.response) {
    return authResult.response;
  }

  const body = await request.json().catch(() => null);
  if (body?.purpose !== VALID_PURPOSE) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid or missing purpose.",
      400
    );
  }

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ??
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Upload configuration is unavailable.",
      500
    );
  }

  const userId = authResult.user.id;
  const folder = getPrivateFolder(userId);
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = signUploadParams(
    { folder, timestamp },
    apiSecret
  );

  return okResponse({
    cloud_name: cloudName,
    api_key: apiKey,
    timestamp,
    signature,
    folder,
    upload_preset: "",
    max_bytes: MAX_BYTES,
    allowed_formats: [...ALLOWED_FORMATS],
  });
}
