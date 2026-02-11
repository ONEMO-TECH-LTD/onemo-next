"use client";

import { useEffect } from "react";

import { ensureSession } from "@/lib/supabase/session";

export default function CreatePage() {
  useEffect(() => {
    ensureSession().catch((error) => {
      console.error("Failed to ensure session", error);
    });
  }, []);

  return <main>Create Page - Coming Soon</main>;
}
