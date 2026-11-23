import Stripe from "stripe";
import {
  NotificationModelType,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import { notify, notifyAdmins } from "../notification/notification.utils.js";
import { paymentServices } from "../payment/payment.service.js";
import config from "../../config/index.js";
import prisma from "../../utils/prisma.js";
import stripe from "../../utils/stripe.js";
import { TUpdateSubscriptionPlan } from "./subscription.validation.js";

const CURRENCY = "eur";

const planSelect = {
  id: true,
  title: true,
  description: true,
  price: true,
  updatedAt: true,
};

/** Statuses where the user already has (or is still paying for) a subscription. */
const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

const toStatus = (subscription: Stripe.Subscription) =>
  subscription.status.toUpperCase() as SubscriptionStatus;

const getPlan = async () => {
  const plan = await prisma.subscriptionPlan.findFirst({ select: planSelect });
  return plan ? { ...plan, currency: CURRENCY } : null;
};

const createMonthlyPrice = async (productId: string, price: number) => {
  const stripePrice = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(price * 100),
    currency: CURRENCY,
    recurring: { interval: "month" },
  });
  await stripe.products.update(productId, { default_price: stripePrice.id });
  return stripePrice;
};

const updatePlan = async (payload: TUpdateSubscriptionPlan) => {
  const existing = await prisma.subscriptionPlan.findFirst();

  if (!existing) {
    const product = await stripe.products.create({
      name: payload.title,
      description: payload.description,
    });
    const stripePrice = await createMonthlyPrice(product.id, payload.price);

    const created = await prisma.subscriptionPlan.create({
      data: {
        ...payload,
        stripeProductId: product.id,
        stripePriceId: stripePrice.id,
      },
      select: planSelect,
    });
    return { ...created, currency: CURRENCY };
  }

  await stripe.products.update(existing.stripeProductId, {
    name: payload.title,
    description: payload.description,
  });

  let stripePriceId = existing.stripePriceId;
  if (payload.price !== existing.price) {
    const stripePrice = await createMonthlyPrice(
      existing.stripeProductId,
      payload.price
    );
    await stripe.prices.update(existing.stripePriceId, { active: false });
    stripePriceId = stripePrice.id;
  }

  const updated = await prisma.subscriptionPlan.update({
    where: { id: existing.id },
    data: { ...payload, stripePriceId },
    select: planSelect,
  });
  return { ...updated, currency: CURRENCY };
};

const purchase = async (authId: string) => {
  const plan = await prisma.subscriptionPlan.findFirst({
    select: { stripePriceId: true },
  });
  if (!plan) throw new ApiError(404, "Subscription plan not found");

  const existing = await prisma.subscription.findUnique({ where: { authId } });

  if (existing) {
    // Never trust the local status here: if the webhook was late or missing,
    // a paid subscription still looks INCOMPLETE in the DB. Ask Stripe.
    const current = await stripe.subscriptions
      .retrieve(existing.stripeSubscriptionId, {
        expand: ["latest_invoice.confirmation_secret"],
      })
      .catch(() => null);

    if (current) {
      await syncSubscription(current);

      if (LIVE_STATUSES.includes(toStatus(current))) {
        throw new ApiError(400, "You already have an active subscription");
      }

      if (current.status === "incomplete") {
        const invoice = current.latest_invoice as Stripe.Invoice | null;
        const clientSecret = invoice?.confirmation_secret?.client_secret;
        const samePrice =
          current.items.data[0]?.price.id === plan.stripePriceId;

        // still waiting for payment: hand back the same PaymentIntent
        if (invoice?.status === "open" && clientSecret && samePrice) {
          return purchaseResult(
            current.id,
            clientSecret,
            existing.stripeCustomerId
          );
        }
        await stripe.subscriptions.cancel(current.id).catch(() => null);
      }
    } else if (LIVE_STATUSES.includes(existing.status)) {
      throw new ApiError(400, "You already have an active subscription");
    }
  }

  let stripeCustomerId = existing?.stripeCustomerId;
  if (!stripeCustomerId) {
    const auth = await prisma.auth.findUnique({
      where: { id: authId },
      select: { email: true, name: true },
    });
    if (!auth) throw new ApiError(404, "User not found");

    const customer = await stripe.customers.create({
      email: auth.email,
      name: auth.name,
      metadata: { authId },
    });
    stripeCustomerId = customer.id;
  }

  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: plan.stripePriceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: { authId },
  });

  const data = {
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: toStatus(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
  };
  await prisma.subscription.upsert({
    where: { authId },
    create: { authId, ...data },
    update: data,
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;

  return purchaseResult(
    subscription.id,
    invoice.confirmation_secret?.client_secret,
    stripeCustomerId
  );
};

/** Values the Stripe PaymentSheet needs on the client. */
const purchaseResult = async (
  subscriptionId: string,
  clientSecret: string | undefined,
  customerId: string
) => {
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: Stripe.API_VERSION }
  );
  return {
    subscriptionId,
    clientSecret,
    ephemeralKey: ephemeralKey.secret,
    customerId,
    publishableKey: config.stripe.publishableKey,
  };
};

