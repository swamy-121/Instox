export const CRM_STAGES = ["new", "contacted", "trial", "paid", "churned"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  new: "New",
  contacted: "Contacted",
  trial: "Trial",
  paid: "Paid",
  churned: "Churned",
};

export function isCrmStage(value: string): value is CrmStage {
  return (CRM_STAGES as readonly string[]).includes(value);
}
