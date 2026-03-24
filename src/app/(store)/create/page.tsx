"use client";

import { useEffect, useState } from "react";

import { ensureSession } from "@/lib/supabase/session-client";

export default function CreatePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const { user } = await ensureSession();
        if (isMounted) {
          setUserId(user.id);
        }
      } catch (sessionError) {
        if (isMounted) {
          setError("Unable to initialize your design session.");
        }
        console.error(sessionError);
      }
    }

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main>
      <h1>Create Page</h1>
      <p>{error ?? "Design tool shell is ready."}</p>
      <p>
        {userId
          ? `Session user: ${userId}`
          : "Creating anonymous session..."}
      </p>
    </main>
  );
}
