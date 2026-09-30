import { NextRequest, NextResponse } from "next/server";
import { withTenantClient } from "@/lib/db";
import QRCode from "qrcode";

// GET /api/events/:eventId/qrcode — returns a PNG QR code pointing to the public event page.
export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const event = await withTenantClient(tenantId, async (client) => {
    const res = await client.query(
      `SELECT slug FROM events WHERE id = $1`,
      [params.eventId]
    );
    return res.rows[0] ?? null;
  });

  if (!event) return NextResponse.json({ error: "المناسبة غير موجودة" }, { status: 404 });

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/e/${event.slug}`;

  const pngBuffer = await QRCode.toBuffer(publicUrl, {
    type: "png",
    width: 600,
    margin: 2,
    color: { dark: "#111111", light: "#FFFFFF" },
  });

  return new NextResponse(pngBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="event-qr-${event.slug}.png"`,
    },
  });
}