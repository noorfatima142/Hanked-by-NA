/* 
  HANKED SHOP - OPTIMIZED COMPLETE JAVASCRIPT
  Features: Supabase Integration, Cart System, EmailJS Checkout, Custom Orders
*/

// 1. CONFIGURATION
const PROJ_URL = 'https://neoxbatnvyfqtzexhuaa.supabase.co';
const PROJ_KEY = 'sb_publishable_1zg1Kw7Oa9EFPc2rdimM0A_O6qlWBaN';

const HANKED_CONFIG = {
  emailjsPublicKey: "YOUR_EMAILJS_PUBLIC_KEY", 
  emailjsServiceId: "YOUR_SERVICE_ID",         
  emailjsOrderTemplateCustomer: "TEMPLATE_ID_1",
  emailjsOrderTemplateOwner: "TEMPLATE_ID_2",
  ownerEmail: "yourshop@example.com"            
};

const hankedClient = supabase.createClient(PROJ_URL, PROJ_KEY);

// GLOBAL DATA STATE
window.storeItems = JSON.parse(localStorage.getItem('hanked_cached_products')) || [];
window.supplyItems = JSON.parse(localStorage.getItem('hanked_cached_supplies')) || [];

/* ---------- 2. DATA FETCHING ---------- */
async function syncCollection(table, storageKey, stateVarName, gridId) {
    console.log(`Syncing ${table}...`);
    const { data, error } = await hankedClient.from(table).select('*');

    if (error) {
        console.error(`Supabase Error (${table}):`, error.message);
    } else {
        window[stateVarName] = data;
        localStorage.setItem(storageKey, JSON.stringify(data));
    }

    // Render if we are on a page with the corresponding grid
    if (gridId) renderGrid(gridId, window[stateVarName], 'all');
    
    // Update UI components that rely on price/data
    Cart.renderDrawer();
    renderCheckoutSummary();
}

// Helper to find item in either collection
const findItem = (id) => [...window.storeItems, ...window.supplyItems].find(p => p.id == id);

/* ---------- 3. RENDERING LOGIC ---------- */
function productCardHTML(p) {
    const isSoldOut = p.stock <= 0;
    return `
      <div class="card reveal in" onclick="openProductModal(${p.id})" style="cursor:pointer;">
          <div class="card-img">
              <img src="${p.image_url}" alt="${p.name}" onerror="this.src='assets/logo.jpg'">
              ${isSoldOut ? '<span class="card-badge sold">Sold Out</span>' : ''}
          </div>
          <div class="card-body">
              <span class="cat">${p.category || 'Handmade'}</span>
              <h3>${p.name}</h3>
              <p class="desc">${p.description || 'Hand-crocheted with love.'}</p>
              <div class="card-foot">
                  <span class="price">Rs. ${p.price}</span>
                  <button class="add-btn" onclick="event.stopPropagation(); Cart.add(${p.id})">
                      Add to Bag
                  </button>
              </div>
          </div>
      </div>`;
}

function renderGrid(gridId, items, filterType) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const filtered = (filterType === 'all' || !filterType) 
        ? items 
        : items.filter(p => p.category?.toLowerCase() === filterType.toLowerCase());

    if (filtered.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding: 40px;'>No items found 🧶</p>";
        return;
    }

    grid.innerHTML = filtered.map(productCardHTML).join('');
    initScrollReveal();
}

