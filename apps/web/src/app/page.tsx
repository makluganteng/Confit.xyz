import Link from "next/link";

export default function Home() {
  return (
    <div className="noise-bg grid-bg relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Hero section */}
      <section className="hero-glow relative flex flex-col items-center justify-center px-4 pt-24 pb-16">
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
            <span className="text-xs font-medium tracking-wide text-emerald-300 uppercase">
              Built on Pacifica Perp DEX
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-100 text-5xl font-bold tracking-tight leading-[1.1] sm:text-7xl lg:text-8xl">
            Trade with{" "}
            <span className="gradient-text">funded capital</span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-up delay-200 mx-auto mt-6 max-w-2xl text-lg text-[#6b7894] leading-relaxed sm:text-xl">
            Confit is a prop firm for perpetual futures. Pay an entry fee,
            prove your edge, and keep <span className="text-white font-medium">80% of the profits</span>.
            Open to humans and AI agents alike.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up delay-300 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/dashboard">
              <button className="glow-btn rounded-lg px-8 py-3 text-sm font-semibold text-[#06090f] transition-transform hover:scale-[1.02] active:scale-[0.98]">
                Start a Challenge
              </button>
            </Link>
            <Link href="/docs">
              <button className="rounded-lg border border-white/10 bg-white/[0.03] px-8 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:text-white hover:border-white/20">
                API Documentation
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="animate-fade-up delay-400 relative z-10 mx-auto max-w-4xl px-4 py-8">
        <div className="glass-card flex items-center justify-around rounded-2xl px-8 py-6">
          <div className="text-center">
            <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-white">$5K</p>
            <p className="mt-1 text-xs text-[#6b7894] uppercase tracking-wider">Starter Capital</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-white">$10K</p>
            <p className="mt-1 text-xs text-[#6b7894] uppercase tracking-wider">Pro Capital</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="font-[family-name:var(--font-mono)] text-2xl font-bold gradient-text">80%</p>
            <p className="mt-1 text-xs text-[#6b7894] uppercase tracking-wider">Profit Share</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <p className="font-[family-name:var(--font-mono)] text-2xl font-bold text-white">30d</p>
            <p className="mt-1 text-xs text-[#6b7894] uppercase tracking-wider">Challenge Duration</p>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="animate-fade-up delay-500 relative z-10 mx-auto max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Card 1 */}
          <div className="glass-card group relative rounded-xl p-6 transition-all duration-300">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">Funded Accounts</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6b7894]">
              Pay $50 or $100 entry fee. Get $5K or $10K in funded capital to trade perpetual futures on Pacifica.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card group relative rounded-xl p-6 transition-all duration-300">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
              <svg className="h-5 w-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">Real-Time Risk Engine</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6b7894]">
              Drawdown, daily loss, position size, and leverage limits monitored every 1.5 seconds. No surprises.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card group relative rounded-xl p-6 transition-all duration-300">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
              <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">AI Agent Ready</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6b7894]">
              Bring your own trading bot. Register via API, get an API key, and trade programmatically. Same rules apply.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="animate-fade-up delay-600 relative z-10 mx-auto max-w-3xl px-4 pb-24">
        <h2 className="mb-12 text-center text-2xl font-bold text-white">How it works</h2>
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-emerald-500/40 via-teal-500/20 to-transparent" />

          <div className="space-y-8">
            {[
              { step: "01", title: "Sign up & choose a tier", desc: "Connect with email, social, or wallet via Privy. Pick Starter ($50) or Pro ($100)." },
              { step: "02", title: "Trade with funded capital", desc: "Place orders through our UI or REST API. Your trades execute on Pacifica Perp DEX." },
              { step: "03", title: "Hit 8% profit target", desc: "Reach the target within 30 days without breaching risk limits. You keep 80% of profits." },
            ].map((item) => (
              <div key={item.step} className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/5">
                  <span className="font-[family-name:var(--font-mono)] text-xs font-bold text-emerald-400">{item.step}</span>
                </div>
                <div className="pt-1">
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#6b7894]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
