# unitsdb

UnitsDB in TypeScript: typed access to the units database — units,
prefixes, dimensions, quantities — rebuilt from
[unitsml/unitsdb](https://github.com/unitsml/unitsdb) releases.

The native replacement for the retired Opal-compiled `@unitsml/unitsdb`;
[the `unitsml-ts` stack](https://github.com/unitsml/unitsml-ts) consumes
this package for all unitsdb resolution.

## Dataset provenance

`src/data/unitsdb.json` is generated from the unitsdb YAML releases by
`scripts/build-dataset.rb` (run it with unitsdb-ruby loadable;
`ruby scripts/build-dataset.rb DATA_DIR OUT` takes a unitsdb checkout,
`npm run dataset` copies the default output into place). The current
dataset is unitsdb **v2.2.0** (commit `c2c7d181`, schema 2.2.0).

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

Unitsdb.findUnitBySymbolId("m");      // NISTu1 "meter"
Unitsdb.findUnitById("NISTu155");     // decibel
Unitsdb.findPrefixBySymbolName("k");  // kilo (base 10, power 3)
Unitsdb.findDimensionById("NISTd2");  // mass
Unitsdb.findDimensionByVector("1");   // vector-string lookup
Unitsdb.findQuantityById("q:frequency"); // resolves q: and NIST ids
Unitsdb.findUnitByReferenceUri("http://si-digital-framework.org/SI/units/degreeCelsius"); // NISTu23
Unitsdb.unitScale(Unitsdb.findUnitById("NISTu23")!); // continuous interval scale
Unitsdb.provenance.data.tag;          // "v2.2.0"
```

Finders mirror the unitsml-ruby wrappers: units resolve through symbol
ids, identifiers are first-wins, dimension components keep the record's
own key order, and dimension vectors use the DIMS_VECTOR exponent order.

## Development

```sh
npm install
npm run build && npm test
```
