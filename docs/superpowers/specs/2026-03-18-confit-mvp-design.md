# Confit.xyz MVP Design Spec

## Overview

Confit.xyz is a prop firm trading platform built on Pacifica Perp Dex (Solana). Traders — both humans and user-owned AI agents — pay an entry fee for a funded perpetual futures trading account. They trade under enforced risk rules, and if they pass the challenge without blowing the drawdown, they keep a share of the profits. If they fail, they lose the entry fee.

### Core Loop

1. User signs in via Privy (email, social, or wallet)
2. User selects a challenge tier and pays the entry fee (USDC on Solana)
3. Platform creates a Pacifica subaccount under the master wallet, funded with the tier's capital
4. User trades through the Confit UI (humans) or REST API (AI agents)
5. Risk monitoring service enforces rules in real-time
6. Challenge ends in pass (profit split) or fail (entry fee forfeited)

### Capital Funding Model

The platform operator (you) pre-funds the master wallet with trading capital. Entry fees are not the source of trading capital — they are protocol revenue that covers the risk of funding traders. The master wallet must hold enough capital to fund all active challenges simultaneously.

For MVP, seed the master wallet manually. If the wallet's available capital drops below the threshold to fund new challenges, new challenge entries are paused until capital is replenished (from entry fees collected, profits from failed challenges, or manual top-up).

### Challenge Pass/Fail Conditions

**Pass:** Trader achieves a profit target of 8% on their funded capital within 30 days without violating any risk rules. On pass, the trader receives 80% of the profits; the platform keeps 20%.

**Fail:** Any of these triggers:
- Max drawdown breached (equity drops below 90% of starting capital)
- 30-day time limit expires without hitting profit target
- Trader manually withdraws from challenge

On fail, the entry fee is forfeited (protocol revenue). Trading capital returns to the master wallet.

**End-of-challenge sequence (pass or fail):**
1. Close all open positions on Pacifica for the trader's subaccount
2. Wait for all positions to settle, reconcile final realized PnL
3. `total_profit = challenge.realized_pnl` (all PnL is realized since positions are closed)
4. Call Solana program `pass_challenge(total_profit)` or `fail_challenge()`
5. Deallocate the Pacifica subaccount

### Key Constraint

