import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/e/", // guest event pages are public by design
  "/kiosk/",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("session")?.value;
    const session = token ? verifySession(token) : null;

    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // Attach the verified session to request headers so route handlers/services
    // never have to re-parse or (worse) trust a client-supplied tenantId.
    const headers = new Headers(req.headers);
    headers.set("x-user-id", session.userId);
    headers.set("x-tenant-id", session.tenantId);
    headers.set("x-user-role", session.role);
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