/* ---------- 4. CART SYSTEM (PERSISTENT) ---------- */
const Cart = {
  KEY: "hanked_cart",
  get() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch(e) { return []; } },
  save(items) { 
    localStorage.setItem(this.KEY, JSON.stringify(items)); 
    this.renderCount(); 
    this.renderDrawer();
    renderCheckoutSummary();
  },
  
  add(productId) {
    const items = this.get();
    const existing = items.find(i => i.id === productId);
    existing ? (existing.qty += 1) : items.push({ id: productId, qty: 1 });
    this.save(items);
    showToast("Added to your bag!");
  },
  
  remove(productId) {
    this.save(this.get().filter(i => i.id !== productId));
  },
  
  setQty(productId, qty) {
    const items = this.get();
    const it = items.find(i => i.id === productId);
    if (it) it.qty = Math.max(1, qty);
    this.save(items);
  },
  
  clear() { this.save([]); },
  totalCount() { return this.get().reduce((s, i) => s + i.qty, 0); },
  totalPrice() {
    return this.get().reduce((s, i) => {
      const p = findItem(i.id);
      return s + (p ? p.price * i.qty : 0);
    }, 0);
  },

  renderCount() {
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = this.totalCount());
  },

  renderDrawer() {
    const wrap = document.getElementById('drawer-items');
    const subtotalEl = document.getElementById('drawer-subtotal');
    if (!wrap) return;
    
    const items = this.get();
    if (items.length === 0) {
      wrap.innerHTML = `<div class="empty-cart">Your bag is empty 🧶</div>`;
      if(subtotalEl) subtotalEl.textContent = formatPKR(0);
      return;
    }
     
    wrap.innerHTML = items.map(i => {
      const p = findItem(i.id);
      if (!p) return "";
      return `
      <div class="cart-item">
        <div class="cart-item-img"><img src="${p.image_url}" onerror="this.src='assets/logo.jpg'"></div>
        <div class="cart-item-info">
          <h4>${p.name}</h4>
          <div class="meta">${formatPKR(p.price)} each</div>
          <div class="qty-control">
            <button onclick="Cart.setQty(${p.id}, ${i.qty - 1})">−</button>
            <span>${i.qty}</span>
            <button onclick="Cart.setQty(${p.id}, ${i.qty + 1})">+</button>
          </div>
          <div class="remove-btn" onclick="Cart.remove(${p.id})">Remove</div>
        </div>
      </div>`;
    }).join('');
    
    if(subtotalEl) subtotalEl.textContent = formatPKR(this.totalPrice());
  }
};

/* ---------- 5. UI CONTROLS ---------- */
function openCart() {
  document.getElementById('cart-overlay')?.classList.add('open');
  document.getElementById('cart-drawer')?.classList.add('open');
  Cart.renderDrawer();
}

function closeCart() {
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.getElementById('cart-drawer')?.classList.remove('open');
}

window.openProductModal = function(id) {
    const p = findItem(id);
    if (!p) return;

    document.getElementById('modal-img').src = p.image_url;
    document.getElementById('modal-name').textContent = p.name;
    document.getElementById('modal-cat').textContent = p.category || 'Handmade';
    document.getElementById('modal-price').textContent = formatPKR(p.price);
    document.getElementById('modal-desc').textContent = p.description || "Beautifully hand-crocheted.";
    document.getElementById('modal-qty').value = 1;

    document.getElementById('modal-add-btn').onclick = () => {
        const qty = parseInt(document.getElementById('modal-qty').value);
        for(let i=0; i < qty; i++) { Cart.add(p.id); }
        closeProductModal();
    };
    document.getElementById('product-modal').classList.add('open');
};

window.closeProductModal = () => document.getElementById('product-modal').classList.remove('open');
window.changeModalQty = (amt) => {
    const input = document.getElementById('modal-qty');
    input.value = Math.max(1, parseInt(input.value) + amt);
};

/* ---------- 6. CHECKOUT & SHIPPING ---------- */
function renderCheckoutSummary() {
    const summaryWrap = document.getElementById('checkout-summary-items');
    if (!summaryWrap) return;

    const items = Cart.get();
    summaryWrap.innerHTML = items.map(i => {
        const p = findItem(i.id);
        if (!p) return ""; 
        return `
            <div class="checkout-item">
                <img src="${p.image_url}" style="width:50px; height:50px; object-fit:cover; border-radius:5px;">
                <div style="flex:1; margin-left:10px;">
                    <h4 style="margin:0; font-size:0.9rem;">${p.name}</h4>
                    <small>Qty: ${i.qty}</small>
                </div>
                <span>${formatPKR(p.price * i.qty)}</span>
            </div>`;
    }).join('');

    calculateShipping(); 
}

