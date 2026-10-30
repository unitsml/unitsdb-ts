// UnitsDB data access for the unitsml model: finders and record
// accessors over the vendored dataset (built from unitsml/unitsdb
// releases; see data/README in the unitsdb repo for the schema).
import dataset from "./data/unitsdb.json" with { type: "json" };

export interface Identifier {
  type: string;
  id: string;
}
export interface LocalizedString {
  lang: string;
  value: string;
}
export interface UnitSymbol {
  id?: string;
  ascii?: string;
  unicode?: string;
  latex?: string;
  html?: string;
  mathml?: string;
}
export interface DerivedBase {
  unit_reference: { id: string };
  prefix_reference: { id: string } | null;
  power: string | number | null;
}
export interface QuantityReferenceRef {
  id: string;
  primary?: boolean;
}
export interface UnitRecord {
  identifiers?: Identifier[];
  names?: LocalizedString[];
  symbols?: UnitSymbol[];
  unit_system_reference?: Identifier[];
  si_derived_bases?: DerivedBase[];
  dimension_reference?: { id: string } | null;
  quantity_references?: QuantityReferenceRef[];
}
export interface PrefixRecord {
  identifiers?: Identifier[];
  names?: LocalizedString[];
  symbols?: UnitSymbol[];
  base?: number;
  power?: number;
}
export interface DimensionRecord {
  id: string | null;
  [component: string]: unknown;
}
export interface QuantityRecord {
  id: string | null;
  names?: LocalizedString[];
  dimension_reference?: { id: string } | null;
  quantityType?: string;
}
export interface CurrencySymbol {
  id?: string;
  ascii?: string;
  unicode?: string;
}
export interface CurrencyRecord {
  identifiers?: Identifier[];
  names?: LocalizedString[];
  symbols?: CurrencySymbol[];
  /** ISO 4217 "N.A." minor units are absent — the key is omitted, never 0. */
  minor_unit_exponent?: number;
  status?: string;
  unit_system_reference?: Identifier[];
  quantity_references?: QuantityReferenceRef[];
  notes?: string | null;
}

const units = dataset.units as UnitRecord[];
const prefixes = dataset.prefixes as PrefixRecord[];
const dimensions = dataset.dimensions as DimensionRecord[];
const quantities = dataset.quantities as QuantityRecord[];
const currencies = dataset.currencies as CurrencyRecord[];

const unitsBySymbolId = new Map<string, UnitRecord>();
for (const unit of units) {
  for (const symbol of unit.symbols ?? []) {
    if (symbol.id !== undefined && symbol.id !== null) {
      unitsBySymbolId.set(symbol.id, unit);
    }
  }
}
// Ruby find_first_through — FIRST record wins on identifier collisions.
const unitsByIdentifier = new Map<string, UnitRecord>();
for (const unit of units) {
  for (const identifier of unit.identifiers ?? []) {
    if (!unitsByIdentifier.has(identifier.id)) {
      unitsByIdentifier.set(identifier.id, unit);
    }
  }
}
const prefixesBySymbolName = new Map<string, PrefixRecord>();
for (const prefix of prefixes) {
  for (const symbol of prefix.symbols ?? []) {
    if (symbol.ascii) prefixesBySymbolName.set(symbol.ascii, prefix);
  }
}
const prefixesByIdentifier = new Map<string, PrefixRecord>();
for (const prefix of prefixes) {
  for (const identifier of prefix.identifiers ?? []) {
    if (!prefixesByIdentifier.has(identifier.id)) {
      prefixesByIdentifier.set(identifier.id, prefix);
    }
  }
}
const prefixSymbolNames: string[] = [...prefixesBySymbolName.keys()].sort(
  (a, b) => a.length - b.length,
);
const dimensionsById = new Map<string, DimensionRecord>();
for (const dim of dimensions) {
  if (dim.id) dimensionsById.set(dim.id, dim);
}
const quantitiesById = new Map<string, QuantityRecord>();
for (const quantity of quantities) {
  if (quantity.id) quantitiesById.set(quantity.id, quantity);
}
const quantitiesByIdentifier = new Map<string, QuantityRecord>();
for (const quantity of quantities) {
  for (const identifier of (quantity as unknown as { identifiers?: Identifier[] }).identifiers ?? []) {
    if (!quantitiesByIdentifier.has(identifier.id)) {
      quantitiesByIdentifier.set(identifier.id, quantity);
    }
  }
}
// Ruby find_first_through — FIRST record wins on identifier collisions.
const currenciesByCode = new Map<string, CurrencyRecord>();
for (const currency of currencies) {
  for (const identifier of currency.identifiers ?? []) {
    if (identifier.type === "iso4217" && !currenciesByCode.has(identifier.id)) {
      currenciesByCode.set(identifier.id, currency);
    }
  }
}
const currenciesByNumeric = new Map<string, CurrencyRecord>();
for (const currency of currencies) {
  for (const identifier of currency.identifiers ?? []) {
    if (
      identifier.type === "iso4217_numeric" &&
      !currenciesByNumeric.has(identifier.id)
    ) {
      currenciesByNumeric.set(identifier.id, currency);
    }
  }
}
function currencySymbolMatch(currency: CurrencyRecord, symbol: string): boolean {
  const needle = symbol.toLowerCase();
  return (currency.symbols ?? []).some(
    (sym) => sym.unicode === symbol || sym.ascii?.toLowerCase() === needle,
  );
}

