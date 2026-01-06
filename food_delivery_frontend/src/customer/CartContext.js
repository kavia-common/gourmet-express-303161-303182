import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "gourmet_express_customer_cart_v1";

const CartContext = createContext(null);

function readStoredCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredCart(cart) {
  try {
    if (!cart) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // ignore
  }
}

/**
 * Cart shape:
 * {
 *   restaurantId: string | null,
 *   restaurantName: string | null,
 *   // items keyed by menu_item_id
 *   items: {
 *     [menuItemId]: { id, name, price_cents, currency, quantity }
 *   }
 * }
 */
function buildEmptyCart() {
  return { restaurantId: null, restaurantName: null, items: {} };
}

/** PUBLIC_INTERFACE */
export function CartProvider({ children }) {
  /** Provide customer cart state persisted in localStorage. */
  const [cart, setCart] = useState(() => readStoredCart() || buildEmptyCart());

  useEffect(() => {
    writeStoredCart(cart);
  }, [cart]);

  const resetCart = useCallback(() => setCart(buildEmptyCart()), []);

  const setRestaurant = useCallback((restaurantId, restaurantName = null) => {
    setCart((prev) => {
      // If switching restaurant, clear items to avoid cross-restaurant carts.
      if (prev.restaurantId && prev.restaurantId !== restaurantId) {
        return { restaurantId, restaurantName, items: {} };
      }
      return { ...prev, restaurantId, restaurantName: restaurantName ?? prev.restaurantName };
    });
  }, []);

  const addItem = useCallback((menuItem, quantityDelta = 1) => {
    setCart((prev) => {
      const next = { ...prev, items: { ...prev.items } };
      const existing = next.items[menuItem.id];
      const nextQty = (existing?.quantity || 0) + quantityDelta;
      if (nextQty <= 0) {
        delete next.items[menuItem.id];
      } else {
        next.items[menuItem.id] = {
          id: menuItem.id,
          name: menuItem.name,
          price_cents: menuItem.price_cents,
          currency: menuItem.currency || "USD",
          quantity: nextQty
        };
      }
      return next;
    });
  }, []);

  const setItemQuantity = useCallback((menuItem, quantity) => {
    setCart((prev) => {
      const next = { ...prev, items: { ...prev.items } };
      if (quantity <= 0) {
        delete next.items[menuItem.id];
      } else {
        next.items[menuItem.id] = {
          id: menuItem.id,
          name: menuItem.name,
          price_cents: menuItem.price_cents,
          currency: menuItem.currency || "USD",
          quantity
        };
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((menuItemId) => {
    setCart((prev) => {
      const next = { ...prev, items: { ...prev.items } };
      delete next.items[menuItemId];
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    const itemsArr = Object.values(cart.items || {});
    const subtotal_cents = itemsArr.reduce((sum, x) => sum + (x.price_cents || 0) * (x.quantity || 0), 0);
    // Backend computes delivery fee; use a small UI placeholder for preview only.
    const estimated_delivery_fee_cents = subtotal_cents > 0 ? 299 : 0;
    const estimated_total_cents = subtotal_cents + estimated_delivery_fee_cents;
    const currency = itemsArr.find((x) => x.currency)?.currency || "USD";
    return { subtotal_cents, estimated_delivery_fee_cents, estimated_total_cents, currency };
  }, [cart.items]);

  const value = useMemo(
    () => ({
      cart,
      setRestaurant,
      addItem,
      setItemQuantity,
      removeItem,
      resetCart,
      totals
    }),
    [cart, setRestaurant, addItem, setItemQuantity, removeItem, resetCart, totals]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** PUBLIC_INTERFACE */
export function useCart() {
  /** Hook to access CartContext. */
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider.");
  return ctx;
}

