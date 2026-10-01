"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPublicWebMcpTools, registerWebMcpTools } from "@/lib/webmcp";

export function PublicWebMcpTools() {
  const router = useRouter();
  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return;
    const controller = new AbortController();
    void registerWebMcpTools(
      modelContext,
      createPublicWebMcpTools((path) => router.push(path)),
      controller.signal,
    ).catch(() => undefined);
    return () => controller.abort();
  }, [router]);
  return null;
}
