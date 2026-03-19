import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PACIFICA_API = "https://test-api.pacifica.fi/api/v1";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get active challenge to find the wallet public key
  const challenge = await prisma.challenge.findFirst({
    where: { userId: auth.userId, status: "ACTIVE" },
  });

  if (!challenge || !challenge.walletPublicKey) {
    return NextResponse.json({ account: null, positions: [] });
  }

  const walletPubkey = challenge.walletPublicKey;

  try {
    // Fetch account info and positions from Pacifica in parallel
    const [accountRes, positionsRes] = await Promise.all([
      fetch(`${PACIFICA_API}/account?account=${walletPubkey}`),
      fetch(`${PACIFICA_API}/positions?account=${walletPubkey}`),
    ]);

    const accountJson = await accountRes.json();
    const positionsJson = await positionsRes.json();

    const account = accountJson.success
      ? {
          balance: accountJson.data.balance,
          accountEquity: accountJson.data.account_equity,
          availableToSpend: accountJson.data.available_to_spend,
          availableToWithdraw: accountJson.data.available_to_withdraw,
          totalMarginUsed: accountJson.data.total_margin_used,
          positionsCount: accountJson.data.positions_count,
          ordersCount: accountJson.data.orders_count,
          makerFee: accountJson.data.maker_fee,
          takerFee: accountJson.data.taker_fee,
          pendingBalance: accountJson.data.pending_balance,
        }
      : null;

    const positions = positionsJson.success
      ? positionsJson.data.map((p: any) => ({
          symbol: p.symbol,
          pair: `${p.symbol}-PERP`,
          side: p.side === "bid" ? "LONG" : "SHORT",
          amount: p.amount,
          entryPrice: p.entry_price,
          margin: p.margin,
          funding: p.funding,
          liquidationPrice: p.liquidation_price,
          isolated: p.isolated,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }))
      : [];

    return NextResponse.json({ account, positions });
  } catch (err) {
    console.error("Failed to fetch Pacifica account:", err);
    return NextResponse.json(
      { error: "Failed to fetch account data" },
      { status: 500 }
    );
  }
}
