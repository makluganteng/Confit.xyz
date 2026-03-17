"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

export function Navbar() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06090f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-teal-500">
              <span className="text-xs font-bold text-[#06090f]">C</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              confit<span className="text-emerald-400">.xyz</span>
            </span>
          </Link>

          {authenticated && (
            <div className="hidden sm:flex items-center gap-1">
              {[
                { href: "/dashboard", label: "Dashboard" },
                { href: "/trade", label: "Trade" },
                { href: "/leaderboard", label: "Leaderboard" },
                { href: "/docs", label: "API" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-[#6b7894] transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          {ready && !authenticated && (
            <button
              onClick={login}
              className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:text-white"
            >
              Connect
            </button>
          )}
          {ready && authenticated && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
                <span className="font-[family-name:var(--font-mono)] text-xs text-[#6b7894]">
                  {user?.wallet?.address
                    ? `${user.wallet.address.slice(0, 4)}...${user.wallet.address.slice(-4)}`
                    : user?.email?.address || "Connected"}
                </span>
              </div>
              <button
                onClick={logout}
                className="rounded-md px-3 py-1.5 text-xs text-[#6b7894] transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
