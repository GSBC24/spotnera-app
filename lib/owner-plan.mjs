export const FREE_BUSINESS_LIMIT = 5;
export const FREE_LIMIT_ERROR = "FREE_BUSINESS_LIMIT_REACHED";
export const BUSINESS_LIMIT_MESSAGE = `You've reached the maximum of ${FREE_BUSINESS_LIMIT} businesses allowed per account. To add a new business, you'll need to remove an existing one.`;

export function getOwnerPlan(plan) {
  return plan === "PREMIUM" ? "PREMIUM" : "FREE";
}

export function canCreateBusiness(count) {
  return count < FREE_BUSINESS_LIMIT;
}

export function isFreeBusinessLimitError(error) {
  return error?.message?.includes(FREE_LIMIT_ERROR) === true;
}
