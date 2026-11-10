# frozen_string_literal: true

# Projects a unitsml/unitsdb data release into src/data/unitsdb.json.
#
#   ruby scripts/build-dataset.rb [DATA_DIR] [OUT]
#
# DATA_DIR defaults to "data" (a checkout of github.com/unitsml/unitsdb at a
# release tag); OUT defaults to /tmp/unitsdb-ts.json (the `npm run dataset`
# path). Loading goes through unitsdb-ruby (Unitsdb::Database.from_db).
#
# The projection refuses instead of rescuing:
# * every field the data release schema (DATA_DIR/schemas/*-schema.yaml)
#   marks required on an entity must be present — a missing one aborts the
#   build naming the entity, never emitting a silent null;
# * a model accessor that raises aborts the build (no `rescue nil`);
# * the YAML files must agree on one schema_version.
#
# The output carries a `provenance` block — data commit/tag/schema version
# and per-file digests, generator digest and loader versions — so a consumer
# can tell exactly which release the bundled data is. Digests are sha256 of
# the file text with CRLF normalized to LF (the git blob content), so a
# Windows autocrlf checkout and a Linux checkout produce the same values. No
# timestamps: rebuilding the same inputs is byte-identical.
require "unitsdb"
require "json"
require "yaml"
require "digest"
require "open3"

DATA_DIR = ARGV[0] || "data"
OUT = ARGV[1] || "/tmp/unitsdb-ts.json"

class ProjectionError < StandardError; end

def text_digest(path)
  "sha256:#{Digest::SHA256.hexdigest(File.binread(path).gsub("\r\n", "\n"))}"
end

def git(*args)
  out, status = Open3.capture2e("git", "-C", DATA_DIR, *args)
  status.success? ? out.strip : nil
rescue SystemCallError
  nil
end

def schema_required(collection, entity)
  path = File.join(DATA_DIR, "schemas", "#{collection}-schema.yaml")
  raise ProjectionError, "missing schema #{path}" unless File.exist?(path)

  schema = YAML.safe_load_file(path, aliases: true)
  required = schema.dig("definitions", entity, "required")
  unless required.is_a?(Array)
    raise ProjectionError, "#{path}: no definitions/#{entity}/required list"
  end

  required.map(&:to_sym)
end

def label(record)
  ids = record.identifiers&.map { |i| "#{i.type}:#{i.id}" }
  ids.nil? || ids.empty? ? record.inspect[0, 80] : ids.join(",")
end

def absent?(value)
  value.nil? || (value.respond_to?(:empty?) && value.empty?)
end

def check_required!(collection, record, required)
  required.each do |field|
    unless record.respond_to?(field)
      raise ProjectionError,
            "#{collection}: loader model #{record.class} has no #{field} " \
            "accessor for schema-required field"
    end
    next unless absent?(record.public_send(field))

    raise ProjectionError,
          "#{collection} #{label(record)}: schema-required #{field} is missing"
  end
end

def ids(list) = list&.map { |i| { type: i.type, id: i.id } }
def names(list) = list&.map { |n| { lang: n.lang, value: n.value } }
def refs(list) = list&.map { |r| { type: r.type, authority: r.authority, uri: r.uri } }
def ref_id(ref) = ref && { id: ref.id }

def unit_ref_pair(item)
  { power: item.power,
    unit_reference: { id: item.unit_reference&.id },
    prefix_reference: ref_id(item.prefix_reference) }
end

db = Unitsdb::Database.from_db(DATA_DIR)

schema_versions = Dir[File.join(DATA_DIR, "*.yaml")].sort.to_h do |path|
  [File.basename(path), YAML.safe_load_file(path, aliases: true)["schema_version"]]
end
if schema_versions.values.uniq.size != 1
  raise ProjectionError, "schema_version disagreement: #{schema_versions.inspect}"
end
schema_version = schema_versions.values.first

unit_required = schema_required("units", "Unit")
units = db.units.map do |u|
  check_required!("units", u, unit_required)
  h = {
    identifiers: ids(u.identifiers),
    names: names(u.names),
    symbols: u.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode, latex: s.latex, html: s.html, mathml: s.mathml } },
    unit_system_reference: ids(u.unit_system_reference),
    si_derived_bases: u.si_derived_bases&.map { |b| { unit_reference: { id: b.unit_reference&.id }, prefix_reference: ref_id(b.prefix_reference), power: b.power } },
    dimension_reference: ref_id(u.dimension_reference),
    quantity_references: u.quantity_references&.map { |r| r.primary ? { id: r.id, primary: true } : { id: r.id } },
  }
  if (cc = u.canonical_conversion)
    if absent?(cc.factor) || absent?(cc.root_units)
      raise ProjectionError,
            "units #{label(u)}: canonical_conversion requires factor and root_units"
    end
    cch = { factor: cc.factor.to_s }
    cch[:offset] = cc.offset.to_s if cc.offset
    cch[:root_units] = cc.root_units.map { |r| unit_ref_pair(r).compact }
    h[:canonical_conversion] = cch
  end
  # Schema fields beyond the original projection (additive keys).
  h[:short] = u.short
  h[:root] = u.root
  h[:prefixed] = u.prefixed
  h[:root_units] = u.root_units&.map { |r| unit_ref_pair(r) }
  h[:scale_reference] = u.scale_reference && { type: u.scale_reference.type, id: u.scale_reference.id }
  h[:references] = refs(u.references)
  h
