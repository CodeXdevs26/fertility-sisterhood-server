import { BillingCycle } from "@prisma/client";
import prisma from "./app/utils/prisma.js";

// Default subscription package(s). Upserted by revenueCatProductId, so running
// it again never creates duplicates; admin edits to other fields are kept.
// revenueCatProductId / entitlementId must match the RevenueCat dashboard:
// change them here (or PATCH /api/v1/packages/:id) once they are known.
const PACKAGES = [
  {
    title: "Monthly plan",
    billingCycle: BillingCycle.MONTHLY,
    revenueCatProductId: "premium_monthly",
    entitlementId: "premium",
    description: ["Monthly membership package that you can subscribe to"],
    price: 19.99,
    currency: "gbp",
  },
];

const main = async () => {
  for (const pkg of PACKAGES) {
    const existing = await prisma.package.findUnique({
      where: { revenueCatProductId: pkg.revenueCatProductId },
      select: { id: true },
    });
    if (existing) {
      console.log(`- ${pkg.title} already exists (${existing.id})`);
      continue;
    }
    const created = await prisma.package.create({
      data: pkg,
      select: { id: true },
    });
    console.log(`✔ Created ${pkg.title} (${created.id})`);
  }
};

main()
  .catch(error => {
    console.error("Package seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
