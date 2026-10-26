import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Unitsdb,
  dimensionVector,
  dimensionComponents,
  unitNistId,
  unitEnName,
  prefixNistId,
  prefixEnName,
} from "../src/index.ts";

test("the dataset loads with expected collection sizes", () => {
  assert.ok(Unitsdb.units.length > 300);
  assert.ok(Unitsdb.prefixes.length > 20);
  assert.ok(Unitsdb.dimensions.length > 50);
  assert.ok(Unitsdb.quantities.length > 100);
});

test("units resolve by symbol id, name and identifier", () => {
  const meter = Unitsdb.findUnitBySymbolId("m");
  assert.equal(unitNistId(meter!), "NISTu1");
  assert.equal(unitEnName(meter!), "metre");
  assert.equal(Unitsdb.findUnitByName("m"), meter);
  assert.equal(Unitsdb.findUnitById("NISTu1"), meter);
});

test("prefixes resolve by symbol name and identifier", () => {
  const kilo = Unitsdb.findPrefixBySymbolName("k");
  assert.equal(kilo?.base, 10);
  assert.equal(kilo?.power, 3);
  assert.equal(prefixNistId(kilo!), "NISTp10_3");
  assert.equal(prefixEnName(kilo!), "kilo");
  assert.equal(Unitsdb.findPrefixById("NISTp10_3"), kilo);
});

test("prefixSymbolNames is length-sorted for longest-match consumers", () => {
  const names = Unitsdb.prefixSymbolNames();
  for (let i = 1; i < names.length; i += 1) {
    assert.ok(names[i - 1].length <= names[i].length);
  }
  assert.ok(names.includes("k") && names.includes("M") && names.includes("a"));
});

test("dimensions resolve by id, vector and parsable symbol", () => {
  const mass = Unitsdb.findDimensionById("NISTd2");
  assert.ok(mass);
  assert.equal(dimensionVector(mass), "::::::1:");
  const viaVector = Unitsdb.findDimensionByVector("::::::1:");
  assert.ok(viaVector);
  const components = dimensionComponents(mass);
  assert.equal(components[0][0], "mass");
  assert.equal(components[0][1].symbol, "M");
});

test("quantities resolve by nist and unitsml identifiers", () => {
  const frequency = Unitsdb.findQuantityById("q:frequency");
  assert.equal(frequency?.id, "NISTq45");
  assert.ok(frequency?.names?.some((n) => n.lang === "en" && n.value === "frequency"));
});
