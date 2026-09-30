import bcrypt from "bcryptjs";
import * as jose from "jose";
import { authenticator } from "otplib";

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with `undefined`.
  throw new Error("NEXTAUTH_SECRET is not set. See .env.example.");
}
const secretKey = new TextEncoder().encode(JWT_SECRET);
export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: "super_admin" | "photographer" | "event_manager";
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
export async function signSession(payload: SessionPayload): Promise<string> {
  return new jose.SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
// ---- MFA (TOTP), required for super_admin per spec §13 ----
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function getMfaOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, "WeddingAIPlatform", secret);
}

export function verifyMfaToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
