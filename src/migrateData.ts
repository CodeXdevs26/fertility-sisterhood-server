import prisma from "./app/utils/prisma.js";
import { toGbp } from "./app/utils/currency.js";

/**
 * One-off data fixes. Run BEFORE deploying the matching code (the CAMPING
 * enum value no longer exists, so Prisma would fail reading old rows).
 * Safe to run more than once. Uses raw commands so it works with old values.
 *
 * 1. Symptom.symptomName CAMPING -> CRAMPING
 * 2. Auth.email lower-cased (emails are now matched in lower case). Two
 *    accounts that differ only by case are reported and left untouched.
 * 3. Payment.amountGbp / amountRefundedGbp backfilled (revenue is in GBP).
 */
type TCursor<T> = { cursor: { firstBatch: T[] } };
type TResult = { n?: number; nModified?: number };

const find = async <T>(
  collection: string,
  filter: object,
  projection: object
) =>
  (
    (await prisma.$runCommandRaw({
      find: collection,
      filter,
      projection,
      batchSize: 100000,
    })) as unknown as TCursor<T>
  ).cursor.firstBatch;

const idOf = (doc: { _id: unknown }) => doc._id as object;

const renameCamping = async () => {
  const result = (await prisma.$runCommandRaw({
    update: "Symptom",
    updates: [
      {
        q: { symptomName: "CAMPING" },
        u: { $set: { symptomName: "CRAMPING" } },
        multi: true,
      },
    ],
  })) as TResult;
  console.log(`✔ Symptom CAMPING -> CRAMPING: ${result.nModified ?? 0}`);
};

const lowercaseEmails = async () => {
  const users = await find<{ _id: unknown; email: string }>(
    "Auth",
    {},
    { email: 1 }
  );
  const byLower = new Map<string, typeof users>();
  for (const user of users) {
    const key = user.email.trim().toLowerCase();
    byLower.set(key, [...(byLower.get(key) ?? []), user]);
  }

  let updated = 0;
  for (const [lower, group] of byLower) {
    if (group.length > 1) {
      console.warn(
        `! ${group.length} accounts share ${lower} (${group
          .map(u => u.email)
          .join(", ")}): merge or remove them by hand`
      );
      continue;
    }
    const user = group[0]!;
    if (user.email === lower) continue;
    await prisma.$runCommandRaw({
      update: "Auth",
      updates: [{ q: { _id: idOf(user) }, u: { $set: { email: lower } } }],
    });
    updated++;
  }
  console.log(`✔ Emails lower-cased: ${updated}`);
};

const backfillGbp = async () => {
  const payments = await find<{
    _id: unknown;
    amount: number;
    amountRefunded?: number;
    currency?: string;
  }>(
    "Payment",
    { amountGbp: { $exists: false } },
    { amount: 1, amountRefunded: 1, currency: 1 }
  );
  for (const payment of payments) {
    await prisma.$runCommandRaw({
      update: "Payment",
      updates: [
        {
          q: { _id: idOf(payment) },
          u: {
            $set: {
              amountGbp: toGbp(payment.amount ?? 0, payment.currency),
              amountRefundedGbp: toGbp(
                payment.amountRefunded ?? 0,
                payment.currency
              ),
            },
          },
        },
      ],
    });
  }
  console.log(`✔ Payments converted to GBP: ${payments.length}`);
};

const main = async () => {
  await renameCamping();
  await lowercaseEmails();
  await backfillGbp();
  console.log("Done.");
};

main()
  .catch(error => {
    console.error("Data migration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
