/* 
  HANKED SHOP - COMPLETE JAVASCRIPT (PERSISTENT VERSION)
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
  emailjsCustomTemplateOwner: "TEMPLATE_ID_3",
  ownerEmail: "yourshop@example.com"            
};

// Use 'hankedClient' for Supabase
const hankedClient = supabase.createClient(PROJ_URL, PROJ_KEY);

// GLOBAL DATA STATE (Persistent via LocalStorage)
window.storeItems = JSON.parse(localStorage.getItem('hanked_cached_products')) || [];

/* ---------- 2. DATA FETCHING (WITH PERSISTENCE) ---------- */
async function getCollection() {
    console.log("Syncing collection from Supabase...");
    
    const { data, error } = await hankedClient.from('products').select('*');

    if (error) {
        console.error("Supabase Error:", error.message);
        // If error, we still have the cached window.storeItems from localStorage
        if (window.storeItems.length > 0) {
            renderProducts('all');
        } else {
            showToast("Error loading products.");
        }
        return;
    }

    console.log("Data Received & Cached:", data);
    window.storeItems = data;
    
    // SAVE TO STORAGE so other pages (Cart/Checkout) can access it
    localStorage.setItem('hanked_cached_products', JSON.stringify(data));
    
    // Render if we are on a page with a grid
    renderProducts('all');
    
    // Update cart displays in case prices changed
    window.storeItems = data;
    localStorage.setItem('hanked_cached_products', JSON.stringify(data));
    
    renderProducts('all');
    Cart.renderDrawer();
    renderCheckoutSummary(); // Add this line here too!
}

/* ---------- 3. RENDERING LOGIC ---------- */
function productCardHTML(p) {
    return `
      <div class="card reveal in" onclick="openProductModal(${p.id})" style="cursor:pointer; opacity:1; transform:none;">
          <div class="card-img">
              <img src="${p.image_url}" alt="${p.name}" onerror="this.src='assets/logo.jpg'">
              ${p.stock <= 0 ? '<span class="card-badge sold">Sold Out</span>' : ''}
          </div>
          <div class="card-body">
              <span class="cat">${p.category || 'Handmade'}</span>
              <h3>${p.name}</h3>
              <p class="desc">${p.description}</p>
              <div class="card-foot">
                  <span class="price">Rs. ${p.price}</span>
                  <button class="add-btn" onclick="event.stopPropagation(); Cart.add(${p.id})">
                      Add to Bag
                  </button>
              </div>
          </div>
      </div>`;
}

function renderProducts(filterType) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = ''; 

    const filtered = (filterType === 'all' || !filterType) 
        ? window.storeItems 
        : window.storeItems.filter(p => p.category?.toLowerCase() === filterType.toLowerCase());

    if (filtered.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding: 40px;'>No items found in this category 🧶</p>";
        return;
    }

    grid.innerHTML = filtered.map(productCardHTML).join('');
    initScrollReveal();
}

