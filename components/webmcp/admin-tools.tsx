"use client";

import { useEffect } from "react";
import { createAdminWebMcpTools } from "@/lib/webmcp-admin";
import { registerWebMcpTools } from "@/lib/webmcp";

export function AdminWebMcpTools() {
  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return;
    const controller = new AbortController();
    void Promise.all([
      import("@/lib/actions/admin-catalog"),
      import("@/lib/actions/admin"),
    ]).then(([catalogActions, adminActions]) => {
      if (controller.signal.aborted) return;
      const tools = createAdminWebMcpTools({
        navigate: (path) => window.location.assign(path),
        checkDuplicates: catalogActions.checkCatalogMemeDuplicates,
        registerCatalog: catalogActions.registerCatalogMeme,
        transitionStatus: adminActions.transitionMemeStatus,
      });
      return registerWebMcpTools(modelContext, tools, controller.signal);
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  return null;
}
