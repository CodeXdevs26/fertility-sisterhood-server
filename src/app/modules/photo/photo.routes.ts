import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { uploadImage } from "../../utils/awss3.js";
import { photoController } from "./photo.controller.js";
import { createPhotoZod } from "./photo.validation.js";

const router = Router();
router.use(authorize(UserRole.USER));
router.post(
  "/",
  uploadImage.single("file"),
  validate(createPhotoZod),
  photoController.create
);
router.get("/", photoController.getMy);
router.get("/:id", photoController.getSingle);

export const photoRoutes = router;
