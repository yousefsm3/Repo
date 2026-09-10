import { NextRequest, NextResponse } from "next/server";
import { withAdminClient } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const RegisterSchema = z.object({
  businessName: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(10, "كلمة المرور يجب أن تكون 10 أحرف على الأقل"),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "محاولات كثيرة جدًا، حاول لاحقًا." }, { status: 429 });
  }

  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { businessName, email, password } = parsed.data;

  try {
    const result = await withAdminClient(async (client) => {
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rowCount && existing.rowCount > 0) {
        throw new Error("EMAIL_TAKEN");
      }

      await client.query("BEGIN");
      try {
        // Every new signup starts on the default free/trial plan (admin-managed, no hardcoded limits).
        const planRes = await client.query(
          "SELECT id FROM plans WHERE name = 'Starter' AND is_active = true LIMIT 1"
        );
        const planId = planRes.rows[0]?.id ?? null;

        const tenantRes = await client.query(
          `INSERT INTO tenants (business_name, plan_id) VALUES ($1, $2) RETURNING id`,
          [businessName, planId]
        );
        const tenantId = tenantRes.rows[0].id;

        const passwordHash = await hashPassword(password);
        const userRes = await client.query(
          `INSERT INTO users (tenant_id, email, password_hash, role)
           VALUES ($1, $2, $3, 'photographer') RETURNING id`,
          [tenantId, email, passwordHash]
        );

        await client.query(
          `INSERT INTO audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
           VALUES ($1, $2, 'tenant.created', 'tenant', $1)`,
          [tenantId, userRes.rows[0].id]
        );

        await client.query("COMMIT");
        return { tenantId, userId: userRes.rows[0].id };
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });

    return NextResponse.json(
      { message: "تم إنشاء الحساب بنجاح", tenantId: result.tenantId },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "هذا البريد الإلكتروني مستخدم بالفعل." }, { status: 409 });
    }
    console.error("register error", err);
    return NextResponse.json({ error: "حدث خطأ، حاول مرة أخرى." }, { status: 500 });
  }
}
