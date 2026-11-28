import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { uploadAttachment } from "../../utils/awss3.js";
import { testResultController } from "./testResult.controller.js";
import {
  createTestResultZod,
  testResultQueryZod,
  updateTestResultZod,
} from "./testResult.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
router.post("/", validate(createTestResultZod), testResultController.create);
router.get(
  "/",
  validate(testResultQueryZod, { query: true }),
  testResultController.getMy
);
router.get("/:id", testResultController.getSingle);
router.patch(
  "/:id",
  validate(updateTestResultZod),
  testResultController.update
);
router.post(
  "/:id/attachment",
  uploadAttachment.single("attachment"),
  testResultController.setAttachment
);
router.delete("/:id/attachment", testResultController.removeAttachment);
router.delete("/:id", testResultController.remove);

export const testResultRoutes = router;
