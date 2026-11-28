import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { upload } from "../../utils/awss3.js";
import { documentController } from "./document.controller.js";
import {
  createDocumentZod,
  documentQueryZod,
  updateDocumentZod,
} from "./document.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
router.post(
  "/",
  upload.single("file"),
  validate(createDocumentZod, { formData: true }),
  documentController.create
);
router.get(
  "/",
  validate(documentQueryZod, { query: true }),
  documentController.getMy
);
router.patch(
  "/:id",
  upload.single("file"),
  validate(updateDocumentZod, { formData: true }),
  documentController.update
);
router.delete("/:id", documentController.remove);

export const documentRoutes = router;
