
import { db, firebaseConfigured } from './firebase.js';

import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const euro = n => Number(n || 0).toLocaleString('pt-PT', {
  style: 'currency',
  currency: 'EUR'
});

let products = [];
let cart = {};
let activeFilter = 'all';

const $ = id => document.getElementById(id);

const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const EMAILJS_PUBLIC_KEY = 'usmcqEbfHIokeoD3a';
const EMAILJS_SERVICE_ID = 'service_rhaeitp';
const EMAILJS_TEMPLATE_ID = 'template_7rllux8';

function stickerCount() {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find(x => x.id === id);
    return sum + (p?.category === 'sticker' ? qty : 0);
  }, 0);
}

function stickerTotal(qty) {
  return Math.floor(qty / 7) * 3 + (qty % 7) * 0.5;
}

function cartTotal() {
  const stickers = stickerTotal(stickerCount());

  const keys = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find(x => x.id === id);
    return sum + (p?.category === 'keychain' ? qty : 0);
  }, 0);

  return stickers + keys * 4;
}

// VALIDAR CONTACTO
function isValidContact(contact) {
  const value = contact.trim();

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const phoneDigits = value.replace(/\D/g, '');
  const isPhone = phoneDigits.length >= 7 && phoneDigits.length <= 15;

  return isEmail || isPhone;
}

// CARREGAR PRODUTOS
function loadProducts() {
  if (!firebaseConfigured) {
    $('productGrid').innerHTML =
      '<p class="loading">A loja está a ser configurada. Volta em breve!</p>';
    return;
  }

  onSnapshot(
    collection(db, 'products'),
    snap => {
      products = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt'));

      renderProducts();
      renderCart();
    },
    err => {
      $('productGrid').innerHTML =
        '<p class="loading">Não foi possível carregar os produtos neste momento.</p>';

      console.error(err);
    }
  );
}

// MOSTRAR PRODUTOS
function renderProducts() {
  const grid = $('productGrid');

  const list = products.filter(
    p => activeFilter === 'all' || p.category === activeFilter
  );

  if (!list.length) {
    grid.innerHTML =
      '<p class="loading">Ainda não há produtos nesta categoria.</p>';
    return;
  }

  grid.innerHTML = list.map(p => `
    <article class="product-card">
      <div class="product-image">
        <img src="${escapeHTML(p.image)}"
             alt="${escapeHTML(p.name)}"
             loading="lazy">
      </div>

      <div class="product-info">
        <span class="product-category">
          ${p.category === 'keychain' ? 'Porta-chaves' : 'Sticker'}
        </span>

        <h3>${escapeHTML(p.name)}</h3>

        <p class="product-desc">
          ${escapeHTML(
            p.description ||
            (p.category === 'keychain' ? 'Inclui 2 stickers aleatórios.' : '')
          )}
        </p>

        <div class="product-foot">
          <span class="price">
            ${p.category === 'keychain' ? '4,00 €' : '0,50 € / un.'}
          </span>

          <button class="add-btn" data-add="${p.id}">
            + Adicionar
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// CARRINHO
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;

  if (cart[id] <= 0) {
    delete cart[id];
  }

  renderCart();
}

function renderCart() {
  const entries = Object.entries(cart).filter(
    ([id, q]) => q > 0 && products.some(p => p.id === id)
  );

  const count = entries.reduce((s, [, q]) => s + q, 0);

  $('cartCount').textContent = count;
  $('cartTitleCount').textContent = `(${count})`;

  const el = $('cartItems');

  if (!entries.length) {
    el.innerHTML =
      '<p class="empty-cart">Ainda não escolheste nada. Vai espreitar a loja!</p>';
  } else {
    el.innerHTML = entries.map(([id, q]) => {
      const p = products.find(x => x.id === id);

      const price = p.category === 'keychain'
        ? `${euro(4 * q)} · inclui ${2 * q} stickers aleatórios`
        : 'Preço calculado no pack de stickers';

      return `
        <div class="cart-row">
          <img src="${escapeHTML(p.image)}" alt="">

          <div>
            <h4>${escapeHTML(p.name)}</h4>
            <small>${price}</small>

            <div class="qty">
              <button data-change="${id}" data-delta="-1">−</button>
              <b>${q}</b>
              <button data-change="${id}" data-delta="1">+</button>
            </div>
          </div>

          <div>
            <button class="remove"
                    data-remove="${id}"
                    aria-label="Remover">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  const sc = stickerCount();

  const kt = entries.reduce((s, [id, q]) => {
    return s + (
      products.find(p => p.id === id)?.category === 'keychain' ? q : 0
    );
  }, 0);

  $('cartTotal').textContent = euro(cartTotal());

  $('cartBreakdown').innerHTML = `
    <div class="price-breakdown">
      <span>Stickers (${sc})</span>
      <b>${euro(stickerTotal(sc))}</b>
    </div>

    <div class="price-breakdown">
      <span>Porta-chaves (${kt})</span>
      <b>${euro(kt * 4)}</b>
    </div>
  `;
}

function openCart() {
  $('cartPanel').classList.add('open');
  $('overlay').classList.add('show');
}

function closeCart() {
  $('cartPanel').classList.remove('open');
  $('overlay').classList.remove('show');
}

// EVENTOS DO CARRINHO
$('productGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-add]');

  if (b) {
    addToCart(b.dataset.add);
  }
});

