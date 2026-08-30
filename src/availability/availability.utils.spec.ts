import { getIntervalSlots } from './availability.utils';

describe('getIntervalSlots', () => {
  it('keeps the end boundary available after a break', () => {
    expect(getIntervalSlots([52, 53, 54, 55, 56])).toEqual([52, 53, 54, 55]);
  });

  it('does not turn a zero-length boundary range into an occupied interval', () => {
    expect(getIntervalSlots([56])).toEqual([]);
  });
});
