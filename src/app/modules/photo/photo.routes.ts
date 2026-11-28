import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { uploadImage } from "../../utils/awss3.js";
import { photoController } from "./photo.controller.js";
import {
  createPhotoZod,
  photoQueryZod,
  updatePhotoZod,
} from "./photo.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
// multipart: image in `file`; fields flat or as a `payload` JSON string
router.post(
  "/",
  uploadImage.single("file"),
  validate(createPhotoZod, { formData: true }),
  photoController.create
);
router.get(
  "/",
  validate(photoQueryZod, { query: true }),
  photoController.getMy
);
router.get("/:id", photoController.getSingle);
router.patch(
  "/:id",
  uploadImage.single("file"),
  validate(updatePhotoZod, { formData: true }),
  photoController.update
);
router.delete("/:id", photoController.remove);

export const photoRoutes = router;
