/** Small UI helpers for customer pages. */

/** PUBLIC_INTERFACE */
export function formatMoney(cents, currency = "USD") {
  /** Format cents as a currency string. */
  const value = (Number(cents || 0) / 100).toFixed(2);
  // Keep it lightweight: don't rely on Intl currency formatting differences for now.
  return `${currency} ${value}`;
}

/** PUBLIC_INTERFACE */
export function statusLabel(status) {
  /** Human-friendly order status label. */
  switch (status) {
    case "CREATED":
      return "Cart created";
    case "PAID":
      return "Paid";
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_PICKUP":
      return "Ready for pickup";
    case "OUT_FOR_DELIVERY":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELED":
      return "Canceled";
    default:
      return status || "Unknown";
  }
}

