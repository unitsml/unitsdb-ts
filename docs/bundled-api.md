# Bundled database access

Install the native `unitsdb` package and import its public API:

```sh
npm install unitsdb
```

```ts
import { Unitsdb } from "unitsdb";

const db = Unitsdb.bundled();
const metre = db.getById("NISTu1");
const euro = db.getById("cur:EUR");
const euroMatches = db.search("Euro");
const euroSymbols = db.findBySymbol("€", "currencies");
const metreSymbols = db.findBySymbol("m", "units");
```

The dataset is included in the package and loaded on import.
`Unitsdb.bundled()` returns that same database object on every call.

`getById(id, identifierType?)` returns the first matching record or
`undefined`. It aliases `findById`; the optional type is an identifier
namespace such as `iso4217`, rather than a collection name.

`findBySymbol(symbol, collection?)` returns an array in units, prefixes,
then currencies order. Units and prefixes match ASCII symbols without
case sensitivity. Currencies also match their exact Unicode sign. The
optional collection is `units`, `prefixes`, or `currencies`; other values
throw `RangeError`. A missing symbol returns an empty array.

`search(text, collection?)` accepts the text form documented by the retired
`@unitsml/unitsdb` package. The existing `search({ text, type })` form and
typed finders remain available. These examples use the native `unitsdb`
package name; the retired package is not changed.
