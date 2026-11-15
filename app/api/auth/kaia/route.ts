import { NextResponse } from "next/server";
import { allowInternalSignup } from "@/lib/auth/internal";
import { createKaiaMessage, kaiaMessageAddress, recoverPersonalSignAddress, walletEmail, walletPassword } from "@/lib/auth/kaia";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { hasTrustedOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ message: "untrusted origin" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { address?: string; message?: string; signature?: string } | null;
  const address = body?.address?.toLowerCase() ?? "";
  const signature = body?.signature ?? "";
  if (!/^0x[0-9a-f]{40}$/.test(address)) return NextResponse.json({ message: "bad address" }, { status: 400 });
  if (!signature) return NextResponse.json({ message: createKaiaMessage(address) });

  const message = body?.message ?? "";
  const claimed = kaiaMessageAddress(message);
  const recovered = recoverPersonalSignAddress(message, signature);
  if (!claimed || claimed !== address || recovered !== address) {
    return NextResponse.json({ message: "bad signature" }, { status: 401 });
  }

  await ensureAuthSchema();
  const email = walletEmail(address);
  const password = walletPassword(address);
  await allowInternalSignup(async () => {
    try {
      await getAuth().api.signUpEmail({ body: { email, password, name: `카이아_${address.slice(2, 8)}` } });
    } catch {
      // The wallet already has an account. Sign-in below opens the session.
    }
  });
  const authResponse = await getAuth().api.signInEmail({
    body: { email, password },
    headers: request.headers,
    asResponse: true,
  });
  return new NextResponse(JSON.stringify({ ok: true }), { status: authResponse.status, headers: authResponse.headers });
}
