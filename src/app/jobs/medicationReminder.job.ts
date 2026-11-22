import cron from "node-cron";
import prisma from "../utils/prisma.js";
import { sendPushNotification } from "../utils/sendPushNotification.js";

// UK GDPR: never expose the medication name/dose/type in a notification.
const REMINDER_TITLE = "Medication reminder";
const REMINDER_BODY = "It's time to take your medication.";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

/** Local date ("YYYY-MM-DD") and time ("HH:mm") of `date` in `timeZone`. */
const getLocalDateTime = (date: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(date)
      .map(part => [part.type, part.value])
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

// Start/end dates are stored as calendar dates (UTC midnight)
const toDay = (date: Date) => date.toISOString().slice(0, 10);

export const sendDueMedicationReminders = async (now = new Date()) => {
  // Broad DB filter; the exact per-timezone check happens below
  const medications = await prisma.medication.findMany({
    where: {
      startDate: { lte: new Date(now.getTime() + DAY_MS) },
      endDate: { gte: new Date(now.getTime() - DAY_MS) },
      reminderTimes: { isEmpty: false },
      auth: { fcmToken: { not: null } },
    },
    select: {
      id: true,
      authId: true,
      startDate: true,
      endDate: true,
      reminderTimes: true,
      timezone: true,
      auth: { select: { fcmToken: true } },
    },
  });

  const due = medications.filter(medication => {
    try {
      const { day, time } = getLocalDateTime(now, medication.timezone);
      return (
        day >= toDay(medication.startDate) &&
        day <= toDay(medication.endDate) &&
        medication.reminderTimes.includes(time)
      );
    } catch {
      return false; // invalid timezone stored
    }
  });
  if (!due.length) return;

  const results = await Promise.allSettled(
    due.map(medication =>
      sendPushNotification({
        authId: medication.authId,
        token: medication.auth.fcmToken!,
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        data: { type: "MEDICATION_REMINDER", medicationId: medication.id },
      })
    )
  );

  const sentAuthIds = due
    .filter((_, i) => {
      const result = results[i];
      return result?.status === "fulfilled" && result.value;
    })
    .map(medication => medication.authId);

  if (sentAuthIds.length) {
    await prisma.notification.createMany({
      data: sentAuthIds.map(authId => ({
        authId,
        title: REMINDER_TITLE,
        message: REMINDER_BODY,
      })),
    });
  }
};

export const startMedicationReminderJob = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        await sendDueMedicationReminders();
      } catch (error) {
        console.error("Medication reminder job failed:", error);
      }
    },
    { noOverlap: true }
  );
};
