# Confit.xyz MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a prop firm trading platform on Pacifica Perp Dex (Solana) where humans and AI agents pay entry fees for funded trading accounts, trade under risk rules, and split profits on success.

**Architecture:** Next.js monolith (frontend + API) communicates with a standalone Risk Monitoring Service via Redis Streams. PostgreSQL for persistence. Solana/Anchor program for entry fee escrow and payouts. Pacifica Perp DEX for trade execution via a platform-controlled master wallet.

**Tech Stack:** Next.js 14 (TypeScript), Prisma (PostgreSQL ORM), Redis (ioredis), Anchor (Rust), Privy (auth), TailwindCSS + shadcn/ui (frontend)

**Spec:** `docs/superpowers/specs/2026-03-18-confit-mvp-design.md`

---

## File Structure

```
confit.xyz/
├── apps/
│   ├── web/                          # Next.js app (frontend + API)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx                    # Landing page
│   │   │   │   ├── layout.tsx                  # Root layout + Privy provider
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx                # Dashboard
│   │   │   │   ├── trade/
│   │   │   │   │   └── page.tsx                # Trading UI
│   │   │   │   ├── leaderboard/
│   │   │   │   │   └── page.tsx                # Leaderboard
│   │   │   │   ├── docs/
│   │   │   │   │   └── page.tsx                # API docs for agents
│   │   │   │   └── api/
│   │   │   │       ├── challenge/
│   │   │   │       │   ├── enter/route.ts      # POST enter challenge
│   │   │   │       │   ├── [id]/route.ts       # GET challenge status
│   │   │   │       │   └── [id]/withdraw/route.ts  # POST withdraw from challenge
│   │   │   │       ├── trade/
│   │   │   │       │   ├── order/
│   │   │   │       │   │   ├── route.ts        # POST submit order
│   │   │   │       │   │   └── [id]/route.ts   # DELETE cancel order
│   │   │   │       │   ├── positions/
│   │   │   │       │   │   ├── route.ts        # GET positions
│   │   │   │       │   │   └── [id]/
│   │   │   │       │   │       └── close/route.ts  # POST close position
│   │   │   │       │   └── history/route.ts    # GET trade history
│   │   │   │       ├── agent/
│   │   │   │       │   └── register/route.ts   # POST register agent
│   │   │   │       ├── leaderboard/route.ts    # GET leaderboard
│   │   │   │       └── events/route.ts         # GET SSE endpoint
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts                     # Privy + API key auth helpers
│   │   │   │   ├── db.ts                       # Prisma client singleton
│   │   │   │   ├── redis.ts                    # Redis client + stream helpers
│   │   │   │   ├── pacifica.ts                 # Pacifica SDK wrapper
│   │   │   │   ├── solana.ts                   # Anchor client for escrow program
│   │   │   │   ├── risk-checks.ts              # Pre-trade risk validation
│   │   │   │   ├── rate-limit.ts               # Rate limiter middleware
│   │   │   │   └── tiers.ts                    # Challenge tier configuration
│   │   │   └── components/
│   │   │       ├── providers.tsx                # Privy + query providers
│   │   │       ├── navbar.tsx                   # Navigation bar
│   │   │       ├── challenge-card.tsx           # Challenge status card
│   │   │       ├── order-form.tsx               # Order placement form
│   │   │       ├── positions-table.tsx          # Open positions table
│   │   │       ├── trade-history.tsx            # Trade history table
│   │   │       ├── risk-metrics.tsx             # Risk metrics display
│   │   │       └── leaderboard-table.tsx        # Leaderboard table
│   │   ├── prisma/
│   │   │   ├── schema.prisma                   # Database schema
│   │   │   └── seed.ts                         # Seed data (optional)
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── risk-service/                 # Standalone risk monitoring service
│       ├── src/
│       │   ├── index.ts                        # Entry point
│       │   ├── monitor.ts                      # Main monitoring loop
│       │   ├── risk-engine.ts                  # Risk rule evaluation
│       │   ├── pacifica-poller.ts              # Pacifica position polling
│       │   ├── redis-consumer.ts               # Redis Stream consumer
│       │   ├── challenge-manager.ts            # End-of-challenge sequence
│       │   └── db.ts                           # Prisma client singleton
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/                       # Shared config across apps
│       ├── src/
│       │   └── tiers.ts                        # Challenge tier configuration
│       ├── package.json
│       └── tsconfig.json
│
├── programs/
│   └── confit-escrow/                # Anchor Solana program
│       ├── src/
│       │   └── lib.rs                          # All program logic
│       ├── Anchor.toml
│       └── Cargo.toml
│
├── tests/
│   ├── confit-escrow.ts              # Anchor integration tests
│   ├── api/                          # API route tests
│   │   ├── challenge.test.ts
│   │   ├── trade.test.ts
│   │   └── agent.test.ts
│   └── risk-service/
│       ├── risk-engine.test.ts
│       └── monitor.test.ts
│
├── packages/shared/                  # Shared tier config
├── package.json                      # Root workspace config
└── docker-compose.yml                # PostgreSQL + Redis for local dev
```

---

## Task 1: Project Scaffolding & Infrastructure

**Files:**
- Create: `package.json` (root workspace)
- Create: `docker-compose.yml`
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/risk-service/package.json`
- Create: `apps/risk-service/tsconfig.json`
- Create: `apps/risk-service/src/index.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize root workspace**

Create `package.json` at the repo root:

```json
{
  "name": "confit-xyz",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run --workspace=apps/web dev",
    "dev:risk": "npm run --workspace=apps/risk-service dev",
    "build": "npm run --workspace=apps/web build",
    "db:push": "npm run --workspace=apps/web db:push",
    "db:generate": "npm run --workspace=apps/web db:generate"
  }
}
```

- [ ] **Step 2: Create docker-compose.yml for local PostgreSQL + Redis**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: confit
      POSTGRES_PASSWORD: confit
      POSTGRES_DB: confit
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  redis:
    image: redis:7
    ports:
      - "6379:6379"
volumes:
  postgres_data:
```

- [ ] **Step 3: Scaffold Next.js app**

```bash
cd apps && npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

- [ ] **Step 4: Install web app dependencies**

```bash
cd apps/web && npm install @privy-io/react-auth @privy-io/server-auth @prisma/client ioredis @solana/web3.js @coral-xyz/anchor uuid
npm install -D prisma @types/uuid
```

- [ ] **Step 5: Install shadcn/ui**

```bash
cd apps/web && npx shadcn@latest init -d
npx shadcn@latest add button card input label select table badge tabs dialog toast
```

- [ ] **Step 6: Scaffold risk-service package**

Create `apps/risk-service/package.json`:

```json
{
  "name": "risk-service",
  "private": true,
  "scripts": {
    "dev": "npx tsx watch src/index.ts",
    "build": "npx tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "ioredis": "^5.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0"
  }
}
```

Create `apps/risk-service/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Create `apps/risk-service/src/index.ts`:

```typescript
import "dotenv/config";

console.log("Risk monitoring service starting...");
// Will be filled in Task 6
```

- [ ] **Step 7: Create .env.example and .gitignore**

`.env.example`:
```
DATABASE_URL=postgresql://confit:confit@localhost:5432/confit
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
SOLANA_RPC_URL=https://api.devnet.solana.com
MASTER_WALLET_PRIVATE_KEY=your-master-wallet-private-key
PACIFICA_API_URL=https://api.pacifica.exchange
```

`.gitignore`:
```
node_modules/
.env
.env.local
dist/
.next/
target/
```

- [ ] **Step 8: Start docker services and verify**

```bash
docker-compose up -d
```

Expected: PostgreSQL on :5432, Redis on :6379

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: scaffold project with Next.js, risk-service, docker-compose"
```

---

## Task 2: Database Schema & Prisma Setup

**Files:**
- Create: `apps/web/prisma/schema.prisma`
- Create: `apps/web/src/lib/db.ts`

- [ ] **Step 1: Write Prisma schema**

