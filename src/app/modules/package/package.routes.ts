import { Router } from "express";
import { UserRole } from "@prisma/client";
import authorize from "../../middlewares/authorize.js";
import validate from "../../middlewares/validate.js";
import { packageController } from "./package.controller.js";
import { createPackageZod, updatePackageZod } from "./package.validation.js";

const router = Router();
const admin = authorize(UserRole.ADMIN);
const anyRole = authorize(UserRole.ADMIN, UserRole.USER);

router.get("/", anyRole, packageController.getAll);
router.get("/:id", anyRole, packageController.getById);
router.post(
  "/",
  admin,
  validate(createPackageZod, { replace: true }),
  packageController.create
);
router.patch(
  "/:id",
  admin,
  validate(updatePackageZod, { replace: true }),
  packageController.update
);
router.delete("/:id", admin, packageController.remove);

export const packageRoutes = router;
