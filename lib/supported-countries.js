export const SUPPORTED_COUNTRIES = [
  { code: "NO", name: "Norway" },
];

export const SUPPORTED_COUNTRY_NAMES = SUPPORTED_COUNTRIES.map(
  (country) => country.name,
);

export const DEFAULT_SUPPORTED_COUNTRY = SUPPORTED_COUNTRIES[0] ?? null;
export const HAS_MULTIPLE_SUPPORTED_COUNTRIES = SUPPORTED_COUNTRIES.length > 1;

export function isSupportedCountry(countryName) {
  return SUPPORTED_COUNTRY_NAMES.includes(String(countryName ?? "").trim());
}
