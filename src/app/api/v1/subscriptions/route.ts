import { requireActor } from "@/server/auth/actor";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/subscriptions", async ({ requestId }) => {
    const actor = await requireActor(request);
    const snap = await adminDb().collection("subscriptions").where("uid", "==", actor.uid).limit(20).get();
    const subscriptions = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          planId: String(data.planId ?? ""),
          status: String(data.status ?? ""),
          periodEnd: data.periodEnd ? String(data.periodEnd) : null,
          createdAt: String(data.createdAt ?? ""),
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return apiOk({ subscriptions }, requestId);
  });
}
