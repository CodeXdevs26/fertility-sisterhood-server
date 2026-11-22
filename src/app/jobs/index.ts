import config from "../config/index.js";
import { getFirebaseMessaging } from "../utils/firebase.js";
import { startMedicationReminderJob } from "./medicationReminder.job.js";

export const startJobs = () => {
  if (!config.enableCron) return;

  if (!getFirebaseMessaging()) {
    console.warn(
      "Firebase credentials missing - push notifications are disabled."
    );
  }

  startMedicationReminderJob();
};
