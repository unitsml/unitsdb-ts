import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check with npm run test:package");

const workspace = mkdtempSync(join(tmpdir(), "unitsdb-package-"));
try {
  const packed = JSON.parse(execFileSync(process.execPath, [npm, "pack",
    "--ignore-scripts", "--json", "--pack-destination", workspace], {
    cwd: root, encoding: "utf8",
  }));
  const consumer = join(workspace, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    private: true, type: "module",
  }));
  execFileSync(process.execPath, [npm, "install", "--offline",
    "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false",
    join(workspace, packed[0].filename)], { cwd: consumer, stdio: "pipe" });
  writeFileSync(join(consumer, "smoke.mjs"), `
import assert from "node:assert/strict";
import { Unitsdb } from "unitsdb";

const metre = Unitsdb.findById("NISTu1");
assert.ok(metre, "the packed package must contain the units dataset");
assert.equal(Unitsdb.findUnitBySymbolId("m"), metre);
const euro = Unitsdb.findById("cur:EUR");
assert.ok(euro, "the packed package must contain the currencies dataset");
assert.equal(Unitsdb.currencies.length, 178);
assert.equal(Unitsdb.findCurrencyByCode("EUR"), euro);
assert.equal(Unitsdb.findCurrencyByNumeric("978"), euro);
assert.equal(euro.minor_unit_exponent, 2);
assert.ok(Unitsdb.search({ text: "Euro" }).includes(euro));
assert.ok(Unitsdb.findCurrenciesBySymbol("€").includes(euro));
console.log("Packed unitsdb: unit lookup, EUR, 178 currencies, search and symbols passed");
`);
  execFileSync(process.execPath, [join(consumer, "smoke.mjs")], {
    cwd: consumer, stdio: "inherit",
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
