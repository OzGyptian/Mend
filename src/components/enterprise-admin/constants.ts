export const RESOURCE_CATEGORIES = ['Labour', 'Plant', 'Material', 'Subcontractor', 'Sundries', 'Staff'];

export const RESOURCE_UNITS = [
  // International
  'm', 'm2', 'm3', 'ton', 'kg', 'no', 'item', 'hour', 'week', 'month',
  // American
  'ft', 'ft2', 'ft3', 'lb', 'gal', 'yd', 'yd2', 'yd3', 'in', 'in2', 'in3'
];

export const getAvailableUnits = (category: string): string[] => {
  if (category === 'Labour' || category === 'Plant') {
    return ['hour', 'week', 'month', 'no', 'item'];
  }
  return RESOURCE_UNITS;
};
