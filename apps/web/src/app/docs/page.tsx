export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold text-white">Agent API Docs</h1>
      <p className="mb-10 text-sm text-zinc-400">
        Use the Confit.xyz trading API to connect your agent or bot to a funded challenge account.
      </p>

      {/* Authentication */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-white">Authentication</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="mb-3 text-sm text-zinc-400">
            All API requests must include your agent API key in the request header:
          </p>
          <pre className="rounded-lg bg-zinc-950 px-4 py-3 text-sm font-mono text-emerald-400 overflow-x-auto">
            X-Api-Key: your-api-key-here
          </pre>
          <p className="mt-3 text-sm text-zinc-500">
            Generate an API key from your dashboard after starting a challenge.
          </p>
        </div>
      </section>

      {/* Endpoints */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-white">Endpoints</h2>
        <div className="flex flex-col gap-4">
          <EndpointCard
            method="POST"
            path="/api/trade/order"
            description="Place a new trade order on the funded account."
            body={`{
  "challengeId": "uuid",
  "pair": "BTC-PERP",
  "side": "long",
  "size": 1000,
  "leverage": 5
}`}
          />
          <EndpointCard
            method="GET"
            path="/api/trade/positions?challengeId=uuid"
            description="List all open positions for a challenge."
          />
          <EndpointCard
            method="POST"
            path="/api/trade/positions/:id/close"
            description="Close an open position by its ID."
            body={`{
  "challengeId": "uuid"
}`}
          />
          <EndpointCard
            method="DELETE"
            path="/api/trade/order/:id"
            description="Cancel a pending order by its ID."
          />
          <EndpointCard
            method="GET"
            path="/api/trade/history?challengeId=uuid"
            description="Retrieve the full trade history for a challenge."
          />
          <EndpointCard
            method="GET"
            path="/api/challenge/:id"
            description="Fetch challenge details including equity, PnL, and risk status."
          />
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-white">Rate Limits</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Trade endpoints</p>
              <p className="text-2xl font-bold text-white">10 <span className="text-base font-normal text-zinc-400">req/s</span></p>
              <p className="mt-1 text-xs text-zinc-500">POST /trade/order, POST .../close, DELETE .../order/:id</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Read endpoints</p>
              <p className="text-2xl font-bold text-white">30 <span className="text-base font-normal text-zinc-400">req/s</span></p>
              <p className="mt-1 text-xs text-zinc-500">GET /positions, GET /history, GET /challenge/:id</p>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Rules */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-white">Risk Rules</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Rule</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-400">Starter</th>
                <th className="px-4 py-3 text-center font-medium text-zinc-400">Pro</th>
              </tr>
            </thead>
            <tbody>
              <RiskRow rule="Max Drawdown" starter="10%" pro="10%" />
              <RiskRow rule="Daily Loss Limit" starter="5%" pro="5%" />
              <RiskRow rule="Max Leverage" starter="10x" pro="20x" />
              <RiskRow rule="Max Position Size" starter="30%" pro="30%" last />
              <RiskRow rule="Profit Target" starter="8%" pro="8%" last />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface EndpointCardProps {
  method: "GET" | "POST" | "DELETE";
  path: string;
  description: string;
  body?: string;
}

function EndpointCard({ method, path, description, body }: EndpointCardProps) {
  const methodColor =
    method === "GET"
      ? "bg-blue-600/20 text-blue-400 border-blue-700"
      : method === "POST"
      ? "bg-green-600/20 text-green-400 border-green-700"
      : "bg-red-600/20 text-red-400 border-red-700";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold font-mono ${methodColor}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-zinc-100">{path}</code>
      </div>
      <p className="text-sm text-zinc-400">{description}</p>
      {body && (
        <pre className="mt-3 rounded-lg bg-zinc-950 px-4 py-3 text-xs font-mono text-zinc-300 overflow-x-auto">
          {body}
        </pre>
      )}
    </div>
  );
}

interface RiskRowProps {
  rule: string;
  starter: string;
  pro: string;
  last?: boolean;
}

function RiskRow({ rule, starter, pro, last }: RiskRowProps) {
  return (
    <tr className={last ? "" : "border-b border-zinc-800"}>
      <td className="px-4 py-3 text-zinc-300">{rule}</td>
      <td className="px-4 py-3 text-center text-zinc-100 font-medium">{starter}</td>
      <td className="px-4 py-3 text-center text-zinc-100 font-medium">{pro}</td>
    </tr>
  );
}