Create `apps/web/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ChallengeTier {
  STARTER
  PRO
}

enum ChallengeStatus {
  ACTIVE
  PASSED
  FAILED
}

enum AgentStatus {
  ACTIVE
  REVOKED
}

enum OrderSide {
  LONG
  SHORT
}

enum OrderType {
  MARKET
  LIMIT
}

enum OrderStatus {
  PENDING
  FILLED
  REJECTED
  CANCELLED
}

enum PositionStatus {
  OPEN
  CLOSED
}

model User {
  id            String      @id @default(uuid())
  privyId       String      @unique @map("privy_id")
  walletAddress String?     @map("wallet_address")
  createdAt     DateTime    @default(now()) @map("created_at")
  challenges    Challenge[]
  agents        Agent[]

  @@map("users")
}

model Challenge {
  id                   String          @id @default(uuid())
  userId               String          @map("user_id")
  user                 User            @relation(fields: [userId], references: [id])
  tier                 ChallengeTier
  entryFee             Decimal         @map("entry_fee") @db.Decimal(18, 6)
  status               ChallengeStatus @default(ACTIVE)
  pacificaSubaccountId String?         @map("pacifica_subaccount_id")
  startingCapital      Decimal         @map("starting_capital") @db.Decimal(18, 6)
  currentEquity        Decimal         @map("current_equity") @db.Decimal(18, 6)
  realizedPnl          Decimal         @default(0) @map("realized_pnl") @db.Decimal(18, 6)
  profitTargetPct      Decimal         @default(0.08) @map("profit_target_pct") @db.Decimal(5, 4)
  profitSplitPct       Decimal         @default(0.80) @map("profit_split_pct") @db.Decimal(5, 4)
  expiresAt            DateTime        @map("expires_at")
  createdAt            DateTime        @default(now()) @map("created_at")
  endedAt              DateTime?       @map("ended_at")
  orders               Order[]
  positions            Position[]
  riskSnapshots        RiskSnapshot[]

  @@map("challenges")
}

model Agent {
  id         String      @id @default(uuid())
  userId     String      @map("user_id")
  user       User        @relation(fields: [userId], references: [id])
  name       String
  apiKeyHash String      @map("api_key_hash")
  status     AgentStatus @default(ACTIVE)
  createdAt  DateTime    @default(now()) @map("created_at")
  orders     Order[]

  @@map("agents")
}

model Order {
  id              String      @id @default(uuid())
  challengeId     String      @map("challenge_id")
  challenge       Challenge   @relation(fields: [challengeId], references: [id])
  agentId         String?     @map("agent_id")
  agent           Agent?      @relation(fields: [agentId], references: [id])
  side            OrderSide
  pair            String
  size            Decimal     @db.Decimal(18, 6)
  leverage        Decimal     @db.Decimal(5, 2)
  orderType       OrderType   @map("order_type")
  limitPrice      Decimal?    @map("limit_price") @db.Decimal(18, 6)
  status          OrderStatus @default(PENDING)
  pacificaOrderId String?     @map("pacifica_order_id")
  createdAt       DateTime    @default(now()) @map("created_at")

  @@map("orders")
}

model Position {
  id            String         @id @default(uuid())
  challengeId   String         @map("challenge_id")
  challenge     Challenge      @relation(fields: [challengeId], references: [id])
  pair          String
  side          OrderSide
  size          Decimal        @db.Decimal(18, 6)
  leverage      Decimal        @db.Decimal(5, 2)
  entryPrice    Decimal        @map("entry_price") @db.Decimal(18, 6)
  currentPrice  Decimal        @map("current_price") @db.Decimal(18, 6)
  unrealizedPnl Decimal        @map("unrealized_pnl") @db.Decimal(18, 6)
  status        PositionStatus @default(OPEN)
  openedAt      DateTime       @default(now()) @map("opened_at")
  closedAt      DateTime?      @map("closed_at")

  @@map("positions")
}

model RiskSnapshot {
  id           String    @id @default(uuid())
  challengeId  String    @map("challenge_id")
  challenge    Challenge @relation(fields: [challengeId], references: [id])
  equity       Decimal   @db.Decimal(18, 6)
  drawdownPct  Decimal   @map("drawdown_pct") @db.Decimal(5, 4)
  dailyLossPct Decimal   @map("daily_loss_pct") @db.Decimal(5, 4)
  timestamp    DateTime  @default(now())

  @@map("risk_snapshots")
}
```

- [ ] **Step 2: Create Prisma client singleton**

Create `apps/web/src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Push schema to database**

```bash
cd apps/web && npx prisma db push
```

Expected: Schema synced, tables created in PostgreSQL.

- [ ] **Step 4: Generate Prisma client**

```bash
cd apps/web && npx prisma generate
```

Expected: Prisma Client generated.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Prisma schema with all tables"
```

---

## Task 3: Auth & Shared Libraries

**Files:**
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/redis.ts`
- Create: `packages/shared/src/tiers.ts`
- Create: `packages/shared/package.json`
- Create: `apps/web/src/lib/rate-limit.ts`
- Create: `apps/web/src/components/providers.tsx`

- [ ] **Step 1: Create shared tier configuration package**

Create `packages/shared/package.json`:

```json
{
  "name": "@confit/shared",
  "private": true,
  "main": "src/tiers.ts",
  "types": "src/tiers.ts"
}
```

Create `packages/shared/src/tiers.ts`:

```typescript
import { ChallengeTier } from "@prisma/client";

export interface TierConfig {
  entryFee: number;
  fundedCapital: number;
  maxDrawdownPct: number;
  dailyLossLimitPct: number;
  maxLeverage: number;
  positionSizeLimitPct: number;
  profitTargetPct: number;
  profitSplitPct: number;
  durationDays: number;
}

export const TIERS: Record<ChallengeTier, TierConfig> = {
  STARTER: {
    entryFee: 50,
    fundedCapital: 5000,
    maxDrawdownPct: 0.10,
    dailyLossLimitPct: 0.05,
    maxLeverage: 10,
    positionSizeLimitPct: 0.30,
    profitTargetPct: 0.08,
    profitSplitPct: 0.80,
    durationDays: 30,
  },
  PRO: {
    entryFee: 100,
    fundedCapital: 10000,
    maxDrawdownPct: 0.10,
    dailyLossLimitPct: 0.05,
    maxLeverage: 20,
    positionSizeLimitPct: 0.30,
    profitTargetPct: 0.08,
    profitSplitPct: 0.80,
    durationDays: 30,
  },
};
```

- [ ] **Step 2: Create Redis client + stream helpers**

Create `apps/web/src/lib/redis.ts`:

```typescript
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis = globalForRedis.redis || new Redis(process.env.REDIS_URL!);

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export async function publishTradeEvent(data: {
  challenge_id: string;
  order_id: string;
  pair: string;
  side: string;
  size: number;
  leverage: number;
}) {
  await redis.xadd(
    "trades",
    "*",
    "data",
    JSON.stringify({ ...data, timestamp: new Date().toISOString() })
  );
}

export async function publishRiskEvent(data: {
  challenge_id: string;
  event_type: string;
  details: Record<string, number>;
  action: string;
}) {
  await redis.xadd(
    "risk-events",
    "*",
    "data",
    JSON.stringify({ ...data, timestamp: new Date().toISOString() })
  );
}
```

- [ ] **Step 3: Create auth helpers**

Create `apps/web/src/lib/auth.ts`:

```typescript
import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "./db";
import { createHash } from "crypto";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export type AuthResult =
  | { type: "user"; userId: string }
  | { type: "agent"; userId: string; agentId: string }
  | null;

export async function authenticate(req: Request): Promise<AuthResult> {
  // Check for API key (agent auth)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const hash = createHash("sha256").update(apiKey).digest("hex");
    const agent = await prisma.agent.findFirst({
      where: { apiKeyHash: hash, status: "ACTIVE" },
    });
    if (agent) {
      return { type: "agent", userId: agent.userId, agentId: agent.id };
    }
    return null;
  }

  // Check for Privy token (human auth)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    const claims = await privy.verifyAuthToken(token);
    // Upsert user on first login
    const user = await prisma.user.upsert({
      where: { privyId: claims.userId },
      update: {},
      create: {
        privyId: claims.userId,
        walletAddress: null,
      },
    });
    return { type: "user", userId: user.id };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create rate limiter**

Create `apps/web/src/lib/rate-limit.ts`:

```typescript
const tokenBuckets = new Map<string, { tokens: number; lastRefill: number }>();

export function rateLimit(
  key: string,
  maxPerSecond: number
): { allowed: boolean } {
  const now = Date.now();
  let bucket = tokenBuckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxPerSecond, lastRefill: now };
    tokenBuckets.set(key, bucket);
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxPerSecond, bucket.tokens + elapsed * maxPerSecond);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return { allowed: false };
  }

  bucket.tokens -= 1;
  return { allowed: true };
}
```

- [ ] **Step 5: Create Privy provider component**

Create `apps/web/src/components/providers.tsx`:

```tsx
"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "wallet", "google"],
        appearance: {
          theme: "dark",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        supportedChains: [
          {
            id: 101, // Solana mainnet
            name: "Solana",
            network: "mainnet-beta",
            nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
            rpcUrls: {
              default: { http: ["https://api.mainnet-beta.solana.com"] },
            },
          } as any,
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

- [ ] **Step 6: Update root layout**

Update `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Confit.xyz — Prop Firm on Pacifica",
  description:
    "Trade perpetual futures with funded accounts. Humans and AI agents welcome.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add auth, redis, tier config, rate limiter, Privy provider"
