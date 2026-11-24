import prisma from "./app/utils/prisma.js";

/**
 * One-off Stripe -> RevenueCat data migration. Run BEFORE `npx prisma db push`.
 * Safe to run more than once.
 *
 * - Stripe subscriptions cannot move to RevenueCat, and their old status values
 *   (INCOMPLETE, PAST_DUE, ...) would make Prisma reads fail: they are deleted.
 * - The SubscriptionPlan collection is dropped (replaced by Package).
 * - Payments are kept for revenue history: stripeInvoiceId -> transactionId,
 *   store = "STRIPE", Stripe-only fields removed.
 */
type TCommandResult = { n?: number; nModified?: number };

const ignoreMissing = async (label: string, run: () => Promise<unknown>) => {
  try {
    await run();
    console.log(`✔ ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /ns not found|index not found|NamespaceNotFound|IndexNotFound/i.test(
        message
      )
    ) {
      console.log(`- ${label}: nothing to do`);
    } else {
      throw error;
    }
  }
};

const main = async () => {
  const deleted = (await prisma.$runCommandRaw({
    delete: "Subscription",
    deletes: [{ q: { stripeSubscriptionId: { $exists: true } }, limit: 0 }],
  })) as TCommandResult;
  console.log(`✔ Deleted ${deleted.n ?? 0} Stripe subscription(s)`);

  await ignoreMissing("Dropped SubscriptionPlan collection", () =>
    prisma.$runCommandRaw({ drop: "SubscriptionPlan" })
  );

  // the old unique index would reject every new payment (missing field = null)
  await ignoreMissing("Dropped Payment.stripeInvoiceId unique index", () =>
    prisma.$runCommandRaw({
      dropIndexes: "Payment",
      index: "Payment_stripeInvoiceId_key",
    })
  );

  const renamed = (await prisma.$runCommandRaw({
    update: "Payment",
    updates: [
      {
        q: { stripeInvoiceId: { $exists: true } },
        u: {
          $rename: { stripeInvoiceId: "transactionId" },
          $set: { store: "STRIPE", environment: "PRODUCTION" },
          $unset: { stripeCustomerId: "", invoiceUrl: "" },
        },
        multi: true,
      },
    ],
  })) as TCommandResult;
  console.log(`✔ Migrated ${renamed.nModified ?? 0} Stripe payment(s)`);

  console.log("Done. Now run: npx prisma db push");
};

main()
  .catch(error => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