export const Unitsdb = {
  units,

  /** unitsml-ruby `Unitsdb.units.find_by_symbol_id` */
  findUnitBySymbolId(symbolId: string): UnitRecord | undefined {
    return unitsBySymbolId.get(symbolId);
  },

  /** unitsml-ruby `Unitsdb.units.find_by_name` (via symbols) */
  findUnitByName(name: string): UnitRecord | undefined {
    return unitsBySymbolId.get(name);
  },

  /** unitsml-ruby `Unitsdb.units.find_by_id` (via identifiers) */
  findUnitById(id: string): UnitRecord | undefined {
    return unitsByIdentifier.get(id);
  },

  prefixes,

  /** unitsml-ruby `Unitsdb.prefixes.find_by_symbol_name` */
  findPrefixBySymbolName(ascii: string): PrefixRecord | undefined {
    return prefixesBySymbolName.get(ascii);
  },

  /** unitsml-ruby `Unitsdb.prefixes.find_by_id` */
  findPrefixById(id: string): PrefixRecord | undefined {
    return prefixesByIdentifier.get(id);
  },

  /** unitsml-ruby `Unitsdb.prefixes_array` (ascii symbols, length-sorted) */
  prefixSymbolNames(): string[] {
    return prefixSymbolNames;
  },

  dimensions,

  findDimensionById(id: string): DimensionRecord | undefined {
    return dimensionsById.get(id);
  },

  /** unitsml-ruby `Unitsdb.dimensions.find_by_vector` (exponent vector) */
  findDimensionByVector(vector: string): DimensionRecord | undefined {
    return dimensions.find((dim) => dimensionVector(dim) === vector);
  },

  quantities,

  findQuantityById(id: string): QuantityRecord | undefined {
    return quantitiesById.get(id) ?? quantitiesByIdentifier.get(id);
  },

  currencies,

  /** unitsml-ruby `Unitsdb.currencies.find_by_code` (case-insensitive alpha) */
  findCurrencyByCode(code: string): CurrencyRecord | undefined {
    return currenciesByCode.get(code.toUpperCase());
  },

  /** unitsml-ruby `Unitsdb.currencies.find_by_numeric` (3-digit, base-10) */
  findCurrencyByNumeric(numeric: string | number): CurrencyRecord | undefined {
    const parsed = Number.parseInt(String(numeric), 10);
    if (Number.isNaN(parsed)) return undefined;
    return currenciesByNumeric.get(String(parsed).padStart(3, "0"));
  },

  /** unitsml-ruby `Unitsdb.find_by_symbol(_, :currencies)` — unicode sign
   * (€, A$) or ascii alpha code (EUR, AUD), case-insensitive on ascii. */
  findCurrenciesBySymbol(symbol: string): CurrencyRecord[] {
    return currencies.filter((currency) => currencySymbolMatch(currency, symbol));
  },

  /** unitsml-ruby `Unitsdb.get_by_id` across collections (REQUIRED first,
   * OPTIONAL currencies last; first record wins on collisions). */
  findById(
    id: string,
    type?: string,
  ): UnitRecord | PrefixRecord | DimensionRecord | QuantityRecord | CurrencyRecord | undefined {
    const matchIdentifier = (
      record: { identifiers?: Identifier[] } | QuantityRecord,
    ): boolean =>
      ((record as { identifiers?: Identifier[] }).identifiers ?? []).some(
        (identifier) =>
          identifier.id === id && (type === undefined || identifier.type === type),
      );
    return (
      units.find(matchIdentifier) ??
      prefixes.find(matchIdentifier) ??
      dimensions.find((dim) => type === undefined && dim.id === id) ??
      quantities.find(matchIdentifier) ??
      currencies.find(matchIdentifier)
    );
  },

  /** unitsml-ruby `Unitsdb.search` — substring over identifiers and names. */
  search(
    params: { text?: string; type?: string },
  ): Array<UnitRecord | PrefixRecord | DimensionRecord | QuantityRecord | CurrencyRecord> {
    const text = params.text;
    if (!text) return [];
    const needle = text.toLowerCase();
    const scope = params.type ?? "all";
    const matchesText = (
      record: { identifiers?: Identifier[]; names?: LocalizedString[] } | QuantityRecord,
    ): boolean => {
      const identifiers = (record as { identifiers?: Identifier[] }).identifiers ?? [];
      return (
        identifiers.some((i) => i.id.toLowerCase().includes(needle)) ||
        (record.names ?? []).some((n) => n.value.toLowerCase().includes(needle))
      );
    };
    type ScopeRecord =
      UnitRecord | PrefixRecord | DimensionRecord | QuantityRecord | CurrencyRecord;
    const results: ScopeRecord[] = [];
    const push = <T extends ScopeRecord>(
      scopeName: string,
      records: T[],
      match: (record: T) => boolean,
    ): void => {
      if (scope !== "all" && scope !== scopeName) return;
      for (const record of records) if (match(record)) results.push(record);
    };
    push("units", units, matchesText);
    push("prefixes", prefixes, matchesText);
    push("dimensions", dimensions, (dim) =>
      typeof dim.id === "string" && dim.id.toLowerCase().includes(needle));
    push("quantities", quantities, matchesText);
    push("currencies", currencies, matchesText);
    return results;
  },
};

