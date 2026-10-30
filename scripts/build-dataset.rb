require "unitsdb"
require "json"
db = Unitsdb::Database.from_db("data")

def safe(&) = (yield rescue nil)

units = db.units.map do |u|
  h = {
    identifiers: safe { u.identifiers&.map { |i| { type: i.type, id: i.id } } },
    names: safe { u.names&.map { |n| { lang: n.lang, value: n.value } } },
    symbols: safe { u.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode, latex: s.latex, html: s.html, mathml: s.mathml } } },
    unit_system_reference: safe { u.unit_system_reference&.map { |r| { type: r.type, id: r.id } } },
    si_derived_bases: safe { u.si_derived_bases&.map { |b| { unit_reference: { id: b.unit_reference&.id }, prefix_reference: (b.prefix_reference && { id: b.prefix_reference&.id }), power: b.power } } },
    dimension_reference: safe { u.dimension_reference && { id: u.dimension_reference.id } },
    quantity_references: safe { u.quantity_references&.map { |r| r.respond_to?(:primary) && r.primary ? { id: r.id, primary: true } : { id: r.id } } },
  }
  # Schema 2.2.0: canonical conversion data (factor/offset exact rationals +
  # root decomposition) — the #130/#134 register content.
  if u.respond_to?(:canonical_conversion) && u.canonical_conversion
    cc = u.canonical_conversion
    cch = { factor: cc.factor&.to_s }
    cch[:offset] = cc.offset&.to_s if cc.respond_to?(:offset) && cc.offset
    ru = cc.respond_to?(:root_units) ? cc.root_units : nil
    if ru&.any?
      cch[:root_units] = ru.map do |r|
        { power: r.power,
          unit_reference: { id: r.unit_reference&.id },
          prefix_reference: (r.respond_to?(:prefix_reference) && r.prefix_reference ? { id: r.prefix_reference&.id } : nil) }.compact
      end
    end
    h[:canonical_conversion] = cch
  end
  h
end

prefixes = db.prefixes.map do |p|
  {
    identifiers: safe { p.identifiers&.map { |i| { type: i.type, id: i.id } } },
    names: safe { p.names&.map { |n| { lang: n.lang, value: n.value } } },
    symbols: safe { p.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode, latex: s.latex, html: s.html } } },
    base: p.base, power: p.power,
  }
end

DIM_KEYS = %i[length mass time electric_current thermodynamic_temperature
              amount_of_substance luminous_intensity plane_angle currency
              dimensionless].freeze
dimensions = db.dimensions.map do |d|
  h = { id: safe { d.identifiers&.find { |i| i.type == "nist" }&.id } }
  skip = %i[identifiers names references short dimensionless currency].freeze
  d.class.attributes.keys.each do |key|
    next if skip.include?(key)
    v = safe { d.public_send(key) }
    next if v.nil?
    h[key.to_s] = {
      symbol: safe { v.symbol },
      power: safe { v.power },
      symbols: safe { v.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode, latex: s.latex, html: s.html } } },
    }
  end
  h
end

quantities = db.quantities.map do |q|
  {
    id: safe { (q.identifiers&.find { |i| i.type == "nist" } || q.identifiers&.first)&.id },
    identifiers: safe { q.identifiers&.map { |i| { type: i.type, id: i.id } } },
    names: safe { q.names&.map { |n| { lang: n.lang, value: n.value } } },
    dimension_reference: safe { q.dimension_reference && { id: q.dimension_reference.id } },
    quantity_type: safe { q.quantity_type },
    equivalence_class: (q.respond_to?(:equivalence_class) && q.equivalence_class) || nil,
    unit_references: safe { q.unit_references&.map { |r| { id: r.id } } },
  }
end

currencies = db.currencies.map do |c|
  h = {
    identifiers: safe { c.identifiers&.map { |i| { type: i.type, id: i.id } } },
    names: safe { c.names&.map { |n| { lang: n.lang, value: n.value } } },
    symbols: safe { c.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode } } },
    status: safe { c.status },
    unit_system_reference: safe { c.unit_system_reference&.map { |r| { type: r.type, id: r.id } } },
    quantity_references: safe { c.quantity_references&.map { |r| { id: r.id } } },
    notes: safe { c.notes },
  }
  # ISO 4217 "N.A." minor units are ABSENT, never 0 — omit the key entirely.
  h[:minor_unit_exponent] = c.minor_unit_exponent unless c.minor_unit_exponent.nil?
  h
end

File.write("/tmp/unitsdb-ts.json", JSON.generate({ units: units, prefixes: prefixes, dimensions: dimensions, quantities: quantities, currencies: currencies }))
puts "units=#{units.size} prefixes=#{prefixes.size} dimensions=#{dimensions.size} quantities=#{quantities.size} currencies=#{currencies.size}"
