import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

interface DesignRow {
  id: string;
  user_id: string;
  is_public: boolean;
  moderation_state: string;
}

interface ApiError {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

interface RequestResult<T> {
  status: number;
  data: T | null;
  error: ApiError | null;
}

const TEST_PASSWORD = process.env.SUPABASE_TEST_USER_PASSWORD ?? "Onemo-Rls-Password-123!";

let supabaseUrl = "";
let anonKey = "";
let serviceRoleKey = "";
let baseInsertPayload: Record<string, unknown> = {};

const createdDesignIds = new Set<string>();
const testUsers: TestUser[] = [];

// Integration test — requires SUPABASE_URL + SERVICE_ROLE_KEY
// Optional: set RLS_TEST_DESIGN_BASE_PAYLOAD to a JSON object when the table
// has additional non-nullable columns in your local/dev schema.
describe.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)("designs RLS", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    supabaseUrl = requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    );
    anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
    baseInsertPayload = parseBaseInsertPayload(process.env.RLS_TEST_DESIGN_BASE_PAYLOAD);

    userA = await createTestUser("a");
    userB = await createTestUser("b");
  });

  afterEach(async () => {
    for (const designId of createdDesignIds) {
      await deleteDesignAsAdmin(designId);
    }

    createdDesignIds.clear();
  });

  afterAll(async () => {
    for (const user of testUsers) {
      await deleteTestUser(user.id);
    }
  });

  it("owner can read own private design", async () => {
    const design = await createDesignAs(userA, {
      is_public: false,
      moderation_state: "self_certified",
    });

    const selectResult = await selectDesignById(userA.accessToken, design.id);

    expect(selectResult.error).toBeNull();
    expect(selectResult.data).toHaveLength(1);
    expect(selectResult.data?.[0]?.id).toBe(design.id);
    expect(selectResult.data?.[0]?.user_id).toBe(userA.id);
  });

  it("owner can update own design", async () => {
    const design = await createDesignAs(userA, {
      is_public: false,
      moderation_state: "self_certified",
    });

    const updateResult = await updateDesign(userA.accessToken, design.id, {
      is_public: true,
      moderation_state: "approved",
    });

    expect(updateResult.error).toBeNull();
    expect(updateResult.data).toHaveLength(1);
    expect(updateResult.data?.[0]?.is_public).toBe(true);
    expect(updateResult.data?.[0]?.moderation_state).toBe("approved");
  });

  it("owner can delete own design", async () => {
    const design = await createDesignAs(userA);

    const deleteResult = await deleteDesign(userA.accessToken, design.id);

    expect(deleteResult.error).toBeNull();
    expect(deleteResult.data).toHaveLength(1);
    expect(deleteResult.data?.[0]?.id).toBe(design.id);

    createdDesignIds.delete(design.id);

    const verifyResult = await selectDesignByIdAsAdmin(design.id);
    expect(verifyResult.error).toBeNull();
    expect(verifyResult.data).toHaveLength(0);
  });

  it("cross-user read is blocked for private designs", async () => {
    const design = await createDesignAs(userA, {
      is_public: false,
      moderation_state: "self_certified",
    });

    const selectResult = await selectDesignById(userB.accessToken, design.id);

    expect(selectResult.error).toBeNull();
    expect(selectResult.data).toHaveLength(0);
  });

  it("cross-user update is blocked", async () => {
    const design = await createDesignAs(userA, {
      is_public: false,
      moderation_state: "self_certified",
    });

    const updateResult = await updateDesign(userB.accessToken, design.id, {
      is_public: true,
      moderation_state: "approved",
    });

    expect(updateResult.error).toBeNull();
    expect(updateResult.data).toHaveLength(0);

    const ownerRead = await selectDesignById(userA.accessToken, design.id);
    expect(ownerRead.error).toBeNull();
    expect(ownerRead.data).toHaveLength(1);
    expect(ownerRead.data?.[0]?.is_public).toBe(false);
  });

  it("cross-user delete is blocked", async () => {
    const design = await createDesignAs(userA);

    const deleteResult = await deleteDesign(userB.accessToken, design.id);

    expect(deleteResult.error).toBeNull();
    expect(deleteResult.data).toHaveLength(0);

    const ownerRead = await selectDesignById(userA.accessToken, design.id);
    expect(ownerRead.error).toBeNull();
    expect(ownerRead.data).toHaveLength(1);
  });

  it("public approved design is readable by another authenticated user", async () => {
    const design = await createDesignAs(userA, {
      is_public: true,
      moderation_state: "approved",
    });

    const selectResult = await selectDesignById(userB.accessToken, design.id);

    expect(selectResult.error).toBeNull();
    expect(selectResult.data).toHaveLength(1);
    expect(selectResult.data?.[0]?.id).toBe(design.id);
  });

  it("public but unapproved design is not readable by another authenticated user", async () => {
    const design = await createDesignAs(userA, {
      is_public: true,
      moderation_state: "self_certified",
    });

    const selectResult = await selectDesignById(userB.accessToken, design.id);

    expect(selectResult.error).toBeNull();
    expect(selectResult.data).toHaveLength(0);
  });

  it("anonymous user can read public approved design", async () => {
    const design = await createDesignAs(userA, {
      is_public: true,
      moderation_state: "approved",
    });

    const selectResult = await selectDesignById(null, design.id);

    expect(selectResult.error).toBeNull();
    expect(selectResult.data).toHaveLength(1);
    expect(selectResult.data?.[0]?.id).toBe(design.id);
  });

  it("anonymous user cannot read private design", async () => {
    const design = await createDesignAs(userA, {
      is_public: false,
      moderation_state: "self_certified",
    });

    const selectResult = await selectDesignById(null, design.id);

    expect(selectResult.error).toBeNull();
    expect(selectResult.data).toHaveLength(0);
  });

  it("user cannot insert a design for another user", async () => {
    const insertResult = await insertDesign(userA.accessToken, buildDesignInsert(userB.id));

    expect(insertResult.error).not.toBeNull();
    expect([401, 403]).toContain(insertResult.status);
  });
});

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required for RLS integration tests.`);
  }

  return value;
}

function parseBaseInsertPayload(rawValue: string | undefined): Record<string, unknown> {
  if (!rawValue) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("RLS_TEST_DESIGN_BASE_PAYLOAD must be valid JSON.");
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new Error("RLS_TEST_DESIGN_BASE_PAYLOAD must be a JSON object.");
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toApiError(payload: unknown): ApiError {
  if (!isRecord(payload)) {
    if (typeof payload === "string") {
      return { message: payload };
    }

    return { message: "Unexpected error response." };
  }

  const message = typeof payload.message === "string" ? payload.message : "Unexpected error response.";
  const error: ApiError = { message };

  if (typeof payload.details === "string" || payload.details === null) {
    error.details = payload.details;
  }

  if (typeof payload.hint === "string" || payload.hint === null) {
    error.hint = payload.hint;
  }

  if (typeof payload.code === "string") {
    error.code = payload.code;
  }

  return error;
}

function buildHeaders(apikey: string, authToken?: string, prefer?: string): Headers {
  const headers = new Headers();
  headers.set("apikey", apikey);
  headers.set("Content-Type", "application/json");

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  if (prefer) {
    headers.set("Prefer", prefer);
  }

  return headers;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<RequestResult<T>> {
  const response = await fetch(url, init);
  const responseText = await response.text();

  let parsed: unknown = null;
  if (responseText.length > 0) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = responseText;
    }
  }

  if (response.ok) {
    return {
      status: response.status,
      data: parsed as T,
      error: null,
    };
  }

  return {
    status: response.status,
    data: null,
    error: toApiError(parsed),
  };
}

function getStringField(payload: unknown, field: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const value = payload[field];
  return typeof value === "string" ? value : null;
}

function formatFailure(result: RequestResult<unknown>): string {
  if (!result.error) {
    return `status=${result.status}`;
  }

  return `status=${result.status}, message=${result.error.message}`;
}

async function createTestUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.com`;

  const createResult = await requestJson<unknown>(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: buildHeaders(serviceRoleKey, serviceRoleKey),
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  });

  const userId = getStringField(createResult.data, "id");
  if (!userId) {
    throw new Error(`Failed creating test user ${email}: ${formatFailure(createResult)}`);
  }

  const tokenResult = await requestJson<unknown>(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: buildHeaders(anonKey),
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
    }),
  });

  const accessToken = getStringField(tokenResult.data, "access_token");
  if (!accessToken) {
    throw new Error(`Failed signing in test user ${email}: ${formatFailure(tokenResult)}`);
  }

  const user: TestUser = { id: userId, email, accessToken };
  testUsers.push(user);
  return user;
}

