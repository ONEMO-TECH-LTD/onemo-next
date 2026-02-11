import { afterEach, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

import { createAdminClient } from '../../lib/supabase/admin';

type DesignRow = {
  id: string;
  user_id: string;
  title: string;
  is_public: boolean;
  moderation_state: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const envMissing = !supabaseUrl || !supabaseAnonKey || !serviceRoleKey;
const describeIntegration = envMissing ? describe.skip : describe;

const trackedUserIds = new Set<string>();
const trackedDesignIds = new Set<string>();

function createAnonClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function createTestUser(prefix: string) {
  const admin = createAdminClient();
  const email = `${prefix}-${crypto.randomUUID()}@example.com`;
  const password = `Pass-${crypto.randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  expect(error).toBeNull();
  expect(data.user).toBeDefined();

  const userId = data.user!.id;
  trackedUserIds.add(userId);

  const userClient = createAnonClient();
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  expect(signInError).toBeNull();

  return { userId, client: userClient };
}

async function seedDesign(input: {
  userId: string;
  title?: string;
  isPublic?: boolean;
  moderationState?: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('designs')
    .insert({
      user_id: input.userId,
      title: input.title ?? `design-${crypto.randomUUID()}`,
      is_public: input.isPublic ?? false,
      moderation_state: input.moderationState ?? 'self_certified',
    })
    .select('id,user_id,title,is_public,moderation_state')
    .single<DesignRow>();

  expect(error).toBeNull();
  expect(data).toBeDefined();

  trackedDesignIds.add(data!.id);
  return data!;
}

afterEach(async () => {
  const admin = createAdminClient();

  if (trackedDesignIds.size > 0) {
    const ids = [...trackedDesignIds];
    trackedDesignIds.clear();
    await admin.from('designs').delete().in('id', ids);
  }

  if (trackedUserIds.size > 0) {
    const userIds = [...trackedUserIds];
    trackedUserIds.clear();
    await Promise.all(
      userIds.map(async (userId) => {
        await admin.auth.admin.deleteUser(userId);
      }),
    );
  }
});

describeIntegration('designs RLS enforcement', () => {
  if (envMissing) {
    it('skips when required Supabase environment variables are missing', () => {
      expect(envMissing).toBe(true);
    });
    return;
  }

  it('1) User A can SELECT own designs', async () => {
    const userA = await createTestUser('user-a-select-own');
    const ownDesign = await seedDesign({ userId: userA.userId });

    const { data, error } = await userA.client
      .from('designs')
      .select('id,user_id')
      .eq('id', ownDesign.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(ownDesign.id);
  });

  it("2) User A CANNOT select user B's private designs", async () => {
    const userA = await createTestUser('user-a-cannot-select-b');
    const userB = await createTestUser('user-b-private-design');
    const userBPrivateDesign = await seedDesign({ userId: userB.userId });

    const { data, error } = await userA.client
      .from('designs')
      .select('id,user_id')
      .eq('id', userBPrivateDesign.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('3) Unauthenticated can SELECT public approved designs only', async () => {
    const userA = await createTestUser('public-approved-owner');
    const publicApproved = await seedDesign({
      userId: userA.userId,
      isPublic: true,
      moderationState: 'approved',
    });
    await seedDesign({
      userId: userA.userId,
      isPublic: true,
      moderationState: 'self_certified',
    });

    const anonClient = createAnonClient();
    const { data, error } = await anonClient
      .from('designs')
      .select('id,is_public,moderation_state')
      .eq('id', publicApproved.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      id: publicApproved.id,
      is_public: true,
      moderation_state: 'approved',
    });
  });

  it('4) Unauthenticated CANNOT see private designs', async () => {
    const userA = await createTestUser('private-owner');
    const privateDesign = await seedDesign({
      userId: userA.userId,
      isPublic: false,
      moderationState: 'approved',
    });

    const anonClient = createAnonClient();
    const { data, error } = await anonClient
      .from('designs')
      .select('id')
      .eq('id', privateDesign.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('5) User can INSERT design with own user_id', async () => {
    const userA = await createTestUser('insert-own');

    const { data, error } = await userA.client
      .from('designs')
      .insert({
        user_id: userA.userId,
        title: `insert-own-${crypto.randomUUID()}`,
      })
      .select('id,user_id')
      .single();

    expect(error).toBeNull();
    expect(data?.user_id).toBe(userA.userId);

    if (data?.id) {
      trackedDesignIds.add(data.id);
    }
  });

  it("6) User CANNOT insert design with someone else's user_id", async () => {
    const userA = await createTestUser('insert-forbidden-a');
    const userB = await createTestUser('insert-forbidden-b');

    const { data, error } = await userA.client.from('designs').insert({
      user_id: userB.userId,
      title: `insert-forbidden-${crypto.randomUUID()}`,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('7) User can UPDATE own designs', async () => {
    const userA = await createTestUser('update-own');
    const ownDesign = await seedDesign({ userId: userA.userId, title: 'before-title' });

    const { data, error } = await userA.client
      .from('designs')
      .update({ title: 'after-title' })
      .eq('id', ownDesign.id)
      .select('id,title')
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe('after-title');
  });

  it("8) User CANNOT update another user's designs", async () => {
    const userA = await createTestUser('update-forbidden-a');
    const userB = await createTestUser('update-forbidden-b');
    const userBDesign = await seedDesign({ userId: userB.userId, title: 'original-title' });

    const { data, error } = await userA.client
      .from('designs')
      .update({ title: 'hijacked-title' })
      .eq('id', userBDesign.id)
      .select('id,title');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const admin = createAdminClient();
    const { data: row } = await admin
      .from('designs')
      .select('title')
      .eq('id', userBDesign.id)
      .single();
    expect(row?.title).toBe('original-title');
  });

  it('9) User can DELETE own designs', async () => {
    const userA = await createTestUser('delete-own');
    const ownDesign = await seedDesign({ userId: userA.userId });

    const { data, error } = await userA.client
      .from('designs')
      .delete()
      .eq('id', ownDesign.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(ownDesign.id);

    trackedDesignIds.delete(ownDesign.id);
  });

  it("10) User CANNOT delete another user's designs", async () => {
    const userA = await createTestUser('delete-forbidden-a');
    const userB = await createTestUser('delete-forbidden-b');
    const userBDesign = await seedDesign({ userId: userB.userId });

    const { data, error } = await userA.client
      .from('designs')
      .delete()
      .eq('id', userBDesign.id)
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const admin = createAdminClient();
    const { data: row } = await admin
      .from('designs')
      .select('id')
      .eq('id', userBDesign.id)
      .single();
    expect(row?.id).toBe(userBDesign.id);
  });
});
