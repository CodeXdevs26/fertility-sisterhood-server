import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { notificationController } from "./notification.controller.js";
import { createDummyNotificationZod } from "./notification.validation.js";

const router = Router();
router.use(authorize(UserRole.ADMIN, UserRole.USER));
router.post(
  "/dummy",
  validate(createDummyNotificationZod),
  notificationController.createDummy
);
router.get("/", notificationController.getMy);
router.patch("/read-all", notificationController.markAllRead);
router.patch("/:id/read", notificationController.markRead);
router.delete("/", notificationController.clearAll);
router.delete("/:id", notificationController.remove);

export const notificationRoutes = router;
