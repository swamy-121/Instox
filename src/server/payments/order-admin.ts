import { AppError } from "@/lib/errors";

export const ADMIN_ORDER_STATUSES = ["refunded", "disputed", "failed"] as const;
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

/** Admin can record a refund, a dispute, or a failure. Paid is never an admin status. */
export function parseAdminOrderStatus(value: unknown): AdminOrderStatus {
  if (value === "refunded" || value === "disputed" || value === "failed") return value;
  throw new AppError(400, "VALIDATION_ERROR", "Choose refunded, disputed, or failed. Paid is not an admin status.", {
    status: "Paid cannot be set from this screen.",
  });
}