```

---

## Task 4: Solana Escrow Program (Anchor)

**Files:**
- Create: `programs/confit-escrow/src/lib.rs`
- Create: `programs/confit-escrow/Anchor.toml`
- Create: `programs/confit-escrow/Cargo.toml`
- Create: `tests/confit-escrow.ts`

- [ ] **Step 1: Initialize Anchor project**

```bash
cd /Users/valentinofish/Github/Confit.xyz && anchor init confit-escrow --no-git
```

Move the generated `programs/confit-escrow` into our repo structure if needed. Update `Anchor.toml` to reference the correct paths.

- [ ] **Step 2: Write the escrow program**

Replace `programs/confit-escrow/src/lib.rs`:

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("CONFIT111111111111111111111111111111111111111");

#[program]
pub mod confit_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.admin = ctx.accounts.admin.key();
        state.vault_bump = ctx.bumps.vault;
        state.trading_capital_bump = ctx.bumps.trading_capital;
        state.challenge_count = 0;
        Ok(())
    }

    pub fn enter_challenge(
        ctx: Context<EnterChallenge>,
        entry_fee: u64,
        tier: u8,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.challenge_count += 1;

        let challenge = &mut ctx.accounts.challenge;
        challenge.trader = ctx.accounts.trader.key();
        challenge.entry_fee = entry_fee;
        challenge.tier = tier;
        challenge.status = ChallengeStatus::Active;
        challenge.profit_target_pct = 800; // 8.00% in basis points
        challenge.profit_split_pct = 8000; // 80.00% in basis points
        challenge.created_at = Clock::get()?.unix_timestamp;
        challenge.expires_at = challenge.created_at + (30 * 24 * 60 * 60); // 30 days
        challenge.nonce = state.challenge_count;

        // Transfer entry fee from trader to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trader_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            entry_fee,
        )?;

        Ok(())
    }

    pub fn fail_challenge(ctx: Context<AdminAction>) -> Result<()> {
        let challenge = &mut ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Active,
            ErrorCode::ChallengeNotActive
        );
        challenge.status = ChallengeStatus::Failed;
        Ok(())
    }

    pub fn pass_challenge(ctx: Context<PassChallenge>, total_profit: u64) -> Result<()> {
        let challenge = &mut ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Active,
            ErrorCode::ChallengeNotActive
        );
        challenge.status = ChallengeStatus::Passed;

        // Calculate trader's share: 80% of profit
        let trader_share =
            (total_profit as u128 * challenge.profit_split_pct as u128 / 10000) as u64;

        // Transfer from trading capital PDA to trader
        let state_key = ctx.accounts.state.key();
        let seeds = &[
            b"trading_capital",
            state_key.as_ref(),
            &[ctx.accounts.state.trading_capital_bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trading_capital.to_account_info(),
                    to: ctx.accounts.trader_token_account.to_account_info(),
                    authority: ctx.accounts.trading_capital.to_account_info(),
                },
                signer,
            ),
            trader_share,
        )?;

        Ok(())
    }

    pub fn withdraw_challenge(ctx: Context<WithdrawChallenge>) -> Result<()> {
        let challenge = &mut ctx.accounts.challenge;
        require!(
            challenge.status == ChallengeStatus::Active,
            ErrorCode::ChallengeNotActive
        );
        require!(
            challenge.trader == ctx.accounts.trader.key(),
            ErrorCode::Unauthorized
        );
        challenge.status = ChallengeStatus::Failed;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChallengeStatus {
    Active,
    Passed,
    Failed,
}

#[account]
pub struct ProgramState {
    pub admin: Pubkey,
    pub vault_bump: u8,
    pub trading_capital_bump: u8,
    pub challenge_count: u64,
}

#[account]
pub struct Challenge {
    pub trader: Pubkey,
    pub entry_fee: u64,
    pub tier: u8,
    pub status: ChallengeStatus,
    pub profit_target_pct: u16,
    pub profit_split_pct: u16,
    pub created_at: i64,
    pub expires_at: i64,
    pub nonce: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 1 + 1 + 8)]
    pub state: Account<'info, ProgramState>,
    #[account(
        init,
        payer = admin,
        seeds = [b"vault", state.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = admin,
        seeds = [b"trading_capital", state.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = trading_capital,
    )]
    pub trading_capital: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct EnterChallenge<'info> {
    #[account(
        init,
        payer = trader,
        space = 8 + 32 + 8 + 1 + 1 + 2 + 2 + 8 + 8 + 8,
        seeds = [b"challenge", state.key().as_ref(), &(state.challenge_count + 1).to_le_bytes()],
        bump,
    )]
    pub challenge: Account<'info, Challenge>,
    #[account(mut)]
    pub state: Account<'info, ProgramState>,
    #[account(
        mut,
        seeds = [b"vault", state.key().as_ref()],
        bump = state.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    #[account(has_one = admin)]
    pub state: Account<'info, ProgramState>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct PassChallenge<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    #[account(has_one = admin)]
    pub state: Account<'info, ProgramState>,
    #[account(
        mut,
        seeds = [b"trading_capital", state.key().as_ref()],
        bump = state.trading_capital_bump,
    )]
    pub trading_capital: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawChallenge<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    pub trader: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Challenge is not active")]
    ChallengeNotActive,
    #[msg("Unauthorized")]
    Unauthorized,
}
```

- [ ] **Step 3: Write Anchor integration tests**

Create `tests/confit-escrow.ts`:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("confit-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ConfitEscrow;
  let usdcMint: anchor.web3.PublicKey;
  let state: anchor.web3.Keypair;
  let vault: anchor.web3.PublicKey;
  let tradingCapital: anchor.web3.PublicKey;
  let traderTokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Create mock USDC mint
    usdcMint = await createMint(
      provider.connection,
      (provider.wallet as any).payer,
      provider.wallet.publicKey,
      null,
      6
    );

    state = anchor.web3.Keypair.generate();

    [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), state.publicKey.toBuffer()],
      program.programId
    );

    [tradingCapital] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("trading_capital"), state.publicKey.toBuffer()],
      program.programId
    );

    // Create trader token account and mint USDC
    traderTokenAccount = await createAccount(
      provider.connection,
      (provider.wallet as any).payer,
      usdcMint,
      provider.wallet.publicKey
    );

    await mintTo(
      provider.connection,
      (provider.wallet as any).payer,
      usdcMint,
      traderTokenAccount,
      provider.wallet.publicKey,
      1000_000_000 // 1000 USDC
    );
  });

  it("initializes the program", async () => {
    await program.methods
      .initialize()
      .accounts({
        state: state.publicKey,
        vault,
        tradingCapital,
        usdcMint,
        admin: provider.wallet.publicKey,
      })
      .signers([state])
      .rpc();

    const stateAccount = await program.account.programState.fetch(state.publicKey);
    assert.ok(stateAccount.admin.equals(provider.wallet.publicKey));
  });

  it("enters a challenge", async () => {
    // Nonce will be challenge_count + 1 = 1
    const nonce = new anchor.BN(1);
    const [challenge] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("challenge"),
        state.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .enterChallenge(new anchor.BN(50_000_000), 0) // 50 USDC, tier 0 (STARTER)
      .accounts({
        challenge,
        state: state.publicKey,
        vault,
        traderTokenAccount,
        trader: provider.wallet.publicKey,
      })
      .rpc();

    const challengeAccount = await program.account.challenge.fetch(challenge);
    assert.equal(challengeAccount.entryFee.toNumber(), 50_000_000);
    assert.deepEqual(challengeAccount.status, { active: {} });
  });
});
```

- [ ] **Step 4: Build and test**

```bash
anchor build && anchor test
```

Expected: Program compiles, tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Solana escrow program with enter/pass/fail/withdraw"
```

---

## Task 5: Pacifica SDK Wrapper & Solana Client

**Files:**
- Create: `apps/web/src/lib/pacifica.ts`
- Create: `apps/web/src/lib/solana.ts`

- [ ] **Step 1: Create Pacifica SDK wrapper**

Create `apps/web/src/lib/pacifica.ts`:

```typescript
import { Keypair, Connection, PublicKey } from "@solana/web3.js";

// NOTE: Replace with actual Pacifica SDK imports once available.
// This wrapper abstracts the DEX interaction so the rest of the app
// doesn't depend on Pacifica's exact API shape.

const connection = new Connection(process.env.SOLANA_RPC_URL!);

function getMasterWallet(): Keypair {
  const secretKey = Uint8Array.from(
    JSON.parse(process.env.MASTER_WALLET_PRIVATE_KEY!)
  );
  return Keypair.fromSecretKey(secretKey);
}

export interface SubaccountInfo {
  id: string;
  equity: number;
  positions: PacificaPosition[];
}

export interface PacificaPosition {
  pair: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  leverage: number;
}

export interface OrderParams {
  subaccountId: string;
  pair: string;
  side: "long" | "short";
  size: number;
  leverage: number;
  orderType: "market" | "limit";
  limitPrice?: number;
}

export interface OrderResult {
  orderId: string;
  status: "filled" | "pending";
  fillPrice?: number;
}

export async function createSubaccount(label: string): Promise<string> {
  // TODO: Integrate with Pacifica SDK to create a subaccount
  // under the master wallet. Return subaccount ID.
  throw new Error("Pacifica integration not yet implemented");
}

export async function fundSubaccount(
  subaccountId: string,
  amount: number
): Promise<void> {
  // TODO: Transfer USDC from master wallet to subaccount
  throw new Error("Pacifica integration not yet implemented");
}

export async function placeOrder(params: OrderParams): Promise<OrderResult> {
  // TODO: Place order on Pacifica using master wallet as signer
  // for the given subaccount
  throw new Error("Pacifica integration not yet implemented");
}

export async function cancelOrder(
  subaccountId: string,
  orderId: string
): Promise<void> {
  // TODO: Cancel pending order on Pacifica
  throw new Error("Pacifica integration not yet implemented");
}

export async function closePosition(
  subaccountId: string,
  pair: string
): Promise<void> {
  // TODO: Close position by placing an opposite market order
  throw new Error("Pacifica integration not yet implemented");
}

export async function closeAllPositions(
  subaccountId: string
): Promise<void> {
  // TODO: Close all open positions for a subaccount
  throw new Error("Pacifica integration not yet implemented");
}

export async function getSubaccountInfo(
  subaccountId: string
): Promise<SubaccountInfo> {
  // TODO: Fetch current equity and positions from Pacifica
  throw new Error("Pacifica integration not yet implemented");
}

export async function deallocateSubaccount(
  subaccountId: string
): Promise<void> {
  // TODO: Withdraw remaining funds from subaccount back to master wallet
  throw new Error("Pacifica integration not yet implemented");
}
```

- [ ] **Step 2: Create Solana/Anchor client**

Create `apps/web/src/lib/solana.ts`:

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

// Load IDL at build time after `anchor build`
// import idl from "../../../target/idl/confit_escrow.json";

const connection = new Connection(process.env.SOLANA_RPC_URL!);

function getAdminKeypair(): Keypair {
  const secretKey = Uint8Array.from(
    JSON.parse(process.env.MASTER_WALLET_PRIVATE_KEY!)
  );
  return Keypair.fromSecretKey(secretKey);
}

function getProgram() {
  const admin = getAdminKeypair();
  const wallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, wallet, {});
  // TODO: Load actual IDL after anchor build
  // return new Program(idl as any, provider);
  throw new Error("Anchor IDL not yet loaded — run anchor build first");
}

export async function callFailChallenge(
  challengePda: string,
  statePda: string
): Promise<string> {
  const program = getProgram();
  const tx = await program.methods
    .failChallenge()
    .accounts({
      challenge: new PublicKey(challengePda),
      state: new PublicKey(statePda),
      admin: getAdminKeypair().publicKey,
    })
    .rpc();
  return tx;
}

