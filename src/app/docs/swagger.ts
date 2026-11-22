import { Request, Response, Router } from "express";
import { components } from "./components.js";
import { appointmentSwagger } from "../modules/appointment/appointment.swagger.js";
import { authSwagger } from "../modules/auth/auth.swagger.js";
import { checklistSwagger } from "../modules/checklist/checklist.swagger.js";
import { costSwagger } from "../modules/cost/cost.swagger.js";
import { cycleSwagger } from "../modules/cycle/cycle.swagger.js";
import { notificationSwagger } from "../modules/notification/notification.swagger.js";
import { documentSwagger } from "../modules/document/document.swagger.js";
import { journalSwagger } from "../modules/journal/journal.swagger.js";
import { legalSwagger } from "../modules/legal/legal.swagger.js";
import { medicationSwagger } from "../modules/medication/medication.swagger.js";
import { metaSwagger } from "../modules/meta/meta.swagger.js";
import { noteSwagger } from "../modules/note/note.swagger.js";
import { otpSwagger } from "../modules/otp/otp.swagger.js";
import { photoSwagger } from "../modules/photo/photo.swagger.js";
import { profileSwagger } from "../modules/profile/profile.swagger.js";
import { questionSwagger } from "../modules/question/question.swagger.js";
import { subscriptionSwagger } from "../modules/subscription/subscription.swagger.js";
import { supplementSwagger } from "../modules/supplement/supplement.swagger.js";
import { supportSwagger } from "../modules/support/support.swagger.js";
import { symptomSwagger } from "../modules/symptom/symptom.swagger.js";
import { testResultSwagger } from "../modules/testResult/testResult.swagger.js";
import { exportSwagger } from "../modules/export/export.swagger.js";

const modules = [
  authSwagger,
  otpSwagger,
  profileSwagger,
  legalSwagger,
  symptomSwagger,
  cycleSwagger,
  appointmentSwagger,
  medicationSwagger,
  supplementSwagger,
  journalSwagger,
  checklistSwagger,
  costSwagger,
  testResultSwagger,
  noteSwagger,
  questionSwagger,
  documentSwagger,
  supportSwagger,
  photoSwagger,
  subscriptionSwagger,
  metaSwagger,
  notificationSwagger,
  exportSwagger,
];

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Fertility Sisterhood API",
    version: "1.0.0",
    description:
      "REST API for the Fertility Sisterhood app.\n\n" +
      "**Response envelope:** every success response is `{ success, message, data }`; errors are `{ success: false, message, error }`.\n\n" +
      "**Auth:** call `POST /auth/login`, then click **Authorize** and paste the `accessToken`.\n\n" +
      "**Premium:** endpoints marked premium need an `ACTIVE` subscription (see Subscriptions).\n\n" +
      "**Pagination:** list endpoints accept `page` and `limit` and return `{ meta: { page, limit, total }, <items> }`.",
  },
  servers: [{ url: "/api/v1", description: "Current server" }],
  tags: modules.map(m => m.tag),
  paths: Object.assign({}, ...modules.map(m => m.paths)),
  components,
};

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fertility Sisterhood API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: "/api-docs.json",
          dom_id: "#swagger-ui",
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: "none",
          tagsSorter: "alpha",
        });
      };
    </script>
  </body>
</html>`;

export const swaggerRouter = Router();

swaggerRouter.get("/api-docs.json", (_req: Request, res: Response) => {
  res.json(openApiDocument);
});

swaggerRouter.get("/api-docs", (_req: Request, res: Response) => {
  res.type("html").send(PAGE);
});
