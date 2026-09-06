const category = (value, label, color, legacyValues = []) => ({ value, label, color, legacyValues });

// Canonical customer-facing taxonomy. Legacy values remain accepted so existing rows are not rewritten.
export const BUSINESS_CATEGORIES = [
  category("Restaurants", "Restaurants", "#dc2626", ["Restaurant"]),
  category("Cafés", "Cafés", "#8b5e34", ["Cafe"]),
  category("Bars & Nightlife", "Bars & Nightlife", "#7e22ce", ["Bar"]),
  category("Grocery", "Grocery", "#166534"),
  category("Bakery", "Bakery", "#f97316"),
  category("Fashion", "Fashion", "#ec4899", ["Clothing"]),
  category("Shoes", "Shoes", "#4338ca"),
  category("Jewelry", "Jewelry", "#a21caf", ["Jewelry & Accessories"]),
  category("Beauty", "Beauty", "#c026d3", ["Beauty & Spa"]),
  category("Hair & Barber", "Hair & Barber", "#be185d"),
  category("Spa & Massage", "Spa & Massage", "#d946ef"),
  category("Fitness", "Fitness", "#2563eb", ["Fitness & Gym"]),
  category("Health", "Health", "#0f766e"),
  category("Pharmacy", "Pharmacy", "#059669"),
  category("Dental", "Dental", "#0891b2"),
  category("Pets", "Pets", "#b45309"),
  category("Electronics", "Electronics", "#0284c7"),
  category("Home & Furniture", "Home & Furniture", "#a16207"),
  category("Hardware & DIY", "Hardware & DIY", "#ca8a04"),
  category("Automotive", "Automotive", "#374151"),
  category("Hotels", "Hotels", "#d97706", ["Hotel"]),
  category("Travel", "Travel", "#06b6d4", ["Travel Services"]),
  category("Entertainment", "Entertainment", "#6d28d9"),
  category("Events", "Events", "#db2777"),
  category("Gaming", "Gaming", "#7c3aed"),
  category("Sports & Outdoors", "Sports & Outdoors", "#15803d"),
  category("Gifts", "Gifts", "#e11d48", ["Florist & Gifts"]),
  category("Books & Stationery", "Books & Stationery", "#0369a1"),
  category("Kids & Baby", "Kids & Baby", "#f472b6"),
  category("Education", "Education", "#eab308"),
  category("Repair Services", "Repair Services", "#64748b"),
  category("Cleaning Services", "Cleaning Services", "#0e7490"),
  category("Construction", "Construction", "#92400e", ["Construction & Trades"]),
  category("Real Estate", "Real Estate", "#4f46e5"),
  category("Professional Services", "Professional Services", "#1e3a8a"),
  category("Finance & Insurance", "Finance & Insurance", "#047857", ["Accounting & Finance"]),
  category("Photography", "Photography", "#9333ea"),
  category("Flowers & Garden", "Flowers & Garden", "#65a30d", ["Agriculture & Garden"]),
  category("Laundry & Dry Cleaning", "Laundry & Dry Cleaning", "#38bdf8"),
  category("Other", "Other", "#6b7280"),
];

// Legacy-only values keep their original marker/chip colors for existing records.
export const LEGACY_CATEGORY_COLORS = {
  Restaurant: "#dc2626",
  Cafe: "#8b5e34",
  Bar: "#7e22ce",
  Bakery: "#f97316",
  Grocery: "#166534",
  Clothing: "#ec4899",
  "Beauty & Spa": "#c026d3",
  "Fitness & Gym": "#2563eb",
  Health: "#0f766e",
  Hotel: "#d97706",
  Automotive: "#374151",
  Electronics: "#0284c7",
  "Home & Furniture": "#a16207",
  "Professional Services": "#1e3a8a",
  Education: "#ca8a04",
  Entertainment: "#6d28d9",
  Events: "#db2777",
  Optical: "#0369a1",
  "Fuel & Charging": "#4b5563",
  Nightlife: "#4338ca",
  Shopping: "#16a34a",
  "Coffee & Tea": "#92400e",
  "Fast Food": "#ea580c",
  Fashion: "#be185d",
  Shoes: "#4338ca",
  Pharmacy: "#059669",
  "Health & Wellness": "#0d9488",
  Pets: "#b45309",
  "Sports & Outdoors": "#15803d",
  "Jewelry & Accessories": "#a21caf",
  "Books & Stationery": "#0369a1",
  "Florist & Gifts": "#e11d48",
  "Toys & Games": "#7c3aed",
  "Laundry & Dry Cleaning": "#0891b2",
  "Travel Services": "#2563eb",
  "Real Estate": "#4f46e5",
  "Legal Services": "#334155",
  "Accounting & Finance": "#166534",
  "Construction & Trades": "#ca8a04",
  "Agriculture & Garden": "#65a30d",
  "Music & Arts": "#9333ea",
};

export const BUSINESS_CATEGORY_LABELS = BUSINESS_CATEGORIES.map((item) => item.value);

export function getBusinessCategoryConfig(value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("en");
  const canonical = BUSINESS_CATEGORIES.find(
    (item) => item.value.toLocaleLowerCase("en") === normalized || item.legacyValues.some((legacy) => legacy.toLocaleLowerCase("en") === normalized),
  );
  const legacyColor = Object.entries(LEGACY_CATEGORY_COLORS).find(
    ([legacy]) => legacy.toLocaleLowerCase("en") === normalized,
  )?.[1];
  if (canonical) return legacyColor ? { ...canonical, color: legacyColor } : canonical;
  return legacyColor
    ? { value, label: value, color: legacyColor, legacyValues: [] }
    : BUSINESS_CATEGORIES[BUSINESS_CATEGORIES.length - 1];
}

export function businessCategoryMatches(value, selectedValue) {
  const config = getBusinessCategoryConfig(value);
  return config.value === selectedValue || config.legacyValues.includes(value) || value === selectedValue;
}

export function isKnownBusinessCategory(value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("en");
  return BUSINESS_CATEGORIES.some(
    (item) => item.value.toLocaleLowerCase("en") === normalized || item.legacyValues.some((legacy) => legacy.toLocaleLowerCase("en") === normalized),
  ) || Object.keys(LEGACY_CATEGORY_COLORS).some((legacy) => legacy.toLocaleLowerCase("en") === normalized);
}