/** Pulls the latest state from Stripe into the DB. Returns false if there is nothing to sync. */
const refreshFromStripe = async (authId: string) => {
  const local = await prisma.subscription.findUnique({
    where: { authId },
    select: { stripeSubscriptionId: true },
  });
  if (!local) return false;
  await syncSubscriptionById(local.stripeSubscriptionId);
  return true;
};

/** POST /subscriptions/sync - for the app right after the PaymentSheet closes. */
const sync = async (authId: string) => {
  if (!(await refreshFromStripe(authId)))
    throw new ApiError(404, "No subscription found");
  return getMy(authId);
};

const getMy = async (authId: string) => {
  const select = {
    status: true,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: true,
    createdAt: true,
  };
  let subscription = await prisma.subscription.findUnique({
    where: { authId },
    select,
  });
  if (!subscription) return null;

  // waiting for payment: don't depend on the webhook, ask Stripe directly
  if (subscription.status === SubscriptionStatus.INCOMPLETE) {
    try {
      await refreshFromStripe(authId);
      subscription =
        (await prisma.subscription.findUnique({ where: { authId }, select })) ??
        subscription;
    } catch (error) {
      console.error("Stripe refresh failed:", error);
    }
  }

  return {
    status: subscription.status,
    isPremium: subscription.status === SubscriptionStatus.ACTIVE,
    autoRenew: !subscription.cancelAtPeriodEnd,
    endDate: subscription.currentPeriodEnd,
    createdAt: subscription.createdAt,
  };
};

const getActiveSubscription = async (authId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { authId },
    select: {
      stripeSubscriptionId: true,
      status: true,
      cancelAtPeriodEnd: true,
    },
  });
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    throw new ApiError(404, "No active subscription found");
  }
  return subscription;
};

const cancel = async (authId: string) => {
  const subscription = await getActiveSubscription(authId);
  if (subscription.cancelAtPeriodEnd) {
    throw new ApiError(400, "Subscription is already canceled");
  }

  const updated = await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    { cancel_at_period_end: true }
  );
  await syncSubscription(updated);
  return getMy(authId);
};

const renew = async (authId: string) => {
  const subscription = await getActiveSubscription(authId);
  if (!subscription.cancelAtPeriodEnd) {
    throw new ApiError(400, "Subscription is already set to auto renew");
  }

  const updated = await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    { cancel_at_period_end: false }
  );
  await syncSubscription(updated);
  return getMy(authId);
};

const getCurrentPeriodEnd = (subscription: Stripe.Subscription) => {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000) : null;
};

const FAILED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.UNPAID,
];
const ENDED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.INCOMPLETE_EXPIRED,
];

/** Push only on real status transitions (T1-T3), never on repeated webhooks. */
const notifyStatusChange = (
  subscription: { id: string; authId: string; stripeSubscriptionId: string },
  oldStatus: SubscriptionStatus,
  newStatus: SubscriptionStatus,
  currentPeriodEnd: Date | null
) => {
  if (oldStatus === newStatus) return;
  const period = currentPeriodEnd?.toISOString() ?? "none";
  const base = {
    receiverId: subscription.authId,
    modelType: NotificationModelType.SUBSCRIPTION,
    referenceId: subscription.id,
  };

  if (newStatus === SubscriptionStatus.ACTIVE) {
    notify({
      ...base,
      message: "Welcome to Premium!",
      description: "All premium features are now unlocked.",
      dedupeKey: `sub-active:${subscription.id}:${period}`,
    });
  } else if (
    FAILED_STATUSES.includes(newStatus) &&
    !FAILED_STATUSES.includes(oldStatus)
  ) {
    notify({
      ...base,
      message: "Payment failed",
      description: "Please update your payment method to keep Premium.",
      dedupeKey: `sub-failed:${subscription.id}:${period}`,
    });
  } else if (
    ENDED_STATUSES.includes(newStatus) &&
    !ENDED_STATUSES.includes(oldStatus) &&
    // an unpaid checkout that expired was never premium - nothing "ended"
    oldStatus !== SubscriptionStatus.INCOMPLETE
  ) {
    notify({
      ...base,
      message: "Your Premium has ended",
      description: "Subscribe again anytime to unlock all features.",
      dedupeKey: `sub-ended:${subscription.stripeSubscriptionId}`,
    });
  }
};