async function deleteTestUser(userId: string): Promise<void> {
  const result = await requestJson<unknown>(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: buildHeaders(serviceRoleKey, serviceRoleKey),
  });

  if (!result.error || result.status === 404) {
    return;
  }

  throw new Error(`Failed deleting test user ${userId}: ${formatFailure(result)}`);
}

function buildDesignInsert(userId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...baseInsertPayload,
    user_id: userId,
    is_public: false,
    moderation_state: "self_certified",
    ...overrides,
  };
}

async function createDesignAs(user: TestUser, overrides: Record<string, unknown> = {}): Promise<DesignRow> {
  const result = await insertDesign(user.accessToken, buildDesignInsert(user.id, overrides));

  if (result.error) {
    throw new Error(
      `Design insert failed for ${user.email}: ${formatFailure(result)}. ` +
        "Set RLS_TEST_DESIGN_BASE_PAYLOAD if additional required columns exist.",
    );
  }

  if (!result.data || result.data.length === 0) {
    throw new Error(`Design insert returned no rows for ${user.email}.`);
  }

  const inserted = result.data[0];
  createdDesignIds.add(inserted.id);
  return inserted;
}

async function insertDesign(
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<RequestResult<DesignRow[]>> {
  return requestJson<DesignRow[]>(`${supabaseUrl}/rest/v1/designs`, {
    method: "POST",
    headers: buildHeaders(anonKey, accessToken, "return=representation"),
    body: JSON.stringify(payload),
  });
}

async function selectDesignById(
  accessToken: string | null,
  designId: string,
): Promise<RequestResult<DesignRow[]>> {
  const params = new URLSearchParams({
    select: "id,user_id,is_public,moderation_state",
    id: `eq.${designId}`,
  });

  return requestJson<DesignRow[]>(`${supabaseUrl}/rest/v1/designs?${params.toString()}`, {
    method: "GET",
    headers: buildHeaders(anonKey, accessToken ?? undefined),
  });
}

async function selectDesignByIdAsAdmin(designId: string): Promise<RequestResult<DesignRow[]>> {
  const params = new URLSearchParams({
    select: "id,user_id,is_public,moderation_state",
    id: `eq.${designId}`,
  });

  return requestJson<DesignRow[]>(`${supabaseUrl}/rest/v1/designs?${params.toString()}`, {
    method: "GET",
    headers: buildHeaders(serviceRoleKey, serviceRoleKey),
  });
}

async function updateDesign(
  accessToken: string,
  designId: string,
  patch: Record<string, unknown>,
): Promise<RequestResult<DesignRow[]>> {
  const params = new URLSearchParams({
    id: `eq.${designId}`,
    select: "id,user_id,is_public,moderation_state",
  });

  return requestJson<DesignRow[]>(`${supabaseUrl}/rest/v1/designs?${params.toString()}`, {
    method: "PATCH",
    headers: buildHeaders(anonKey, accessToken, "return=representation"),
    body: JSON.stringify(patch),
  });
}

async function deleteDesign(accessToken: string, designId: string): Promise<RequestResult<DesignRow[]>> {
  const params = new URLSearchParams({
    id: `eq.${designId}`,
    select: "id,user_id,is_public,moderation_state",
  });

  return requestJson<DesignRow[]>(`${supabaseUrl}/rest/v1/designs?${params.toString()}`, {
    method: "DELETE",
    headers: buildHeaders(anonKey, accessToken, "return=representation"),
  });
}

async function deleteDesignAsAdmin(designId: string): Promise<void> {
  const params = new URLSearchParams({
    id: `eq.${designId}`,
  });

  const result = await requestJson<unknown>(`${supabaseUrl}/rest/v1/designs?${params.toString()}`, {
    method: "DELETE",
    headers: buildHeaders(serviceRoleKey, serviceRoleKey),
  });

  if (!result.error || result.status === 404) {
    return;
  }

  throw new Error(`Failed cleaning up design ${designId}: ${formatFailure(result)}`);
}