All trades are executed by the platform's master wallet on behalf of traders. Traders never have direct access to the funded capital or Pacifica accounts — this prevents theft and enables risk enforcement.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js (TypeScript) |
| Auth | Privy (email, social, wallet login + embedded wallets) |
| Database | PostgreSQL |
| Real-time messaging | Redis Streams |
| Risk monitoring | Standalone Node.js service |
| Smart contract | Solana / Anchor (Rust) |
| Perp DEX | Pacifica (Solana) |

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │  Frontend     │  │  API Routes                 │  │
│  │  - Landing    │  │  - /api/challenge/*         │  │
│  │  - Dashboard  │  │  - /api/trade/*             │  │
│  │  - Trading UI │  │  - /api/agent/*             │  │
│  │  - Leaderboard│  │  - /api/leaderboard         │  │
│  └──────────────┘  └──────────┬──────────────────┘  │
│                               │                      │
└───────────────────────────────┼──────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
              ▼                 ▼                  ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  PostgreSQL   │  │    Redis     │  │   Pacifica   │
     │  (persistent  │  │   Streams    │  │  Perp DEX    │
     │   state)      │  │  (events)    │  │  (master     │
     └──────────────┘  └──────┬───────┘  │   wallet)    │
                              │          └──────────────┘
                              │                  ▲
                              ▼                  │
                     ┌──────────────────┐        │
                     │  Risk Monitoring │────────┘
                     │  Service         │
                     │  (standalone     │
                     │   Node.js)       │
                     └──────────────────┘

     ┌──────────────┐
     │  Solana       │
     │  Program      │
     │  (Anchor)     │
     │  - Escrow     │
     └──────────────┘
```

### Data Flow

**Trade submission:**
1. User/Agent submits order → Next.js API
2. API runs pre-trade risk checks (position size, leverage cap, daily loss)
3. If valid, API signs and submits order to Pacifica via master wallet
4. API publishes trade event to Redis Stream `trades`
5. API returns order confirmation

**Risk monitoring:**
1. Risk service consumes Redis Stream `trades`
2. Risk service polls Pacifica every 1-2 seconds for position data per active trader
3. On violation: publishes kill event to Redis Stream `risk-events`, updates PostgreSQL, closes positions on Pacifica
4. Next.js API consumes `risk-events`, pushes to frontend via WebSocket
5. If max drawdown hit: calls Solana program `fail_challenge`

---

## Component Details

### 1. Solana Program (Anchor)

**Accounts:**
- `Vault` — PDA holding escrowed entry fees (USDC)
- `TradingCapital` — Separate PDA holding the platform's trading capital pool, funded by the operator
- `Challenge` — PDA per trader: trader pubkey, entry fee amount, profit_split_pct, status (active/passed/failed), created_at, funded_account_id, profit_target_pct, expires_at

**Instructions:**
- `enter_challenge(amount, tier)` — Transfers USDC entry fee from trader to Vault PDA, creates Challenge account with status `active`, sets profit_target to 8%, expires_at to 30 days from now, profit_split to 80/20
- `fail_challenge(challenge)` — Admin-only (backend keypair). Marks challenge as `failed`, entry fee remains in vault as protocol revenue
- `pass_challenge(challenge, total_profit)` — Admin-only. Marks as `passed`, transfers 80% of profit from TradingCapital PDA to trader's wallet, 20% stays with platform
- `withdraw_challenge(challenge)` — Trader-initiated early exit. Marks as `failed`, forfeits entry fee

**Solvency:** The Vault (entry fees) and TradingCapital (funded accounts) are separate PDAs. Profit payouts come from TradingCapital, not from entry fees. The operator must ensure TradingCapital is adequately funded.

The contract is intentionally simple — the backend is the authority for pass/fail decisions based on the risk engine's data.

### 2. Next.js App

**Frontend Pages:**
- Landing page — product explanation, enter a challenge
- Login — Privy-powered (email, social, or wallet)
- Dashboard — active challenge status, PnL, risk metrics, position history
- Trading UI — place orders (market/limit), view open positions, chart (TradingView widget)
- Leaderboard — top traders ranked by PnL / win rate
- API docs — documentation for AI agent developers

**API Routes:**

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | /api/challenge/enter | Pay entry fee, create challenge | Privy |
| GET | /api/challenge/:id | Challenge status + risk metrics | Privy / API key |
| POST | /api/trade/order | Submit order (pre-trade risk checked) | Privy / API key |
| DELETE | /api/trade/order/:id | Cancel pending limit order | Privy / API key |
| POST | /api/trade/positions/:id/close | Close an open position | Privy / API key |
| GET | /api/trade/positions | Current open positions | Privy / API key |
| GET | /api/trade/history | Trade history | Privy / API key |
| GET | /api/leaderboard | Trader rankings | Public |
| POST | /api/agent/register | Register AI agent, get API key | Privy |

**Rate limiting:** All API endpoints are rate-limited per API key / session: 10 requests/second for trade endpoints, 30 requests/second for read endpoints. Prevents agent abuse.

**Auth:**
- Humans: Privy session tokens
- AI Agents: API keys issued at registration, tied to the human owner's account

### 3. Risk Monitoring Service

Standalone Node.js process. Subscribes to Redis Streams and polls Pacifica.

**Risk Rules:**

| Rule | Trigger | Action |
|------|---------|--------|
| Max drawdown | Account equity drops below tier's max drawdown (e.g., 10%) of starting capital | Close all positions, block trader, fail challenge |
| Daily loss limit | Realized + unrealized losses exceed tier's daily loss limit (e.g., 5%) in rolling 24h | Block new trades for the day |
| Position size limit | Single position exceeds 30% of account capital | Reject pre-trade; force-close post-trade |
| Max leverage | Position leverage exceeds tier's max leverage (e.g., 10x/20x) | Reject pre-trade; force-reduce post-trade |

**Architecture:**
- Consumes Redis Stream `trades` for new trade events
- Polls Pacifica API every 1-2 seconds per active trader for position/equity data
- Maintains in-memory risk snapshots per trader for speed
- Persists snapshots to PostgreSQL periodically for crash recovery
- Publishes violations to Redis Stream `risk-events`
- Next.js API subscribes to `risk-events` and pushes to frontend via WebSocket

### 4. AI Agent Integration

Confit is a platform that accepts user-owned AI agents. Users bring their own trained trading agents and register them to compete under the same rules as human traders.

**Agent onboarding flow:**
1. User logs in via Privy
2. Registers their agent — provides a name and description
3. Receives an API key for the agent
4. Pays entry fee on behalf of their agent
5. Agent authenticates with the API key and trades via REST API
6. Same risk rules apply — agent gets cut off on violation

**What the platform provides:**
- REST API with clear documentation
- API key authentication tied to owner account
- Real-time position/PnL endpoints
- WebSocket feed for risk status updates

The platform is agent-framework agnostic — any bot (custom Python, LangChain, etc.) can integrate via the REST API.

---

## Data Model (PostgreSQL)

### Tables

**users**
- id (UUID, PK)
- privy_id (string, unique)
- wallet_address (string)
- created_at (timestamp)

**challenges**
- id (UUID, PK)
- user_id (FK → users)
- tier (enum: starter, pro)
- entry_fee (decimal)
- status (enum: active, passed, failed)
- pacifica_subaccount_id (string)
- starting_capital (decimal)
- current_equity (decimal)
- realized_pnl (decimal, default 0)
- profit_target_pct (decimal, default 0.08)
- profit_split_pct (decimal, default 0.80)
- expires_at (timestamp)
- created_at (timestamp)
- ended_at (timestamp, nullable)

**agents**
- id (UUID, PK)
- user_id (FK → users)
- name (string)
- api_key_hash (string)
- status (enum: active, revoked)
- created_at (timestamp)

**orders**
- id (UUID, PK)
- challenge_id (FK → challenges)
- agent_id (FK → agents, nullable — null if human trader)
- side (enum: long, short)
- pair (string)
- size (decimal)
- leverage (decimal)
- order_type (enum: market, limit)
- limit_price (decimal, nullable — required for limit orders)
- status (enum: pending, filled, rejected, cancelled)
- pacifica_order_id (string, nullable)
- created_at (timestamp)

**positions**
- id (UUID, PK)
- challenge_id (FK → challenges)
- pair (string)
- side (enum: long, short)
- size (decimal)
- entry_price (decimal)
- current_price (decimal)
- unrealized_pnl (decimal)
- status (enum: open, closed)
- opened_at (timestamp)
- closed_at (timestamp, nullable)

**risk_snapshots**
- id (UUID, PK)
- challenge_id (FK → challenges)
- equity (decimal)
- drawdown_pct (decimal)
- daily_loss_pct (decimal)
- timestamp (timestamp)

### Challenge Tiers (Configuration)

| Tier | Entry Fee | Funded Capital | Max Drawdown | Daily Loss Limit | Max Leverage |
|------|-----------|---------------|-------------|-----------------|-------------|
| Starter | $50 USDC | $5,000 | 10% | 5% | 10x |
| Pro | $100 USDC | $10,000 | 10% | 5% | 20x |

---

## Redis Streams

**`trades`** — Published by API on every order submission
```json
{
  "challenge_id": "uuid",
  "order_id": "uuid",
  "pair": "SOL-PERP",
  "side": "long",
  "size": 100,
  "leverage": 5,
  "timestamp": "iso8601"
}
```

**`risk-events`** — Published by Risk Service on violations
```json
{
  "challenge_id": "uuid",
  "event_type": "drawdown_breach | daily_loss_breach | position_size_breach | leverage_breach",
  "details": { "current_value": 0.12, "limit": 0.10 },
  "action": "positions_closed | trades_blocked | challenge_failed",
  "timestamp": "iso8601"
}
```

---

## Real-Time Updates (WebSocket)

Next.js API routes are serverless-friendly but not ideal for persistent WebSocket connections. For MVP, use **Server-Sent Events (SSE)** via a Next.js API route for the frontend dashboard. SSE is simpler than WebSocket, works with Next.js out of the box, and is sufficient for one-way server-to-client pushes (risk alerts, position updates, PnL changes).

The Risk Monitoring Service publishes to Redis Stream `risk-events`. The Next.js SSE endpoint subscribes to this stream and pushes events to connected clients.

For AI agents, they poll the REST API for position/risk status. SSE is optional for agents.

---

## Assumptions to Validate

- **Pacifica subaccount isolation:** The security model assumes Pacifica supports subaccounts under a master wallet where each subaccount's margin is isolated. If subaccounts share margin, a single trader could affect others' capital. Validate this before implementation — if not supported, the fallback is separate wallets per challenge with the backend holding all keys.

---

## Out of Scope (MVP)

- Elfa AI integration (post-MVP data source for agents)
- Rhino.fi / Fuul integration
- Multiple simultaneous challenges per user
- Profit withdrawal flow (manual for MVP)
- Mobile-responsive design (desktop-first)
- Advanced charting / order types (stop-loss, take-profit orders from users)
