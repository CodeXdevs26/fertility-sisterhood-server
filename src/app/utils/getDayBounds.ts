import ApiError from "../classes/ApiError.js";

/** The UTC calendar day containing `date` (tracker dates are stored at UTC midnight). */
export const getDayBounds = (date: Date) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { gte: start, lt: end };
};

/** Rejects a course whose end is before its start (the reminder job would never fire). */
export const assertDateRange = (startDate: Date, endDate: Date) => {
  if (endDate.getTime() < startDate.getTime()) {
    throw new ApiError(400, "endDate must be on or after startDate!");
  }
};
