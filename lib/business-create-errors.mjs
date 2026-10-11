export const BUSINESS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BUSINESS_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateBusinessImage(file, field) {
  if (!file || (!file.name && file.size === 0)) return null;
  const label = field === "logo" ? "Logo image" : "Cover image";
  if (!file.size) return { field, message: `${label} is empty. Choose another image.` };
  if (!Object.hasOwn(BUSINESS_IMAGE_TYPES, file.type)) {
    return { field, message: `${label} format is not supported. Upload JPG, PNG, WebP or GIF.` };
  }
  if (file.size > BUSINESS_IMAGE_MAX_BYTES) {
    return { field, message: `${label} is too large. Maximum size: 5 MB.` };
  }
  return null;
}

export function businessInsertError(error, referenceId, responseStatus) {
  const status = Number(error?.status ?? responseStatus);
  if (status === 401 || error?.code === "PGRST301") {
    return { field: null, message: "Your session has expired. Please sign in again.", referenceId };
  }
  if (error?.code === "42501" || status === 403) {
    return { field: null, message: "We couldn't create this business because your account does not have permission.", referenceId };
  }
  const constraint = String(error?.message ?? "").match(/business_(?:name_length|category_length|city_length|latitude_range|longitude_range)/)?.[0];
  if (error?.code === "23514" && constraint) {
    if (constraint === "business_name_length") return { field: "name", message: "Business name must be 2 to 120 characters.", referenceId };
    if (constraint === "business_category_length") return { field: "category", message: "Choose a business category.", referenceId };
    if (constraint === "business_city_length") return { field: "city", message: "City must be 2 to 120 characters.", referenceId };
    return { field: "address", message: "Select a complete business address from the suggestions so customers can find you.", referenceId };
  }
  return {
    field: null,
    message: "We couldn't create your business. Please try again. If the problem continues, contact support.",
    referenceId,
  };
}

export function businessStorageError(error, field) {
  const status = Number(error?.statusCode ?? error?.status);
  if (status === 401) return { field, message: "Your session has expired. Please sign in again." };
  if (status === 403) return { field, message: "We couldn't upload this image because your account does not have permission." };
  const label = field === "logo" ? "logo" : "cover image";
  return { field, message: `Unable to upload your ${label}. Please try again.` };
}

export function logBusinessCreateInsertFailure(error, responseStatus) {
  const referenceId = crypto.randomUUID();
  const code = typeof error?.code === "string" && /^[A-Za-z0-9_]{2,32}$/.test(error.code) ? error.code : null;
  const rawStatus = Number(error?.statusCode ?? error?.status ?? responseStatus);
  const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : null;
  console.error("Business creation failed", {
    operation: "business_create_insert", code, status, referenceId, timestamp: new Date().toISOString(),
  });
  return referenceId;
}
