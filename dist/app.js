"use strict";
let products = [];
const form = document.getElementById("productForm");
const nameInput = document.getElementById("name");
const priceInput = document.getElementById("price");
const productList = document.getElementById("productList");
form.addEventListener("submit", function (event) {
    event.preventDefault();
    const product = {
        id: products.length + 1,
        name: nameInput.value,
        price: Number(priceInput.value),
        inStock: true
    };
    products.push(product);
    showProducts();
    nameInput.value = "";
    priceInput.value = "";
});
function showProducts() {
    productList.innerHTML = "";
    products.forEach(function (product) {
        const item = document.createElement("li");
        item.textContent =
            product.name + " - ₹" + product.price +
                " - " + (product.inStock ? "In Stock" : "Out of Stock");
        productList.appendChild(item);
    });
}