/* ---------- 4. CART SYSTEM (PERSISTENT) ---------- */
const Cart = {
  KEY: "hanked_cart",
  
  get() { 
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } 
    catch(e) { return []; } 
  },
  
  save(items) { 
    localStorage.setItem(this.KEY, JSON.stringify(items)); 
    this.renderCount(); 
  },
  
  add(productId) {
    const items = this.get();
    const existing = items.find(i => i.id === productId);
    if (existing) { 
        existing.qty += 1; 
    } else { 
        items.push({ id: productId, qty: 1 }); 
    }
    this.save(items);
    showToast("Added to your bag!");
    this.renderDrawer();
  },
  
  remove(productId) {
    let items = this.get().filter(i => i.id !== productId);
    this.save(items); 
    this.renderDrawer();
  },
  
  setQty(productId, qty) {
    let items = this.get();
    const it = items.find(i => i.id === productId);
    if (it) { it.qty = Math.max(1, qty); }
    this.save(items); 
    this.renderDrawer();
  },
  
  clear() { 
    this.save([]); 
    this.renderDrawer(); 
  },
  
  totalCount() { return this.get().reduce((s, i) => s + i.qty, 0); },
  totalPrice() {
    return this.get().reduce((s, i) => {
      // Look in both Handmade Products AND Supplies
      const allItems = [...window.storeItems, ...window.supplyItems];
      const p = allItems.find(item => item.id === i.id);
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
     
    const allAvailableItems = [...window.storeItems, ...window.supplyItems];
    wrap.innerHTML = items.map(i => {
      // NEW CODE (Looks at BOTH products and supplies)
      const p = allAvailableItems.find(item => item.id === i.id);
      if (!p) return ""; // Item might not be in cache yet
      return `
      <div class="cart-item">
        <div class="cart-item-img">
            <img src="${p.image_url}" alt="${p.name}" onerror="this.src='assets/logo.jpg'">
        </div>
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

/* ---------- 5. UI CONTROLS (DRAWER & MODALS) ---------- */
function openCart() {
  const overlay = document.getElementById('cart-overlay');
  const drawer = document.getElementById('cart-drawer');
  if(overlay) overlay.classList.add('open');
  if(drawer) drawer.classList.add('open');
  Cart.renderDrawer();
}

function closeCart() {
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.getElementById('cart-drawer')?.classList.remove('open');
}

window.openProductModal = function(id) {
    const product = window.storeItems.find(p => p.id == id);
    if (!product) return;

    document.getElementById('modal-img').src = product.image_url;
    document.getElementById('modal-name').textContent = product.name;
    document.getElementById('modal-cat').textContent = product.category || 'Handmade';
    document.getElementById('modal-price').textContent = "Rs. " + product.price;
    document.getElementById('modal-desc').textContent = product.description;
    document.getElementById('modal-qty').value = 1;

    document.getElementById('modal-add-btn').onclick = () => {
        const qty = parseInt(document.getElementById('modal-qty').value);
        for(let i=0; i < qty; i++) { Cart.add(product.id); }
        closeProductModal();
    };

    document.getElementById('product-modal').classList.add('open');
};

window.closeProductModal = function() {
    document.getElementById('product-modal').classList.remove('open');
};

window.changeModalQty = function(amt) {
    const input = document.getElementById('modal-qty');
    let val = parseInt(input.value) + amt;
    if (val < 1) val = 1;
    input.value = val;
};

window.openReviewModal = function() {
    document.getElementById('review-modal').classList.add('open');
};

window.closeReviewModal = function() {
    document.getElementById('review-modal').classList.remove('open');
};

window.viewBag = function() {
    window.location.href = 'cart.html'; 
};

window.openCheckout = function() {
    window.location.href = 'checkout.html'; 
};

/* ---------- 6. CHECKOUT LOGIC ---------- */
function handleCheckoutSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  const address = form.address.value.trim();

  if (!name || !email || !phone || !address) {
    showToast("Please fill in all required fields");
    return;
  }

  const currentCart = Cart.get();
  if (currentCart.length === 0) {
      showToast("Your bag is empty!");
      return;
  }

  const orderId = generateOrderId();
  const orderSummary = currentCart.map(i => {
    const p = window.storeItems.find(item => item.id === i.id);
    return p ? `${p.name} x${i.qty} — ${formatPKR(p.price * i.qty)}` : `Item ID ${i.id} x${i.qty}`;
  }).join("\n");

  const btn = form.querySelector('.submit-btn');
  btn.disabled = true; 
  btn.textContent = "Placing order...";

  const params = {
    order_id: orderId,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    customer_address: address,
    order_summary: orderSummary,
    order_total: formatPKR(Cart.totalPrice())
  };

  if (typeof emailjs !== "undefined" && !HANKED_CONFIG.emailjsPublicKey.startsWith("YOUR_")) {
    Promise.all([
      emailjs.send(HANKED_CONFIG.emailjsServiceId, HANKED_CONFIG.emailjsOrderTemplateCustomer, params),
      emailjs.send(HANKED_CONFIG.emailjsServiceId, HANKED_CONFIG.emailjsOrderTemplateOwner, params)
    ]).then(() => {
      finishCheckout(orderId);
    }).catch(err => {
      console.error("Email Error:", err);
      finishCheckout(orderId); 
    });
  } else {
    console.warn("EmailJS not configured.");
    finishCheckout(orderId);
  }
}

function finishCheckout(orderId) {
  const formContainer = document.getElementById('checkout-step-form');
  const successBox = document.getElementById('checkout-step-success');
  
  if(formContainer) formContainer.style.display = 'none';
  if(successBox) successBox.style.display = 'block';
  
  const orderDisplay = document.getElementById('order-id-display');
  if(orderDisplay) orderDisplay.textContent = orderId;
  
  Cart.clear();
}

/* ---------- 7. UTILITIES ---------- */
function generateOrderId() {
  const d = new Date();
  const stamp = d.getFullYear().toString().slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `HKD-${stamp}-${rand}`;
}

function formatPKR(n) { return "Rs. " + (n || 0).toLocaleString(); }
let toastTimer;

function showToast(msg) {
    // 1. Check for the toast element, create if missing
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        document.body.appendChild(t);
    }

    // 2. THE DIRECT FIX: Always pull it out of any hidden containers
    if (t.parentElement !== document.body) {
        document.body.appendChild(t);
    }

    // 3. Reset the state for the animation
    clearTimeout(toastTimer);
    t.classList.remove('show');

    // 4. Update the text (Just the message, no icons)
    t.textContent = msg;

    // 5. Trigger the slide-in animation
    // A 10ms delay ensures the browser registers the removal of 'show'
    setTimeout(() => {
        t.classList.add('show');
    }, 10);

    // 6. Professional timing: 3 seconds is best for readability
    toastTimer = setTimeout(() => {
        t.classList.remove('show');
    }, 1500);
}
/* --- IMPORTANT: CHECK THESE FUNCTIONS --- */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.15 });
  els.forEach(el => obs.observe(el));
}

function initNav() {
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 30) nav.classList.add('scrolled'); 
        else nav.classList.remove('scrolled');
    });
  }
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) toggle.addEventListener('click', () => links.classList.toggle('open'));
}

/*----------- 9. REVIEWS SYSTEM ---------------*/
async function fetchReviews() {
    const reviewGrid = document.getElementById('reviews-container');
    if (!reviewGrid) return;

    reviewGrid.innerHTML = "<p style='text-align:center;'>Loading your stories...</p>";

    try {
        const { data, error } = await hankedClient.from('reviews').select('*');

        if (error) {
            console.error("Supabase Error:", error.message);
            return;
        }

        if (!data || data.length === 0) {
            reviewGrid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding: 40px;'>No reviews yet. Be the first to share your HANKED story! 🧶</p>";
            return;
        }

        reviewGrid.innerHTML = data.map(r => `
            <div class="review-card" style="background:#fff; padding:25px; border-radius:15px; box-shadow:0 10px 30px rgba(0,0,0,0.05); margin-bottom:20px;">
                <div class="stars" style="color: #FFB800; margin-bottom: 10px;">
                    ${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}
                </div>
                <h4 style="font-family: 'Playfair Display', serif; color: #2D3A47; margin:0 0 10px 0;">${r.customer_name || 'HANKED Customer'}</h4>
                <p style="font-style: italic; color: #666; margin:0;">"${r.feedback || r.comment || 'No feedback provided.'}"</p> 
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
    }
}

async function handleReviewSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('post-review-btn');

    const reviewData = {
        customer_name: form.name.value,
        email: form.email.value,      
        rating: parseInt(form.rating.value),
        feedback: form.feedback.value 
    };

    if(btn) {
        btn.disabled = true;
        btn.textContent = "Posting...";
    }

    const { error } = await hankedClient.from('reviews').insert([reviewData]);

    if (error) {
        showToast("Error: " + error.message);
    } else {
        showToast("Thank you for sharing your feedback!"); 
        form.reset();                             
        closeReviewModal();                       
        fetchReviews();                           
    }
    if(btn) {
        btn.disabled = false;
        btn.textContent = "Post Review";
    }
}

/*----------- 8. INITIALIZATION (PAGE LOAD) ---------------*/
document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Global UI
    initNav();
    Cart.renderCount();
    // IF ON PRODUCTS PAGE
    if (document.getElementById('product-grid')) {
        getCollection();
        setupFilterButtons(renderProducts);
    }
    // IF ON SUPPLIES PAGE
    if (document.getElementById('supplies-grid')) {
        getSuppliesCollection();
        setupFilterButtons(renderSupplies);
    }
    // 2. Load Products (Always do this to ensure Cart/Checkout has data)
    getCollection().then(() => {
        renderCheckoutSummary();
    });

    // 3. Setup Filter Buttons (Only if they exist)
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderProducts(e.target.dataset.filter);
        });
    });

    // 4. Review Page Logic
    if (document.getElementById('reviews-container')) {
        fetchReviews();
    }
    
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        reviewForm.addEventListener('submit', handleReviewSubmit);
    }

    // 5. Checkout Logic
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckoutSubmit);
    }

    // 6. Global UI Interactions
    const overlay = document.getElementById('cart-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeCart);
    }

    // 7. EmailJS Init
    if (typeof emailjs !== "undefined" && !HANKED_CONFIG.emailjsPublicKey.startsWith("YOUR_")) {
        emailjs.init(HANKED_CONFIG.emailjsPublicKey);
    }
});
function setupFilterButtons(renderFunc) {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderFunc(e.target.dataset.filter);
        });
    });
}
/* ---------- NEW: CHECKOUT SUMMARY RENDERING ---------- */
function renderCheckoutSummary() {
    const summaryWrap = document.getElementById('checkout-summary-items');
    const totalEl = document.getElementById('checkout-final-total');
    if (!summaryWrap) return;

    const items = Cart.get();
    // THE FIX: Combine both data sources
    const allItems = [...window.storeItems, ...window.supplyItems];

    summaryWrap.innerHTML = items.map(i => {
        const p = allItems.find(item => item.id === i.id);
        if (!p) return ""; 
        return `
            <div class="checkout-item">
                <img src="${p.image_url}" style="width:50px; height:50px;">
                <div style="flex:1;">
                    <h4>${p.name}</h4>
                    <small>Qty: ${i.qty}</small>
                </div>
                <span>${formatPKR(p.price * i.qty)}</span>
            </div>`;
    }).join('');

    // Ensure shipping is recalculated whenever the summary renders
    calculateShipping(); 
}

