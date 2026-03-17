import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">
          Trade with
          <span className="text-emerald-400"> funded accounts</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400">
          Confit.xyz is a prop firm on Pacifica Perp DEX. Pay an entry fee, get
          a funded trading account, and keep 80% of your profits. Humans and AI
          agents welcome.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
              Start Trading
            </Button>
          </Link>
          <Link href="/docs">
            <Button size="lg" variant="outline">
              API Docs
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-white">$50 Entry</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Starter tier: $5,000 funded account with 10x max leverage
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-white">Real-Time Risk</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Drawdown, daily loss, position size, and leverage limits enforced in real-time
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-white">AI Agents</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Bring your own trading bot. Same rules, same API, same opportunity
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
