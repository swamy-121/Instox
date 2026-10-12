"use client";

import { AppFrame } from "@/components/app-frame";
import { Pill } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { ContentDesk } from "@/features/admin/content-desk";
import { formatInr } from "@/lib/money";

export default function ShopAdminPage() {
  return (
    <AppFrame admin>
      <OperationsGate>
        <ContentDesk
          collection="shopProducts"
          title="Shop"
          lede="Items shown in the member shop."
          addLabel="Add Product"
          columns={[
            {
              key: "name",
              label: "Product",
              render: (row) => (
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-canvas text-sm font-semibold text-ink">
                    {String(row.name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <span className="block font-medium">{String(row.name ?? "")}</span>
                    <span className="block text-xs text-muted">{String(row.description ?? "")}</span>
                  </span>
                </span>
              ),
            },
            { key: "priceMinor", label: "Price", render: (row) => formatInr(Number(row.priceMinor ?? 0)) },
            { key: "active", label: "Status", render: (row) => <Pill tone={row.active === true ? "green" : "gray"}>{row.active === true ? "Active" : "Hidden"}</Pill> },
          ]}
          fields={[
            { key: "name", label: "Name", kind: "text" },
            { key: "price", label: "Price in rupees", kind: "number" },
            { key: "active", label: "Status", kind: "select", options: [{ value: "true", label: "Active" }, { value: "false", label: "Hidden" }] },
            { key: "description", label: "Description", kind: "textarea" },
          ]}
          fromRow={(row) => ({
            id: String(row.id ?? ""),
            name: String(row.name ?? ""),
            price: String(Number(row.priceMinor ?? 0) / 100),
            active: row.active === true ? "true" : "false",
            description: String(row.description ?? ""),
            approved: row.approved === true ? "true" : "false",
          })}
          blank={() => ({ id: "", name: "", price: "", active: "true", description: "", approved: "false", fulfillment: "unconfigured", currency: "INR" })}
          toPayload={(form) => ({
            id: form.id || slug(form.name),
            name: form.name,
            description: form.description,
            priceMinor: Math.round(Number(form.price) * 100),
            currency: "INR",
            active: form.active !== "false",
            approved: form.approved === "true",
            fulfillment: "unconfigured",
            sort: Date.now() % 100000,
          })}
        />
      </OperationsGate>
    </AppFrame>
  );
}

function slug(value: string): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return base || `product_${Date.now().toString(36)}`;
}