// Global variable for supplies
window.supplyItems = JSON.parse(localStorage.getItem('hanked_cached_supplies')) || [];

/* ---------- FETCH SUPPLIES FROM 'supplies' TABLE ---------- */
async function getSuppliesCollection() {
    console.log("Fetching supplies from Supabase...");
    
    const { data, error } = await hankedClient.from('supplies').select('*');

    if (error) {
        console.error("Supabase Supplies Error:", error.message);
        if (window.supplyItems.length > 0) renderSupplies('all');
        return;
    }

    window.supplyItems = data;
    localStorage.setItem('hanked_cached_supplies', JSON.stringify(data));
    renderSupplies('all');
}

/* ---------- RENDER SUPPLIES GRID ---------- */
function renderSupplies(filterType) {
    const grid = document.getElementById('supplies-grid'); // Use a specific ID for supplies
    if (!grid) return;

    grid.innerHTML = ''; 

    const filtered = (filterType === 'all' || !filterType) 
        ? window.supplyItems 
        : window.supplyItems.filter(p => p.category?.toLowerCase() === filterType.toLowerCase());

    if (filtered.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding: 40px;'>No supplies found in this category 🧶</p>";
        return;
    }

    // Use the same card HTML logic as products
    grid.innerHTML = filtered.map(productCardHTML).join('');
    initScrollReveal();
}
function openPolicy(type) {
    const modal = document.getElementById('policy-modal');
    const content = document.getElementById('policy-text');
    
    if (type === 'shipping') {
        content.innerHTML = `
            <h2>Shipping Policy 🚚</h2>
            <p><strong>Processing Time:</strong> Orders are usually processed within 24-48 hours after the item is finished.</p>
            <p><strong>Shipping Rates:</strong> Karachi: <strong>Rs. 200/</strong> , For other cities: <strong>Rs. 350/.</strong>.</p>
            <p><strong>Delivery Timeline:</strong> Once shipped, your package will reach you in 3-5 business days.</p>
        `;
    } else if (type === 'maker') {
        content.innerHTML = `
            <h2>Maker Policy 🧶</h2>
            <p>HANKED products are 100% handmade. Quality takes time, and we appreciate your patience!</p>
            <ul>
                <li><strong>Charms & Small Items:</strong> Take approximately 1 days or less sometimes.</li>
                <li><strong>Cardigans & Large Items:</strong> Take approximately 3-5 days to crochet.</li>
                <li><strong>Custom Designs:</strong> Timeline will be shared via WhatsApp/Email after design approval.</li>
            </ul>
            <p><em>Note: Timelines may vary during busy holiday seasons.</em></p>
        `;
    } else if (type === 'payment-policy') {
        content.innerHTML = `
           <h2>Payment Policy 💸</h2>
            <p>To keep things personal and secure, we handle all payments manually via WhatsApp!</p>
            <ul>
              <li><strong>Order Confirmation:</strong> Once you click 'Place Order', we will reach out via WhatsApp to confirm stock and your details.</li>
              <li><strong>Payment Methods:</strong> We currently accept Bank Transfers, Easypaisa, and JazzCash.</li>
            </ul>
            <p><em>Thank you for supporting our craft!</em></p>
        `;
    }
    
    modal.classList.add('open');
}

