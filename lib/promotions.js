export const PROMOTION_TYPES = [
  { value: "percentage_off", label: "Percentage off" },
  { value: "amount_off", label: "Amount off" },
  { value: "buy_one_get_one", label: "Buy one get one" },
  { value: "special_price", label: "Special price" },
  { value: "happy_hour", label: "Happy hour" },
  { value: "bundle_combo", label: "Bundle / Combo" },
  { value: "free_item", label: "Free item" },
  { value: "limited_time_deal", label: "Limited-time deal" },
  { value: "member_loyalty", label: "Member / Loyalty" },
  { value: "other", label: "Other" },
];

export const PROMOTION_TYPE_VALUES = PROMOTION_TYPES.map((type) => type.value);

export function getPromotionTypeLabel(value) {
  return PROMOTION_TYPES.find((type) => type.value === value)?.label ?? "Other";
}
