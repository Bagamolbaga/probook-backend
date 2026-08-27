export const getIntervalSlots = (rangeSlots: number[]) => {
  const sortedSlots = [...new Set(rangeSlots)].sort(
    (left, right) => left - right,
  );
  return sortedSlots.length > 1 ? sortedSlots.slice(0, -1) : [];
};
