import { NextRequest, NextResponse } from "next/server";
import { readSignedObject, verifySignedObject } from "@/lib/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const exp = request.nextUrl.searchParams.get("exp") ?? "";
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  if (!key || !verifySignedObject(key, exp, sig)) return NextResponse.json({ message: "expired" }, { status: 401 });
  try {
    const stored = await readSignedObject(key);
    if (!stored) return NextResponse.json({ message: "missing" }, { status: 404 });
    return new NextResponse(Buffer.from(stored.bytes), { headers: { "content-type": stored.type, "cache-control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ message: "unreadable" }, { status: 400 });
  }
}
