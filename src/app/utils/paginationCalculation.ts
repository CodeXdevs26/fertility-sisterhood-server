export type TPaginationOptions = {
  page?: number;
  limit?: number;
  sortBy?: string;
  orderBy?: "asc" | "desc";
};
export type TReturnOptions = {
  page: number;
  skip: number;
  take: number;
  sortBy?: string;
  orderBy?: "asc" | "desc";
};

export const calculatePagination = ({
  page = 1,
  limit = 10,
  sortBy,
  orderBy,
}: TPaginationOptions): TReturnOptions => {
  // query strings arrive unvalidated: NaN / 0 / negatives / huge limits would
  // make Prisma throw (500) or return everything
  const toPositiveInt = (value: unknown, fallback: number) => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 1 ? n : fallback;
  };
  const safePage = toPositiveInt(page, 1);
  const take = Math.min(toPositiveInt(limit, 10), 100);
  const skip = (safePage - 1) * take;

  return {
    page: safePage,
    skip,
    take,
    sortBy,
    orderBy,
  };
};
