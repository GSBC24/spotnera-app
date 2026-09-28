export const OWNER_SECTIONS = ["overview", "businesses", "deals", "analytics", "reviews"];

export function ownerSectionHref(section, parameters = {}) {
  const activeSection = OWNER_SECTIONS.includes(section) ? section : "overview";
  const query = new URLSearchParams({ section: activeSection });
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  return `/owner?${query.toString()}`;
}
