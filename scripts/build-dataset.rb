require "unitsdb"
require "json"
db = Unitsdb::Database.from_db("data")

def safe(&) = (yield rescue nil)

units = db.units.map do |u|
  {
    identifiers: safe { u.identifiers&.map { |i| { type: i.type, id: i.id } } },
    names: safe { u.names&.map { |n| { lang: n.lang, value: n.value } } },
    symbols: safe { u.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode, latex: s.latex, html: s.html, mathml: s.mathml } } },
    unit_system_reference: safe { u.unit_system_reference&.map { |r| { type: r.type, id: r.id } } },
    si_derived_bases: safe { u.si_derived_bases&.map { |b| { unit_reference: { id: b.unit_reference&.id }, prefix_reference: (b.prefix_reference && { id: b.prefix_reference&.id }), power: b.power } } },
    dimension_reference: safe { u.dimension_reference && { id: u.dimension_reference.id } },
    quantity_references: safe { u.quantity_references&.map { |r| { id: r.id } } },
  }
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
    unit_references: safe { q.unit_references&.map { |r| { id: r.id } } },
  }
end

File.write("/tmp/unitsdb-ts.json", JSON.generate({ units: units, prefixes: prefixes, dimensions: dimensions, quantities: quantities }))
puts "units=#{units.size} prefixes=#{prefixes.size} dimensions=#{dimensions.size} quantities=#{quantities.size}"
