import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { checklistTemplateController } from "./checklistTemplate.controller.js";
import {
  createChecklistTemplateZod,
  updateChecklistTemplateZod,
} from "./checklistTemplate.validation.js";

const router = Router();
const admin = authorize(UserRole.ADMIN);

router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.USER),
  checklistTemplateController.getAll
);
router.post(
  "/",
  admin,
  validate(createChecklistTemplateZod),
  checklistTemplateController.create
);
router.patch(
  "/:id",
  admin,
  validate(updateChecklistTemplateZod),
  checklistTemplateController.update
);
router.delete("/:id", admin, checklistTemplateController.remove);

export const checklistTemplateRoutes = router;
