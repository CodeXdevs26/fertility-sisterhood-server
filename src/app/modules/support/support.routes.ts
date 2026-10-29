import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { supportController } from "./support.controller.js";
import {
  sendSupportZod,
  updateSupportStatusZod,
} from "./support.validation.js";

const router = Router();
router.post(
  "/",
  authorize(UserRole.USER),
  validate(sendSupportZod),
  supportController.send
);
router.get("/", authorize(UserRole.ADMIN), supportController.getAll);
router.patch(
  "/:id/status",
  authorize(UserRole.ADMIN),
  validate(updateSupportStatusZod),
  supportController.updateStatus
);

export const supportRoutes = router;
