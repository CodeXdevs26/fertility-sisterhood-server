import { PaymentStatus, Prisma } from "@prisma/client";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import { TRevenueCatEvent } from "../../utils/revenuecat.js";
import { findPackageByProduct } from "../package/package.service.js";

const paymentSelect = { id: true, status: true, authId: true };

/** RevenueCat reports refunds as CANCELLATION with this reason. */
export const isRefundEvent = (event: TRevenueCatEvent) =>
  event.type === "CANCELLATION" && event.cancel_reason === "CUSTOMER_SUPPORT";

const statusForEvent = (event: TRevenueCatEvent): PaymentStatus | null => {
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
      return PaymentStatus.SUCCEEDED;
    case "BILLING_ISSUE":
      return PaymentStatus.FAILED;
    default:
      return isRefundEvent(event) ? PaymentStatus.REFUNDED : null;
  }
};

/**
 * Saves / updates the Payment row for a RevenueCat event, deduped by
 * `transaction_id`. Only INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE,
 * BILLING_ISSUE and refunds are recorded; free (trial) transactions are not.
 */
const upsertRevenueCatPayment = async (
  authId: string | null,
  event: TRevenueCatEvent
) => {
  const status = statusForEvent(event);
  const transactionId = event.transaction_id;
  if (!status || !transactionId) return null;

  const amount = Math.abs(event.price_in_purchased_currency ?? 0);
  const existing = await prisma.payment.findUnique({
    where: { transactionId },
    select: paymentSelect,
  });

  if (status === PaymentStatus.REFUNDED) {
    if (existing) {
      return prisma.payment.update({
        where: { id: existing.id },
        data: {
          status,
          ...(amount ? { amountRefunded: amount } : {}),
        },
        select: paymentSelect,
      });
    }
    if (!amount) return null;
  } else {
    if (!amount) return null;
    // a refund is final; a late/duplicate event must not undo it
    if (existing?.status === PaymentStatus.REFUNDED) return existing;
    // a retried failure arriving after the payment succeeded must not undo it
    if (
      existing?.status === PaymentStatus.SUCCEEDED &&
      status === PaymentStatus.FAILED
    )
      return existing;
    if (existing) {
      return prisma.payment.update({
        where: { id: existing.id },
        data: { status, eventType: event.type },
        select: paymentSelect,
      });
    }
  }

  const pkg = await findPackageByProduct(event.product_id);
  return prisma.payment.create({
    data: {
      authId,
      transactionId,
      store: event.store ?? null,
      productId: event.product_id ?? null,
      packageId: pkg?.id ?? null,
      eventType: event.type,
      environment: event.environment ?? null,
      amount,
      amountRefunded: status === PaymentStatus.REFUNDED ? amount : 0,
      currency: (event.currency ?? "eur").toLowerCase(),
      status,
      createdAt: new Date(
        event.purchased_at_ms ?? event.event_timestamp_ms ?? Date.now()
      ),
    },
    select: paymentSelect,
  });
};

const getAll = async (
  options: TPaginationOptions,
  query: Record<string, unknown>
) => {
  const { page, take, skip } = calculatePagination(options);
  const and: Prisma.PaymentWhereInput[] = [];

  const status = String(query.status || "").toUpperCase();
  if (Object.values(PaymentStatus).includes(status as PaymentStatus)) {
    and.push({ status: status as PaymentStatus });
  }

  const searchTerm = String(query.searchTerm || "").trim();
  if (searchTerm) {
    and.push({
      OR: [
        {
          auth: { is: { name: { contains: searchTerm, mode: "insensitive" } } },
        },
        {
          auth: {
            is: { email: { contains: searchTerm, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  const where: Prisma.PaymentWhereInput = and.length ? { AND: and } : {};
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        amountRefunded: true,
        currency: true,
        status: true,
        store: true,
        productId: true,
        environment: true,
        createdAt: true,
        auth: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return { meta: { page, limit: take, total }, payments };
};

/** Statuses whose money was collected (refunds are subtracted separately). */
export const REVENUE_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.REFUNDED,
];

export const paymentServices = { upsertRevenueCatPayment, getAll };

/** Sandbox (and test-purchase) payments never count as revenue. */
export const LIVE_PAYMENT: Prisma.PaymentWhereInput = {
  NOT: { environment: "SANDBOX" },
};