function calculateShipping() {
    const cityInput = document.getElementById('city-input')?.value.trim().toLowerCase();
    const shippingEl = document.getElementById('summary-shipping');
    const totalEl = document.getElementById('summary-total');
    if (!shippingEl || !totalEl) return;

    const subtotal = Cart.totalPrice();
    let shipping = 0;
    
    if (cityInput) {
        shipping = (cityInput === "karachi") ? 200 : 350;
    }

    shippingEl.textContent = formatPKR(shipping);
    totalEl.textContent = formatPKR(subtotal + shipping);
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const currentCart = Cart.get();
  
  if (currentCart.length === 0) return showToast("Your bag is empty!");

  const orderId = `HKD-${Date.now().toString().slice(-6)}`;
  const orderSummary = currentCart.map(i => {
    const p = findItem(i.id);
    return p ? `${p.name} x${i.qty}` : `ID:${i.id} x${i.qty}`;
  }).join("\n");

  const btn = form.querySelector('.submit-btn');
  btn.disabled = true; btn.textContent = "Placing order...";

  const params = {
    order_id: orderId,
    customer_name: form.name.value,
    customer_email: form.email.value,
    customer_phone: form.phone.value,
    customer_address: form.address.value,
    order_summary: orderSummary,
    order_total: formatPKR(Cart.totalPrice() + (form.city.value.toLowerCase() === 'karachi' ? 200 : 350))
  };

  try {
    if (typeof emailjs !== "undefined" && !HANKED_CONFIG.emailjsPublicKey.startsWith("YOUR_")) {
        await Promise.all([
            emailjs.send(HANKED_CONFIG.emailjsServiceId, HANKED_CONFIG.emailjsOrderTemplateCustomer, params),
            emailjs.send(HANKED_CONFIG.emailjsServiceId, HANKED_CONFIG.emailjsOrderTemplateOwner, params)
        ]);
    }
    finishCheckout(orderId);
  } catch (err) {
    console.error("Order Error:", err);
    finishCheckout(orderId); 
  }
}

function finishCheckout(orderId) {
    document.getElementById('checkout-step-form').style.display = 'none';
    document.getElementById('checkout-step-success').style.display = 'block';
    document.getElementById('order-id-display').textContent = orderId;
    Cart.clear();
}

/* ---------- 7. REVIEWS ---------- */
async function fetchReviews() {
    const container = document.getElementById('reviews-container');
    if (!container) return;

    const { data } = await hankedClient.from('reviews').select('*');
    if (!data || data.length === 0) {
        container.innerHTML = "<p>No reviews yet. 🧶</p>";
        return;
    }

    container.innerHTML = data.map(r => `
        <div class="review-card">
            <div class="stars">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div>
            <h4>${r.customer_name}</h4>
            <p>"${r.feedback || r.comment}"</p> 
        </div>
    `).join('');
}

/* ---------- 8. INITIALIZATION ---------- */
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    Cart.renderCount();
    
    // Page-specific Initializations
    if (document.getElementById('product-grid')) syncCollection('products', 'hanked_cached_products', 'storeItems', 'product-grid');
    if (document.getElementById('supplies-grid')) syncCollection('supplies', 'hanked_cached_supplies', 'supplyItems', 'supplies-grid');
    if (document.getElementById('reviews-container')) fetchReviews();
    
    // Generic Filter Button Logic
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            const isSupplies = !!document.getElementById('supplies-grid');
            renderGrid(isSupplies ? 'supplies-grid' : 'product-grid', isSupplies ? window.supplyItems : window.storeItems, filter);
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Form Listeners
    document.getElementById('checkout-form')?.addEventListener('submit', handleCheckoutSubmit);
    document.getElementById('review-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await hankedClient.from('reviews').insert([{
            customer_name: e.target.name.value,
            rating: parseInt(e.target.rating.value),
            feedback: e.target.feedback.value
        }]);
        if (!error) { showToast("Review posted!"); e.target.reset(); fetchReviews(); }
    });

    if (typeof emailjs !== "undefined" && !HANKED_CONFIG.emailjsPublicKey.startsWith("YOUR_")) {
        emailjs.init(HANKED_CONFIG.emailjsPublicKey);
    }
});

/* ---------- 9. UTILITIES ---------- */
function formatPKR(n) { return "Rs. " + (n || 0).toLocaleString(); }

function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

function initNav() {
    const nav = document.querySelector('.nav');
    window.addEventListener('scroll', () => {
        nav?.classList.toggle('scrolled', window.scrollY > 30);
    });
    document.querySelector('.nav-toggle')?.addEventListener('click', () => {
        document.querySelector('.nav-links')?.classList.toggle('open');
    });
}

function initScrollReveal() {
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// Global Policy Controls
window.openPolicy = (type) => {
    const content = document.getElementById('policy-text');
    const policies = {
        shipping: `<h2>Shipping Policy 🚚</h2><p>Karachi: Rs. 200. Others: Rs. 350. Delivery in 3-5 days.</p>`,
        maker: `<h2>Maker Policy 🧶</h2><p>Small items: 1 day. Large items: 3-5 days. Handmade with love.</p>`
    };
    if(content) content.innerHTML = policies[type];
    document.getElementById('policy-modal')?.classList.add('open');
};
window.closePolicy = () => document.getElementById('policy-modal')?.classList.remove('open');