export async function callPassChallenge(
  challengePda: string,
  statePda: string,
  tradingCapitalPda: string,
  traderTokenAccount: string,
  totalProfit: number
): Promise<string> {
  const program = getProgram();
  const { BN } = await import("@coral-xyz/anchor");
  const tx = await program.methods
    .passChallenge(new BN(totalProfit))
    .accounts({
      challenge: new PublicKey(challengePda),
      state: new PublicKey(statePda),
      tradingCapital: new PublicKey(tradingCapitalPda),
      traderTokenAccount: new PublicKey(traderTokenAccount),
      admin: getAdminKeypair().publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return tx;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Pacifica SDK wrapper and Solana Anchor client"
```

---

## Task 6: Core API Routes — Challenge & Agent

**Files:**
- Create: `apps/web/src/app/api/challenge/enter/route.ts`
- Create: `apps/web/src/app/api/challenge/[id]/route.ts`
- Create: `apps/web/src/app/api/agent/register/route.ts`

- [ ] **Step 1: Create challenge enter endpoint**

Create `apps/web/src/app/api/challenge/enter/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIERS } from "@confit/shared/src/tiers";
import { createSubaccount, fundSubaccount } from "@/lib/pacifica";
import { ChallengeTier } from "@prisma/client";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const tier = body.tier as string;

  if (!tier || !["STARTER", "PRO"].includes(tier.toUpperCase())) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const tierKey = tier.toUpperCase() as ChallengeTier;
  const tierConfig = TIERS[tierKey];

  // Check for existing active challenge
  const existing = await prisma.challenge.findFirst({
    where: { userId: auth.userId, status: "ACTIVE" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active challenge" },
      { status: 409 }
    );
  }

  // TODO: Verify on-chain that entry fee was paid (check Solana tx)
  // For MVP, accept a transaction signature and verify it
  const txSignature = body.txSignature as string;
  if (!txSignature) {
    return NextResponse.json(
      { error: "Transaction signature required" },
      { status: 400 }
    );
  }

  // Create Pacifica subaccount
  const subaccountId = await createSubaccount(`challenge-${Date.now()}`);
  await fundSubaccount(subaccountId, tierConfig.fundedCapital);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + tierConfig.durationDays);

  const challenge = await prisma.challenge.create({
    data: {
      userId: auth.userId,
      tier: tierKey,
      entryFee: tierConfig.entryFee,
      status: "ACTIVE",
      pacificaSubaccountId: subaccountId,
      startingCapital: tierConfig.fundedCapital,
      currentEquity: tierConfig.fundedCapital,
      realizedPnl: 0,
      profitTargetPct: tierConfig.profitTargetPct,
      profitSplitPct: tierConfig.profitSplitPct,
      expiresAt,
    },
  });

  return NextResponse.json({ challenge }, { status: 201 });
}
```

- [ ] **Step 2: Create challenge status endpoint**

Create `apps/web/src/app/api/challenge/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: {
      positions: { where: { status: "OPEN" } },
      riskSnapshots: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });

  if (!challenge || challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ challenge });
}
```

- [ ] **Step 3: Create agent register endpoint**

Create `apps/web/src/app/api/agent/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes, createHash } from "crypto";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth || auth.type !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = body.name as string;

  if (!name || name.length < 1 || name.length > 100) {
    return NextResponse.json({ error: "Name is required (1-100 chars)" }, { status: 400 });
  }

  // Generate API key
  const apiKey = `confit_${randomBytes(32).toString("hex")}`;
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

  const agent = await prisma.agent.create({
    data: {
      userId: auth.userId,
      name,
      apiKeyHash,
    },
  });

  // Return the raw API key only once — it won't be retrievable later
  return NextResponse.json(
    {
      agent: { id: agent.id, name: agent.name },
      apiKey, // Show only on creation
    },
    { status: 201 }
  );
}
```

- [ ] **Step 4: Create challenge withdraw endpoint**

Create `apps/web/src/app/api/challenge/[id]/withdraw/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (challenge.status !== "ACTIVE") {
    return NextResponse.json({ error: "Challenge is not active" }, { status: 400 });
  }

  // TODO: Close all positions on Pacifica, then call Solana withdraw_challenge
  await prisma.challenge.update({
    where: { id },
    data: { status: "FAILED", endedAt: new Date() },
  });

  return NextResponse.json({ message: "Challenge withdrawn", challengeId: id });
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add challenge enter, status, withdraw, and agent register API routes"
```

---

## Task 7: Core API Routes — Trading

**Files:**
- Create: `apps/web/src/lib/risk-checks.ts`
- Create: `apps/web/src/app/api/trade/order/route.ts`
- Create: `apps/web/src/app/api/trade/order/[id]/route.ts`
- Create: `apps/web/src/app/api/trade/positions/route.ts`
- Create: `apps/web/src/app/api/trade/positions/[id]/close/route.ts`
- Create: `apps/web/src/app/api/trade/history/route.ts`
- Create: `apps/web/src/app/api/leaderboard/route.ts`

- [ ] **Step 1: Create pre-trade risk checks**

Create `apps/web/src/lib/risk-checks.ts`:

```typescript
import { prisma } from "./db";
import { TIERS, TierConfig } from "@confit/shared/src/tiers";
import { ChallengeTier } from "@prisma/client";

interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export async function preTradeRiskCheck(
  challengeId: string,
  size: number,
  leverage: number
): Promise<RiskCheckResult> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { positions: { where: { status: "OPEN" } } },
  });

  if (!challenge || challenge.status !== "ACTIVE") {
    return { allowed: false, reason: "Challenge is not active" };
  }

  const tier = TIERS[challenge.tier as ChallengeTier];

  // Check leverage cap
  if (leverage > tier.maxLeverage) {
    return {
      allowed: false,
      reason: `Leverage ${leverage}x exceeds max ${tier.maxLeverage}x`,
    };
  }

  // Check position size limit (30% of capital)
  const positionValue = size * leverage;
  const maxPositionValue =
    Number(challenge.startingCapital) * tier.positionSizeLimitPct;
  if (positionValue > maxPositionValue) {
    return {
      allowed: false,
      reason: `Position value $${positionValue} exceeds limit $${maxPositionValue}`,
    };
  }

  // Check daily loss limit
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const latestSnapshot = await prisma.riskSnapshot.findFirst({
    where: { challengeId, timestamp: { gte: oneDayAgo } },
    orderBy: { timestamp: "desc" },
  });

  if (latestSnapshot && Number(latestSnapshot.dailyLossPct) >= tier.dailyLossLimitPct) {
    return { allowed: false, reason: "Daily loss limit reached" };
  }

  // Check max drawdown (shouldn't trade if close to limit)
  const equity = Number(challenge.currentEquity);
  const startingCapital = Number(challenge.startingCapital);
  const drawdownPct = (startingCapital - equity) / startingCapital;

  if (drawdownPct >= tier.maxDrawdownPct) {
    return { allowed: false, reason: "Max drawdown reached" };
  }

  return { allowed: true };
}
```

- [ ] **Step 2: Create order submission endpoint**

Create `apps/web/src/app/api/trade/order/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { preTradeRiskCheck } from "@/lib/risk-checks";
import { placeOrder } from "@/lib/pacifica";
import { publishTradeEvent } from "@/lib/redis";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 req/s for trade endpoints
  const rateLimitKey = auth.type === "agent" ? `agent:${auth.agentId}` : `user:${auth.userId}`;
  if (!rateLimit(rateLimitKey, 10).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json();
  const { challengeId, pair, side, size, leverage, orderType, limitPrice } = body;

  // Validate required fields
  if (!challengeId || !pair || !side || !size || !leverage || !orderType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["long", "short"].includes(side)) {
    return NextResponse.json({ error: "Side must be 'long' or 'short'" }, { status: 400 });
  }

  if (!["market", "limit"].includes(orderType)) {
    return NextResponse.json({ error: "orderType must be 'market' or 'limit'" }, { status: 400 });
  }

  if (orderType === "limit" && !limitPrice) {
    return NextResponse.json({ error: "limitPrice required for limit orders" }, { status: 400 });
  }

  // Verify challenge belongs to this user
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  // Pre-trade risk check
  const riskCheck = await preTradeRiskCheck(challengeId, size, leverage);
  if (!riskCheck.allowed) {
    const order = await prisma.order.create({
      data: {
        challengeId,
        agentId: auth.type === "agent" ? auth.agentId : null,
        side: side.toUpperCase(),
        pair,
        size,
        leverage,
        orderType: orderType.toUpperCase(),
        limitPrice: limitPrice || null,
        status: "REJECTED",
      },
    });
    return NextResponse.json(
      { error: riskCheck.reason, order },
      { status: 403 }
    );
  }

  // Place order on Pacifica
  const result = await placeOrder({
    subaccountId: challenge.pacificaSubaccountId!,
    pair,
    side,
    size,
    leverage,
    orderType,
    limitPrice,
  });

  const order = await prisma.order.create({
    data: {
      challengeId,
      agentId: auth.type === "agent" ? auth.agentId : null,
      side: side.toUpperCase(),
      pair,
      size,
      leverage,
      orderType: orderType.toUpperCase(),
      limitPrice: limitPrice || null,
      status: result.status === "filled" ? "FILLED" : "PENDING",
      pacificaOrderId: result.orderId,
    },
  });

  // Publish to Redis Stream for risk monitoring
  await publishTradeEvent({
    challenge_id: challengeId,
    order_id: order.id,
    pair,
    side,
    size,
    leverage,
  });

  return NextResponse.json({ order }, { status: 201 });
}
```

- [ ] **Step 3: Create cancel order endpoint**

Create `apps/web/src/app/api/trade/order/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelOrder } from "@/lib/pacifica";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { challenge: true },
  });

  if (!order || order.challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending orders can be cancelled" }, { status: 400 });
  }

  await cancelOrder(order.challenge.pacificaSubaccountId!, order.pacificaOrderId!);

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ order: updated });
}
```

- [ ] **Step 4: Create positions endpoints**

Create `apps/web/src/app/api/trade/positions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = auth.type === "agent" ? `agent:${auth.agentId}` : `user:${auth.userId}`;
  if (!rateLimit(rateLimitKey, 30).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const challengeId = req.nextUrl.searchParams.get("challengeId");

  const challenge = await prisma.challenge.findFirst({
    where: {
      userId: auth.userId,
      ...(challengeId ? { id: challengeId } : { status: "ACTIVE" }),
    },
  });

  if (!challenge) {
    return NextResponse.json({ positions: [] });
  }

  const positions = await prisma.position.findMany({
    where: { challengeId: challenge.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json({ positions });
}
```

Create `apps/web/src/app/api/trade/positions/[id]/close/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { closePosition } from "@/lib/pacifica";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const position = await prisma.position.findUnique({
    where: { id },
    include: { challenge: true },
  });

  if (!position || position.challenge.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (position.status !== "OPEN") {
    return NextResponse.json({ error: "Position already closed" }, { status: 400 });
  }

  await closePosition(position.challenge.pacificaSubaccountId!, position.pair);

  const updated = await prisma.position.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  return NextResponse.json({ position: updated });
}
```

- [ ] **Step 5: Create trade history endpoint**

Create `apps/web/src/app/api/trade/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = auth.type === "agent" ? `agent:${auth.agentId}` : `user:${auth.userId}`;
  if (!rateLimit(rateLimitKey, 30).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const challengeId = req.nextUrl.searchParams.get("challengeId");

  const challenge = await prisma.challenge.findFirst({
    where: {
      userId: auth.userId,
      ...(challengeId ? { id: challengeId } : { status: "ACTIVE" }),
    },
  });

  if (!challenge) {
    return NextResponse.json({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: { challengeId: challenge.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders });
}
```

- [ ] **Step 6: Create leaderboard endpoint**

Create `apps/web/src/app/api/leaderboard/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Public endpoint — no auth required
  const challenges = await prisma.challenge.findMany({
    where: { status: { in: ["ACTIVE", "PASSED"] } },
    include: {
      user: { select: { id: true, walletAddress: true } },
    },
    orderBy: { realizedPnl: "desc" },
    take: 50,
  });

  const leaderboard = challenges.map((c, i) => ({
    rank: i + 1,
    walletAddress: c.user.walletAddress
      ? `${c.user.walletAddress.slice(0, 4)}...${c.user.walletAddress.slice(-4)}`
      : "Anonymous",
    tier: c.tier,
    pnl: Number(c.realizedPnl),
    equity: Number(c.currentEquity),
    startingCapital: Number(c.startingCapital),
    returnPct:
      ((Number(c.currentEquity) - Number(c.startingCapital)) /
        Number(c.startingCapital)) *
      100,
    status: c.status,
  }));

  return NextResponse.json({ leaderboard });
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add trading, positions, history, and leaderboard API routes"
```

---

## Task 8: SSE Events Endpoint

**Files:**
- Create: `apps/web/src/app/api/events/route.ts`

- [ ] **Step 1: Create SSE endpoint**

Create `apps/web/src/app/api/events/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Redis from "ioredis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Pre-fetch user's challenge IDs for filtering
  const userChallenges = await prisma.challenge.findMany({
    where: { userId: auth.userId, status: "ACTIVE" },
    select: { id: true },
  });
  const userChallengeIds = new Set(userChallenges.map((c) => c.id));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const redis = new Redis(process.env.REDIS_URL!);
      let lastId = "$"; // Only new messages
      let aborted = false;

      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      sendEvent("connected", { userId: auth.userId });

      req.signal.addEventListener("abort", () => {
        aborted = true;
        redis.disconnect();
      });

      // Use while loop instead of recursive calls to avoid stack growth
      while (!aborted) {
        try {
          const results = await redis.xread(
            "BLOCK",
            5000,
            "COUNT",
            10,
            "STREAMS",
            "risk-events",
            lastId
          );

          if (results) {
            for (const [, messages] of results) {
              for (const [id, fields] of messages) {
                lastId = id;
                const data = JSON.parse(fields[1]);
                // Only send events for THIS user's challenges
                if (data.challenge_id && userChallengeIds.has(data.challenge_id)) {
                  sendEvent("risk-event", data);
                }
              }
            }
          }
        } catch {
          break; // Connection closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add SSE events endpoint for real-time risk updates"
```

---

## Task 9: Risk Monitoring Service

**Files:**
- Create: `apps/risk-service/src/config.ts`
- Create: `apps/risk-service/src/redis-consumer.ts`
- Create: `apps/risk-service/src/pacifica-poller.ts`
- Create: `apps/risk-service/src/risk-engine.ts`
- Create: `apps/risk-service/src/challenge-manager.ts`
- Create: `apps/risk-service/src/monitor.ts`
- Modify: `apps/risk-service/src/index.ts`

- [ ] **Step 1: Create config**

Create `apps/risk-service/src/config.ts`:

```typescript
// Re-export shared tier config — single source of truth
export { TIERS } from "@confit/shared/src/tiers";

export const POLL_INTERVAL_MS = 1500; // 1.5 seconds per trader
export const SNAPSHOT_PERSIST_INTERVAL_MS = 30_000; // Persist snapshots every 30s
```

Add `@confit/shared` as a dependency in `apps/risk-service/package.json`:
```json
"dependencies": {
  "@confit/shared": "*",
  ...
}
```

Create `apps/risk-service/src/db.ts` (Prisma singleton for risk service):

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

Use this single `prisma` instance in both `monitor.ts` and `challenge-manager.ts` instead of creating separate clients.

- [ ] **Step 2: Create Redis consumer**

Create `apps/risk-service/src/redis-consumer.ts`:

```typescript
import Redis from "ioredis";

export class RedisConsumer {
  private redis: Redis;
  private lastId = "0";

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async consumeTradeEvents(
    handler: (data: {
      challenge_id: string;
      order_id: string;
      pair: string;
      side: string;
      size: number;
      leverage: number;
    }) => Promise<void>
  ) {
    while (true) {
      try {
        const results = await this.redis.xread(
          "BLOCK",
          2000,
          "COUNT",
          50,
          "STREAMS",
          "trades",
          this.lastId
        );

        if (results) {
          for (const [, messages] of results) {
            for (const [id, fields] of messages) {
              this.lastId = id;
              const data = JSON.parse(fields[1]);
              await handler(data);
            }
          }
        }
      } catch (err) {
        console.error("Redis consumer error:", err);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  async publishRiskEvent(data: {
    challenge_id: string;
    event_type: string;
    details: Record<string, number>;
    action: string;
  }) {
    await this.redis.xadd(
      "risk-events",
      "*",
      "data",
      JSON.stringify({ ...data, timestamp: new Date().toISOString() })
    );
  }

  async disconnect() {
    await this.redis.disconnect();
  }
}
```

- [ ] **Step 3: Create risk engine**

Create `apps/risk-service/src/risk-engine.ts`:

```typescript
import { TIERS } from "./config";

export interface TraderSnapshot {
  challengeId: string;
  tier: keyof typeof TIERS;
  startingCapital: number;
  currentEquity: number;
  realizedPnl: number;
  dailyPnlHistory: { timestamp: number; pnl: number }[];
  positions: {
    pair: string;
    side: string;
    size: number;
    leverage: number;
    unrealizedPnl: number;
  }[];
}

export interface RiskViolation {
  challengeId: string;
  eventType: string;
  details: Record<string, number>;
  action: string;
}

export function evaluateRisk(snapshot: TraderSnapshot): RiskViolation | null {
  const tier = TIERS[snapshot.tier];

  // 1. Max drawdown check
  const drawdownPct =
    (snapshot.startingCapital - snapshot.currentEquity) / snapshot.startingCapital;

  if (drawdownPct >= tier.maxDrawdownPct) {
    return {
      challengeId: snapshot.challengeId,
      eventType: "drawdown_breach",
      details: {
        current_value: drawdownPct,
        limit: tier.maxDrawdownPct,
      },
      action: "challenge_failed",
    };
  }

  // 2. Daily loss limit check (rolling 24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentPnl = snapshot.dailyPnlHistory
    .filter((h) => h.timestamp >= oneDayAgo)
    .reduce((sum, h) => sum + h.pnl, 0);

  const totalUnrealized = snapshot.positions.reduce(
    (sum, p) => sum + p.unrealizedPnl,
    0
  );

  const dailyLossPct =
    Math.abs(Math.min(0, recentPnl + totalUnrealized)) / snapshot.startingCapital;

  if (dailyLossPct >= tier.dailyLossLimitPct) {
    return {
      challengeId: snapshot.challengeId,
      eventType: "daily_loss_breach",
      details: {
        current_value: dailyLossPct,
        limit: tier.dailyLossLimitPct,
      },
      action: "trades_blocked",
    };
  }

  // 3. Position size limit check (post-trade enforcement)
  for (const pos of snapshot.positions) {
    const positionValue = pos.size * pos.leverage;
    const maxValue = snapshot.startingCapital * tier.positionSizeLimitPct;
    if (positionValue > maxValue) {
      return {
        challengeId: snapshot.challengeId,
        eventType: "position_size_breach",
        details: {
          current_value: positionValue,
          limit: maxValue,
        },
        action: "positions_closed",
      };
    }
  }

  // 4. Leverage check (post-trade enforcement)
  for (const pos of snapshot.positions) {
    if (pos.leverage > tier.maxLeverage) {
      return {
        challengeId: snapshot.challengeId,
        eventType: "leverage_breach",
        details: {
          current_value: pos.leverage,
          limit: tier.maxLeverage,
        },
        action: "positions_closed",
      };
    }
  }

  // 5. Profit target check (challenge pass!)
  const profitPct =
    (snapshot.currentEquity - snapshot.startingCapital) / snapshot.startingCapital;

  if (profitPct >= tier.profitTargetPct) {
    return {
      challengeId: snapshot.challengeId,
      eventType: "profit_target_reached",
      details: {
        current_value: profitPct,
        target: tier.profitTargetPct,
      },
      action: "challenge_passed",
    };
  }

  return null;
}
```

- [ ] **Step 4: Create challenge manager (end-of-challenge sequence)**

Create `apps/risk-service/src/challenge-manager.ts`:

```typescript
import { prisma } from "./db";

export async function handleChallengeFailed(challengeId: string) {
  console.log(`Challenge ${challengeId} FAILED — executing end sequence`);

  // 1. Mark as failed in DB
  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "FAILED", endedAt: new Date() },
  });

  // 2. Close all positions on Pacifica
  // TODO: Import and call closeAllPositions from pacifica wrapper

  // 3. Call Solana program fail_challenge
  // TODO: Import and call callFailChallenge from solana client

  console.log(`Challenge ${challengeId} fail sequence complete`);
}

export async function handleChallengePassed(challengeId: string) {
  console.log(`Challenge ${challengeId} PASSED — executing end sequence`);

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) return;

  // 1. Close all positions on Pacifica
  // TODO: Import and call closeAllPositions from pacifica wrapper

  // 2. Wait for settlement, get final realized PnL
  // TODO: Poll Pacifica until all positions settled

  // 3. Mark as passed in DB
  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "PASSED", endedAt: new Date() },
  });

  // 4. Call Solana program pass_challenge with realized PnL
  // TODO: Import and call callPassChallenge from solana client

  console.log(`Challenge ${challengeId} pass sequence complete`);
}

export async function checkExpiredChallenges() {
  const expired = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: new Date() },
    },
  });

  for (const challenge of expired) {
    console.log(`Challenge ${challenge.id} expired`);
    await handleChallengeFailed(challenge.id);
  }
}
```

- [ ] **Step 5: Create main monitor loop**

Create `apps/risk-service/src/monitor.ts`:

```typescript
import { prisma } from "./db";
import { RedisConsumer } from "./redis-consumer";
import { evaluateRisk, TraderSnapshot } from "./risk-engine";
import {
  handleChallengeFailed,
  handleChallengePassed,
  checkExpiredChallenges,
} from "./challenge-manager";
import { POLL_INTERVAL_MS, SNAPSHOT_PERSIST_INTERVAL_MS } from "./config";

