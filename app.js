"use strict";
const STORAGE_KEY = "inventory.products.v1";
const THEME_KEY = "inventory.theme";
const LOW_STOCK_LIMIT = 5;
const CATEGORY_COLORS = {
    Electronics: "#4f6bed",
    Grocery: "#2f9e6b",
    Clothing: "#c2457a",
    Stationery: "#d17b1f",
    Home: "#7a5af8",
    Other: "#64708a"
};
// ---------- State ----------
let products = load();
let filter = "all";
let query = "";
let sortKey = "new";
let editingId = null;
let freshId = null;
let toastTimer;
// ---------- Elements ----------
function el(id) {
    return document.getElementById(id);
}
const form = el("productForm");
const nameInput = el("name");
const priceInput = el("price");
const quantityInput = el("quantity");
const categoryInput = el("category");
const submitBtn = el("submitBtn");
const cancelBtn = el("cancelBtn");
const formTitle = el("formTitle");
const formPanel = document.querySelector(".form-panel");
const productList = el("productList");
const emptyBox = el("empty");
const searchInput = el("search");
const sortSelect = el("sort");
const toast = el("toast");
// ---------- Storage ----------
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    }
    catch {
        /* storage unavailable: app still works for this session */
    }
}
// ---------- Helpers ----------
const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});
function statusOf(p) {
    if (p.quantity <= 0)
        return "out";
    if (p.quantity <= LOW_STOCK_LIMIT)
        return "low";
    return "in";
}
const STATUS_LABEL = {
    in: "In stock",
    low: "Low stock",
    out: "Out of stock"
};
function nextId() {
    return products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}
