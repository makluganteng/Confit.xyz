"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-white">
            Confit.xyz
          </Link>
          {authenticated && (
            <div className="flex gap-6">
              <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
                Dashboard
              </Link>
              <Link href="/trade" className="text-sm text-zinc-400 hover:text-white">
                Trade
              </Link>
              <Link href="/leaderboard" className="text-sm text-zinc-400 hover:text-white">
                Leaderboard
              </Link>
              <Link href="/docs" className="text-sm text-zinc-400 hover:text-white">
                API Docs
              </Link>
            </div>
          )}
        </div>
        <div>
          {ready && !authenticated && (
            <Button onClick={login} variant="outline">
              Sign In
            </Button>
          )}
          {ready && authenticated && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">
                {user?.wallet?.address
                  ? `${user.wallet.address.slice(0, 4)}...${user.wallet.address.slice(-4)}`
                  : user?.email?.address || "Connected"}
              </span>
              <Button onClick={logout} variant="ghost" size="sm">
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
