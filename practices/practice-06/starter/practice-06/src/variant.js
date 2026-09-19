export const variantNumber = null;

const FILTERS_BY_VARIANT = Object.freeze({
  1: Object.freeze({ completed: false }),
  2: Object.freeze({ completed: true }),
  3: Object.freeze({ priority: "high" }),
  4: Object.freeze({ priority: "medium" }),
  5: Object.freeze({ categoryId: 1 }),
  6: Object.freeze({ categoryId: 2 }),
  7: Object.freeze({ q: "провер" }),
  8: Object.freeze({ completed: false, priority: "high", categoryId: 2 }),
});

export function getVariantFilters(number) {
  if (!Number.isInteger(number) || !FILTERS_BY_VARIANT[number]) {
    throw new RangeError("Номер варианта должен быть целым числом от 1 до 8.");
  }
  return { ...FILTERS_BY_VARIANT[number] };
}
