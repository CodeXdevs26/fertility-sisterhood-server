import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { exportController } from "./export.controller.js";
import { exportQueryZod } from "./export.validation.js";

const router = Router();

// open to every user (no requirePremium): users can always take out their own data
router.use(authorize(UserRole.USER));
router.get(
  "/",
  validate(exportQueryZod, { query: true }),
  exportController.exportData
);

export const exportRoutes = router;