// ---------- Rendering ----------
function visibleProducts() {
    const q = query.trim().toLowerCase();
    const list = products.filter(p => {
        const matchesText = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
        const matchesFilter = filter === "all" || statusOf(p) === filter;
        return matchesText && matchesFilter;
    });
    const sorters = {
        new: (a, b) => b.createdAt - a.createdAt,
        name: (a, b) => a.name.localeCompare(b.name),
        priceDesc: (a, b) => b.price - a.price,
        priceAsc: (a, b) => a.price - b.price,
        qty: (a, b) => a.quantity - b.quantity
    };
    return list.sort(sorters[sortKey]);
}
function renderStats() {
    const value = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    el("statCount").textContent = String(products.length);
    el("statValue").textContent = money.format(value);
    el("statLow").textContent = String(products.filter(p => statusOf(p) === "low").length);
    el("statOut").textContent = String(products.filter(p => statusOf(p) === "out").length);
}
function buildItem(p) {
    const status = statusOf(p);
    const li = document.createElement("li");
    li.className = "item" + (p.id === freshId ? " fresh" : "");
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.background = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.Other;
    avatar.textContent = p.name.charAt(0).toUpperCase();
    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = p.category;
    info.append(name, meta);
    const price = document.createElement("div");
    price.className = "price";
    price.textContent = money.format(p.price);
    const pill = document.createElement("span");
    pill.className = "pill " + status;
    pill.textContent = STATUS_LABEL[status];
    const qty = document.createElement("div");
    qty.className = "qty";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Decrease quantity of " + p.name);
    minus.addEventListener("click", () => changeQuantity(p.id, -1));
    const count = document.createElement("span");
    count.textContent = String(p.quantity);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Increase quantity of " + p.name);
    plus.addEventListener("click", () => changeQuantity(p.id, 1));
    qty.append(minus, count, plus);
    const actions = document.createElement("div");
    actions.className = "actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "link";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => startEdit(p.id));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "link del";
    del.textContent = "Delete";
    del.addEventListener("click", () => removeProduct(p.id));
    actions.append(edit, del);
    li.append(avatar, info, price, pill, qty, actions);
    return li;
}
function render() {
    renderStats();
    const items = visibleProducts();
    productList.replaceChildren(...items.map(buildItem));
    freshId = null;
    if (items.length === 0) {
        emptyBox.hidden = false;
        emptyBox.innerHTML = "";
        const title = document.createElement("strong");
        const hint = document.createElement("span");
        if (products.length === 0) {
            title.textContent = "No products yet";
            hint.textContent = "Add your first product using the form.";
        }
        else {
            title.textContent = "No matching products";
            hint.textContent = "Try a different search or filter.";
        }
        emptyBox.append(title, hint);
    }
    else {
        emptyBox.hidden = true;
    }
}
// ---------- Actions ----------
function changeQuantity(id, delta) {
    const p = products.find(x => x.id === id);
    if (!p)
        return;
    p.quantity = Math.max(0, p.quantity + delta);
    save();
    render();
}
function removeProduct(id) {
    const index = products.findIndex(p => p.id === id);
    if (index === -1)
        return;
    const [removed] = products.splice(index, 1);
    if (editingId === id)
        stopEdit();
    save();
    render();
    showToast(`Deleted “${removed.name}”`, "Undo", () => {
        products.splice(index, 0, removed);
        save();
        render();
    });
}
function startEdit(id) {
    const p = products.find(x => x.id === id);
    if (!p)
        return;
    editingId = id;
    nameInput.value = p.name;
    priceInput.value = String(p.price);
    quantityInput.value = String(p.quantity);
    categoryInput.value = p.category;
    formTitle.textContent = "Edit product";
    submitBtn.textContent = "Save changes";
    cancelBtn.hidden = false;
    formPanel.classList.add("editing");
    nameInput.focus();
}
function stopEdit() {
    editingId = null;
    form.reset();
    formTitle.textContent = "Add product";
    submitBtn.textContent = "Add product";
    cancelBtn.hidden = true;
    formPanel.classList.remove("editing");
}
function showToast(message, actionLabel, onAction) {
    toast.replaceChildren();
    const text = document.createElement("span");
    text.textContent = message;
    toast.append(text);
    if (actionLabel && onAction) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = actionLabel;
        btn.addEventListener("click", () => {
            onAction();
            toast.hidden = true;
        });
        toast.append(btn);
    }
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.hidden = true), 5000);
}
function exportCsv() {
    if (products.length === 0) {
        showToast("Nothing to export yet");
        return;
    }
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
        ["ID", "Name", "Category", "Price", "Quantity", "Status"],
        ...products.map(p => [p.id, p.name, p.category, p.price, p.quantity, STATUS_LABEL[statusOf(p)]])
    ];
    const csv = rows.map(r => r.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported inventory.csv");
}
// ---------- Events ----------
form.addEventListener("submit", function (event) {
    event.preventDefault();
    const name = nameInput.value.trim();
    const price = Number(priceInput.value);
    const quantity = Math.floor(Number(quantityInput.value));
    if (!name || price < 0 || quantity < 0)
        return;
    if (editingId !== null) {
        const p = products.find(x => x.id === editingId);
        if (p) {
            p.name = name;
            p.price = price;
            p.quantity = quantity;
            p.category = categoryInput.value;
        }
        stopEdit();
        showToast("Changes saved");
    }
    else {
        const product = {
            id: nextId(),
            name,
            price,
            quantity,
            category: categoryInput.value,
            createdAt: Date.now()
        };
        products.push(product);
        freshId = product.id;
        form.reset();
        showToast(`Added “${name}”`);
    }
    save();
    render();
    nameInput.focus();
});
cancelBtn.addEventListener("click", stopEdit);
searchInput.addEventListener("input", () => { query = searchInput.value; render(); });
sortSelect.addEventListener("change", () => { sortKey = sortSelect.value; render(); });
el("exportBtn").addEventListener("click", exportCsv);
document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        filter = btn.dataset.filter;
        document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b === btn));
        render();
    });
});
// ---------- Theme ----------
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
}
const savedTheme = (() => {
    try {
        return localStorage.getItem(THEME_KEY);
    }
    catch {
        return null;
    }
})();
applyTheme(savedTheme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
el("themeBtn").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
        localStorage.setItem(THEME_KEY, next);
    }
    catch { /* ignore */ }
});
render();
