import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  createMenuApi,
  createMenuItemApi,
  deleteMenuApi,
  deleteMenuItemApi,
  listMenuItemsApi,
  listMenusByRestaurantApi,
  listRestaurantsApi,
  updateMenuApi,
  updateMenuItemApi
} from "../../api/restaurant";
import { formatMoney } from "../../customer/format";

function normalizeError(err) {
  return err?.message || "Request failed.";
}

function sortByName(a, b) {
  return String(a?.name || "").localeCompare(String(b?.name || ""));
}

function canEditMenu(menu) {
  // Backend enforces permissions; UI just provides guardrails.
  return Boolean(menu?.id);
}

function itemAvailabilityLabel(isAvailable) {
  return isAvailable ? "Available" : "Unavailable";
}

/**
 * PUBLIC_INTERFACE
 * Restaurant Menu Management
 * - Select restaurant (if multiple)
 * - CRUD menus for that restaurant
 * - CRUD menu items for selected menu
 */
export function RestaurantMenuManagementPage() {
  const { getToken, user } = useAuth();

  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");

  const [menus, setMenus] = useState([]);
  const [menuId, setMenuId] = useState("");

  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState({ restaurants: true, menus: false, items: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Menu create form
  const [menuForm, setMenuForm] = useState({ name: "", description: "", is_active: true });
  // Menu update form (for selected menu)
  const [menuEditForm, setMenuEditForm] = useState({ name: "", description: "", is_active: true });

  // Item create form
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    price_cents: "",
    currency: "USD",
    image_url: "",
    is_available: true
  });

  const selectedRestaurant = useMemo(
    () => restaurants.find((r) => r.id === restaurantId) || null,
    [restaurants, restaurantId]
  );
  const selectedMenu = useMemo(() => menus.find((m) => m.id === menuId) || null, [menus, menuId]);

  // Load restaurants the user can manage.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading((p) => ({ ...p, restaurants: true }));
      setError("");
      try {
        const res = await listRestaurantsApi({ include_inactive: true, limit: 200, offset: 0 }, getToken);
        const list = Array.isArray(res) ? res.slice() : [];
        list.sort(sortByName);

        if (cancelled) return;
        setRestaurants(list);

        // Default to the first restaurant if none selected.
        if (!restaurantId && list.length > 0) {
          setRestaurantId(list[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(normalizeError(err));
      } finally {
        if (!cancelled) setLoading((p) => ({ ...p, restaurants: false }));
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  // Load menus when restaurant changes.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!restaurantId) {
        setMenus([]);
        setMenuId("");
        setItems([]);
        return;
      }

      setLoading((p) => ({ ...p, menus: true }));
      setError("");
      try {
        const res = await listMenusByRestaurantApi(restaurantId, { include_inactive: true }, getToken);
        const list = Array.isArray(res) ? res.slice() : [];
        list.sort(sortByName);

        if (cancelled) return;

        setMenus(list);

        // Keep current menu selection if still present, else select first.
        const stillThere = list.some((m) => m.id === menuId);
        const nextMenuId = stillThere ? menuId : list[0]?.id || "";
        setMenuId(nextMenuId);

        // Update menu edit form from selection.
        const m = list.find((x) => x.id === nextMenuId) || null;
        if (m) {
          setMenuEditForm({
            name: m.name || "",
            description: m.description || "",
            is_active: Boolean(m.is_active)
          });
        } else {
          setMenuEditForm({ name: "", description: "", is_active: true });
        }
      } catch (err) {
        if (!cancelled) setError(normalizeError(err));
      } finally {
        if (!cancelled) setLoading((p) => ({ ...p, menus: false }));
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, getToken]);

  // Load items when menu changes.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!restaurantId || !menuId) {
        setItems([]);
        return;
      }
      setLoading((p) => ({ ...p, items: true }));
      setError("");
      try {
        const res = await listMenuItemsApi(restaurantId, menuId, { include_unavailable: true }, getToken);
        const list = Array.isArray(res) ? res.slice() : [];
        list.sort(sortByName);

        if (!cancelled) setItems(list);
      } catch (err) {
        if (!cancelled) setError(normalizeError(err));
      } finally {
        if (!cancelled) setLoading((p) => ({ ...p, items: false }));
      }
    }

    run();
  }, [restaurantId, menuId, getToken]);

  function flashNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 1500);
  }

  async function onCreateMenu(e) {
    e.preventDefault();
    if (!restaurantId) return;

    setError("");
    try {
      const created = await createMenuApi(
        restaurantId,
        {
          name: menuForm.name.trim(),
          description: menuForm.description.trim() || null,
          is_active: Boolean(menuForm.is_active)
        },
        getToken
      );
      flashNotice(`Menu created: ${created?.name || "New menu"}`);
      setMenuForm({ name: "", description: "", is_active: true });

      // Reload menus and select created.
      const res = await listMenusByRestaurantApi(restaurantId, { include_inactive: true }, getToken);
      const list = Array.isArray(res) ? res.slice() : [];
      list.sort(sortByName);
      setMenus(list);
      if (created?.id) setMenuId(created.id);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function onUpdateMenu(e) {
    e.preventDefault();
    if (!restaurantId || !menuId) return;

    setError("");
    try {
      const updated = await updateMenuApi(
        restaurantId,
        menuId,
        {
          name: menuEditForm.name.trim() || null,
          description: menuEditForm.description.trim() || null,
          is_active: Boolean(menuEditForm.is_active)
        },
        getToken
      );
      flashNotice(`Menu updated: ${updated?.name || "Menu"}`);

      // Reload menus to reflect changes.
      const res = await listMenusByRestaurantApi(restaurantId, { include_inactive: true }, getToken);
      const list = Array.isArray(res) ? res.slice() : [];
      list.sort(sortByName);
      setMenus(list);

      const m = list.find((x) => x.id === menuId) || null;
      if (m) {
        setMenuEditForm({
          name: m.name || "",
          description: m.description || "",
          is_active: Boolean(m.is_active)
        });
      }
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function onDeleteMenu() {
    if (!restaurantId || !menuId) return;
    // Keep it lightweight; use confirm() to prevent accidental deletes.
    // eslint-disable-next-line no-alert
    const ok = window.confirm("Delete this menu? This cannot be undone.");
    if (!ok) return;

    setError("");
    try {
      await deleteMenuApi(restaurantId, menuId, getToken);
      flashNotice("Menu deleted.");

      const res = await listMenusByRestaurantApi(restaurantId, { include_inactive: true }, getToken);
      const list = Array.isArray(res) ? res.slice() : [];
      list.sort(sortByName);
      setMenus(list);
      setMenuId(list[0]?.id || "");
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function onCreateItem(e) {
    e.preventDefault();
    if (!restaurantId || !menuId) return;

    setError("");
    try {
      const priceCents = Number(itemForm.price_cents);
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        setError("Price must be a non-negative number (cents).");
        return;
      }

      const created = await createMenuItemApi(
        restaurantId,
        menuId,
        {
          name: itemForm.name.trim(),
          description: itemForm.description.trim() || null,
          price_cents: Math.trunc(priceCents),
          currency: itemForm.currency.trim() || "USD",
          image_url: itemForm.image_url.trim() || null,
          is_available: Boolean(itemForm.is_available)
        },
        getToken
      );

      flashNotice(`Item created: ${created?.name || "New item"}`);
      setItemForm({
        name: "",
        description: "",
        price_cents: "",
        currency: "USD",
        image_url: "",
        is_available: true
      });

      const res = await listMenuItemsApi(restaurantId, menuId, { include_unavailable: true }, getToken);
      const list = Array.isArray(res) ? res.slice() : [];
      list.sort(sortByName);
      setItems(list);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function onToggleItemAvailability(item) {
    if (!restaurantId || !menuId || !item?.id) return;
    setError("");
    try {
      const updated = await updateMenuItemApi(
        restaurantId,
        menuId,
        item.id,
        { is_available: !Boolean(item.is_available) },
        getToken
      );
      flashNotice(`${updated?.name || "Item"} set to ${itemAvailabilityLabel(Boolean(updated?.is_available))}.`);

      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, is_available: updated?.is_available } : x))
      );
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function onQuickEditItem(item) {
    if (!restaurantId || !menuId || !item?.id) return;

    const nextName = window.prompt("Item name:", item.name || ""); // eslint-disable-line no-alert
    if (nextName === null) return;

    const nextPrice = window.prompt("Price (cents):", String(item.price_cents ?? "")); // eslint-disable-line no-alert
    if (nextPrice === null) return;

    const priceCents = Number(nextPrice);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError("Price must be a non-negative number (cents).");
      return;
    }

    setError("");
    try {
      const updated = await updateMenuItemApi(
        restaurantId,
        menuId,
        item.id,
        { name: nextName.trim() || null, price_cents: Math.trunc(priceCents) },
        getToken
      );
      flashNotice(`Item updated: ${updated?.name || "Item"}`);

      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, name: updated?.name ?? x.name, price_cents: updated?.price_cents ?? x.price_cents } : x
        )
      );
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function onDeleteItem(item) {
    if (!restaurantId || !menuId || !item?.id) return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm(`Delete item "${item.name}"? This cannot be undone.`);
    if (!ok) return;

    setError("");
    try {
      await deleteMenuItemApi(restaurantId, menuId, item.id, getToken);
      flashNotice("Item deleted.");
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="ui-grid2" style={{ alignItems: "start" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Menus</h2>
            <p className="ui-cardSub">Create and manage menus for your restaurant.</p>
          </div>
          <span className="ui-badge" title="Signed-in user">
            {user?.email || "—"}
          </span>
        </div>

        {error ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className="ui-alert"
            role="status"
            style={{ marginBottom: 12, borderColor: "rgba(6,182,212,0.30)", background: "rgba(6,182,212,0.10)" }}
          >
            {notice}
          </div>
        ) : null}

        <div className="ui-form">
          <div>
            <div className="ui-label">Restaurant</div>
            {loading.restaurants ? (
              <p className="ui-help" style={{ margin: "6px 0 0 0" }}>
                Loading restaurants…
              </p>
            ) : restaurants.length === 0 ? (
              <div className="ui-alert" role="alert">
                No restaurants available for this account. Ask an admin to create/assign a restaurant to your user.
              </div>
            ) : (
              <select
                className="ui-input"
                value={restaurantId}
                onChange={(e) => {
                  setRestaurantId(e.target.value);
                  setMenuId("");
                  setItems([]);
                }}
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.city ? `· ${r.city}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="ui-label">Select menu</div>
            {loading.menus ? (
              <p className="ui-help" style={{ margin: "6px 0 0 0" }}>
                Loading menus…
              </p>
            ) : menus.length === 0 ? (
              <p className="ui-help" style={{ margin: "6px 0 0 0" }}>
                No menus yet. Create your first menu below.
              </p>
            ) : (
              <select
                className="ui-input"
                value={menuId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setMenuId(nextId);
                  const m = menus.find((x) => x.id === nextId) || null;
                  if (m) {
                    setMenuEditForm({ name: m.name || "", description: m.description || "", is_active: Boolean(m.is_active) });
                  }
                }}
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.is_active ? "" : "· (inactive)"}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="ui-grid2" style={{ marginTop: 14 }}>
          <div className="ui-card" style={{ padding: 12, background: "var(--surface-2)" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Create menu</div>
            <form className="ui-form" onSubmit={onCreateMenu}>
              <div>
                <div className="ui-label">Name</div>
                <input
                  className="ui-input"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Lunch Specials"
                  required
                />
              </div>

              <div>
                <div className="ui-label">Description (optional)</div>
                <input
                  className="ui-input"
                  value={menuForm.description}
                  onChange={(e) => setMenuForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Short description"
                />
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={menuForm.is_active}
                  onChange={(e) => setMenuForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <span className="ui-help" style={{ margin: 0 }}>
                  Active (visible to customers)
                </span>
              </label>

              <button className="ui-btn ui-btnPrimary" type="submit" disabled={!restaurantId}>
                Create menu
              </button>
            </form>
          </div>

          <div className="ui-card" style={{ padding: 12, background: "var(--surface-2)" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Edit selected menu</div>

            {!selectedMenu ? (
              <p className="ui-help" style={{ margin: 0 }}>
                Select a menu to edit.
              </p>
            ) : (
              <form className="ui-form" onSubmit={onUpdateMenu}>
                <div>
                  <div className="ui-label">Name</div>
                  <input
                    className="ui-input"
                    value={menuEditForm.name}
                    onChange={(e) => setMenuEditForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <div className="ui-label">Description</div>
                  <input
                    className="ui-input"
                    value={menuEditForm.description}
                    onChange={(e) => setMenuEditForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={menuEditForm.is_active}
                    onChange={(e) => setMenuEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                  />
                  <span className="ui-help" style={{ margin: 0 }}>
                    Active
                  </span>
                </label>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="ui-btn ui-btnPrimary" type="submit" disabled={!canEditMenu(selectedMenu)}>
                    Save changes
                  </button>
                  <button className="ui-btn" type="button" onClick={onDeleteMenu}>
                    Delete menu
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <p className="ui-help" style={{ margin: 0 }}>
            Selected:{" "}
            <strong>{selectedRestaurant?.name ? `${selectedRestaurant.name}` : "—"}</strong>{" "}
            {selectedMenu?.name ? `· Menu: ${selectedMenu.name}` : ""}
          </p>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Menu Items</h2>
            <p className="ui-cardSub">Add, edit, and toggle availability for items in the selected menu.</p>
          </div>
          {selectedMenu ? <span className="ui-badge">Menu: {selectedMenu.name}</span> : <span className="ui-badge">No menu</span>}
        </div>

        {!restaurantId ? (
          <div className="ui-alert" role="alert">
            Select a restaurant first.
          </div>
        ) : !menuId ? (
          <div className="ui-alert" role="alert">
            Create or select a menu to manage items.
          </div>
        ) : (
          <>
            <div className="ui-card" style={{ padding: 12, background: "var(--surface-2)", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Create item</div>
              <form className="ui-form" onSubmit={onCreateItem}>
                <div className="ui-grid2">
                  <div>
                    <div className="ui-label">Name</div>
                    <input
                      className="ui-input"
                      value={itemForm.name}
                      onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Margherita Pizza"
                      required
                    />
                  </div>

                  <div>
                    <div className="ui-label">Price (cents)</div>
                    <input
                      className="ui-input"
                      value={itemForm.price_cents}
                      onChange={(e) => setItemForm((p) => ({ ...p, price_cents: e.target.value }))}
                      placeholder="e.g. 1299"
                      inputMode="numeric"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="ui-label">Description (optional)</div>
                  <input
                    className="ui-input"
                    value={itemForm.description}
                    onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Short description"
                  />
                </div>

                <div className="ui-grid2">
                  <div>
                    <div className="ui-label">Currency</div>
                    <input
                      className="ui-input"
                      value={itemForm.currency}
                      onChange={(e) => setItemForm((p) => ({ ...p, currency: e.target.value }))}
                      placeholder="USD"
                    />
                  </div>
                  <div>
                    <div className="ui-label">Image URL (optional)</div>
                    <input
                      className="ui-input"
                      value={itemForm.image_url}
                      onChange={(e) => setItemForm((p) => ({ ...p, image_url: e.target.value }))}
                      placeholder="https://…"
                    />
                  </div>
                </div>

                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={itemForm.is_available}
                    onChange={(e) => setItemForm((p) => ({ ...p, is_available: e.target.checked }))}
                  />
                  <span className="ui-help" style={{ margin: 0 }}>
                    Available
                  </span>
                </label>

                <button className="ui-btn ui-btnPrimary" type="submit">
                  Create item
                </button>
              </form>
            </div>

            {loading.items ? (
              <p className="ui-help" style={{ margin: 0 }}>
                Loading items…
              </p>
            ) : items.length === 0 ? (
              <p className="ui-help" style={{ margin: 0 }}>
                No items yet in this menu.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {items.map((it) => (
                  <div key={it.id} className="ui-card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900 }}>{it.name}</div>
                        <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                          {it.description || "—"}
                        </div>
                        <div className="ui-help" style={{ margin: "6px 0 0 0", fontWeight: 800 }}>
                          {formatMoney(it.price_cents, it.currency || "USD")}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <span className="ui-badge">{itemAvailabilityLabel(Boolean(it.is_available))}</span>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button className="ui-btn ui-btnGhost" type="button" onClick={() => onQuickEditItem(it)} style={{ boxShadow: "none" }}>
                            Quick edit
                          </button>
                          <button
                            className={`ui-btn ${it.is_available ? "" : "ui-btnPrimary"}`}
                            type="button"
                            onClick={() => onToggleItemAvailability(it)}
                            title="Toggle availability"
                          >
                            {it.is_available ? "Mark unavailable" : "Mark available"}
                          </button>
                          <button className="ui-btn" type="button" onClick={() => onDeleteItem(it)}>
                            Delete
                          </button>
                        </div>
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

