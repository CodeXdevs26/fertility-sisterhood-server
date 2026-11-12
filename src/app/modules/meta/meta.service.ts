import { SubscriptionStatus, UserRole, UserStatus } from "@prisma/client";
import prisma from "../../utils/prisma.js";

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
  const [activeUsers, blockedUsers, activeSubscribers] = await Promise.all([
    prisma.auth.count({
      where: { role: UserRole.USER, status: UserStatus.ACTIVE },
    }),
    prisma.auth.count({
      where: { role: UserRole.USER, status: UserStatus.BLOCKED },
    }),
    prisma.subscription.count({
      where: { status: SubscriptionStatus.ACTIVE },
    }),
  ]);

  return {
    totalUsers: activeUsers + blockedUsers,
    activeUsers,
    blockedUsers,
    activeSubscribers,
  };
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
};
