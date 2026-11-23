import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { paymentServices } from "./payment.service.js";

const getAll = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await paymentServices.getAll(
    pick(req.query, ["page", "limit"]),
    pick(req.query, ["searchTerm", "status"])
  );
  sendResponse(res, { message: "Payments fetched successfully!", data });
});

export const paymentController = { getAll };
