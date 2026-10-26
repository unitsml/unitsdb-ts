# unitsdb

UnitsDB in TypeScript: typed access to the units database — units,
prefixes, dimensions, quantities — rebuilt from
[unitsml/unitsdb](https://github.com/unitsml/unitsdb) releases.

The native replacement for the retired Opal-compiled `@unitsml/unitsdb`;
[the `unitsml-ts` stack](https://github.com/unitsml/unitsml-ts) consumes
this package for all unitsdb resolution.

## Dataset provenance

`src/data/unitsdb.json` is generated from the unitsdb YAML releases by
`scripts/build-dataset.rb` (run it from a unitsdb-ruby checkout;
`npm run dataset` copies the result into place). The dataset version
tracks the unitsdb data tags — current: unitsdb v2.0.2.

## API

```ts
import { Unitsdb } from "unitsdb";

Unitsdb.findUnitBySymbolId("m");      // NISTu1 "meter"
Unitsdb.findUnitById("NISTu155");     // decibel
Unitsdb.findPrefixBySymbolName("k");  // kilo (base 10, power 3)
Unitsdb.findDimensionById("NISTd2");  // mass
Unitsdb.findDimensionByVector("1");   // vector-string lookup
Unitsdb.findQuantityById("q:frequency"); // resolves q: and NIST ids
```

Finders mirror the unitsml-ruby wrappers: units resolve through symbol
ids, identifiers are first-wins, dimension components keep the record's
own key order, and dimension vectors use the DIMS_VECTOR exponent order.

## Development

```sh
npm install
npm run build && npm test
```
