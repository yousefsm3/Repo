import { NextRequest, NextResponse } from "next/server";
import { withTenantClient } from "@/lib/db";
import { generateEventSlug } from "@/lib/slug";
import { z } from "zod";

const CreateEventSchema = z.object({
  name: z.string().min(2).max(200),
  eventDate: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

// POST /api/events — create a new event for the logged-in photographer's tenant.
export async function POST(req: NextRequest) {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, eventDate, location, description } = parsed.data;

  try {
    const event = await withTenantClient(tenantId, async (client) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const slug = generateEventSlug();
        try {
          const res = await client.query(
            `INSERT INTO events (tenant_id, slug, name, event_date, location, description)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, slug, name, event_date, location, status, created_at`,
            [tenantId, slug, name, eventDate ?? null, location ?? null, description ?? null]
          );
          return res.rows[0];
        } catch (err: any) {
          if (err.code === "23505") continue;
          throw err;
        }
      }
      throw new Error("SLUG_GENERATION_FAILED");
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error("create event error", err);
    return NextResponse.json({ error: "تعذّر إنشاء المناسبة، حاول مرة أخرى" }, { status: 500 });
  }
}

// GET /api/events — list this tenant's events (dashboard "My Events" list).
export async function GET(req: NextRequest) {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const events = await withTenantClient(tenantId, async (client) => {
    const res = await client.query(
      `SELECT id, slug, name, event_date, location, status, created_at
       FROM events WHERE status != 'deleted' ORDER BY created_at DESC`
    );
    return res.rows;
  });

  return NextResponse.json({ events });
}