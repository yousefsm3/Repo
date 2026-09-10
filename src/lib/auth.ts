import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with `undefined`.
  throw new Error("NEXTAUTH_SECRET is not set. See .env.example.");
}

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

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as SessionPayload;
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
