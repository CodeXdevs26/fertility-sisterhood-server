import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { profileServices } from "./profile.service.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { REFRESH_COOKIE } from "../auth/auth.controller.js";

const getProfile = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const result = await profileServices.getProfile(req.user?.id as string);
  sendResponse(res, {
    message: "Profile fetched successfully!",
    data: result,
  });
});

const updateProfile = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const result = await profileServices.updateProfile(
      req.user?.id as string,
      req.body
    );
    sendResponse(res, {
      message: "Profile updated successfully!",
      data: result,
    });
  }
);

const deleteAccount = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    await profileServices.deleteAccount(req.user!.id, req.body);
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: "lax" });
    sendResponse(res, {
      message: "Account deleted successfully!",
      data: null,
    });
  }
);

const updateConsent = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const result = await profileServices.updateConsent(req.user!.id, req.body);
    sendResponse(res, {
      message: "Consent saved successfully!",
      data: result,
    });
  }
);

export const profileController = {
  getProfile,
  updateProfile,
  updateConsent,
  deleteAccount,
};
