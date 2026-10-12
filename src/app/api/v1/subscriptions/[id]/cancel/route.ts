import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { getDb } from "@/server/db/client";
import { subscriptions } from "@/server/db/schema";
import { apiOk, withApi } from "@/server/http";
import { cancellationKeepsAccessUntil, nextSubscriptionStatus, type SubscriptionStatus } from "@/server/payments/subscription";

function asStatus(value: unknown): SubscriptionStatus | null {
  if (
    value === "created" || value === "checkout_pending" || value === "active" || value === "past_due" || value === "grace_period" ||
    value === "expired" || value === "cancelled_at_period_end" || value === "cancelled" || value === "refunded" || value === "disputed"
  ) return value;
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withApi(request, "POST /api/v1/subscriptions/:id/cancel", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const db = getDb();
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.userId !== actor.uid) throw new AppError(404, "NOT_FOUND", "That subscription was not found.");
    const current = asStatus(row.status);
    if (!current) throw new AppError(409, "STATE_CONFLICT", "That subscription cannot be cancelled.");
    const next = nextSubscriptionStatus(current, "cancel_at_period_end");
    if (!next) throw new AppError(409, "STATE_CONFLICT", "That subscription cannot be cancelled from its current state.");
    const keepsAccess = row.periodEnd ? cancellationKeepsAccessUntil(row.periodEnd, new Date()) : false;
    const now = new Date().toISOString();
    await db.update(subscriptions).set({ status: next, updatedAt: now, cancelRequestedAt: now }).where(eq(subscriptions.id, id));
    return apiOk({
      id,
      status: next,
      keepsAccess,
      message: keepsAccess
        ? "Cancellation is scheduled. Access stays until the current period ends."
        : "Cancellation is recorded. No new period was added.",
    }, requestId);
  });
}
