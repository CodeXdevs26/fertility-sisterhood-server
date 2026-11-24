import { NextFunction, Response } from "express";
import jwt, { Secret } from "jsonwebtoken";
import { TAuthUser, TRequest } from "../interface/global.interface.js";
import ApiError from "../classes/ApiError.js";
import config from "../config/index.js";
import prisma from "../utils/prisma.js";
import { UserStatus } from "@prisma/client";

type TAuthorizeOptions = {
  optional?: boolean;
};

const authorize = (...args: Array<string | TAuthorizeOptions>) => {
  const options =
    typeof args[0] === "object" ? (args[0] as TAuthorizeOptions) : undefined;
  const roles = (options ? args.slice(1) : args).filter(
    (arg): arg is string => typeof arg === "string"
  );

  return async (req: TRequest, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        if (options?.optional) {
          req.user = undefined;
          return next();
        }

        throw new ApiError(401, "Unauthorized");
      }
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;

      if (!token) throw new ApiError(401, "Unauthorized");

      const decodedUser = jwt.verify(
        token,
        config.jwt.accessSecret as Secret
      ) as TAuthUser;

      // The token alone is not enough: a blocked/deleted account, or one whose
      // password changed (tokenVersion bumped), must lose access immediately.
      const auth = await prisma.auth.findUnique({
        where: { id: decodedUser.id },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          tokenVersion: true,
        },
      });
      if (
        !auth ||
        auth.status !== UserStatus.ACTIVE ||
        (auth.tokenVersion ?? 0) !== (decodedUser.tv ?? 0)
      ) {
        throw new ApiError(401, "Unauthorized");
      }
      // role from the DB, so a role change also applies at once
      req.user = {
        id: auth.id,
        email: auth.email,
        role: auth.role,
        tv: auth.tokenVersion ?? 0,
      };

      if (roles.length && !roles.includes(auth.role)) {
        throw new ApiError(403, "Forbidden!");
      }

      next();
    } catch (error: any) {
      next(error);
    }
  };
};

export default authorize;
