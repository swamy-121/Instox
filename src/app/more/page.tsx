"use client";

import Link from "next/link";
import { AppFrame } from "@/components/app-frame";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAdmin } from "@/server/authorization/roles";

const LINKS = [
  ["/profile", "My profile"],
  ["/watchlist", "Watchlist"],
  ["/market", "Market overview"],
  ["/insights", "Insights history"],
  ["/shop", "Shop"],
  ["/premium", "Go Premium"],
  ["/settings", "Settings"],
  ["/help", "Help and support"],
  ["/pricing", "Plans"],
] as const;

export default function MorePage() {
  return (
    <AppFrame requireAuth>
      <MoreBody />
    </AppFrame>
  );
}

function MoreBody() {
  const { state, signOutUser } = useAuth();
  if (state.status !== "ready") return null;
  const admin = canAccessAdmin(state.me.roles);
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">More</h1>
        <p className="text-sm text-muted">{state.me.displayName}</p>
      </header>
      <ul className="card divide-y divide-line p-0">
        {LINKS.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="flex items-center justify-between px-4 py-3 text-sm font-medium text-ink">
              {label}
              <span aria-hidden="true" className="text-muted">›</span>
            </Link>
          </li>
        ))}
        {admin ? (
          <li>
            <Link href="/admin" className="flex items-center justify-between px-4 py-3 text-sm font-medium text-ink">
              Admin
              <span aria-hidden="true" className="text-muted">›</span>
            </Link>
          </li>
        ) : null}
      </ul>
      <button type="button" className="btn-secondary w-full" onClick={() => void signOutUser()}>Log out</button>
    </div>
  );
}