const getUserLabel = async (authId: string) => {
  const auth = await prisma.auth.findUnique({
    where: { id: authId },
    select: { name: true, email: true },
  });
  return auth ? `${auth.name} (${auth.email})` : "A user";
};

/** Admin in-app notifications for subscription changes (no push). */
const notifyAdminsOfChange = async (
  old: {
    id: string;
    authId: string;
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
  },
  stripeSubscriptionId: string,
  newStatus: SubscriptionStatus,
  cancelAtPeriodEnd: boolean,
  currentPeriodEnd: Date | null
) => {
  const period = currentPeriodEnd?.toISOString() ?? "none";
  const base = { referenceId: old.authId };

  if (
    newStatus === SubscriptionStatus.ACTIVE &&
    old.status !== SubscriptionStatus.ACTIVE &&
    // recovering from a failed renewal is not a new subscription
    !FAILED_STATUSES.includes(old.status)
  ) {
    notifyAdmins({
      ...base,
      message: "New subscription",
      description: `${await getUserLabel(old.authId)} subscribed to Premium`,
      modelType: NotificationModelType.NEW_SUBSCRIPTION,
      dedupeKey: `admin-sub-new:${stripeSubscriptionId}`,
    });
  } else if (
    ENDED_STATUSES.includes(newStatus) &&
    !ENDED_STATUSES.includes(old.status) &&
    old.status !== SubscriptionStatus.INCOMPLETE
  ) {
    notifyAdmins({
      ...base,
      message: "Subscription ended",
      description: `Premium ended for ${await getUserLabel(old.authId)}`,
      modelType: NotificationModelType.SUBSCRIPTION_CANCELED,
      dedupeKey: `admin-sub-ended:${stripeSubscriptionId}`,
    });
  } else if (
    cancelAtPeriodEnd &&
    !old.cancelAtPeriodEnd &&
    newStatus === SubscriptionStatus.ACTIVE
  ) {
    const endDate = currentPeriodEnd
      ? ` (Premium ends ${currentPeriodEnd.toISOString().slice(0, 10)})`
      : "";
    notifyAdmins({
      ...base,
      message: "Subscription canceled",
      description: `${await getUserLabel(old.authId)} canceled their subscription${endDate}`,
      modelType: NotificationModelType.SUBSCRIPTION_CANCELED,
      dedupeKey: `admin-sub-cancel:${stripeSubscriptionId}:${period}`,
    });
  }
};

const syncSubscription = async (subscription: Stripe.Subscription) => {
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, authId: true, status: true, cancelAtPeriodEnd: true },
  });

  const status = subscription.status.toUpperCase() as SubscriptionStatus;
  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd,
    },
  });

  if (existing) {
    notifyStatusChange(
      { ...existing, stripeSubscriptionId: subscription.id },
      existing.status,
      status,
      currentPeriodEnd
    );
    notifyAdminsOfChange(
      existing,
      subscription.id,
      status,
      subscription.cancel_at_period_end,
      currentPeriodEnd
    ).catch(error => console.error("Failed to notify admins:", error));
  }
};

const syncSubscriptionById = async (stripeSubscriptionId: string) => {
  const subscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);
  await syncSubscription(subscription);
};

/** Invoice events also refresh the subscription, so status never lags the payment. */
const syncInvoiceSubscription = async (invoice: Stripe.Invoice) => {
  const ref = invoice.parent?.subscription_details?.subscription;
  const id = typeof ref === "string" ? ref : ref?.id;
  if (id) await syncSubscriptionById(id);
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const payment = await paymentServices.recordInvoice(
    invoice,
    PaymentStatus.FAILED
  );
  // only renewals - a declined card at first checkout is not worth an alert
  if (invoice.billing_reason !== "subscription_cycle" || !payment?.authId)
    return;

  notifyAdmins({
    message: "Payment failed",
    description: `Renewal payment failed for ${await getUserLabel(payment.authId)}`,
    modelType: NotificationModelType.PAYMENT_FAILED,
    referenceId: payment.id,
    dedupeKey: `admin-payment-failed:${invoice.id}`,
  });
};

const handleWebhook = async (payload: Buffer, signature: string) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret as string
    );
  } catch {
    throw new ApiError(400, "Invalid webhook signature");
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // Retrieve the latest state since webhook events can arrive out of order
      await syncSubscriptionById(event.data.object.id);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await paymentServices.recordInvoice(
        event.data.object,
        PaymentStatus.SUCCEEDED
      );
      await syncInvoiceSubscription(event.data.object);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object);
      await syncInvoiceSubscription(event.data.object);
      break;
    case "charge.refunded":
      await paymentServices.recordRefund(event.data.object);
      break;
    default:
      break;
  }
};

export const subscriptionServices = {
  getPlan,
  updatePlan,
  purchase,
  getMy,
  sync,
  cancel,
  renew,
  handleWebhook,
};
