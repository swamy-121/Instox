"use client";

import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { AdminTabs, Pill } from "@/components/admin-ui";
import { OperationsGate } from "@/components/operations-gate";
import { ContentDesk } from "@/features/admin/content-desk";

const PATHS = [
  { value: "/home", label: "Home" },
  { value: "/tips", label: "Tips" },
  { value: "/screener", label: "Screener" },
  { value: "/news", label: "News" },
  { value: "/shop", label: "Shop" },
  { value: "/market", label: "Market" },
  { value: "/watchlist", label: "Watchlist" },
  { value: "/premium", label: "Premium" },
  { value: "/profile", label: "Profile" },
  { value: "/insights", label: "Insights" },
  { value: "/settings", label: "Settings" },
  { value: "/help", label: "Help" },
  { value: "/pricing", label: "Pricing" },
];

const ICONS = [
  { value: "tips", label: "Tips" },
  { value: "screener", label: "Screener" },
  { value: "news", label: "News" },
  { value: "shop", label: "Shop" },
  { value: "market", label: "Market" },
  { value: "watchlist", label: "Watchlist" },
  { value: "premium", label: "Premium" },
  { value: "help", label: "Help" },
];

export default function MemberAppPage() {
  const [tab, setTab] = useState("tiles");
  return (
    <AppFrame admin>
      <OperationsGate>
        <AdminTabs
          tabs={[
            { id: "tiles", label: "Home tiles" },
            { id: "more", label: "More menu" },
            { id: "onboarding", label: "Onboarding" },
            { id: "watchlist", label: "Watchlist defaults" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="mt-4">
          {tab === "tiles" ? (
            <ContentDesk
              collection="homeTiles"
              title="Home tiles"
              lede="Shortcuts on the member home screen."
              addLabel="Add tile"
              columns={[
                { key: "label", label: "Label" },
                { key: "href", label: "Path" },
                { key: "icon", label: "Icon" },
                { key: "status", label: "Status", render: (row) => <Pill tone={row.status === "published" ? "green" : "gray"}>{row.status === "published" ? "Published" : "Draft"}</Pill> },
              ]}
              fields={[
                { key: "label", label: "Label", kind: "text" },
                { key: "href", label: "Path", kind: "select", options: PATHS },
                { key: "icon", label: "Icon", kind: "select", options: ICONS },
                { key: "status", label: "Status", kind: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
                { key: "sort", label: "Sort", kind: "number" },
              ]}
              blank={() => ({ id: "", label: "", href: "/tips", icon: "tips", status: "draft", sort: "1" })}
              toPayload={(form) => ({
                id: form.id || slug(form.label, "tile"),
                href: form.href,
                label: form.label,
                icon: form.icon,
                status: form.status === "published" ? "published" : "draft",
                sort: Number(form.sort || 1),
              })}
            />
          ) : null}
          {tab === "more" ? (
            <ContentDesk
              collection="moreLinks"
              title="More menu"
              lede="Rows on the member More screen. Admin and Log out stay in the app."
              addLabel="Add link"
              columns={[
                { key: "label", label: "Label" },
                { key: "href", label: "Path" },
                { key: "status", label: "Status", render: (row) => <Pill tone={row.status === "published" ? "green" : "gray"}>{row.status === "published" ? "Published" : "Draft"}</Pill> },
              ]}
              fields={[
                { key: "label", label: "Label", kind: "text" },
                { key: "href", label: "Path", kind: "select", options: PATHS },
                { key: "status", label: "Status", kind: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
                { key: "sort", label: "Sort", kind: "number" },
              ]}
              blank={() => ({ id: "", label: "", href: "/profile", status: "draft", sort: "1" })}
              toPayload={(form) => ({
                id: form.id || slug(form.label, "more"),
                href: form.href,
                label: form.label,
                status: form.status === "published" ? "published" : "draft",
                sort: Number(form.sort || 1),
              })}
            />
          ) : null}
          {tab === "onboarding" ? (
            <ContentDesk
              collection="onboardingSlides"
              title="Onboarding"
              lede="Slides shown before sign-in."
              addLabel="Add slide"
              columns={[
                { key: "title", label: "Title" },
                { key: "icon", label: "Icon" },
                { key: "sort", label: "Sort" },
              ]}
              fields={[
                { key: "title", label: "Title", kind: "text" },
                { key: "body", label: "Body", kind: "textarea" },
                { key: "icon", label: "Icon", kind: "select", options: [
                  { value: "chart", label: "Chart" },
                  { value: "search", label: "Search" },
                  { value: "news", label: "News" },
                ] },
                { key: "sort", label: "Sort", kind: "number" },
              ]}
              blank={() => ({ id: "", title: "", body: "", icon: "chart", sort: "1" })}
              toPayload={(form) => ({
                id: form.id || slug(form.title, "slide"),
                title: form.title,
                body: form.body,
                icon: form.icon === "search" || form.icon === "news" ? form.icon : "chart",
                sort: Number(form.sort || 1),
              })}
            />
          ) : null}
          {tab === "watchlist" ? (
            <ContentDesk
              collection="watchlistDefaults"
              title="Watchlist defaults"
              lede="Symbols copied onto a new account. Existing watchlists are left as they are."
              addLabel="Add symbol"
              columns={[
                { key: "symbol", label: "Symbol" },
                { key: "status", label: "Status", render: (row) => <Pill tone={row.status === "published" ? "green" : "gray"}>{row.status === "published" ? "Published" : "Draft"}</Pill> },
              ]}
              fields={[
                { key: "symbol", label: "Symbol", kind: "text" },
                { key: "status", label: "Status", kind: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
                { key: "sort", label: "Sort", kind: "number" },
              ]}
              blank={() => ({ id: "", symbol: "", status: "published", sort: "1" })}
              toPayload={(form) => ({
                id: form.id || `default_${form.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24) || Date.now().toString(36)}`,
                symbol: form.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32),
                status: form.status === "published" ? "published" : "draft",
                sort: Number(form.sort || 1),
              })}
            />
          ) : null}
        </div>
      </OperationsGate>
    </AppFrame>
  );
}

function slug(value: string, prefix: string): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return base ? `${prefix}_${base}` : `${prefix}_${Date.now().toString(36)}`;
}