// DIMS_VECTOR order (unitsml-ruby Utility::DIMS_VECTOR) — the vector
// string fed to unitsdb dimension lookups depends on it.
const DIM_COMPONENT_KEYS = [
  "thermodynamic_temperature",
  "amount_of_substance",
  "luminous_intensity",
  "electric_current",
  "plane_angle",
  "length",
  "mass",
  "time",
];

/** The DIMS_VECTOR-ordered exponent string unitsml-ruby uses for lookups. */
export function dimensionVector(dim: DimensionRecord): string {
  return DIM_COMPONENT_KEYS.map((key) => {
    const component = dim[key] as { power?: unknown } | undefined;
    return component?.power ?? "";
  }).join(":");
}

/** Components in the RECORD's own key order (the unitsdb YAML order,
 * which is what unitsml-ruby's processed_keys preserves). */
export function dimensionComponents(
  dim: DimensionRecord,
): Array<[string, { symbol?: string; power?: unknown }]> {
  return Object.keys(dim)
    .filter((key) => key !== "id" && dim[key] !== undefined)
    .map((key) => [key, dim[key] as { symbol?: string; power?: unknown }]);
}

export function unitNistId(unit: UnitRecord): string | undefined {
  return unit.identifiers?.find((i) => i.type === "nist")?.id;
}

export function unitEnName(unit: UnitRecord): string | undefined {
  return unit.names?.find((n) => n.lang === "en")?.value;
}

export function prefixNistId(prefix: PrefixRecord): string | undefined {
  return prefix.identifiers?.find((i) => i.type === "nist")?.id;
}

export function prefixEnName(prefix: PrefixRecord): string | undefined {
  return prefix.names?.find((n) => n.lang === "en")?.value;
}
