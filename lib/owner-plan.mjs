export const FREE_BUSINESS_LIMIT = 5;
export const FREE_LIMIT_ERROR = "FREE_BUSINESS_LIMIT_REACHED";

export function getOwnerPlan(plan) {
  return plan === "PREMIUM" ? "PREMIUM" : "FREE";
}

export function canCreateBusiness(plan, count) {
  return getOwnerPlan(plan) === "PREMIUM" || count < FREE_BUSINESS_LIMIT;
}

export function isFreeBusinessLimitError(error) {
  return error?.message?.includes(FREE_LIMIT_ERROR) === true;
}
