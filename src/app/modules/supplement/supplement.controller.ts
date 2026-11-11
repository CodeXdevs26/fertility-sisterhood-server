import { Response } from "express";
import { TRequest } from "../../interface/global.interface.js";
import handleAsyncRequest from "../../utils/handleAsyncRequest.js";
import pick from "../../utils/pick.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { supplementServices } from "./supplement.service.js";

const create = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await supplementServices.create(req.user!.id, req.body);
  sendResponse(res, {
    status: 201,
    message: "Supplement created successfully!",
    data,
  });
});

const getMy = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await supplementServices.getMy(
    req.user!.id,
    pick(req.query, ["page", "limit"])
  );
  sendResponse(res, { message: "Supplements fetched successfully!", data });
});

const markTakenToday = handleAsyncRequest(
  async (req: TRequest, res: Response) => {
    const data = await supplementServices.markTakenToday(
      req.user!.id,
      req.params.id as string
    );
    sendResponse(res, {
      message: "Supplement marked as taken for today!",
      data,
    });
  }
);

const getSingle = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await supplementServices.getSingle(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Supplement fetched successfully!", data });
});

const update = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await supplementServices.update(
    req.user!.id,
    req.params.id as string,
    req.body
  );
  sendResponse(res, { message: "Supplement updated successfully!", data });
});

const remove = handleAsyncRequest(async (req: TRequest, res: Response) => {
  const data = await supplementServices.remove(
    req.user!.id,
    req.params.id as string
  );
  sendResponse(res, { message: "Supplement deleted successfully!", data });
});

export const supplementController = {
  create,
  getMy,
  markTakenToday,
  getSingle,
  update,
  remove,
};
