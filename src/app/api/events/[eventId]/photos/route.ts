import { NextRequest, NextResponse } from "next/server";
import { withTenantClient } from "@/lib/db";
import { storageProvider } from "@/providers/S3StorageProvider";
import crypto from "crypto";

// POST /api/events/:eventId/photos — upload one photo, store in S3, record in DB.
// AI processing (face detection) happens later in a background worker, not here.
export async function POST(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const storageKey = `events/${params.eventId}/originals/${fileHash}-${file.name}`;

  try {
    const photo = await withTenantClient(tenantId, async (client) => {
      // Duplicate detection via unique (event_id, file_hash) constraint.
      const existing = await client.query(
        `SELECT id FROM photos WHERE event_id = $1 AND file_hash = $2`,
        [params.eventId, fileHash]
      );
      if (existing.rows[0]) return { ...existing.rows[0], duplicate: true };

      await storageProvider.upload(storageKey, buffer, file.type);

      const res = await client.query(
        `INSERT INTO photos (tenant_id, event_id, storage_key, file_size, file_hash, processing_status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id, storage_key, processing_status, uploaded_at`,
        [tenantId, params.eventId, storageKey, buffer.length, fileHash]
      );
      return { ...res.rows[0], duplicate: false };
    });

    return NextResponse.json({ photo }, { status: photo.duplicate ? 200 : 201 });
  } catch (err) {
    console.error("upload photo error", err);
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 });
  }
}

// GET /api/events/:eventId/photos — list photos for this event (dashboard gallery).
export async function GET(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const photos = await withTenantClient(tenantId, async (client) => {
    const res = await client.query(
      `SELECT id, storage_key, thumbnail_key, processing_status, uploaded_at
       FROM photos WHERE event_id = $1 ORDER BY uploaded_at DESC`,
      [params.eventId]
    );
    return res.rows;
  });

  return NextResponse.json({ photos });
}