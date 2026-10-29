import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { supportServices } from "./support.service.js";

const send = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await supportServices.send(req.body);
  sendResponse(res, {
    status: 201,
    message: "Support request sent successfully!",
    data,
  });
});

const getAll = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await supportServices.getAll(pick(req.query, ["page", "limit"]));
  sendResponse(res, {
    message: "Support requests fetched successfully!",
    data,
  });
});

const updateStatus = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const data = await supportServices.updateStatus(
      req.params.id as string,
      req.body.status
    );
    sendResponse(res, {
      message: "Support request status updated successfully!",
      data,
    });
  }
);

export const supportController = { send, getAll, updateStatus };