// In-memory snapshots for active traders
const snapshots = new Map<string, TraderSnapshot>();

export async function startMonitor(redisUrl: string) {
  const consumer = new RedisConsumer(redisUrl);

  // Start consuming trade events (runs in background)
  consumer.consumeTradeEvents(async (data) => {
    console.log(`Trade event: ${data.challenge_id} ${data.side} ${data.pair}`);
    // Trade events trigger an immediate risk check for this challenge
    await pollAndEvaluate(data.challenge_id, consumer);
  });

  // Main polling loop — check all active challenges in parallel
  setInterval(async () => {
    try {
      const activeChallenges = await prisma.challenge.findMany({
        where: { status: "ACTIVE" },
      });

      await Promise.all(
        activeChallenges.map((c) => pollAndEvaluate(c.id, consumer))
      );
    } catch (err) {
      console.error("Polling loop error:", err);
    }
  }, POLL_INTERVAL_MS);

  // Persist snapshots to DB periodically
  setInterval(async () => {
    try {
      for (const [challengeId, snapshot] of snapshots) {
        const drawdownPct =
          (snapshot.startingCapital - snapshot.currentEquity) /
          snapshot.startingCapital;

        // Calculate daily loss from PnL history
        const totalUnrealized = snapshot.positions.reduce(
          (sum, p) => sum + p.unrealizedPnl, 0
        );
        const recentPnl = snapshot.dailyPnlHistory.reduce(
          (sum, h) => sum + h.pnl, 0
        );
        const dailyLossPct = Math.abs(
          Math.min(0, recentPnl + totalUnrealized)
        ) / snapshot.startingCapital;

        await prisma.riskSnapshot.create({
          data: {
            challengeId,
            equity: snapshot.currentEquity,
            drawdownPct: Math.max(0, drawdownPct),
            dailyLossPct,
          },
        });

        // Update challenge equity
        await prisma.challenge.update({
          where: { id: challengeId },
          data: { currentEquity: snapshot.currentEquity },
        });
      }
    } catch (err) {
      console.error("Snapshot persist error:", err);
    }
  }, SNAPSHOT_PERSIST_INTERVAL_MS);

  // Check for expired challenges every minute
  setInterval(async () => {
    try {
      await checkExpiredChallenges();
    } catch (err) {
      console.error("Expiry check error:", err);
    }
  }, 60_000);

  console.log("Risk monitoring service started");
}

async function pollAndEvaluate(challengeId: string, consumer: RedisConsumer) {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.status !== "ACTIVE") {
      snapshots.delete(challengeId);
      return;
    }

    // TODO: Fetch real data from Pacifica
    // const info = await getSubaccountInfo(challenge.pacificaSubaccountId!);

    // Build snapshot from DB (replaced by Pacifica data once integrated)
    const positions = await prisma.position.findMany({
      where: { challengeId, status: "OPEN" },
    });

    // Build daily PnL history from risk snapshots (rolling 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSnapshots = await prisma.riskSnapshot.findMany({
      where: { challengeId, timestamp: { gte: oneDayAgo } },
      orderBy: { timestamp: "asc" },
    });

    const dailyPnlHistory = recentSnapshots.map((s) => ({
      timestamp: s.timestamp.getTime(),
      pnl: Number(s.equity) - Number(challenge.startingCapital),
    }));

    const snapshot: TraderSnapshot = {
      challengeId,
      tier: challenge.tier as any,
      startingCapital: Number(challenge.startingCapital),
      currentEquity: Number(challenge.currentEquity),
      realizedPnl: Number(challenge.realizedPnl),
      dailyPnlHistory,
      positions: positions.map((p) => ({
        pair: p.pair,
        side: p.side,
        size: Number(p.size),
        leverage: Number(p.leverage),
        unrealizedPnl: Number(p.unrealizedPnl),
      })),
    };

    snapshots.set(challengeId, snapshot);

    const violation = evaluateRisk(snapshot);
    if (violation) {
      console.log(`VIOLATION: ${violation.eventType} for ${challengeId}`);

      await consumer.publishRiskEvent(violation);

      if (violation.action === "challenge_failed") {
        await handleChallengeFailed(challengeId);
        snapshots.delete(challengeId);
      } else if (violation.action === "challenge_passed") {
        await handleChallengePassed(challengeId);
        snapshots.delete(challengeId);
      }
    }
  } catch (err) {
    console.error(`Error evaluating ${challengeId}:`, err);
  }
}
```

- [ ] **Step 6: Update index.ts entry point**

Update `apps/risk-service/src/index.ts`:

```typescript
import "dotenv/config";
import { startMonitor } from "./monitor";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

startMonitor(redisUrl).catch((err) => {
  console.error("Fatal error starting risk monitor:", err);
  process.exit(1);
});
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add risk monitoring service with real-time evaluation"
```

---

## Task 10: Risk Engine Unit Tests

**Files:**
- Create: `tests/risk-service/risk-engine.test.ts`

- [ ] **Step 1: Write risk engine tests**

Create `tests/risk-service/risk-engine.test.ts`:

```typescript
import { evaluateRisk, TraderSnapshot } from "../../apps/risk-service/src/risk-engine";

function makeSnapshot(overrides: Partial<TraderSnapshot> = {}): TraderSnapshot {
  return {
    challengeId: "test-challenge-1",
    tier: "STARTER",
    startingCapital: 5000,
    currentEquity: 5000,
    realizedPnl: 0,
    dailyPnlHistory: [],
    positions: [],
    ...overrides,
  };
}

