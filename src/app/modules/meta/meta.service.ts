import {
  SubscriptionStatus,
  SupportStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { LIVE_PAYMENT, REVENUE_STATUSES } from "../payment/payment.service.js";

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Net revenue (collected minus refunded) of payments matching the date range. */
const sumRevenue = async (createdAt?: { gte: Date; lt?: Date }) => {
  const { _sum } = await prisma.payment.aggregate({
    where: {
      ...LIVE_PAYMENT,
      status: { in: REVENUE_STATUSES },
      ...(createdAt ? { createdAt } : {}),
    },
    _sum: { amount: true, amountRefunded: true },
  });
  return round2((_sum.amount ?? 0) - (_sum.amountRefunded ?? 0));
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getStats = async () => {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const [
    activeUsers,
    blockedUsers,
    activeSubscribers,
    newUsersThisMonth,
    totalRevenue,
    revenueThisMonth,
    pendingSupports,
  ] = await Promise.all([
    prisma.auth.count({
      where: { role: UserRole.USER, status: UserStatus.ACTIVE },
    }),
    prisma.auth.count({
      where: { role: UserRole.USER, status: UserStatus.BLOCKED },
    }),
    prisma.subscription.count({
      where: { status: SubscriptionStatus.ACTIVE },
    }),
    prisma.auth.count({
      where: {
        role: UserRole.USER,
        status: { in: [UserStatus.ACTIVE, UserStatus.BLOCKED] },
        createdAt: { gte: monthStart },
      },
    }),
    sumRevenue(),
    sumRevenue({ gte: monthStart }),
    prisma.support.count({ where: { status: SupportStatus.PENDING } }),
  ]);

  return {
    totalUsers: activeUsers + blockedUsers,
    activeUsers,
    blockedUsers,
    activeSubscribers,
    newUsersThisMonth,
    totalRevenue,
    revenueThisMonth,
    pendingSupports,
  };
};

const getEarningOverview = async (query: Record<string, unknown>) => {
  const year = Number(query.year) || new Date().getUTCFullYear();

  const payments = await prisma.payment.findMany({
    where: {
      ...LIVE_PAYMENT,
      status: { in: REVENUE_STATUSES },
      createdAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: { amount: true, amountRefunded: true, createdAt: true },
  });

  const amounts = new Array<number>(12).fill(0);
  payments.forEach(({ amount, amountRefunded, createdAt }) => {
    const month = createdAt.getUTCMonth();
    amounts[month] = (amounts[month] ?? 0) + amount - amountRefunded;
  });

  return MONTHS.map((month, index) => ({
    month,
    amount: round2(amounts[index] ?? 0),
  }));
};

const getUserOverview = async (query: Record<string, unknown>) => {
  const year = Number(query.year) || new Date().getUTCFullYear();
  const status = String(query.status || "").toUpperCase();
  const statuses =
    status === UserStatus.ACTIVE || status === UserStatus.BLOCKED
      ? [status]
      : [UserStatus.ACTIVE, UserStatus.BLOCKED];

  const users = await prisma.auth.findMany({
    where: {
      role: UserRole.USER,
      status: { in: statuses },
      createdAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: { createdAt: true },
  });

  const counts = new Array<number>(12).fill(0);
  users.forEach(({ createdAt }) => {
    const month = createdAt.getUTCMonth();
    counts[month] = (counts[month] ?? 0) + 1;
  });

  return MONTHS.map((month, index) => ({ month, count: counts[index] ?? 0 }));
};

export const metaServices = {
  getStats,
  getUserOverview,
  getEarningOverview,
};
