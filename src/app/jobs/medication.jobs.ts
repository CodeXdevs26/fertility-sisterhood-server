import cron from "node-cron";
import { NotificationModelType, UserRole, UserStatus } from "@prisma/client";
import prisma from "../utils/prisma.js";
import { createNotification } from "../modules/notification/notification.utils.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Each run also re-checks the previous minute, so a tick that fires late (or
 * is skipped while the previous run is still busy) still sends the reminder.
 * The dedupeKey stops it from being sent twice.
 */
const LOOKBACK_MINUTES = 1;

// UK GDPR: the push is visible on the lock screen, so it must never name the
// medication. The app opens the medication itself via `referenceId`.
const REMINDER_MESSAGE = "Medication reminder";
const REMINDER_DESCRIPTION = "It's time to take your medication.";

/** Local calendar day ("YYYY-MM-DD") and time ("HH:mm") of `date` in `timeZone`. */
const getLocalDateTime = (date: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map(part => [part.type, part.value])
  );
  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

/** Course dates are stored as calendar days at UTC midnight. */
const toDay = (date: Date) => date.toISOString().slice(0, 10);

export const runMedicationReminderJob = async (now = new Date()) => {
  // Rough UTC window (timezones span UTC-12..UTC+14); the exact local-day
  // check per user happens below.
  const medications = await prisma.medication.findMany({
    where: {
      reminderTimes: { isEmpty: false },
      startDate: { lte: new Date(now.getTime() + DAY_MS) },
      endDate: { gte: new Date(now.getTime() - 2 * DAY_MS) },
      auth: {
        is: {
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          fcmToken: { not: null },
        },
      },
    },
    select: {
      id: true,
      authId: true,
      startDate: true,
      endDate: true,
      reminderTimes: true,
      auth: { select: { timezone: true } },
    },
  });

  for (const medication of medications) {
    try {
      const timeZone = medication.auth.timezone || "UTC";
      const firstDay = toDay(medication.startDate);
      const lastDay = toDay(medication.endDate);

      for (let minutesAgo = LOOKBACK_MINUTES; minutesAgo >= 0; minutesAgo--) {
        const { localDate, time } = getLocalDateTime(
          new Date(now.getTime() - minutesAgo * MINUTE_MS),
          timeZone
        );
        if (localDate < firstDay || localDate > lastDay) continue;
        if (!medication.reminderTimes.includes(time)) continue;

        await createNotification({
          receiverId: medication.authId,
          message: REMINDER_MESSAGE,
          description: REMINDER_DESCRIPTION,
          modelType: NotificationModelType.MEDICATION,
          referenceId: medication.id,
          dedupeKey: `med:${medication.id}:${localDate}:${time}`,
        });
      }
    } catch (error) {
      console.error(
        `Medication reminder failed for medication ${medication.id}:`,
        error
      );
    }
  }
};

let isRunning = false;

/** Runs every minute; each reminder fires at the user's local "HH:mm". */
export const startMedicationReminderJob = () => {
  return cron.schedule("* * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runMedicationReminderJob();
    } catch (error) {
      console.error("Medication reminder job failed:", error);
    } finally {
      isRunning = false;
    }
  });
};
