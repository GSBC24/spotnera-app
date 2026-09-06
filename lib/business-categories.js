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
  { label: "Coffee & Tea", color: "#92400e" },
  { label: "Fast Food", color: "#ea580c" },
  { label: "Fashion", color: "#be185d" },
  { label: "Shoes", color: "#4338ca" },
  { label: "Pharmacy", color: "#059669" },
  { label: "Health & Wellness", color: "#0d9488" },
  { label: "Pets", color: "#b45309" },
  { label: "Sports & Outdoors", color: "#15803d" },
  { label: "Jewelry & Accessories", color: "#a21caf" },
  { label: "Books & Stationery", color: "#0369a1" },
  { label: "Florist & Gifts", color: "#e11d48" },
  { label: "Toys & Games", color: "#7c3aed" },
  { label: "Laundry & Dry Cleaning", color: "#0891b2" },
  { label: "Travel Services", color: "#2563eb" },
  { label: "Real Estate", color: "#4f46e5" },
  { label: "Legal Services", color: "#334155" },
  { label: "Accounting & Finance", color: "#166534" },
  { label: "Construction & Trades", color: "#ca8a04" },
  { label: "Agriculture & Garden", color: "#65a30d" },
  { label: "Music & Arts", color: "#9333ea" },
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
