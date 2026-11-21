import cron from "node-cron";
import {
  ChecklistStatus,
  NotificationModelType,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import prisma from "../utils/prisma.js";
import { createNotification } from "../modules/notification/notification.utils.js";

const DIGEST_HOUR = 8;
const EVENING_HOUR = 20;
const SUBSCRIPTION_ENDING_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar date ("YYYY-MM-DD") and hour of `date` in `timeZone`. */
const getLocalParts = (date: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map(part => [part.type, part.value])
  );
  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
};

/** "YYYY-MM-DD" shifted by n days */
const shiftDay = (day: string, days: number) =>
  new Date(new Date(`${day}T00:00:00.000Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

/**
 * Tracker dates (appointments, checklists, medications, cycles) are stored as
 * calendar days at UTC midnight, so a user's local day maps to that UTC day.
 */
const dayRange = (day: string) => {
  const gte = new Date(`${day}T00:00:00.000Z`);
  return { gte, lt: new Date(gte.getTime() + DAY_MS) };
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** T6: one morning summary per day, skipped when there is nothing to show. */
const sendMorningDigest = async (authId: string, localDate: string) => {
  const today = dayRange(localDate);
  const yesterday = dayRange(shiftDay(localDate, -1));
  const activeOnDay = {
    authId,
    startDate: { lt: today.lt },
    endDate: { gte: today.gte },
  };

  const [
    appointments,
    medications,
    supplements,
    checklists,
    medicationsEnding,
    supplementsEnding,
    endedCycle,
  ] = await Promise.all([
    prisma.appointment.count({ where: { authId, date: today } }),
    prisma.medication.count({ where: activeOnDay }),
    prisma.supplement.count({ where: activeOnDay }),
    prisma.checklist.count({
      where: { authId, date: today, status: ChecklistStatus.PENDING },
    }),
    prisma.medication.count({ where: { authId, endDate: today } }),
    prisma.supplement.count({ where: { authId, endDate: today } }),
    prisma.cycle.findFirst({
      where: { authId, endDate: yesterday },
      select: { endDate: true },
    }),
  ]);

  const cycleEnded =
    endedCycle?.endDate &&
    !(await prisma.cycle.count({
      where: { authId, startDate: { gt: endedCycle.endDate } },
    }));

  const summary = [
    appointments && plural(appointments, "appointment"),
    medications && plural(medications, "medication"),
    supplements && plural(supplements, "supplement"),
    checklists && plural(checklists, "checklist item"),
  ].filter(Boolean);

  const extras = [
    medicationsEnding + supplementsEnding > 0 &&
      `${plural(medicationsEnding + supplementsEnding, "course")} ends today`,
    cycleEnded && "Your cycle ended yesterday - set your new cycle start",
  ].filter(Boolean);

  if (!summary.length && !extras.length) return;

  await createNotification({
    receiverId: authId,
    message: "Your plan for today",
    description: [summary.join(" · "), ...extras].filter(Boolean).join(". "),
    modelType: NotificationModelType.DIGEST,
    dedupeKey: `digest:${authId}:${localDate}`,
  });
};

/** T7: one reminder per appointment, the evening before. */
const sendAppointmentReminders = async (authId: string, localDate: string) => {
  const appointments = await prisma.appointment.findMany({
    where: { authId, date: dayRange(shiftDay(localDate, 1)) },
    select: { id: true, doctor: true, time: true },
    orderBy: { date: "asc" },
  });

  for (const appointment of appointments) {
    await createNotification({
      receiverId: authId,
      message: "Appointment tomorrow",
      description: `${appointment.doctor} at ${appointment.time}`,
      modelType: NotificationModelType.APPOINTMENT,
      referenceId: appointment.id,
      dedupeKey: `appt:${appointment.id}`,
    });
  }
};

/** T8: premium set to cancel at period end, 3 days before it ends. */
const sendSubscriptionEndingReminder = async (
  authId: string,
  localDate: string,
  timeZone: string,
  subscription: { id: string; currentPeriodEnd: Date }
) => {
  const endDay = getLocalParts(
    subscription.currentPeriodEnd,
    timeZone
  ).localDate;
  if (endDay !== shiftDay(localDate, SUBSCRIPTION_ENDING_DAYS)) return;

  await createNotification({
    receiverId: authId,
    message: `Premium ends in ${SUBSCRIPTION_ENDING_DAYS} days`,
    description: "Renew to keep access to your trackers.",
    modelType: NotificationModelType.SUBSCRIPTION,
    referenceId: subscription.id,
    dedupeKey: `sub-ending:${subscription.id}:${subscription.currentPeriodEnd.toISOString()}`,
  });
};

export const runHourlyNotificationJob = async (now = new Date()) => {
  const users = await prisma.auth.findMany({
    where: {
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      fcmToken: { not: null },
    },
    select: {
      id: true,
      timezone: true,
      subscription: {
        select: {
          id: true,
          status: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  for (const user of users) {
    try {
      const timeZone = user.timezone || "UTC";
      const { localDate, hour } = getLocalParts(now, timeZone);
      if (hour !== DIGEST_HOUR && hour !== EVENING_HOUR) continue;

      const subscription = user.subscription;
      const isPremium = subscription?.status === SubscriptionStatus.ACTIVE;

      if (hour === DIGEST_HOUR && isPremium) {
        await sendMorningDigest(user.id, localDate);
      }

      if (hour === EVENING_HOUR) {
        if (isPremium) await sendAppointmentReminders(user.id, localDate);
        if (
          subscription?.cancelAtPeriodEnd &&
          subscription.currentPeriodEnd &&
          isPremium
        ) {
          await sendSubscriptionEndingReminder(user.id, localDate, timeZone, {
            id: subscription.id,
            currentPeriodEnd: subscription.currentPeriodEnd,
          });
        }
      }
    } catch (error) {
      console.error(`Notification job failed for user ${user.id}:`, error);
    }
  }
};

let isRunning = false;

/** Runs at minute 0 of every hour; each user is handled at their local 08:00 / 20:00. */
export const startNotificationJobs = () => {
  cron.schedule("0 * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runHourlyNotificationJob();
    } catch (error) {
      console.error("Hourly notification job failed:", error);
    } finally {
      isRunning = false;
    }
  });
};
