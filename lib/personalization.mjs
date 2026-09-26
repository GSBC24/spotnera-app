import { BUSINESS_CATEGORIES, getBusinessCategoryConfig, isKnownBusinessCategory } from "./business-categories.js";

export const MAX_INTERESTS = 5;
export const AGE_RANGES = ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"];

const categoryValues = new Set(BUSINESS_CATEGORIES.map(({ value }) => value));

export function canonicalInterest(value) {
  if (!isKnownBusinessCategory(value)) return null;
  const category = getBusinessCategoryConfig(value);
  return categoryValues.has(category.value) ? category.value : null;
}

export function validatePersonalization(interests, ageRange) {
  if (!Array.isArray(interests) || interests.length > MAX_INTERESTS ||
      interests.some((interest) => !categoryValues.has(interest)) ||
      new Set(interests).size !== interests.length) {
    return { error: "Choose up to five different business categories." };
  }
  if (ageRange !== null && !AGE_RANGES.includes(ageRange)) {
    return { error: "Choose a valid age range or prefer not to say." };
  }
  return { interests, ageRange };
}
