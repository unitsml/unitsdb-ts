import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Unitsdb, unitNistId } from "../src/index.ts";

test("the dataset records the unitsdb release and generator it came from", () => {
  const { provenance } = Unitsdb;
  assert.equal(provenance.data.repository, "https://github.com/unitsml/unitsdb");
  assert.match(provenance.data.commit, /^[0-9a-f]{40}$/);
  assert.equal(provenance.data.schema_version, "2.2.0");
  assert.equal(provenance.data.tag, "v2.2.0");
  for (const file of ["units.yaml", "prefixes.yaml", "scales.yaml"]) {
    assert.match(provenance.data.files[file], /^sha256:[0-9a-f]{64}$/);
  }
  assert.equal(provenance.counts.units, Unitsdb.units.length);
  assert.equal(provenance.counts.scales, Unitsdb.scales.length);
  // The committed dataset must be regenerated whenever the generator changes.
  const script = readFileSync(new URL("../scripts/build-dataset.rb", import.meta.url), "utf8")
    .replace(/\r\n/g, "\n");
  assert.equal(
    provenance.generator.script_digest,
    `sha256:${createHash("sha256").update(script).digest("hex")}`,
  );
  const helpers = readFileSync(new URL("../scripts/projection-helpers.rb", import.meta.url), "utf8")
    .replace(/\r\n/g, "\n");
  assert.equal(
    provenance.generator.helper_digest,
    `sha256:${createHash("sha256").update(helpers).digest("hex")}`,
  );
});

test("units carry schema 2.2.0 conversion, scale and reference fields", () => {
  const degC = Unitsdb.findUnitById("NISTu23")!;
  assert.deepEqual(degC.canonical_conversion, {
    factor: "1",
    offset: "273.15",
    root_units: [{ power: 1, unit_reference: { id: "NISTu5" } }],
  });
  assert.equal(degC.scale_reference?.id, "continuous_interval");
  const scale = Unitsdb.unitScale(degC)!;
  assert.equal(scale.properties.interval, true);
  assert.equal(scale.properties.ratio, false);
  assert.ok(!scale.operations?.includes("multiplication"));
  assert.equal(
    Unitsdb.findUnitByReferenceUri("http://si-digital-framework.org/SI/units/degreeCelsius"),
    degC,
  );
  assert.equal(Unitsdb.findUnitByReferenceUri("http://example.invalid/none"), undefined);
  assert.equal(Unitsdb.findScaleById("s:continuous_ratio"), Unitsdb.findScaleById("continuous_ratio"));
});

test("every unit scale_reference resolves and every unit has a scale", () => {
  for (const unit of Unitsdb.units) {
    assert.ok(Unitsdb.unitScale(unit), `unresolved scale for ${unitNistId(unit)}`);
  }
});
