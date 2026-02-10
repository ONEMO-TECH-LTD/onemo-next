import { ensureSession } from "@/lib/supabase/ensure-session";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const user = await ensureSession();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-3xl font-semibold">ONEMO Configurator</h1>
      <p className="text-zinc-700">
        Session initialized for user <span className="font-mono">{user.id}</span>.
      </p>
      <p className="text-sm text-zinc-600">
        Current session type: {user.is_anonymous ? "anonymous" : "account"}.
      </p>
    </main>
  );
}
