jest.mock("../../apps/risk-service/src/db", () => ({
  prisma: {
    challenge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../apps/risk-service/src/pacifica-actions", () => ({
  closeAllAndWithdraw: jest.fn(),
}));

import {
  handleChallengeFailed,
  handleChallengePassed,
  checkExpiredChallenges,
} from "../../apps/risk-service/src/challenge-manager";
import { prisma } from "../../apps/risk-service/src/db";
import { closeAllAndWithdraw } from "../../apps/risk-service/src/pacifica-actions";

const mockPrisma = prisma as unknown as {
  challenge: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const mockCloseAllAndWithdraw = closeAllAndWithdraw as jest.Mock;

function makeChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "challenge-1",
    status: "ACTIVE",
    walletSecretKey: "secret-key-abc",
    currentEquity: 4500,
    expiresAt: new Date(Date.now() + 100_000),
    ...overrides,
  };
}

describe("challenge-manager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.challenge.update.mockResolvedValue({});
    mockCloseAllAndWithdraw.mockResolvedValue(undefined);
  });

  // ─── handleChallengeFailed ─────────────────────────────────────────────

  test("handleChallengeFailed updates challenge status to FAILED with endedAt", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(makeChallenge());

    await handleChallengeFailed("challenge-1");

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "challenge-1" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );

    const data = mockPrisma.challenge.update.mock.calls[0][0].data;
    expect(data.endedAt).toBeInstanceOf(Date);
  });

  test("handleChallengeFailed calls closeAllAndWithdraw with correct args", async () => {
    const challenge = makeChallenge({
      walletSecretKey: "my-wallet-secret",
      currentEquity: 4000,
    });
    mockPrisma.challenge.findUnique.mockResolvedValue(challenge);

    await handleChallengeFailed("challenge-1");

    expect(mockCloseAllAndWithdraw).toHaveBeenCalledWith("my-wallet-secret", "4000");
  });

  test("handleChallengeFailed does nothing when challenge not found", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(null);

    await handleChallengeFailed("nonexistent");

    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
    expect(mockCloseAllAndWithdraw).not.toHaveBeenCalled();
  });

  test("handleChallengeFailed skips withdrawal when no walletSecretKey", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(
      makeChallenge({ walletSecretKey: null })
    );

    await handleChallengeFailed("challenge-1");

    expect(mockCloseAllAndWithdraw).not.toHaveBeenCalled();
    // But it should still update the status
    expect(mockPrisma.challenge.update).toHaveBeenCalled();
  });

  // ─── handleChallengePassed ─────────────────────────────────────────────

  test("handleChallengePassed updates challenge status to PASSED with endedAt", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(makeChallenge());

    await handleChallengePassed("challenge-1");

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "challenge-1" },
        data: expect.objectContaining({ status: "PASSED" }),
      })
    );

    const data = mockPrisma.challenge.update.mock.calls[0][0].data;
    expect(data.endedAt).toBeInstanceOf(Date);
  });

  test("handleChallengePassed calls closeAllAndWithdraw with correct args", async () => {
    const challenge = makeChallenge({
      walletSecretKey: "pass-wallet-secret",
      currentEquity: 5500,
    });
    mockPrisma.challenge.findUnique.mockResolvedValue(challenge);

    await handleChallengePassed("challenge-1");

    expect(mockCloseAllAndWithdraw).toHaveBeenCalledWith("pass-wallet-secret", "5500");
  });

  test("handleChallengePassed does nothing when challenge not found", async () => {
    mockPrisma.challenge.findUnique.mockResolvedValue(null);

    await handleChallengePassed("nonexistent");

    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
    expect(mockCloseAllAndWithdraw).not.toHaveBeenCalled();
  });

  // ─── checkExpiredChallenges ────────────────────────────────────────────

  test("checkExpiredChallenges finds and fails expired challenges", async () => {
    const expiredChallenge = makeChallenge({
      id: "expired-1",
      expiresAt: new Date(Date.now() - 1000),
    });
    mockPrisma.challenge.findMany.mockResolvedValue([expiredChallenge]);
    // findUnique is called inside handleChallengeFailed
    mockPrisma.challenge.findUnique.mockResolvedValue(expiredChallenge);

    await checkExpiredChallenges();

    expect(mockPrisma.challenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
        }),
      })
    );

    expect(mockPrisma.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "expired-1" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  test("checkExpiredChallenges does nothing when no challenges are expired", async () => {
    mockPrisma.challenge.findMany.mockResolvedValue([]);

    await checkExpiredChallenges();

    expect(mockPrisma.challenge.update).not.toHaveBeenCalled();
    expect(mockCloseAllAndWithdraw).not.toHaveBeenCalled();
  });
});
