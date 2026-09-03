import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

async function main() {
  await prisma.$connect();
  app.listen(env.PORT, () => {
    console.log(`[server] Mini ERP + CRM API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
