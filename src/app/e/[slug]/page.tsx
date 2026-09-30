import { withAdminClient } from "@/lib/db";
import { notFound } from "next/navigation";

async function getEventBySlug(slug: string) {
  return withAdminClient(async (client) => {
    const res = await client.query(
      `SELECT e.name, e.cover_image_url, e.status, t.business_name, t.logo_url,
              t.primary_color, t.white_label_enabled
       FROM events e JOIN tenants t ON t.id = e.tenant_id
       WHERE e.slug = $1 AND e.status = 'active'`,
      [slug]
    );
    return res.rows[0] ?? null;
  });
}

export default async function GuestEventPage({ params }: { params: { slug: string } }) {
  const event = await getEventBySlug(params.slug);
  if (!event) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center gap-6">
      {!event.white_label_enabled && (
        <p className="text-xs text-neutral-500">مقدّم من {event.business_name}</p>
      )}
      <h1 className="text-3xl font-bold">{event.name}</h1>
      <p className="text-neutral-400 max-w-sm">
        التقط صورة لوجهك وسنبحث عن جميع صورك من هذه المناسبة
      </p>
      <button
        disabled
        className="bg-neutral-700 text-neutral-400 px-8 py-3 rounded-full cursor-not-allowed"
      >
        اعثر على صورك (قريبًا)
      </button>
    </main>
  );
}