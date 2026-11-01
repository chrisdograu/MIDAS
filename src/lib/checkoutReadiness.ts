export function checkoutReady(processing: boolean, couponLoading: boolean) {
  return !processing && !couponLoading;
}