import { NextRequest, NextResponse } from "next/server";
import { withAdminClient } from "@/lib/db";
import { verifyPassword, signSession, verifyMfaToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaToken: z.string().optional(), // required only for super_admin accounts with MFA enabled
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }
  const { email, password, mfaToken } = parsed.data;

  // Rate limit per email+IP to slow down brute force without locking out shared IPs entirely.
  if (!checkRateLimit(`login:${ip}:${email}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "محاولات كثيرة جدًا، حاول بعد قليل." }, { status: 429 });
  }

  const user = await withAdminClient(async (client) => {
    const res = await client.query(
      `SELECT id, tenant_id, password_hash, role, mfa_enabled, mfa_secret
       FROM users WHERE email = $1`,
      [email]
    );
    return res.rows[0] ?? null;
  });

  // Constant response shape whether the email exists or not, to avoid user enumeration.
  const genericError = () => NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });

  if (!user) return genericError();

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) return genericError();

  if (user.role === "super_admin" && user.mfa_enabled) {
    if (!mfaToken) {
      return NextResponse.json({ error: "MFA_REQUIRED" }, { status: 401 });
    }
    if (!verifyMfaToken(mfaToken, user.mfa_secret)) {
      return genericError();
    }
  }

  const token = await signSession({ userId: user.id, tenantId: user.tenant_id, role: user.role });

  const response = NextResponse.json({ message: "تم تسجيل الدخول" });
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
