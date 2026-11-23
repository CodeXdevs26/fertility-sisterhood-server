import { log } from "console";
import { createServer, Server } from "http";
import { networkInterfaces } from "os";
import { setTimeout } from "timers";
import type { ScheduledTask } from "node-cron";
import app from "./app/app.js";
import config from "./app/config/index.js";
import prisma from "./app/utils/prisma.js";
import { startNotificationJobs } from "./app/jobs/notification.jobs.js";
import { startMedicationReminderJob } from "./app/jobs/medication.jobs.js";

// must stay below the container stop timeout (docker default: 10s)
const SHUTDOWN_TIMEOUT_MS = 8000;

let server: Server;
const jobs: ScheduledTask[] = [];
let shuttingDown = false;

const main = () => {
  server = createServer(app);

  server.listen(config.port, () => {
    const networkIps = Object.values(networkInterfaces())
      .flat()
      .filter(net => net?.family === "IPv4" && !net.internal)
      .map(net => net!.address);

    console.log(
      [
        "",
        `🚀 Fertility Sisterhood server is running (${config.env ?? "development"})`,
        ...networkIps.map(ip => `   Network:  http://${ip}:${config.port}`),
        `   Docs:     http://localhost:${config.port}/api-docs`,
        "",
      ].join("\n")
    );
    jobs.push(startNotificationJobs(), startMedicationReminderJob());
  });
};

/** Stops cron jobs, drains HTTP connections and closes the DB before exiting. */
const shutdown = (reason: string, exitCode: number) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${reason}: shutting down...`);

  // force exit if connections or a running job do not finish in time
  setTimeout(() => {
    console.error("Shutdown timed out, forcing exit");
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  for (const job of jobs) void job.stop();

  const closeDb = () =>
    prisma
      .$disconnect()
      .catch(error => log(error))
      .finally(() => {
        console.log("Server closed");
        process.exit(exitCode);
      });

  if (!server?.listening) return void closeDb();

  server.close(() => void closeDb());
  server.closeIdleConnections();
};

main();

process.on("SIGTERM", () => shutdown("SIGTERM received", 0));
process.on("SIGINT", () => shutdown("SIGINT received", 0));

process.on("uncaughtException", error => {
  log(error);
  shutdown("Uncaught exception", 1);
});

process.on("unhandledRejection", error => {
  log(error);
  shutdown("Unhandled rejection", 1);
});