function closePolicy() {
    document.getElementById('policy-modal').classList.remove('open');
}
let shippingCost = 0;

function calculateShipping() {
    const cityInput = document.getElementById('city-input').value.trim().toLowerCase();
    const shippingEl = document.getElementById('summary-shipping');
    const totalEl = document.getElementById('summary-total');
    const subtotal = Cart.totalPrice();

    // 1. If the field is empty, shipping is 0
    if (cityInput === "") {
        shippingCost = 0;
    } 
    // 2. If they type "karachi"
    else if (cityInput === "karachi") {
        shippingCost = 200;
    } 
    // 3. Anything else they type
    else {
        shippingCost = 350;
    }

    // Update the UI
    shippingEl.textContent = "Rs. " + shippingCost.toLocaleString();
    
    const grandTotal = subtotal + shippingCost;
    totalEl.textContent = "Rs. " + grandTotal.toLocaleString();
}
const orderForm = document.getElementById('custom-order-form');
const thankYouMsg = document.getElementById('thank-you-message');

if (orderForm) {
    orderForm.addEventListener('submit', function (e) {
        e.preventDefault(); // This stops the page from redirecting!

        const btn = document.getElementById('submit-btn');
        btn.innerText = "SENDING...";
        btn.disabled = true;

        const formData = new FormData(orderForm);

        fetch(orderForm.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                // Hide form and show your thank you message
                orderForm.style.display = 'none';
                thankYouMsg.style.display = 'block';
            } else {
                alert("Something went wrong. Please try again.");
                btn.innerText = "SUBMIT REQUEST";
                btn.disabled = false;
            }
        })
        .catch(error => {
            alert("Error connecting to server.");
            btn.innerText = "SUBMIT REQUEST";
            btn.disabled = false;
        });
    });
}

// Keep your filename function too
function showFileName() {
    const input = document.getElementById('file-input');
    const display = document.getElementById('file-name-display');
    if (input.files.length > 0) {
        display.innerText = "Selected: " + input.files[0].name;
        display.style.color = "#a67c7c";
    }
}
function displayCheckoutItems() {
    const listContainer = document.getElementById('checkout-items-list');
    let itemsHTML = '';

    cart.forEach(item => {
        itemsHTML += `
            <div class="summary-item-row">
                <div class="item-details">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="item-info-text">
                        <h4>${item.name}</h4>
                        <p>Qty: ${item.quantity}</p>
                    </div>
                </div>
                <span class="value">Rs. ${item.price * item.quantity}</span>
            </div>
        `;
    });

    listContainer.innerHTML = itemsHTML;
    
    // Update the bottom totals
    document.getElementById('summary-subtotal').innerText = `Rs. ${subtotal}`;
    document.getElementById('summary-total').innerText = `Rs. ${totalE1}`;
}
