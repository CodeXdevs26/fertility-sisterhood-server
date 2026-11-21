import Stripe from "stripe";
import { NotificationModelType, SubscriptionStatus } from "@prisma/client";
import ApiError from "../../classes/ApiError.js";
import { notify } from "../notification/notification.utils.js";
import config from "../../config/index.js";
import prisma from "../../utils/prisma.js";
import stripe from "../../utils/stripe.js";
import { TUpdateSubscriptionPlan } from "./subscription.validation.js";

const CURRENCY = "eur";

const getPlan = async () =>
  prisma.subscriptionPlan.findFirst({
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      updatedAt: true,
    },
  });

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
  const select = {
    id: true,
    title: true,
    description: true,
    price: true,
    updatedAt: true,
  };

  if (!existing) {
    const product = await stripe.products.create({
      name: payload.title,
      description: payload.description,
    });
    const stripePrice = await createMonthlyPrice(product.id, payload.price);

    return prisma.subscriptionPlan.create({
      data: {
        ...payload,
        stripeProductId: product.id,
        stripePriceId: stripePrice.id,
      },
      select,
    });
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

  return prisma.subscriptionPlan.update({
    where: { id: existing.id },
    data: { ...payload, stripePriceId },
    select,
  });
};

const purchase = async (authId: string) => {
  const plan = await prisma.subscriptionPlan.findFirst({
    select: { stripePriceId: true },
  });
  if (!plan) throw new ApiError(404, "Subscription plan not found");

  const existing = await prisma.subscription.findUnique({ where: { authId } });
  if (
    existing &&
    (
      [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIALING,
        SubscriptionStatus.PAST_DUE,
      ] as SubscriptionStatus[]
    ).includes(existing.status)
  ) {
    throw new ApiError(400, "You already have an active subscription");
  }

  if (existing?.status === SubscriptionStatus.INCOMPLETE) {
    await stripe.subscriptions
      .cancel(existing.stripeSubscriptionId)
      .catch(() => null);
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

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: stripeCustomerId },
    { apiVersion: Stripe.API_VERSION }
  );

  const data = {
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status.toUpperCase() as SubscriptionStatus,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
  };
  await prisma.subscription.upsert({
    where: { authId },
    create: { authId, ...data },
    update: data,
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;

  return {
    subscriptionId: subscription.id,
    clientSecret: invoice.confirmation_secret?.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customerId: stripeCustomerId,
    publishableKey: config.stripe.publishableKey,
  };
};

const getMy = async (authId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { authId },
    select: {
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      createdAt: true,
    },
  });
  if (!subscription) return null;

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
  subscription: { id: string; authId: string },
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
      dedupeKey: `sub-ended:${subscription.id}`,
    });
  }
};

const syncSubscription = async (subscription: Stripe.Subscription) => {
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, authId: true, status: true },
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

  if (existing)
    notifyStatusChange(existing, existing.status, status, currentPeriodEnd);
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
    case "customer.subscription.deleted": {
      // Retrieve the latest state since webhook events can arrive out of order
      const subscription = await stripe.subscriptions.retrieve(
        event.data.object.id
      );
      await syncSubscription(subscription);
      break;
    }
    default:
      break;
  }
};

export const subscriptionServices = {
  getPlan,
  updatePlan,
  purchase,
  getMy,
  cancel,
  renew,
  handleWebhook,
};
