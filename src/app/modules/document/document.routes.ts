import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { upload } from "../../utils/awss3.js";
import { documentController } from "./document.controller.js";
import { createDocumentZod, updateDocumentZod } from "./document.validation.js";

const router = Router();
router.use(authorize(UserRole.USER));
router.post(
  "/",
  upload.single("file"),
  validate(createDocumentZod),
  documentController.create
);
router.get("/", documentController.getMy);
router.patch(
  "/:id",
  upload.single("file"),
  validate(updateDocumentZod),
  documentController.update
);
router.delete("/:id", documentController.remove);

export const documentRoutes = router;
