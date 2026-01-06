import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCart } from "../../customer/CartContext";
import {
  getRestaurantApi,
  listMenuItemsApi,
  listMenusByRestaurantApi,
  listRestaurantsApi
} from "../../api/customer";
import { formatMoney } from "../../customer/format";

/**
 * Customer browse page:
 * - List restaurants (search + city filter)
 * - Select a restaurant -> show menus -> show items
 * - Add items to local cart (persisted) and link to Cart page
 */

// PUBLIC_INTERFACE
export function CustomerBrowsePage() {
  const { getToken } = useAuth();
  const { cart, setRestaurant, addItem } = useCart();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedRestaurantId = searchParams.get("restaurant") || "";
  const selectedMenuId = searchParams.get("menu") || "";

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");

  const [restaurants, setRestaurants] = useState([]);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [restaurantError, setRestaurantError] = useState("");

  const [restaurantDetail, setRestaurantDetail] = useState(null);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const cartCount = useMemo(
    () => Object.values(cart.items || {}).reduce((sum, x) => sum + (x.quantity || 0), 0),
    [cart.items]
  );

  // Load restaurant list
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setRestaurantLoading(true);
      setRestaurantError("");
      try {
        const res = await listRestaurantsApi({ q: q || null, city: city || null, limit: 50, offset: 0 }, getToken);
        if (!cancelled) setRestaurants(Array.isArray(res) ? res : []);
      } catch (err) {
        if (!cancelled) setRestaurantError(err?.message || "Failed to load restaurants.");
      } finally {
        if (!cancelled) setRestaurantLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [q, city, getToken]);

  // Load restaurant detail + menus + default menu items
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedRestaurantId) {
        setRestaurantDetail(null);
        setMenus([]);
        setMenuItems([]);
        setDetailError("");
        return;
      }
      setDetailLoading(true);
      setDetailError("");
      try {
        const [r, m] = await Promise.all([
          getRestaurantApi(selectedRestaurantId, getToken),
          listMenusByRestaurantApi(selectedRestaurantId, {}, getToken)
        ]);

        if (cancelled) return;
        setRestaurantDetail(r);
        setMenus(Array.isArray(m) ? m : []);

        // Sync cart's restaurant selection for downstream checkout.
        setRestaurant(selectedRestaurantId, r?.name || null);

        const defaultMenuId = selectedMenuId || (Array.isArray(m) && m[0]?.id) || "";
        if (defaultMenuId) {
          const items = await listMenuItemsApi(selectedRestaurantId, defaultMenuId, {}, getToken);
          if (!cancelled) {
            setMenuItems(Array.isArray(items) ? items : []);
            // Ensure URL includes menu selection (for refresh shareability)
            if (!selectedMenuId) {
              const next = new URLSearchParams(searchParams);
              next.set("menu", defaultMenuId);
              setSearchParams(next, { replace: true });
            }
          }
        } else {
          setMenuItems([]);
        }
      } catch (err) {
        if (!cancelled) setDetailError(err?.message || "Failed to load restaurant details.");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurantId, selectedMenuId, getToken]);

  async function onSelectMenu(menuId) {
    if (!selectedRestaurantId) return;
    const next = new URLSearchParams(searchParams);
    next.set("restaurant", selectedRestaurantId);
    next.set("menu", menuId);
    setSearchParams(next);

    setDetailLoading(true);
    setDetailError("");
    try {
      const items = await listMenuItemsApi(selectedRestaurantId, menuId, {}, getToken);
      setMenuItems(Array.isArray(items) ? items : []);
    } catch (err) {
      setDetailError(err?.message || "Failed to load menu items.");
    } finally {
      setDetailLoading(false);
    }
  }

  function onPickRestaurant(r) {
    const next = new URLSearchParams(searchParams);
    next.set("restaurant", r.id);
    next.delete("menu");
    setSearchParams(next);
  }

  function applyFilters(e) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (q) next.set("q", q);
    else next.delete("q");
    if (city) next.set("city", city);
    else next.delete("city");
    // keep restaurant/menu selection
    setSearchParams(next);
  }

  return (
    <div className="ui-grid2" style={{ alignItems: "start" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Browse Restaurants</h2>
            <p className="ui-cardSub">Search by name or city, then view menus and add items.</p>
          </div>
          <button
            className="ui-btn ui-btnGhost"
            onClick={() => navigate("/customer/cart")}
            title="Go to cart"
          >
            Cart ({cartCount})
          </button>
        </div>

        <form className="ui-form" onSubmit={applyFilters}>
          <div className="ui-grid2">
            <div>
              <div className="ui-label">Search</div>
              <input
                className="ui-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Sushi, Pizza…"
              />
            </div>
            <div>
              <div className="ui-label">City</div>
              <input
                className="ui-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. San Francisco"
              />
            </div>
          </div>
          <button className="ui-btn ui-btnPrimary" type="submit">
            Apply
          </button>
        </form>

        {restaurantError ? (
          <div className="ui-alert" role="alert" style={{ marginTop: 12 }}>
            {restaurantError}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {restaurantLoading ? (
            <p className="ui-help" style={{ margin: 0 }}>
              Loading restaurants…
            </p>
          ) : restaurants.length === 0 ? (
            <p className="ui-help" style={{ margin: 0 }}>
              No restaurants found. Try adjusting filters.
            </p>
          ) : (
            restaurants.map((r) => {
              const isSelected = r.id === selectedRestaurantId;
              return (
                <button
                  key={r.id}
                  className="ui-btn"
                  onClick={() => onPickRestaurant(r)}
                  style={{
                    textAlign: "left",
                    background: isSelected ? "rgba(59,130,246,0.08)" : "var(--surface)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name}
                      </div>
                      <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                        {(r.city || "City unknown") + (r.description ? ` · ${r.description}` : "")}
                      </div>
                    </div>
                    <span className="ui-badge">View</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Restaurant Details</h2>
            <p className="ui-cardSub">
              {selectedRestaurantId ? "Choose a menu and add items to your cart." : "Select a restaurant on the left."}
            </p>
          </div>
          {selectedRestaurantId ? (
            <button className="ui-btn ui-btnGhost" onClick={() => navigate("/customer/cart")}>
              Checkout
            </button>
          ) : null}
        </div>

        {detailError ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {detailError}
          </div>
        ) : null}

        {!selectedRestaurantId ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Tip: start with a restaurant, then add items to the cart.
          </p>
        ) : detailLoading && !restaurantDetail ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Loading details…
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{restaurantDetail?.name}</div>
              <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                {restaurantDetail?.address_line1 ? `${restaurantDetail.address_line1}, ` : ""}
                {restaurantDetail?.city || ""} {restaurantDetail?.state || ""}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {(menus || []).map((m) => {
                const active = m.id === selectedMenuId || (!selectedMenuId && m.id === menus?.[0]?.id);
                return (
                  <button
                    key={m.id}
                    className={`ui-btn ${active ? "ui-btnPrimary" : "ui-btnGhost"}`}
                    onClick={() => onSelectMenu(m.id)}
                    type="button"
                    style={{ boxShadow: "none" }}
                  >
                    {m.name}
                  </button>
                );
              })}
              {menus.length === 0 ? <span className="ui-badge">No menus</span> : null}
            </div>

            {detailLoading && restaurantDetail ? (
              <p className="ui-help" style={{ margin: 0 }}>
                Loading menu items…
              </p>
            ) : menuItems.length === 0 ? (
              <p className="ui-help" style={{ margin: 0 }}>
                No items found in this menu.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {menuItems.map((it) => (
                  <div
                    key={it.id}
                    className="ui-card"
                    style={{
                      padding: 12,
                      background: "linear-gradient(180deg, var(--surface) 0%, rgba(59,130,246,0.03) 100%)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900 }}>{it.name}</div>
                        <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                          {it.description || "—"}
                        </div>
                        <div className="ui-help" style={{ margin: "6px 0 0 0", fontWeight: 800 }}>
                          {formatMoney(it.price_cents, it.currency)}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <button
                          className="ui-btn ui-btnPrimary"
                          onClick={() => {
                            // Ensure cart restaurant stays consistent
                            setRestaurant(selectedRestaurantId, restaurantDetail?.name || null);
                            addItem(it, 1);
                          }}
                        >
                          Add
                        </button>
                        <button className="ui-btn ui-btnGhost" onClick={() => navigate("/customer/cart")}>
                          View cart
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

