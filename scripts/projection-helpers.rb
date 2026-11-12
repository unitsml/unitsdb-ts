# frozen_string_literal: true

# Pure record projections shared by scripts/build-dataset.rb and its controls
# (test/projection-controls.rb). No unitsdb or database access here.

# A quantity reference keeps its primary flag exactly as the source states it:
# `primary: true` and `primary: false` are both emitted, and an absent flag
# stays absent. Consumers distinguish a sole unflagged reference (inferred
# primary) from one explicitly marked false (never promoted).
def quantity_reference(ref)
  projected = { id: ref.id }
  projected[:primary] = ref.primary unless ref.primary.nil?
  projected
end
