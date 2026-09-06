function getEnvValue(key, fallback = "") {
  return process.env[key]?.trim() || fallback;
}

export const legalConfig = {
  brandName: "Spotnera",
  legalEntityName: getEnvValue("NEXT_PUBLIC_LEGAL_ENTITY_NAME", "Bergendahl Services"),
  organizationNumber: getEnvValue("NEXT_PUBLIC_ORG_NUMBER"),
  country: getEnvValue("NEXT_PUBLIC_LEGAL_COUNTRY", "Norway"),
  privacyContactEmail: getEnvValue("NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL"),
  legalContactEmail: getEnvValue("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL"),
};

export function getOperatorSentence() {
  return `${legalConfig.brandName} is a service operated by ${legalConfig.legalEntityName}.`;
}

export function getSoleProprietorshipSentence() {
  return `${legalConfig.legalEntityName} is a Norwegian sole proprietorship (enkeltpersonforetak).`;
}
