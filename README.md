# unitsdb

UnitsDB in TypeScript: typed access to the units database — units,
prefixes, dimensions, quantities, currencies — generated from
[unitsml/unitsdb](https://github.com/unitsml/unitsdb) releases.

The native replacement for the retired Opal-compiled `@unitsml/unitsdb`;
[the `unitsml-ts` stack](https://github.com/unitsml/unitsml-ts) consumes
this package for all unitsdb resolution.

## Installation

```sh
npm install unitsdb
```

This is an ES module package. Importing `Unitsdb` loads the bundled dataset
and builds its lookup indexes immediately; no separate data download or
initialization call is needed.

## Dataset provenance

`src/data/unitsdb.json` is generated from the unitsdb YAML releases by
`scripts/build-dataset.rb` (run it with unitsdb-ruby loadable;
`ruby scripts/build-dataset.rb DATA_DIR OUT` takes a unitsdb checkout,
`npm run dataset` copies the default output into place). The current
dataset is pinned to unitsdb commit `b210137` (unitsml/unitsdb#143; schema 2.2.0).

The generator refuses rather than guessing: every field the release
schema marks required must be present, loader errors abort the build, and
the YAML files must agree on one schema version. The dataset records its
own `provenance` — data repository/commit/tag/schema version, per-file
sha256 digests, generator digest and loader versions — exposed as
`Unitsdb.provenance`. The tests fail if the generator changes without the
dataset being regenerated.

Units carry the schema 2.2.0 fields `canonical_conversion` (exact
factor/offset strings and root units), `root_units`, `scale_reference`
and external `references`; the `scales` registry is bundled too.

## API

```ts
import { Unitsdb } from "unitsdb";

Unitsdb.findUnitBySymbolId("m");      // NISTu1 "metre"
Unitsdb.findUnitById("NISTu155");     // decibel
Unitsdb.findPrefixBySymbolName("k");  // kilo (base 10, power 3)
Unitsdb.findDimensionById("NISTd2");  // mass
Unitsdb.findDimensionByVector("::::::1:"); // mass exponent vector
Unitsdb.findQuantityById("q:frequency"); // resolves q: and NIST ids
Unitsdb.findCurrencyByCode("EUR");   // Euro
Unitsdb.findCurrencyByNumeric(978);  // Euro
```

Finders mirror the unitsml-ruby wrappers: units resolve through symbol
ids, identifiers are first-wins, dimension components keep the record's
own key order, and dimension vectors use the DIMS_VECTOR exponent order.

## Migrating from `@unitsml/unitsdb`

Replace the retired `@unitsml/unitsdb` dependency and import with `unitsdb`.
Use the exported `Unitsdb` object directly, without a `bundled()` call.
Use the current camelCase methods for lookups and search:

```ts
import { Unitsdb } from "unitsdb";

const euro = Unitsdb.findById("cur:EUR");
const matches = Unitsdb.search({ text: "Euro" });
const currencies = Unitsdb.search({ text: "Euro", type: "currencies" });
const euroSymbols = Unitsdb.findCurrenciesBySymbol("€");
const metre = Unitsdb.findUnitBySymbolId("m");
```

Single-record finders return `undefined` when no record matches. Search and
currency symbol lookups return arrays. Search matches identifiers and names
case-insensitively; currency symbols accept Unicode signs or ASCII codes
such as `EUR`. The currently bundled dataset contains 178 currency records,
available through `Unitsdb.currencies`.

## Dataset generation

`src/data/unitsdb.json` is generated from a unitsdb checkout's `data`
directory by `scripts/build-dataset.rb`, using the Ruby `unitsdb` library.
The script writes `/tmp/unitsdb-ts.json`; copy that file into
`src/data/unitsdb.json` to update the bundled dataset.

## Development

```sh
npm install
npm run build && npm test
npm run test:package
```

`test:package` builds and packs the package, installs the local tarball in
an isolated temporary consumer, and checks that its public API can read
the bundled data.
