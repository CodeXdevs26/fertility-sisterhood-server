import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { Request, Response } from "express";
import { authServices } from "./auth.service.js";
import config from "../../config/index.js";
import { TRequest } from "../../interface/global.interface.js";
import pick from "../../utils/pick.js";
import { TGoogleLoginInput, TLoginInput } from "./auth.validation.js";

// name kept for existing clients (documented in Swagger)
export const REFRESH_COOKIE = "player-centralRefreshToken";

const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: config.env === "production",
    maxAge: 45 * 24 * 60 * 60 * 1000,
    // CORS allows every origin, so the cookie must not be sent on cross-site
    // requests (else any site could read GET /auth/refresh-token). Works when
    // the dashboard and the API share a site (admin.x.com + api.x.com).
    sameSite: "lax",
  });
};

const signup = handleAsyncRequest(async (req: TRequest, res) => {
  const result = await authServices.signUp(req.body);

  sendResponse(res, {
    status: 201,
    message: "Signup successful!",
    data: result,
  });
});

const login = handleAsyncRequest(async (req: Request, res: Response) => {
  const result = await authServices.login(req.body);

  const { refreshToken, accessToken } = result;
  setRefreshCookie(res, refreshToken);

  sendResponse(res, {
    message: "Logged in successfully!",
    // mobile apps have no cookie jar: they get the refresh token in the body
    // and send it back in the `x-refresh-token` header
    data: (req.body as TLoginInput).isMobileApp
      ? { accessToken, refreshToken }
      : { accessToken },
  });
});

// same response as /login
const googleLogin = handleAsyncRequest(async (req: Request, res: Response) => {
  const { refreshToken, accessToken } = await authServices.googleLogin(
    req.body
  );
  setRefreshCookie(res, refreshToken);

  sendResponse(res, {
    message: "Logged in successfully!",
    data: (req.body as TGoogleLoginInput).isMobileApp
      ? { accessToken, refreshToken }
      : { accessToken },
  });
});

const getSingle = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const result = await authServices.getSingle(req.params.id as string);
  sendResponse(res, {
    message: "User retrieved successfully!",
    data: result,
  });
});

const getAll = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const options = pick(req.query, ["page", "limit", "sortBy", "orderBy"]);
  const result = await authServices.getAll(options, req.query);
  sendResponse(res, {
    message: "Users retrieved successfully!",
    data: result,
  });
});

const resetPassword = handleAsyncRequest(
  async (req: Request, res: Response) => {
    const result = await authServices.resetPassword(req.body);
    sendResponse(res, {
      message: "Password reset successfully!",
      data: result,
    });
  }
);

const changePassword = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    // every other device is logged out; this one gets fresh tokens
    const { accessToken, refreshToken } = await authServices.changePassword(
      req.body,
      req.user?.id as string
    );
    setRefreshCookie(res, refreshToken);
    sendResponse(res, {
      message: "Password changed successfully!",
      // mobile clients (refresh token in a header) need the new one in the body
      data: req.headers["x-refresh-token"]
        ? { accessToken, refreshToken }
        : { accessToken },
    });
  }
);

const changeAccountStatus = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const { message } = await authServices.changeAccountStatus(
      req.params.userId as string,
      req.body.status
    );
    sendResponse(res, {
      message,
      data: null,
    });
  }
);

const refreshToken = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const header = req.headers["x-refresh-token"];
    const token =
      req.cookies?.[REFRESH_COOKIE] ??
      (typeof header === "string" ? header : undefined);
    const result = await authServices.refreshToken(token);
    sendResponse(res, {
      message: "Token refreshed successfully!",
      data: result,
    });
  }
);

const logout = handleAsyncRequest(async (req: TRequest, res: Response) => {
  await authServices.logout(req.user!.id);
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true });
  sendResponse(res, {
    message: "Logged out successfully!",
    data: null,
  });
});

export const authController = {
  signup,
  login,
  googleLogin,
  getSingle,
  getAll,
  resetPassword,
  changePassword,
  changeAccountStatus,
  refreshToken,
  logout,
};