end

prefix_required = schema_required("prefixes", "Prefix")
prefixes = db.prefixes.map do |p|
  check_required!("prefixes", p, prefix_required)
  {
    identifiers: ids(p.identifiers),
    names: names(p.names),
    symbols: p.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode, latex: s.latex, html: s.html } },
    base: p.base, power: p.power,
    short: p.short,
    references: refs(p.references),
  }
end

dimension_required = schema_required("dimensions", "Dimension")
dimension_skip = %i[identifiers names references short dimensionless currency].freeze
dimensions = db.dimensions.map do |d|
  check_required!("dimensions", d, dimension_required)
  h = { id: d.identifiers.find { |i| i.type == "nist" }&.id }
  d.class.attributes.each_key do |key|
    next if dimension_skip.include?(key)

    v = d.public_send(key)
    next if v.nil?

    h[key.to_s] = {
      symbol: v.symbol,
      power: v.power,
      symbols: v.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode, latex: s.latex, html: s.html } },
    }
  end
  h
end

quantity_required = schema_required("quantities", "Quantity")
quantities = db.quantities.map do |q|
  check_required!("quantities", q, quantity_required)
  {
    id: (q.identifiers.find { |i| i.type == "nist" } || q.identifiers.first)&.id,
    identifiers: ids(q.identifiers),
    names: names(q.names),
    dimension_reference: ref_id(q.dimension_reference),
    quantity_type: q.quantity_type,
    equivalence_class: q.equivalence_class,
    unit_references: q.unit_references&.map { |r| { id: r.id } },
    short: q.short,
    references: refs(q.references),
  }
end

currency_required = schema_required("currencies", "Currency")
currencies = db.currencies.map do |c|
  check_required!("currencies", c, currency_required)
  h = {
    identifiers: ids(c.identifiers),
    names: names(c.names),
    symbols: c.symbols&.map { |s| { id: s.id, ascii: s.ascii, unicode: s.unicode } },
    status: c.status,
    unit_system_reference: ids(c.unit_system_reference),
    quantity_references: c.quantity_references&.map { |r| { id: r.id } },
    notes: c.notes,
  }
  # ISO 4217 "N.A." minor units are ABSENT, never 0 — omit the key entirely.
  h[:minor_unit_exponent] = c.minor_unit_exponent unless c.minor_unit_exponent.nil?
  h
end

# Scales are not a Unitsdb::Database collection; load the release file
# through the unitsdb-ruby Scales model so unit scale_reference ids resolve.
scale_required = schema_required("scales", "Scale")
scales_path = File.join(DATA_DIR, "scales.yaml")
raise ProjectionError, "missing #{scales_path}" unless File.exist?(scales_path)

scales = Unitsdb::Scales.from_yaml(File.read(scales_path, encoding: "utf-8")).scales.map do |s|
  check_required!("scales", s, scale_required)
  pr = s.properties
  {
    identifiers: ids(s.identifiers),
    names: names(s.names),
    short: s.short,
    properties: { continuous: pr.continuous, ordered: pr.ordered, logarithmic: pr.logarithmic, interval: pr.interval, ratio: pr.ratio },
    operations: s.operations,
  }
end

scale_ids = scales.flat_map { |s| s[:identifiers].map { |i| i[:id] } }
units.each do |u|
  sid = u.dig(:scale_reference, :id)
  next if scale_ids.include?(sid)

  raise ProjectionError,
        "units #{u[:identifiers].map { |i| i[:id] }.join(',')}: scale_reference " \
        "#{sid.inspect} is not in scales.yaml"
end

commit = ENV["UNITSDB_DATA_COMMIT"] || git("rev-parse", "HEAD")
unless commit&.match?(/\A\h{40}\z/)
  raise ProjectionError,
        "cannot establish the data commit of #{DATA_DIR}: use a git checkout " \
        "or set UNITSDB_DATA_COMMIT"
end
tag = ENV.key?("UNITSDB_DATA_TAG") ? ENV["UNITSDB_DATA_TAG"] : git("describe", "--tags", "--exact-match", "HEAD")

lutaml_version = Gem.loaded_specs["lutaml-model"]&.version&.to_s
unitsdb_version = Gem.loaded_specs["unitsdb"]&.version&.to_s || Unitsdb::VERSION

provenance = {
  data: {
    repository: "https://github.com/unitsml/unitsdb",
    commit: commit,
    tag: tag.nil? || tag.empty? ? nil : tag,
    schema_version: schema_version,
    files: Dir[File.join(DATA_DIR, "*.yaml")].sort.to_h { |p| [File.basename(p), text_digest(p)] },
    schemas: Dir[File.join(DATA_DIR, "schemas", "*.yaml")].sort.to_h { |p| [File.basename(p), text_digest(p)] },
  },
  generator: {
    script: "scripts/build-dataset.rb",
    script_digest: text_digest(__FILE__),
    unitsdb_ruby: unitsdb_version,
    lutaml_model: lutaml_version,
  },
  counts: { units: units.size, prefixes: prefixes.size, dimensions: dimensions.size,
            quantities: quantities.size, currencies: currencies.size, scales: scales.size },
}

File.write(OUT, JSON.generate({ units: units, prefixes: prefixes, dimensions: dimensions,
                                quantities: quantities, currencies: currencies,
                                scales: scales, provenance: provenance }))
puts provenance[:counts].map { |k, v| "#{k}=#{v}" }.join(" ")
