export const BUSINESS_CATEGORIES = [
  { label: "Restaurant", color: "#dc2626" },
  { label: "Cafe", color: "#8b5e34" },
  { label: "Bar", color: "#7e22ce" },
  { label: "Bakery", color: "#f97316" },
  { label: "Grocery", color: "#166534" },
  { label: "Clothing", color: "#ec4899" },
  { label: "Beauty & Spa", color: "#c026d3" },
  { label: "Fitness & Gym", color: "#2563eb" },
  { label: "Health", color: "#0f766e" },
  { label: "Hotel", color: "#d97706" },
  { label: "Automotive", color: "#374151" },
  { label: "Electronics", color: "#0284c7" },
  { label: "Home & Furniture", color: "#a16207" },
  { label: "Professional Services", color: "#1e3a8a" },
  { label: "Education", color: "#ca8a04" },
  { label: "Entertainment", color: "#6d28d9" },
  { label: "Events", color: "#db2777" },
  { label: "Nightlife", color: "#4338ca" },
  { label: "Shopping", color: "#16a34a" },
  { label: "Other", color: "#6b7280" },
];

export const BUSINESS_CATEGORY_LABELS = BUSINESS_CATEGORIES.map(
  (category) => category.label,
);

export function getBusinessCategoryConfig(category) {
  const normalizedCategory = String(category ?? "").trim().toLocaleLowerCase("en");

  return (
    BUSINESS_CATEGORIES.find(
      (item) => item.label.toLocaleLowerCase("en") === normalizedCategory,
    ) ?? BUSINESS_CATEGORIES[BUSINESS_CATEGORIES.length - 1]
  );
}