$('cartItems').addEventListener('click', e => {
  const q = e.target.closest('[data-change]');
  const r = e.target.closest('[data-remove]');

  if (q) {
    changeQty(q.dataset.change, Number(q.dataset.delta));
  }

  if (r) {
    changeQty(r.dataset.remove, -(cart[r.dataset.remove] || 0));
  }
});

const cartOpenButton = $('cartOpen');
const cartCloseButton = $('cartClose');
const cartOverlay = $('overlay');

if (cartOpenButton) {
  cartOpenButton.addEventListener('click', openCart);
}

if (cartCloseButton) {
  cartCloseButton.addEventListener('click', closeCart);
}

if (cartOverlay) {
  cartOverlay.addEventListener('click', closeCart);
}

// FILTROS
document.querySelectorAll('.filter').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(x => {
      x.classList.remove('active');
    });

    b.classList.add('active');
    activeFilter = b.dataset.filter;

    renderProducts();
  });
});


// POP-UP DE CONFIRMAÇÃO
function showOrderSuccess(orderId) {
  $('successOrderNumber').textContent =
    `Número da encomenda: ${orderId}`;

  $('successModal').hidden = false;
}

function closeOrderSuccess() {
  $('successModal').hidden = true;
}

$('successClose').addEventListener('click', closeOrderSuccess);

$('successModal').addEventListener('click', event => {
  if (event.target.id === 'successModal') {
    closeOrderSuccess();
  }
});

// FINALIZAR ENCOMENDA
async function finishOrder() {
  const entries = Object.entries(cart).filter(
    ([id, qty]) => qty > 0 && products.some(p => p.id === id)
  );

  if (!entries.length) {
    $('copyFeedback').textContent = 'O carrinho está vazio.';
    return;
  }

  const name = $('customerName').value.trim();
  const contact = $('customerContact').value.trim();

  // Validar os campos obrigatórios
  if (!name) {
    $('copyFeedback').textContent = 'Por favor, indica o teu nome.';
    $('customerName').focus();
    return;
  }

  if (!contact) {
    $('copyFeedback').textContent = 'Por favor, indica o teu email ou telemóvel.';
    $('customerContact').focus();
    return;
  }

  if (!isValidContact(contact)) {
    $('copyFeedback').textContent =
      'O contacto não parece válido. Introduz um email ou número de telemóvel.';
    $('customerContact').focus();
    return;
  }

  const button = $('finishOrder');

  button.disabled = true;
  button.textContent = 'A registar encomenda...';

  const stickerQty = stickerCount();

  const keychainQty = entries.reduce((sum, [id, qty]) => {
    const p = products.find(x => x.id === id);
    return sum + (p?.category === 'keychain' ? qty : 0);
  }, 0);

  const total = cartTotal();

  const items = entries.map(([id, qty]) => {
    const p = products.find(x => x.id === id);

    return {
      productId: id,
      name: p.name,
      category: p.category,
      quantity: qty
    };
  });

  const details = items.map(item =>
    `${item.quantity} x ${item.name} (${
      item.category === 'keychain' ? 'Porta-chaves' : 'Sticker'
    })`
  ).join('\n');

  try {
    // 1. Guardar a encomenda no Firestore
    const orderRef = await addDoc(collection(db, 'orders'), {
      customerName: name,
      customerContact: contact,
      items,
      stickerCount: stickerQty,
      stickerTotal: stickerTotal(stickerQty),
      keychainCount: keychainQty,
      keychainTotal: keychainQty * 4,
      total,
      status: 'Pendente',
      createdAt: serverTimestamp()
    });

    // 2. Enviar email através do EmailJS
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          order_id: orderRef.id,
          customer_name: name,
          customer_contact: contact,
          order_details: details,
          order_total: euro(total),
          order_date: new Date().toLocaleString('pt-PT')
        },
        {
          publicKey: EMAILJS_PUBLIC_KEY
        }
      );
    } catch (emailError) {
      console.error('Erro no envio do email:', emailError);
    }

    // 3. Limpar o carrinho e os campos
    cart = {};
    renderCart();

    $('customerName').value = '';
    $('customerContact').value = '';
    $('copyFeedback').textContent = '';

    // 4. Fechar o carrinho
    closeCart();

    // 5. Mostrar confirmação
    showOrderSuccess(orderRef.id);

  } catch (error) {
    console.error('Erro ao registar encomenda:', error);

    $('copyFeedback').textContent =
      'Não foi possível registar a encomenda. Tenta novamente.';
  } finally {
    button.disabled = false;
    button.textContent = 'Finalizar encomenda';
  }
}

$('finishOrder').addEventListener('click', finishOrder);

// INICIALIZAÇÃO
loadProducts();
renderCart();
