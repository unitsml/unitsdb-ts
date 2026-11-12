# frozen_string_literal: true

# Projection controls for quantity reference primary flags: true, false and
# missing must survive projection exactly. Run: ruby test/projection-controls.rb
require "minitest/autorun"
require_relative "../scripts/projection-helpers"

QuantityRef = Struct.new(:id, :primary, keyword_init: true)

class ProjectionControls < Minitest::Test
  def test_true_flag_is_kept
    assert_equal({ id: "NISTq17", primary: true }, quantity_reference(QuantityRef.new(id: "NISTq17", primary: true)))
  end

  def test_false_flag_is_kept
    assert_equal({ id: "NISTq17", primary: false }, quantity_reference(QuantityRef.new(id: "NISTq17", primary: false)))
  end

  def test_missing_flag_stays_absent
    projected = quantity_reference(QuantityRef.new(id: "NISTq17", primary: nil))
    assert_equal({ id: "NISTq17" }, projected)
    refute projected.key?(:primary)
  end
end
