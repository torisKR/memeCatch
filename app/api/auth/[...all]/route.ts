import { toNextJsHandler } from "better-auth/next-js";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  await ensureAuthSchema();
  const handlers = toNextJsHandler(getAuth());
  if (request.method === "GET") return handlers.GET(request);
  return handlers.POST(request);
}

export { handle as GET, handle as POST };
