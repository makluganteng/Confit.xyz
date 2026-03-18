// Must mock modules before any imports
jest.mock("../../apps/web/src/lib/db", () => ({
  prisma: {
    agent: {
      findFirst: jest.fn(),
    },
    user: {
      upsert: jest.fn(),
    },
  },
}));

// Mock @privy-io/server-auth — the instance methods are set per-test via the mock
jest.mock("@privy-io/server-auth", () => {
  const verifyAuthToken = jest.fn();
  const getUser = jest.fn();
  const instance = { verifyAuthToken, getUser };
  const PrivyClient = jest.fn(() => instance);
  // Attach instance to constructor for test access
  (PrivyClient as any).__instance = instance;
  return { PrivyClient };
});

import { authenticate } from "../../apps/web/src/lib/auth";
import { prisma } from "../../apps/web/src/lib/db";
import { PrivyClient } from "@privy-io/server-auth";

const mockPrisma = prisma as unknown as {
  agent: { findFirst: jest.Mock };
  user: { upsert: jest.Mock };
};

// Access the shared privy mock instance
const privyMockInstance = (PrivyClient as any).__instance as {
  verifyAuthToken: jest.Mock;
  getUser: jest.Mock;
};

function makeRequest(headers: Record<string, string>): Request {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

describe("authenticate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns null when no auth header and no API key", async () => {
    const req = makeRequest({});
    const result = await authenticate(req);
    expect(result).toBeNull();
  });

  test("returns null when invalid API key provided", async () => {
    mockPrisma.agent.findFirst.mockResolvedValue(null);

    const req = makeRequest({ "x-api-key": "invalid-key" });
    const result = await authenticate(req);

    expect(result).toBeNull();
    expect(mockPrisma.agent.findFirst).toHaveBeenCalledTimes(1);
  });

  test("returns agent auth result when valid API key provided", async () => {
    mockPrisma.agent.findFirst.mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      status: "ACTIVE",
    });

    const req = makeRequest({ "x-api-key": "valid-api-key" });
    const result = await authenticate(req);

    expect(result).toEqual({
      type: "agent",
      userId: "user-1",
      agentId: "agent-1",
    });
  });

  test("agent.findFirst is called with hashed API key (sha256 hex)", async () => {
    mockPrisma.agent.findFirst.mockResolvedValue(null);

    const req = makeRequest({ "x-api-key": "test-key" });
    await authenticate(req);

    const call = mockPrisma.agent.findFirst.mock.calls[0][0];
    // Should contain a hash (64 char hex string), not the raw key
    expect(call.where.apiKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(call.where.apiKeyHash).not.toBe("test-key");
  });

  test("returns user auth result when valid Bearer token provided", async () => {
    privyMockInstance.verifyAuthToken.mockResolvedValue({ userId: "privy-user-1" });
    privyMockInstance.getUser.mockResolvedValue({
      linkedAccounts: [
        { type: "wallet", chainType: "solana", address: "SolAddr123" },
      ],
    });
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-user-1" });

    const req = makeRequest({ authorization: "Bearer valid-token" });
    const result = await authenticate(req);

    expect(result).toEqual({ type: "user", userId: "db-user-1" });
  });

  test("upserts user on first login", async () => {
    privyMockInstance.verifyAuthToken.mockResolvedValue({ userId: "privy-new-user" });
    privyMockInstance.getUser.mockResolvedValue({
      linkedAccounts: [],
    });
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-new-user" });

    const req = makeRequest({ authorization: "Bearer some-token" });
    await authenticate(req);

    expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = mockPrisma.user.upsert.mock.calls[0][0];
    expect(upsertCall.where.privyId).toBe("privy-new-user");
    expect(upsertCall.create.privyId).toBe("privy-new-user");
  });

  test("returns null on invalid Bearer token", async () => {
    privyMockInstance.verifyAuthToken.mockRejectedValue(new Error("invalid token"));

    const req = makeRequest({ authorization: "Bearer bad-token" });
    const result = await authenticate(req);

    expect(result).toBeNull();
  });

  test("returns null when Authorization header does not start with Bearer", async () => {
    const req = makeRequest({ authorization: "Basic sometoken" });
    const result = await authenticate(req);

    expect(result).toBeNull();
  });

  test("API key auth takes precedence over Bearer token when both present", async () => {
    mockPrisma.agent.findFirst.mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      status: "ACTIVE",
    });

    const req = makeRequest({
      "x-api-key": "my-api-key",
      authorization: "Bearer some-bearer-token",
    });
    const result = await authenticate(req);

    expect(result?.type).toBe("agent");
    // Privy should not have been called
    expect(privyMockInstance.verifyAuthToken).not.toHaveBeenCalled();
  });
});