describe("Risk Engine", () => {
  test("returns null when no violations", () => {
    const result = evaluateRisk(makeSnapshot());
    expect(result).toBeNull();
  });

  test("detects max drawdown breach", () => {
    const result = evaluateRisk(
      makeSnapshot({ currentEquity: 4400 }) // 12% drawdown > 10% limit
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("drawdown_breach");
    expect(result!.action).toBe("challenge_failed");
  });

  test("does not trigger at drawdown boundary", () => {
    const result = evaluateRisk(
      makeSnapshot({ currentEquity: 4550 }) // 9% drawdown < 10% limit
    );
    expect(result).toBeNull();
  });

  test("detects daily loss breach", () => {
    const result = evaluateRisk(
      makeSnapshot({
        dailyPnlHistory: [
          { timestamp: Date.now() - 1000, pnl: -200 },
        ],
        positions: [
          { pair: "SOL-PERP", side: "long", size: 100, leverage: 5, unrealizedPnl: -100 },
        ],
      })
    );
    // Total daily loss: 200 + 100 = 300, which is 6% of 5000 > 5% limit
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("daily_loss_breach");
    expect(result!.action).toBe("trades_blocked");
  });

  test("detects position size breach", () => {
    const result = evaluateRisk(
      makeSnapshot({
        positions: [
          { pair: "SOL-PERP", side: "long", size: 200, leverage: 10, unrealizedPnl: 0 },
          // positionValue = 200 * 10 = 2000, limit = 5000 * 0.30 = 1500
        ],
      })
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("position_size_breach");
  });

  test("detects leverage breach for STARTER tier", () => {
    const result = evaluateRisk(
      makeSnapshot({
        tier: "STARTER",
        positions: [
          { pair: "SOL-PERP", side: "long", size: 10, leverage: 15, unrealizedPnl: 0 },
          // leverage 15 > STARTER limit 10
        ],
      })
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("leverage_breach");
  });

  test("allows valid leverage for PRO tier", () => {
    const result = evaluateRisk(
      makeSnapshot({
        tier: "PRO",
        startingCapital: 10000,
        currentEquity: 10000,
        positions: [
          { pair: "SOL-PERP", side: "long", size: 10, leverage: 15, unrealizedPnl: 0 },
          // leverage 15 < PRO limit 20, positionValue 150 < 10000*0.30=3000
        ],
      })
    );
    expect(result).toBeNull();
  });

  test("detects profit target reached", () => {
    const result = evaluateRisk(
      makeSnapshot({ currentEquity: 5450 }) // 9% profit > 8% target
    );
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("profit_target_reached");
    expect(result!.action).toBe("challenge_passed");
  });

  test("priority: drawdown checked before daily loss", () => {
    const result = evaluateRisk(
      makeSnapshot({
        currentEquity: 4400, // 12% drawdown
        dailyPnlHistory: [{ timestamp: Date.now(), pnl: -600 }], // Also daily loss breach
      })
    );
    // Drawdown should be caught first since it's checked first
    expect(result!.eventType).toBe("drawdown_breach");
  });
});
```

- [ ] **Step 2: Install test dependencies and configure**

```bash
npm install -D jest ts-jest @types/jest
```

Add to root `package.json` scripts:
```json
"test": "jest --config jest.config.js"
```

Create `jest.config.js`:
```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/apps/web/src/$1",
  },
};
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm test -- tests/risk-service/risk-engine.test.ts
```

Expected: All 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add risk engine unit tests"
```

---

## Task 11: Frontend — Landing Page & Navigation

**Files:**
- Create: `apps/web/src/components/navbar.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Create navbar component**

Create `apps/web/src/components/navbar.tsx`:

```tsx
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
              <Link
                href="/dashboard"
                className="text-sm text-zinc-400 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/trade"
                className="text-sm text-zinc-400 hover:text-white"
              >
                Trade
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm text-zinc-400 hover:text-white"
              >
                Leaderboard
              </Link>
              <Link
                href="/docs"
                className="text-sm text-zinc-400 hover:text-white"
              >
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
```

- [ ] **Step 2: Create landing page**

Update `apps/web/src/app/page.tsx`:

```tsx
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
              Drawdown, daily loss, position size, and leverage limits enforced
              in real-time
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
```

- [ ] **Step 3: Update layout with navbar**

Update `apps/web/src/app/layout.tsx` to include `<Navbar />` inside the Providers wrapper.

- [ ] **Step 4: Verify the app runs**

```bash
cd apps/web && npm run dev
```

Expected: App loads at localhost:3000 with landing page and navbar.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add landing page and navbar with Privy auth"
```

---

## Task 12: Frontend — Dashboard Page

**Files:**
- Create: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/components/challenge-card.tsx`
- Create: `apps/web/src/components/risk-metrics.tsx`

- [ ] **Step 1: Create challenge card component**

Create `apps/web/src/components/challenge-card.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChallengeCardProps {
  challenge: {
    id: string;
    tier: string;
    status: string;
    startingCapital: number;
    currentEquity: number;
    realizedPnl: number;
    profitTargetPct: number;
    expiresAt: string;
    createdAt: string;
  };
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const pnlPct =
    ((challenge.currentEquity - challenge.startingCapital) /
      challenge.startingCapital) *
    100;
  const targetPct = challenge.profitTargetPct * 100;
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(challenge.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  );

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {challenge.tier} Challenge
        </CardTitle>
        <Badge
          variant={
            challenge.status === "ACTIVE"
              ? "default"
              : challenge.status === "PASSED"
                ? "secondary"
                : "destructive"
          }
        >
          {challenge.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-zinc-400">Equity</p>
            <p className="text-xl font-bold text-white">
              ${challenge.currentEquity.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">P&L</p>
            <p
              className={`text-xl font-bold ${pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {pnlPct >= 0 ? "+" : ""}
              {pnlPct.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Target</p>
            <p className="text-sm text-white">+{targetPct}%</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Days Left</p>
            <p className="text-sm text-white">{daysLeft}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create risk metrics component**

Create `apps/web/src/components/risk-metrics.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RiskMetricsProps {
  drawdownPct: number;
  dailyLossPct: number;
  maxDrawdown: number;
  dailyLossLimit: number;
}

export function RiskMetrics({
  drawdownPct,
  dailyLossPct,
  maxDrawdown,
  dailyLossLimit,
}: RiskMetricsProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-lg">Risk Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Drawdown</span>
            <span
              className={
                drawdownPct > maxDrawdown * 0.8 ? "text-red-400" : "text-white"
              }
            >
              {(drawdownPct * 100).toFixed(2)}% / {(maxDrawdown * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${drawdownPct > maxDrawdown * 0.8 ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, (drawdownPct / maxDrawdown) * 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Daily Loss</span>
            <span
              className={
                dailyLossPct > dailyLossLimit * 0.8 ? "text-red-400" : "text-white"
              }
            >
              {(dailyLossPct * 100).toFixed(2)}% / {(dailyLossLimit * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${dailyLossPct > dailyLossLimit * 0.8 ? "bg-red-500" : "bg-amber-500"}`}
              style={{
                width: `${Math.min(100, (dailyLossPct / dailyLossLimit) * 100)}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create dashboard page**

Create `apps/web/src/app/dashboard/page.tsx`:

```tsx
"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChallengeCard } from "@/components/challenge-card";
import { RiskMetrics } from "@/components/risk-metrics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DashboardPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState("STARTER");

  useEffect(() => {
    if (!authenticated) return;
    // TODO: Fetch active challenge from API
    setLoading(false);
  }, [authenticated]);

  const enterChallenge = async () => {
    // TODO: Sign Solana tx for entry fee, then call API
    console.log("Enter challenge:", selectedTier);
  };

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-zinc-400">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {!challenge ? (
        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h2 className="text-xl font-semibold text-white">
            No Active Challenge
          </h2>
          <p className="mt-2 text-zinc-400">
            Select a tier and enter a challenge to start trading.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Select value={selectedTier} onValueChange={setSelectedTier}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STARTER">Starter ($50)</SelectItem>
                <SelectItem value="PRO">Pro ($100)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={enterChallenge}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              Enter Challenge
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChallengeCard challenge={challenge} />
          <RiskMetrics
            drawdownPct={0}
            dailyLossPct={0}
            maxDrawdown={0.10}
            dailyLossLimit={0.05}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add dashboard page with challenge card and risk metrics"
```

---

## Task 13: Frontend — Trading Page

**Files:**
- Create: `apps/web/src/app/trade/page.tsx`
- Create: `apps/web/src/components/order-form.tsx`
- Create: `apps/web/src/components/positions-table.tsx`
- Create: `apps/web/src/components/trade-history.tsx`

- [ ] **Step 1: Create order form component**

Create `apps/web/src/components/order-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OrderFormProps {
  onSubmit: (order: {
    pair: string;
    side: string;
    size: number;
    leverage: number;
    orderType: string;
    limitPrice?: number;
  }) => Promise<void>;
}

export function OrderForm({ onSubmit }: OrderFormProps) {
  const [side, setSide] = useState("long");
  const [orderType, setOrderType] = useState("market");
  const [pair, setPair] = useState("SOL-PERP");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState("5");
  const [limitPrice, setLimitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        pair,
        side,
        size: parseFloat(size),
        leverage: parseFloat(leverage),
        orderType,
        limitPrice: orderType === "limit" ? parseFloat(limitPrice) : undefined,
      });
      setSize("");
      setLimitPrice("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <Tabs value={side} onValueChange={setSide}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger
            value="long"
            className="data-[state=active]:bg-emerald-600"
          >
            Long
          </TabsTrigger>
          <TabsTrigger
            value="short"
            className="data-[state=active]:bg-red-600"
          >
            Short
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        <Label>Pair</Label>
        <Select value={pair} onValueChange={setPair}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SOL-PERP">SOL-PERP</SelectItem>
            <SelectItem value="BTC-PERP">BTC-PERP</SelectItem>
            <SelectItem value="ETH-PERP">ETH-PERP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Order Type</Label>
        <Select value={orderType} onValueChange={setOrderType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="market">Market</SelectItem>
            <SelectItem value="limit">Limit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Size (USD)</Label>
        <Input
          type="number"
          placeholder="100"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Leverage</Label>
        <Input
          type="number"
          placeholder="5"
          value={leverage}
          onChange={(e) => setLeverage(e.target.value)}
        />
      </div>

      {orderType === "limit" && (
        <div className="space-y-2">
          <Label>Limit Price</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
          />
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={submitting || !size}
        className={`w-full ${side === "long" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}
      >
        {submitting ? "Submitting..." : `${side === "long" ? "Buy" : "Sell"} ${pair}`}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create positions table component**

Create `apps/web/src/components/positions-table.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Position {
  id: string;
  pair: string;
  side: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

interface PositionsTableProps {
  positions: Position[];
  onClose: (positionId: string) => Promise<void>;
}

export function PositionsTable({ positions, onClose }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No open positions
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pair</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Entry</TableHead>
          <TableHead>Current</TableHead>
          <TableHead>PnL</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map((pos) => (
          <TableRow key={pos.id}>
            <TableCell className="font-medium">{pos.pair}</TableCell>
            <TableCell>
              <Badge
                variant={pos.side === "LONG" ? "default" : "destructive"}
              >
                {pos.side}
              </Badge>
            </TableCell>
            <TableCell>${pos.size.toLocaleString()}</TableCell>
            <TableCell>${pos.entryPrice.toFixed(2)}</TableCell>
            <TableCell>${pos.currentPrice.toFixed(2)}</TableCell>
            <TableCell
              className={
                pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              ${pos.unrealizedPnl.toFixed(2)}
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onClose(pos.id)}
              >
                Close
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create trade history component**

Create `apps/web/src/components/trade-history.tsx`:

```tsx
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  pair: string;
  side: string;
  size: number;
  leverage: number;
  orderType: string;
  status: string;
  createdAt: string;
}

interface TradeHistoryProps {
  orders: Order[];
}

export function TradeHistory({ orders }: TradeHistoryProps) {
  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">No trades yet</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Pair</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Leverage</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="text-xs text-zinc-400">
              {new Date(order.createdAt).toLocaleString()}
            </TableCell>
            <TableCell className="font-medium">{order.pair}</TableCell>
            <TableCell>
              <Badge
                variant={order.side === "LONG" ? "default" : "destructive"}
              >
                {order.side}
              </Badge>
            </TableCell>
            <TableCell className="text-xs uppercase">{order.orderType}</TableCell>
            <TableCell>${order.size.toLocaleString()}</TableCell>
            <TableCell>{order.leverage}x</TableCell>
            <TableCell>
              <Badge
                variant={
                  order.status === "FILLED"
                    ? "secondary"
                    : order.status === "REJECTED"
                      ? "destructive"
                      : "outline"
                }
              >
                {order.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Create trading page**

Create `apps/web/src/app/trade/page.tsx`:

```tsx
"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderForm } from "@/components/order-form";
import { PositionsTable } from "@/components/positions-table";
import { TradeHistory } from "@/components/trade-history";

export default function TradePage() {
  const { authenticated } = usePrivy();
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const handleOrderSubmit = async (order: any) => {
    // TODO: Call POST /api/trade/order
    console.log("Submit order:", order);
  };

  const handleClosePosition = async (positionId: string) => {
    // TODO: Call POST /api/trade/positions/:id/close
    console.log("Close position:", positionId);
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-zinc-400">Please sign in to trade.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Trade</h1>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Order Form - Left sidebar */}
        <div>
          <OrderForm onSubmit={handleOrderSubmit} />
        </div>

        {/* Chart + Positions - Main area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart placeholder */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="flex h-[400px] items-center justify-center">
              <p className="text-zinc-500">
                TradingView chart will be integrated here
              </p>
            </CardContent>
          </Card>

          {/* Positions & History */}
          <Card className="border-zinc-800 bg-zinc-900">
            <Tabs defaultValue="positions">
              <CardHeader>
                <TabsList>
                  <TabsTrigger value="positions">
                    Open Positions ({positions.length})
                  </TabsTrigger>
                  <TabsTrigger value="history">Trade History</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="positions">
                  <PositionsTable
                    positions={positions}
                    onClose={handleClosePosition}
                  />
                </TabsContent>
                <TabsContent value="history">
                  <TradeHistory orders={orders} />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add trading page with order form, positions, and history"
```

---

## Task 14: Frontend — Leaderboard & API Docs Pages

**Files:**
- Create: `apps/web/src/app/leaderboard/page.tsx`
- Create: `apps/web/src/components/leaderboard-table.tsx`
- Create: `apps/web/src/app/docs/page.tsx`

- [ ] **Step 1: Create leaderboard table component**

Create `apps/web/src/components/leaderboard-table.tsx`:

```tsx
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  tier: string;
  pnl: number;
  returnPct: number;
  status: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Trader</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>PnL</TableHead>
          <TableHead>Return</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.rank}>
            <TableCell className="font-bold">#{entry.rank}</TableCell>
            <TableCell className="font-mono text-sm">
              {entry.walletAddress}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{entry.tier}</Badge>
            </TableCell>
            <TableCell
              className={
                entry.pnl >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              ${entry.pnl.toFixed(2)}
            </TableCell>
            <TableCell
              className={
                entry.returnPct >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {entry.returnPct >= 0 ? "+" : ""}
              {entry.returnPct.toFixed(2)}%
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  entry.status === "ACTIVE" ? "default" : "secondary"
                }
              >
                {entry.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Create leaderboard page**

Create `apps/web/src/app/leaderboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaderboardTable } from "@/components/leaderboard-table";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => setEntries(data.leaderboard || []))
      .catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
      <p className="mt-2 text-zinc-400">
        Top traders ranked by realized PnL
      </p>

      <Card className="mt-8 border-zinc-800 bg-zinc-900">
        <CardContent className="pt-6">
          {entries.length > 0 ? (
            <LeaderboardTable entries={entries} />
          ) : (
            <p className="py-8 text-center text-zinc-500">
              No active challenges yet. Be the first!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create API docs page**

Create `apps/web/src/app/docs/page.tsx`:

```tsx
export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">API Documentation</h1>
      <p className="mt-2 text-zinc-400">
        Integrate your AI trading agent with Confit.xyz
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-white">Authentication</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Register your agent via the dashboard to get an API key. Include it
            in all requests:
          </p>
          <pre className="mt-2 rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
            {`X-Api-Key: confit_your_api_key_here`}
          </pre>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Endpoints</h2>
          <div className="mt-4 space-y-6">
            <EndpointDoc
              method="POST"
              path="/api/trade/order"
              description="Submit a new order"
              body={{
                challengeId: "uuid",
                pair: "SOL-PERP",
                side: "long | short",
                size: 100,
                leverage: 5,
                orderType: "market | limit",
                limitPrice: "required for limit orders",
              }}
            />
            <EndpointDoc
              method="GET"
              path="/api/trade/positions?challengeId=uuid"
              description="Get open positions"
            />
            <EndpointDoc
              method="POST"
              path="/api/trade/positions/:id/close"
              description="Close an open position"
            />
            <EndpointDoc
              method="DELETE"
              path="/api/trade/order/:id"
              description="Cancel a pending limit order"
            />
            <EndpointDoc
              method="GET"
              path="/api/trade/history?challengeId=uuid"
              description="Get order history"
            />
            <EndpointDoc
              method="GET"
              path="/api/challenge/:id"
              description="Get challenge status and risk metrics"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Rate Limits</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Trade endpoints: 10 requests/second. Read endpoints: 30
            requests/second. Per API key.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Risk Rules</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm text-zinc-300">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="pb-2 text-left">Rule</th>
                  <th className="pb-2 text-left">Starter</th>
                  <th className="pb-2 text-left">Pro</th>
                </tr>
              </thead>
              <tbody className="text-zinc-400">
                <tr><td className="py-1">Max Drawdown</td><td>10%</td><td>10%</td></tr>
                <tr><td className="py-1">Daily Loss Limit</td><td>5%</td><td>5%</td></tr>
                <tr><td className="py-1">Max Leverage</td><td>10x</td><td>20x</td></tr>
                <tr><td className="py-1">Position Size</td><td>30%</td><td>30%</td></tr>
                <tr><td className="py-1">Profit Target</td><td>8%</td><td>8%</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function EndpointDoc({
  method,
  path,
  description,
  body,
}: {
  method: string;
  path: string;
  description: string;
  body?: Record<string, any>;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center gap-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${
            method === "GET"
              ? "bg-blue-900 text-blue-300"
              : method === "POST"
                ? "bg-emerald-900 text-emerald-300"
                : "bg-red-900 text-red-300"
          }`}
        >
          {method}
        </span>
        <code className="text-sm text-zinc-300">{path}</code>
      </div>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
      {body && (
        <pre className="mt-2 rounded bg-zinc-950 p-3 text-xs text-zinc-400">
          {JSON.stringify(body, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add leaderboard and API docs pages"
```

---

## Task 15: Integration & End-to-End Wiring

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx` (wire up API calls)
- Modify: `apps/web/src/app/trade/page.tsx` (wire up API calls)
- Modify: `apps/risk-service/src/monitor.ts` (wire up Pacifica polling)
- Modify: `apps/risk-service/src/challenge-manager.ts` (wire up Solana calls)

This task wires together the frontend API calls to the backend, and the risk service to Pacifica + Solana. The exact implementation depends on the Pacifica SDK's actual API shape, which should be validated before this task.

- [ ] **Step 1: Wire dashboard to fetch active challenge**

Add `useEffect` in dashboard page to call `GET /api/challenge/:id` and display real data from the API.

- [ ] **Step 2: Wire trading page to submit orders**

Update `handleOrderSubmit` in trade page to call `POST /api/trade/order` with the Privy access token, and refresh positions list.

- [ ] **Step 3: Wire risk service to Pacifica**

Replace TODO comments in `monitor.ts` with actual `getSubaccountInfo()` calls from the Pacifica wrapper.

- [ ] **Step 4: Wire challenge manager to Solana**

Replace TODO comments in `challenge-manager.ts` with actual `callFailChallenge()` and `callPassChallenge()` calls.

- [ ] **Step 5: Test full flow locally**

```bash
docker-compose up -d
cd apps/web && npm run dev     # Terminal 1
cd apps/risk-service && npm run dev  # Terminal 2
```

Verify: Sign in via Privy → Enter challenge → Place order → See position → Risk monitoring detects state.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: wire frontend to API and risk service to Pacifica/Solana"
```

---

## Task 16: Pacifica Integration (Critical Path)

This task is left intentionally open because it depends on Pacifica's actual SDK/API. This is the highest-risk item and should be tackled early.

- [ ] **Step 1: Validate Pacifica subaccount isolation**

Confirm that Pacifica supports subaccounts with isolated margin. If not, update `pacifica.ts` to use separate wallets per challenge.

- [ ] **Step 2: Implement Pacifica wrapper functions**

Fill in all TODO functions in `apps/web/src/lib/pacifica.ts` with actual SDK calls:
- `createSubaccount`
- `fundSubaccount`
- `placeOrder`
- `cancelOrder`
- `closePosition`
- `closeAllPositions`
- `getSubaccountInfo`
- `deallocateSubaccount`

- [ ] **Step 3: Test with devnet**

Run manual tests against Pacifica devnet to verify order placement, position fetching, and subaccount management.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: implement Pacifica SDK integration"
```

---

## Build Order (Recommended)

To de-risk the timeline, build in this order:

1. **Task 1** — Project scaffolding (day 1)
2. **Task 2** — Database schema (day 1)
3. **Task 16** — Pacifica integration proof-of-concept (days 2-5, highest risk)
4. **Task 4** — Solana escrow program (days 5-8)
5. **Task 3** — Auth & shared libs (day 8-9)
6. **Tasks 5-8** — API routes + SSE (days 9-13)
7. **Task 9-10** — Risk monitoring service + tests (days 13-17)
8. **Tasks 11-14** — Frontend pages (days 17-23)
9. **Task 15** — Integration wiring (days 23-27)
10. **Days 27-30** — Testing, bug fixes, polish
