import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import requirePremium from "../../middlewares/requirePremium.js";
import validate from "../../middlewares/validate.js";
import { uploadImage } from "../../utils/awss3.js";
import { photoController } from "./photo.controller.js";
import { createPhotoZod, photoQueryZod } from "./photo.validation.js";

const router = Router();
router.use(authorize(UserRole.USER), requirePremium);
router.post(
  "/",
  uploadImage.single("file"),
  // flat multipart fields: replace req.body so `date` arrives coerced
  validate(createPhotoZod, { replace: true }),
  photoController.create
);
router.get(
  "/",
  validate(photoQueryZod, { query: true }),
  photoController.getMy
);
router.get("/:id", photoController.getSingle);
router.delete("/:id", photoController.remove);

export const photoRoutes = router;
