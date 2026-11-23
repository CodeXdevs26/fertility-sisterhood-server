import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { metaServices } from "./meta.service.js";

const getStats = handleAsyncRequest(async (_req: TRequest, res: Response) => {
  const data = await metaServices.getStats();
  sendResponse(res, { message: "Stats fetched successfully!", data });
});

const getUserOverview = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const data = await metaServices.getUserOverview(
      pick(req.query, ["year", "status"])
    );
    sendResponse(res, {
      message: "User overview fetched successfully!",
      data,
    });
  }
);

const getEarningOverview = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const data = await metaServices.getEarningOverview(
      pick(req.query, ["year"])
    );
    sendResponse(res, {
      message: "Earning overview fetched successfully!",
      data,
    });
  }
);

export const metaController = {
  getStats,
  getUserOverview,
  getEarningOverview,
};
