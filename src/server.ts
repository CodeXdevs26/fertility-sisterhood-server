import { log } from "console";
import { createServer, Server } from "http";
import { networkInterfaces } from "os";
import app from "./app/app.js";
import config from "./app/config/index.js";
import { startNotificationJobs } from "./app/jobs/notification.jobs.js";
import { startMedicationReminderJob } from "./app/jobs/medication.jobs.js";

let server: Server;

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
    startNotificationJobs();
    startMedicationReminderJob();
  });
};

main();

process.on("uncaughtException", error => {
  log(error);
  if (server) {
    server.close(() => {
      console.log("Server closed due to uncaught exception");
      process.exit(1);
    });
  }
});

process.on("unhandledRejection", error => {
  log(error);
  if (server) {
    server.close(() => {
      console.log("Server closed due to unhandled rejection");
      process.exit(1);
    });
  }
});
