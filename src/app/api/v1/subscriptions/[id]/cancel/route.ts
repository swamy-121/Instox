import { AppError } from "@/lib/errors";
import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";
import { cancellationKeepsAccessUntil, nextSubscriptionStatus, type SubscriptionStatus } from "@/server/payments/subscription";

function asStatus(value: unknown): SubscriptionStatus | null {
  if (
    value === "created" ||
    value === "checkout_pending" ||
    value === "active" ||
    value === "past_due" ||
    value === "grace_period" ||
    value === "expired" ||
    value === "cancelled_at_period_end" ||
    value === "cancelled" ||
    value === "refunded" ||
    value === "disputed"
  ) {
    return value;
  }
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withApi(request, "POST /api/v1/subscriptions/:id/cancel", async ({ requestId }) => {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const ref = adminDb().collection("subscriptions").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== actor.uid) {
      throw new AppError(404, "NOT_FOUND", "That subscription was not found.");
    }
    const current = asStatus(snap.data()?.status);
    if (!current) throw new AppError(409, "STATE_CONFLICT", "That subscription cannot be cancelled.");
    const next = nextSubscriptionStatus(current, "cancel_at_period_end");
    if (!next) throw new AppError(409, "STATE_CONFLICT", "That subscription cannot be cancelled from its current state.");
    const periodEnd = snap.data()?.periodEnd ? String(snap.data()?.periodEnd) : null;
    const keepsAccess = periodEnd ? cancellationKeepsAccessUntil(periodEnd, new Date()) : false;
    await ref.update({
      status: next,
      updatedAt: new Date().toISOString(),
      cancelRequestedAt: new Date().toISOString(),
    });
    return apiOk(
      {
        id,
        status: next,
        keepsAccess,
        message: keepsAccess
          ? "Cancellation is scheduled. Access stays until the current period ends."
          : "Cancellation is recorded. No new period was added.",
      },
      requestId,
    );
  });
}
