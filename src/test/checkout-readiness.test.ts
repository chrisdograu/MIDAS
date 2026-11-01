import { describe, expect, it } from 'vitest';
import { checkoutReady } from '@/lib/checkoutReadiness';

describe('Checkout with a settled coupon', () => {
  it('blocks purchase while the coupon is still being validated', () => {
    expect(checkoutReady(false, true)).toBe(false);
  });
  it('allows purchase without a coupon once no validation is pending', () => {
    expect(checkoutReady(false, false)).toBe(true);
  });
  it('blocks a second purchase while the first is processing', () => {
    expect(checkoutReady(true, false)).toBe(false);
  });
});