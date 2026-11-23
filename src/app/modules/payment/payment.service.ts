import Stripe from "stripe";
import { PaymentStatus, Prisma } from "@prisma/client";
import {
  calculatePagination,
  TPaginationOptions,
} from "../../utils/paginationCalculation.js";
import prisma from "../../utils/prisma.js";
import stripe from "../../utils/stripe.js";

const toMajor = (minor: number) => Math.round(minor) / 100;

const getId = (value: string | { id?: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

/** authId from the subscription metadata, else from the saved Stripe customer. */
const resolveAuthId = async (invoice: Stripe.Invoice) => {
  const metaAuthId =
    invoice.parent?.subscription_details?.metadata?.authId ?? null;
  if (metaAuthId && /^[a-f\d]{24}$/i.test(metaAuthId)) return metaAuthId;

  const customerId = getId(invoice.customer);
  if (!customerId) return null;
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { authId: true },
  });
  return subscription?.authId ?? null;
};

/**
 * Saves / updates the Payment row for a Stripe invoice.
 * Called from the `invoice.paid` and `invoice.payment_failed` webhooks.
 * Returns the payment (or null for a $0 invoice, which is not recorded).
 */
const recordInvoice = async (
  invoice: Stripe.Invoice,
  status: typeof PaymentStatus.SUCCEEDED | typeof PaymentStatus.FAILED
) => {
  const minor =
    status === PaymentStatus.SUCCEEDED
      ? invoice.amount_paid
      : invoice.amount_due;
  if (!minor) return null;

  const existing = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id },
    select: { id: true, status: true, authId: true },
  });

  // a refund is final; a late/duplicate invoice event must not undo it
  if (existing?.status === PaymentStatus.REFUNDED) return existing;
  // a retried failure arriving after the invoice was paid must not undo it
  if (
    existing?.status === PaymentStatus.SUCCEEDED &&
    status === PaymentStatus.FAILED
  )
    return existing;

  const paidAt = invoice.status_transitions?.paid_at;
  const data = {
    amount: toMajor(minor),
    currency: invoice.currency,
    status,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
  };

  if (existing) {
    return prisma.payment.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(status === PaymentStatus.SUCCEEDED && paidAt
          ? { createdAt: new Date(paidAt * 1000) }
          : {}),
      },
      select: { id: true, status: true, authId: true },
    });
  }

  return prisma.payment.create({
    data: {
      ...data,
      authId: await resolveAuthId(invoice),
      stripeInvoiceId: invoice.id,
      stripeCustomerId: getId(invoice.customer),
      createdAt: new Date((paidAt ?? invoice.created) * 1000),
    },
    select: { id: true, status: true, authId: true },
  });
};

/** `charge.refunded`: stores the refunded amount on the invoice's payment. */
const recordRefund = async (charge: Stripe.Charge) => {
  const paymentIntentId = getId(charge.payment_intent);
  if (!paymentIntentId) return;

  const { data } = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: paymentIntentId },
    limit: 1,
  });
  const invoiceId = getId(data[0]?.invoice);
  if (!invoiceId) return; // not a subscription payment

  let payment = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoiceId },
    select: { id: true },
  });
  if (!payment) {
    // paid before payments were recorded - save it now
    const invoice = await stripe.invoices.retrieve(invoiceId);
    payment = await recordInvoice(invoice, PaymentStatus.SUCCEEDED);
    if (!payment) return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      amountRefunded: toMajor(charge.amount_refunded),
      status: charge.refunded
        ? PaymentStatus.REFUNDED
        : PaymentStatus.SUCCEEDED,
    },
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
        invoiceUrl: true,
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

export const paymentServices = { recordInvoice, recordRefund, getAll };
