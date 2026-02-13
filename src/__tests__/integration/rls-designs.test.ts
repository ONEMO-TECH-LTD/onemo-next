import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import { createAdminClient } from "../../lib/supabase/admin";

type DesignRecord = {
  id: string;
  user_id: string;
  title: string;
  is_public: boolean;
  moderation_state:
    | "self_certified"
    | "approved"
    | "rejected"
    | "appeal_pending"
    | "rejected_final";
};

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasRequiredEnv = Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey);

const describeRls = hasRequiredEnv ? describe : describe.skip;
const admin = hasRequiredEnv ? createAdminClient() : null;
const createdDesignIds = new Set<string>();
const createdUserIds = new Set<string>();

function createAnonClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase test configuration.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function createAnonymousUser() {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInAnonymously();

  if (error || !data.user) {
    throw new Error(`Failed to create anonymous test user: ${error?.message}`);
  }

  createdUserIds.add(data.user.id);

  return { client, user: data.user };
}

async function seedDesign(
  userId: string,
  overrides: Partial<Omit<DesignRecord, "id" | "user_id">> = {}
): Promise<DesignRecord> {
  if (!admin) {
    throw new Error("Missing admin client.");
  }

  const payload = {
    user_id: userId,
    title: overrides.title ?? `rls-${crypto.randomUUID()}`,
    is_public: overrides.is_public ?? false,
    moderation_state: overrides.moderation_state ?? "self_certified",
  };

  const { data, error } = await admin
    .from("designs")
    .insert(payload)
    .select("id, user_id, title, is_public, moderation_state")
    .single();

  if (error || !data) {
    throw new Error(`Failed to seed design: ${error?.message}`);
  }

  createdDesignIds.add(data.id);
  return data as DesignRecord;
}

async function getDesignById(id: string) {
  if (!admin) {
    throw new Error("Missing admin client.");
  }

  const { data, error } = await admin
    .from("designs")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch design: ${error.message}`);
  }

  return data;
}

afterEach(async () => {
  if (!admin) {
    return;
  }

  if (createdDesignIds.size > 0) {
    const ids = Array.from(createdDesignIds);
    const { error } = await admin.from("designs").delete().in("id", ids);
    if (error) {
      throw new Error(`Failed to clean designs: ${error.message}`);
    }
    createdDesignIds.clear();
  }

  if (createdUserIds.size > 0) {
    for (const userId of createdUserIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        throw new Error(`Failed to clean auth user ${userId}: ${error.message}`);
      }
    }
    createdUserIds.clear();
  }
});

describeRls("designs RLS policies", () => {
  it("1. User A can SELECT own designs", async () => {
    const userA = await createAnonymousUser();
    const design = await seedDesign(userA.user.id);

    const { data, error } = await userA.client
      .from("designs")
      .select("id, user_id, title")
      .eq("id", design.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(design.id);
    expect(data?.[0]?.user_id).toBe(userA.user.id);
  });

  it("2. User A CANNOT select user B private designs", async () => {
    const userA = await createAnonymousUser();
    const userB = await createAnonymousUser();
    const privateDesign = await seedDesign(userB.user.id, {
      is_public: false,
      moderation_state: "self_certified",
    });

    const { data, error } = await userA.client
      .from("designs")
      .select("id, user_id")
      .eq("id", privateDesign.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("3. Unauthenticated/anon can SELECT public approved designs only", async () => {
    const userA = await createAnonymousUser();
    const publicApproved = await seedDesign(userA.user.id, {
      is_public: true,
      moderation_state: "approved",
    });
    const publicNotApproved = await seedDesign(userA.user.id, {
      is_public: true,
      moderation_state: "self_certified",
    });
    const privateApproved = await seedDesign(userA.user.id, {
      is_public: false,
      moderation_state: "approved",
    });

    const anonClient = createAnonClient();
    const { data, error } = await anonClient
      .from("designs")
      .select("id")
      .in("id", [publicApproved.id, publicNotApproved.id, privateApproved.id]);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(publicApproved.id);
  });

  it("4. Unauthenticated/anon CANNOT see private designs", async () => {
    const userA = await createAnonymousUser();
    const privateDesign = await seedDesign(userA.user.id, {
      is_public: false,
      moderation_state: "approved",
    });

    const anonClient = createAnonClient();
    const { data, error } = await anonClient
      .from("designs")
      .select("id")
      .eq("id", privateDesign.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("5. User can INSERT design with own user_id", async () => {
    const userA = await createAnonymousUser();
    const payloadTitle = `insert-own-${crypto.randomUUID()}`;

    const { data, error } = await userA.client
      .from("designs")
      .insert({
        user_id: userA.user.id,
        title: payloadTitle,
      })
      .select("id, user_id, title")
      .single();

    if (data?.id) {
      createdDesignIds.add(data.id);
    }

    expect(error).toBeNull();
    expect(data?.user_id).toBe(userA.user.id);
    expect(data?.title).toBe(payloadTitle);
  });

  it("6. User CANNOT insert design with someone else's user_id", async () => {
    const userA = await createAnonymousUser();
    const userB = await createAnonymousUser();

    const { data, error } = await userA.client.from("designs").insert({
      user_id: userB.user.id,
      title: `insert-other-${crypto.randomUUID()}`,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("row-level security");
  });

  it("7. User can UPDATE own designs", async () => {
    const userA = await createAnonymousUser();
    const design = await seedDesign(userA.user.id, {
      title: "before-update-own",
    });

    const { data, error } = await userA.client
      .from("designs")
      .update({ title: "after-update-own" })
      .eq("id", design.id)
      .select("id, title")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(design.id);
    expect(data?.title).toBe("after-update-own");
  });

  it("8. User CANNOT update another user's designs", async () => {
    const userA = await createAnonymousUser();
    const userB = await createAnonymousUser();
    const design = await seedDesign(userB.user.id, {
      title: "before-update-other",
    });

    const { data, error } = await userA.client
      .from("designs")
      .update({ title: "after-update-other" })
      .eq("id", design.id)
      .select("id, title");

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const unchanged = await getDesignById(design.id);
    expect(unchanged?.title).toBe("before-update-other");
  });

  it("9. User can DELETE own designs", async () => {
    const userA = await createAnonymousUser();
    const design = await seedDesign(userA.user.id);

    const { data, error } = await userA.client
      .from("designs")
      .delete()
      .eq("id", design.id)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(design.id);

    createdDesignIds.delete(design.id);
    const deleted = await getDesignById(design.id);
    expect(deleted).toBeNull();
  });

  it("10. User CANNOT delete another user's designs", async () => {
    const userA = await createAnonymousUser();
    const userB = await createAnonymousUser();
    const design = await seedDesign(userB.user.id);

    const { data, error } = await userA.client
      .from("designs")
      .delete()
      .eq("id", design.id)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const stillExists = await getDesignById(design.id);
    expect(stillExists?.id).toBe(design.id);
  });
});
