import assert from "node:assert/strict";
import { test } from "node:test";
import {
  copyBusinessAddress,
  getBusinessAddressLines,
  getBusinessDirectionsUrl,
  getCopyableBusinessAddress,
} from "./business-address.mjs";

test("address composition uses stored parts without empty or duplicate fragments", () => {
  assert.deepEqual(getBusinessAddressLines({ address: " Storgata 1 ", city: "Oslo", country: "Norway" }), ["Storgata 1", "Oslo, Norway"]);
  assert.equal(getCopyableBusinessAddress({ address: "Storgata 1, Oslo", city: "Oslo", country: "Norway" }), "Storgata 1, Oslo, Norway");
  assert.equal(getCopyableBusinessAddress({ address: "Storgata 1, 0155 Oslo, Norway", city: "Oslo", country: "Norway" }), "Storgata 1, 0155 Oslo, Norway");
  assert.deepEqual(getBusinessAddressLines({ city: "Oslo", country: "Norway" }), ["Oslo, Norway"]);
  assert.equal(getCopyableBusinessAddress({ city: "Oslo", country: "Norway" }), "");
  assert.equal(getCopyableBusinessAddress({}), "");
});

test("directions prefer real business coordinates and never use a fallback location", () => {
  assert.match(getBusinessDirectionsUrl({ latitude: 58.97, longitude: 5.73 }), /destination=58\.97%2C5\.73$/);
  assert.match(getBusinessDirectionsUrl({ address: "Storgata 1", city: "Oslo" }), /destination=Storgata%201%2C%20Oslo$/);
  assert.equal(getBusinessDirectionsUrl({ city: "Oslo" }), null);
});

test("copy uses secure clipboard, then safe selection fallback when unavailable or denied", async () => {
  let copied = "";
  const clipboard = { writeText: async (value) => { copied = value; } };
  assert.equal(await copyBusinessAddress("Storgata 1", { clipboard, secureContext: true }), true);
  assert.equal(copied, "Storgata 1");

  const events = [];
  const previousFocus = { focus: () => events.push("restored") };
  const field = { style: {}, focus: () => events.push("focused"), select: () => events.push("selected"), remove: () => events.push("removed") };
  const documentRef = {
    activeElement: previousFocus,
    body: { appendChild: () => events.push("added") },
    createElement: () => field,
    execCommand: (command) => { events.push(command); return true; },
  };
  assert.equal(await copyBusinessAddress("Storgata 1", { clipboard: { writeText: async () => { throw Error("denied"); } }, documentRef, secureContext: true }), true);
  assert.equal(field.value, "Storgata 1");
  assert.deepEqual(events, ["added", "focused", "selected", "copy", "removed", "restored"]);
  assert.equal(await copyBusinessAddress("", { documentRef, secureContext: false }), false);
  assert.equal(await copyBusinessAddress("Storgata 1", { documentRef: {}, secureContext: false }), false);
  assert.equal(await copyBusinessAddress("Storgata 1", {
    documentRef: { ...documentRef, execCommand: () => false }, secureContext: false,
  }), false);
  assert.equal(await copyBusinessAddress("Storgata 1", {
    documentRef: { ...documentRef, createElement: () => { throw Error("blocked"); } }, secureContext: false,
  }), false);
});
