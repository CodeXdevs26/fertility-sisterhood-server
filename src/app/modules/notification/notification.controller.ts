import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { notificationServices } from "./notification.service.js";

const createDummy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await notificationServices.createDummy(req.user!.id, req.body);
  sendResponse(res, {
    status: 201,
    message: "Notification created successfully!",
    data,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await notificationServices.getMy(
    req.user!.id,
    pick(req.query, ["page", "limit"])
  );
  sendResponse(res, { message: "Notifications fetched successfully!", data });
});

const markAllRead = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await notificationServices.markAllRead(req.user!.id);
  sendResponse(res, { message: "All notifications marked as read!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await notificationServices.remove(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Notification deleted successfully!", data });
});

const clearAll = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await notificationServices.clearAll(req.user!.id);
  sendResponse(res, { message: "All notifications cleared!", data });
});

export const notificationController = {
  createDummy,
  getMy,
  markAllRead,
  remove,
  clearAll,
};
