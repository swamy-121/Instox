import { requireOperations } from "@/server/auth/operations";
import { adminDb } from "@/server/db/admin";
import { apiOk, withApi } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withApi(request, "GET /api/v1/admin/orders", async ({ requestId }) => {
    await requireOperations(request);
    const snap = await adminDb().collection("paymentOrders").limit(100).get();
    const orders = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: String(data.uid ?? ""),
          planId: String(data.planId ?? ""),
          provider: String(data.provider ?? ""),
          amountMinor: Number(data.amountMinor ?? 0),
          currency: String(data.currency ?? ""),
          status: String(data.status ?? ""),
          entitlementGranted: data.entitlementGranted === true,
          createdAt: String(data.createdAt ?? ""),
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return apiOk({ orders }, requestId);
  });
}
