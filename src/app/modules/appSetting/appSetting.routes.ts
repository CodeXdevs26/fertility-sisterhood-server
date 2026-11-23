import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { appSettingController } from "./appSetting.controller.js";
import { updateAppSettingZod } from "./appSetting.validation.js";

const router = Router();
router.get("/", appSettingController.get);
router.patch(
  "/",
  authorize(UserRole.ADMIN),
  validate(updateAppSettingZod),
  appSettingController.update
);

export const appSettingRoutes = router;
