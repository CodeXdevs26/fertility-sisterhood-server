import { NextFunction, Response } from "express";
import { SubscriptionStatus } from "@prisma/client";
import { TRequest } from "../interface/global.interface.js";
import ApiError from "../classes/ApiError.js";
import prisma from "../utils/prisma.js";

const requirePremium = async (
  req: TRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { authId: req.user!.id },
      select: { status: true },
    });

    if (subscription?.status !== SubscriptionStatus.ACTIVE) {
      throw new ApiError(
        403,
        "This feature is only available for premium users!"
      );
    }

    next();
  } catch (error: any) {
    next(error);
  }
};

export default requirePremium;
