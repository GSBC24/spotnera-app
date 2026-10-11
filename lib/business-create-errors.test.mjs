import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { businessInsertError, businessStorageError, logBusinessCreateInsertFailure, validateBusinessImage } from "./business-create-errors.mjs";

const owner = readFileSync(new URL("../app/owner/page.js", import.meta.url), "utf8");
const address = readFileSync(new URL("../app/owner/address-autocomplete.js", import.meta.url), "utf8");
const form = readFileSync(new URL("../components/business-create-form.js", import.meta.url), "utf8");
const analytics = readFileSync(new URL("../components/owner-analytics.js", import.meta.url), "utf8");
const create = owner.split("async function createBusiness(_previousState, formData) {")[1]?.split("async function updateBusiness(")[0];

test("image validation matches the live 5 MB bucket and names the offending image", () => {
  const valid = { name: "photo.png", type: "image/png", size: 1024 };
  assert.equal(validateBusinessImage(valid, "logo"), null);
  assert.equal(validateBusinessImage({ ...valid, type: "image/gif" }, "cover"), null);
  assert.equal(validateBusinessImage({ ...valid, type: "image/heic" }, "logo")?.message,
    "Logo image format is not supported. Upload JPG, PNG, WebP or GIF.");
  assert.equal(validateBusinessImage({ ...valid, size: 5 * 1024 * 1024 + 1 }, "cover")?.message,
    "Cover image is too large. Maximum size: 5 MB.");
  assert.equal(validateBusinessImage({ ...valid, size: 0 }, "logo")?.field, "logo");
  assert.equal(validateBusinessImage({ name: "", size: 0 }, "logo"), null);
});

test("known insert failures have actionable messages without exposing SQL details", () => {
  assert.match(businessInsertError({ code: "42501", message: "private SQL" }).message, /permission/);
  assert.match(businessInsertError({ status: 401 }).message, /session has expired/);
  assert.equal(businessInsertError({ code: "23514", message: "business_latitude_range" }).field, "address");
  assert.equal(businessInsertError({ code: "23514", message: "business_name_length" }).field, "name");
  assert.equal(businessInsertError({ code: "23505", message: "businesses_slug_key" }).message,
    "We couldn't create your business. Please try again. If the problem continues, contact support.");
  assert.doesNotMatch(businessInsertError({ code: "XX000", message: "secret database detail" }).message, /secret|SQL|slug/);
});

test("storage failures identify the image and distinguish permission from temporary errors", () => {
  assert.match(businessStorageError({ statusCode: "403" }, "logo").message, /permission/);
  assert.match(businessStorageError({ statusCode: "401" }, "cover").message, /session has expired/);
  assert.equal(businessStorageError({ message: "private storage path" }, "cover").message,
    "Unable to upload your cover image. Please try again.");
});

test("production insert diagnostics record only safe fields and correlate with the browser reference", () => {
  const original = console.error;
  const calls = [];
  let referenceId;
  try {
    console.error = (...args) => calls.push(args);
    referenceId = logBusinessCreateInsertFailure({
      code: "42501", message: "private owner email", details: "private address",
    }, 403);
  } finally {
    console.error = original;
  }
  assert.match(referenceId, /^[0-9a-f-]{36}$/);
  assert.equal(calls[0][0], "Business creation failed");
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ["code", "operation", "referenceId", "status", "timestamp"]);
  assert.equal(calls[0][1].operation, "business_create_insert");
  assert.equal(calls[0][1].code, "42501");
  assert.equal(calls[0][1].status, 403);
  assert.equal(calls[0][1].referenceId, referenceId);
  assert.match(calls[0][1].timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(businessInsertError({ code: "XX000" }, referenceId).referenceId, referenceId);
  assert.equal(businessInsertError({ code: "bad_jwt" }, referenceId, 401).message,
    "Your session has expired. Please sign in again.");
  assert.doesNotMatch(JSON.stringify(calls), /private owner email|private address/);
});

test("creation validates before insert, retains form state on known failures, and redirects only on success", () => {
  assert.ok(create);
  assert.ok(create.indexOf("validateBusinessIssue(payload") < create.indexOf('.insert(getBusinessSavePayload(payload))'));
  assert.ok(create.indexOf("validateBusinessImage(getImageFile") < create.indexOf('.insert(getBusinessSavePayload(payload))'));
  assert.match(create, /if \(authError \|\| !user\)/);
  assert.ok(create.indexOf("if (!canCreateBusiness(businessCount))") < create.indexOf('.insert(getBusinessSavePayload(payload))'));
  assert.match(create, /if \(countError \|\| businessCount === null\)/);
  assert.match(create, /return \{ field: null, message: BUSINESS_LIMIT_MESSAGE \}/);
  assert.match(create, /isFreeBusinessLimitError\(error\)/);
  assert.match(create, /if \(error\) \{\s+const referenceId = logBusinessCreateInsertFailure\(error, status\)/);
  assert.match(create, /return businessInsertError\(error, referenceId, status\)/);
  assert.match(create, /businessStorageError\(uploaded\.error\.technicalError, uploaded\.error\.field\)/);
  assert.match(create, /compensateFailedOpeningHoursCreate/);
  assert.match(create, /businessCreated=1/);
  assert.match(form, /useActionState\(action/);
  assert.match(form, /BusinessCreateFieldError/);
  assert.match(form, /optionalFieldError/);
  assert.match(owner, /<BusinessCreateDetails defaultOpen=/);
  assert.match(form, /\.focus\(\)/);
  assert.match(analytics, /preventDuplicateSubmissions && submissionLockRef\.current/);
  assert.match(form, /preserveOnAction/);
  assert.match(analytics, /onReset=\{preserveOnAction \? \(event\) => event\.preventDefault\(\)/);
  assert.match(owner, /pendingLabel="Creating business/);
});

test("existing Mapbox address selection and coordinate checks remain intact", () => {
  assert.match(address, /name="selected_address" value=\{selectedAddress\}/);
  assert.match(address, /name="latitude" value=\{latitude\}/);
  assert.match(address, /name="longitude" value=\{longitude\}/);
  assert.match(owner, /payload\.address !== payload\.selected_address/);
  assert.match(owner, /payload\.latitude === null \|\| payload\.longitude === null/);
});
