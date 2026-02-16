/**
 * ONE-18: Integration tests for /api/upload-permission.
 * Verifies auth, purpose validation, env handling, and happy-path signed params.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorResponse } from "../../../lib/api/response";

const VALID_PURPOSE = "private_design_upload";
const MOCK_USER_ID = "user_abc123";

const originalEnv: Record<string, string | undefined> = {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_ENV_PREFIX: process.env.CLOUDINARY_ENV_PREFIX,
};

vi.mock("@/lib/supabase/session-server", () => ({
  requireAuth: vi.fn(),
}));

async function loadRoute() {
  const mod = await import("./route");
  return mod.POST;
}

describe("POST /api/upload-permission", () => {
  let requireAuth: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const sessionServer = await import("@/lib/supabase/session-server");
    requireAuth = vi.mocked(sessionServer.requireAuth);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = originalEnv.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = originalEnv.CLOUDINARY_API_KEY;
    process.env.CLOUDINARY_API_SECRET = originalEnv.CLOUDINARY_API_SECRET;
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME =
      originalEnv.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_ENV_PREFIX = originalEnv.CLOUDINARY_ENV_PREFIX;
  });

  it("returns 401 when there is no session", async () => {
    requireAuth.mockResolvedValueOnce({
      user: null,
      response: errorResponse(
        "AUTH_REQUIRED",
        "Authentication is required for this endpoint.",
        401
      ),
    });

    const POST = await loadRoute();
    const req = new Request("http://localhost/api/upload-permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: VALID_PURPOSE }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required for this endpoint.",
      },
    });
  });

  it("returns 400 VALIDATION_ERROR when purpose is missing", async () => {
    requireAuth.mockResolvedValueOnce({
      user: { id: MOCK_USER_ID } as import("@supabase/supabase-js").User,
      response: null,
    });

    const POST = await loadRoute();
    const req = new Request("http://localhost/api/upload-permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid or missing purpose." },
    });
  });

  it("returns 400 VALIDATION_ERROR when purpose is wrong", async () => {
    requireAuth.mockResolvedValueOnce({
      user: { id: MOCK_USER_ID } as import("@supabase/supabase-js").User,
      response: null,
    });

    const POST = await loadRoute();
    const req = new Request("http://localhost/api/upload-permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "wrong_purpose" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid or missing purpose." },
    });
  });

  it("returns 500 INTERNAL_ERROR when Cloudinary env vars are missing", async () => {
    requireAuth.mockResolvedValueOnce({
      user: { id: MOCK_USER_ID } as import("@supabase/supabase-js").User,
      response: null,
    });
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = "";
    process.env.CLOUDINARY_API_SECRET = "";

    const POST = await loadRoute();
    const req = new Request("http://localhost/api/upload-permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: VALID_PURPOSE }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Upload configuration is unavailable.",
      },
    });
  });

  it("happy path: returns signed params with correct types and folder prefix", async () => {
    requireAuth.mockResolvedValueOnce({
      user: { id: MOCK_USER_ID } as import("@supabase/supabase-js").User,
      response: null,
    });
    process.env.CLOUDINARY_ENV_PREFIX = "dev/";
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "key123";
    process.env.CLOUDINARY_API_SECRET = "secret456";
    vi.resetModules();

    const POST = await loadRoute();
    const req = new Request("http://localhost/api/upload-permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: VALID_PURPOSE }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data).toBeDefined();

    const data = json.data as {
      cloud_name: string;
      api_key: string;
      timestamp: number;
      signature: string;
      folder: string;
      max_bytes: number;
      allowed_formats: string[];
    };
    expect(typeof data.cloud_name).toBe("string");
    expect(typeof data.api_key).toBe("string");
    expect(typeof data.timestamp).toBe("number");
    expect(typeof data.signature).toBe("string");
    expect(typeof data.folder).toBe("string");
    expect(typeof data.max_bytes).toBe("number");
    expect(Array.isArray(data.allowed_formats)).toBe(true);

    expect(data.cloud_name).toBe("test-cloud");
    expect(data.api_key).toBe("key123");
    expect(data.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(data.max_bytes).toBe(10_485_760);
    expect(data.allowed_formats).toEqual(["png", "jpg", "jpeg"]);
    expect(data.folder).toMatch(
      new RegExp(`^dev/onemo-designs/private/customer_${MOCK_USER_ID}/`)
    );
  });
});
