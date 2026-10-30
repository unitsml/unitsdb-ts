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
  type CurrencyRecord,
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

test("the dataset carries all 178 ISO 4217 currencies", () => {
  assert.equal(Unitsdb.currencies.length, 178);
});

test("currencies resolve by code, numeric identifier and unitsml id", () => {
  const euro = Unitsdb.findCurrencyByCode("eur");
  assert.equal(unitEnName(euro as never), "Euro");
  assert.equal(
    euro?.identifiers?.find((i) => i.type === "iso4217_numeric")?.id,
    "978",
  );
  assert.equal(Unitsdb.findCurrencyByCode("EUR"), euro);
  assert.equal(Unitsdb.findCurrencyByNumeric(978), euro);
  assert.equal(Unitsdb.findCurrencyByNumeric("978"), euro);
  // Leading-zero numeric codes are decimals, not octal.
  const aud = Unitsdb.findCurrencyByNumeric("036");
  assert.equal(aud?.identifiers?.find((i) => i.type === "iso4217")?.id, "AUD");
  assert.equal(Unitsdb.findCurrencyByNumeric("nope"), undefined);
  const byId = Unitsdb.findById("cur:EUR");
  assert.equal(byId, euro);
  assert.equal(Unitsdb.findById("EUR", "iso4217"), euro);
});

test("currencies resolve by unicode sign and ascii code", () => {
  const euro = Unitsdb.findCurrencyByCode("EUR");
  assert.deepEqual(Unitsdb.findCurrenciesBySymbol("€"), [euro]);
  assert.ok(Unitsdb.findCurrenciesBySymbol("eur").includes(euro));
  assert.ok(Unitsdb.findCurrenciesBySymbol("A$").length > 0);
  assert.deepEqual(Unitsdb.findCurrenciesBySymbol("£").length > 0, true);
});

test("minor units: 0 is a value, N.A. is absent — never conflated", () => {
  const kmf = Unitsdb.findCurrencyByCode("KMF");
  assert.equal(kmf?.minor_unit_exponent, 0);
  const absent = Unitsdb.currencies.filter(
    (currency) => currency.minor_unit_exponent === undefined,
  );
  assert.equal(absent.length, 13);
  assert.ok(absent.every((currency) => currency.minor_unit_exponent !== 0));
});

test("currencies are denominations: no conversion factors exist", () => {
  for (const currency of Unitsdb.currencies) {
    assert.equal("si_derived_bases" in currency, false);
    assert.equal("canonical_conversion" in currency, false);
    assert.equal("root_units" in currency, false);
  }
});

test("search spans identifiers and names across collections", () => {
  assert.ok(Unitsdb.search({ text: "Euro" }).includes(Unitsdb.findCurrencyByCode("EUR")));
  assert.ok(Unitsdb.search({ text: "euro" }).length > 0);
  const scoped = Unitsdb.search({ text: "Euro", type: "currencies" });
  assert.ok(scoped.every((record) => (record as CurrencyRecord).status !== undefined));
});

