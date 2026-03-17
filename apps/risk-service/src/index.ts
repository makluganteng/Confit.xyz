import "dotenv/config";
import { startMonitor } from "./monitor";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

startMonitor(redisUrl).catch((err) => {
  console.error("Fatal error starting risk monitor:", err);
  process.exit(1);
});
