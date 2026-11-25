
import { db, firebaseConfigured } from './firebase.js';

import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// CLOUDINARY
const CLOUDINARY_CLOUD_NAME = 'yljkzzdq';
const CLOUDINARY_UPLOAD_PRESET = 'thirst-project-references';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const euro = n => Number(n || 0).toLocaleString('pt-PT', {
  style: 'currency',
  currency: 'EUR'
});

let products = [];
let cart = [];
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

function newLineId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stickerCount() {
  return cart.reduce((sum, item) => {
    const p = products.find(x => x.id === item.productId);
    return sum + (p?.category === 'sticker' ? item.quantity : 0);
  }, 0);
}

function stickerTotal(qty) {
  return Math.floor(qty / 7) * 3 + (qty % 7) * 0.5;
}

function cartTotal() {
  const stickers = stickerTotal(stickerCount());

  const keys = cart.reduce((sum, item) => {
    const p = products.find(x => x.id === item.productId);
    return sum + (p?.category === 'keychain' ? item.quantity : 0);
  }, 0);

  return stickers + keys * 4;
}

function isValidContact(contact) {
  const value = contact.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const phoneDigits = value.replace(/\D/g, '');
  const isPhone = phoneDigits.length >= 7 && phoneDigits.length <= 15;

  return isEmail || isPhone;
}

function validateImage(file) {
  if (!file) return;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('A imagem deve estar em formato JPG, PNG ou WEBP.');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('A imagem não pode ultrapassar 5 MB.');
  }
}

// ENVIAR IMAGEM PARA CLOUDINARY
async function uploadReferenceImage(file) {
  validateImage(file);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const endpoint =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    console.error('Erro Cloudinary:', result);
    throw new Error('Não foi possível enviar uma imagem de referência.');
  }

  return result.secure_url;
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

        ${p.category === 'keychain' ? `
          <div class="personalization-box">
            <label class="personalization-toggle">
              <input type="checkbox" data-personalize="${escapeHTML(p.id)}">
              Quero este porta-chaves personalizado
            </label>

            <div class="personalization-fields"
                 data-personalization-fields="${escapeHTML(p.id)}"
                 hidden>

              <label>
                Descreve a personalização
                <textarea
                  data-custom-description="${escapeHTML(p.id)}"
                  maxlength="500"
                  rows="3"
                  placeholder="Ex.: Quero o meu nome em letras azuis..."
                ></textarea>
              </label>

              <label>
                Imagem de referência (opcional)
                <input
                  type="file"
                  data-custom-image="${escapeHTML(p.id)}"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                >
              </label>

              <small>Formatos JPG, PNG ou WEBP. Máximo 5 MB.</small>

              <div class="reference-preview"
                   data-reference-preview="${escapeHTML(p.id)}"
                   hidden>
                <img data-reference-preview-image="${escapeHTML(p.id)}"
                     alt="Pré-visualização da referência">
                <button type="button"
                        data-clear-reference="${escapeHTML(p.id)}">
                  Remover imagem
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="product-foot">
          <span class="price">
            ${p.category === 'keychain' ? '4,00 €' : '0,50 € / un.'}
          </span>

          <button class="add-btn" data-add="${escapeHTML(p.id)}">
            + Adicionar
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// CARRINHO
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const personalizedCheckbox =
    document.querySelector(`[data-personalize="${CSS.escape(id)}"]`);

  const isPersonalized =
    p.category === 'keychain' && personalizedCheckbox?.checked;

  if (isPersonalized) {
    const descriptionInput =
      document.querySelector(`[data-custom-description="${CSS.escape(id)}"]`);

    const imageInput =
      document.querySelector(`[data-custom-image="${CSS.escape(id)}"]`);

    const description = descriptionInput?.value.trim() || '';
    const file = imageInput?.files?.[0] || null;

    if (!description) {
      alert('Escreve uma descrição para a personalização.');
      descriptionInput?.focus();
      return;
    }

    try {
      if (file) validateImage(file);
    } catch (error) {
      alert(error.message);
      return;
    }

    cart.push({
      lineId: newLineId(),
      productId: id,
      quantity: 1,
      personalized: true,
      customizationDescription: description,
      referenceFile: file,
      referencePreview: file ? URL.createObjectURL(file) : null
    });

    // Limpar os campos para permitir uma personalização diferente
    if (descriptionInput) descriptionInput.value = '';
    if (imageInput) imageInput.value = '';

    const preview = document.querySelector(
      `[data-reference-preview="${CSS.escape(id)}"]`
    );

    if (preview) preview.hidden = true;

    if (personalizedCheckbox) personalizedCheckbox.checked = false;

    const fields = document.querySelector(
      `[data-personalization-fields="${CSS.escape(id)}"]`
    );

    if (fields) fields.hidden = true;

  } else {
    // Produtos normais iguais são agrupados
    const existing = cart.find(item =>
      item.productId === id && !item.personalized
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        lineId: newLineId(),
        productId: id,
        quantity: 1,
        personalized: false
      });
    }
  }

  renderCart();
}

function changeQty(lineId, delta) {
  const item = cart.find(x => x.lineId === lineId);
  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    removeCartLine(lineId);
    return;
  }

  renderCart();
}

function removeCartLine(lineId) {
  const index = cart.findIndex(x => x.lineId === lineId);
  if (index === -1) return;

  const item = cart[index];

  if (item.referencePreview) {
    URL.revokeObjectURL(item.referencePreview);
  }

  cart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const entries = cart.filter(item =>
    item.quantity > 0 && products.some(p => p.id === item.productId)
  );

  const count = entries.reduce((s, item) => s + item.quantity, 0);

  $('cartCount').textContent = count;
  $('cartTitleCount').textContent = `(${count})`;

  const el = $('cartItems');

  if (!entries.length) {
    el.innerHTML =
      '<p class="empty-cart">Ainda não escolheste nada. Vai espreitar a loja!</p>';
  } else {
    el.innerHTML = entries.map(item => {
      const p = products.find(x => x.id === item.productId);

      const price = p.category === 'keychain'
        ? `${euro(4 * item.quantity)} · inclui ${2 * item.quantity} stickers aleatórios`
        : 'Preço calculado no pack de stickers';

      const personalizationHTML = item.personalized ? `
        <div class="cart-personalization">
          <small><strong>Personalização:</strong>
            ${escapeHTML(item.customizationDescription)}
          </small>

          ${item.referencePreview ? `
            <img class="cart-reference-image"
                 src="${escapeHTML(item.referencePreview)}"
                 alt="Imagem de referência">
          ` : '<small>Sem imagem de referência.</small>'}
        </div>
      ` : '';

      return `
        <div class="cart-row">
          <img src="${escapeHTML(p.image)}" alt="">

          <div>
            <h4>${escapeHTML(p.name)}</h4>
            <small>${price}</small>
            ${personalizationHTML}

            ${item.personalized ? `
              <div class="qty">
                <b>1 unidade personalizada</b>
              </div>
            ` : `
              <div class="qty">
                <button data-change="${escapeHTML(item.lineId)}" data-delta="-1">−</button>
                <b>${item.quantity}</b>
                <button data-change="${escapeHTML(item.lineId)}" data-delta="1">+</button>
              </div>
            `}
          </div>

          <div>
            <button class="remove"
                    data-remove="${escapeHTML(item.lineId)}"
                    aria-label="Remover">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  const sc = stickerCount();

  const kt = entries.reduce((s, item) => {
    return s + (
      products.find(p => p.id === item.productId)?.category === 'keychain'
        ? item.quantity
        : 0
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

// EVENTOS DOS PRODUTOS E PERSONALIZAÇÃO
$('productGrid').addEventListener('click', e => {
  const clearButton = e.target.closest('[data-clear-reference]');

  if (clearButton) {
    const id = clearButton.dataset.clearReference;
    const input = document.querySelector(
      `[data-custom-image="${CSS.escape(id)}"]`
    );

    if (input) input.value = '';

    const preview = document.querySelector(
      `[data-reference-preview="${CSS.escape(id)}"]`
    );

    if (preview) preview.hidden = true;
    return;
  }

  const button = e.target.closest('[data-add]');
  if (button) addToCart(button.dataset.add);
});

$('productGrid').addEventListener('change', e => {
  const checkbox = e.target.closest('[data-personalize]');

  if (checkbox) {
    const id = checkbox.dataset.personalize;
    const fields = document.querySelector(
      `[data-personalization-fields="${CSS.escape(id)}"]`
    );

    if (fields) fields.hidden = !checkbox.checked;
  }

  const fileInput = e.target.closest('[data-custom-image]');

  if (fileInput) {
    const id = fileInput.dataset.customImage;
    const file = fileInput.files?.[0];

    const preview = document.querySelector(
      `[data-reference-preview="${CSS.escape(id)}"]`
    );

    const image = document.querySelector(
      `[data-reference-preview-image="${CSS.escape(id)}"]`
    );

    if (!file) {
      if (preview) preview.hidden = true;
      return;
    }

    try {
      validateImage(file);
    } catch (error) {
      alert(error.message);
      fileInput.value = '';
      if (preview) preview.hidden = true;
      return;
    }

    if (image) image.src = URL.createObjectURL(file);
    if (preview) preview.hidden = false;
  }
});

// EVENTOS DO CARRINHO
$('cartItems').addEventListener('click', e => {
  const q = e.target.closest('[data-change]');
  const r = e.target.closest('[data-remove]');

  if (q) {
    changeQty(q.dataset.change, Number(q.dataset.delta));
  }

  if (r) {
    removeCartLine(r.dataset.remove);
  }
});

const cartOpenButton = $('cartOpen');
const cartCloseButton = $('cartClose');
const cartOverlay = $('overlay');

if (cartOpenButton) cartOpenButton.addEventListener('click', openCart);
if (cartCloseButton) cartCloseButton.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

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

if ($('successClose')) {
  $('successClose').addEventListener('click', closeOrderSuccess);
}

if ($('successModal')) {
  $('successModal').addEventListener('click', event => {
    if (event.target.id === 'successModal') {
      closeOrderSuccess();
    }
  });
}

// FINALIZAR ENCOMENDA
async function finishOrder() {
  const entries = cart.filter(
    item => item.quantity > 0 && products.some(p => p.id === item.productId)
  );

  if (!entries.length) {
    $('copyFeedback').textContent = 'O carrinho está vazio.';
    return;
  }

  const name = $('customerName').value.trim();
  const contact = $('customerContact').value.trim();

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
  button.textContent = 'A preparar encomenda...';

  try {
    // Enviar as imagens de referência antes de criar a encomenda
    const items = [];

    for (const item of entries) {
      const p = products.find(x => x.id === item.productId);

      const orderItem = {
        productId: item.productId,
        name: p.name,
        category: p.category,
        quantity: item.quantity
      };

      if (item.personalized) {
        orderItem.personalized = true;
        orderItem.customizationDescription =
          item.customizationDescription;

        if (item.referenceFile) {
          button.textContent = 'A enviar imagens...';

          orderItem.referenceImageUrl =
            await uploadReferenceImage(item.referenceFile);
        }
      }

      items.push(orderItem);
    }

    const stickerQty = stickerCount();

    const keychainQty = entries.reduce((sum, item) => {
      const p = products.find(x => x.id === item.productId);
      return sum + (p?.category === 'keychain' ? item.quantity : 0);
    }, 0);

    const total = cartTotal();

    const details = items.map(item => {
      let line =
        `${item.quantity} x ${item.name} (${
          item.category === 'keychain' ? 'Porta-chaves' : 'Sticker'
        })`;

      if (item.personalized) {
        line += `\n  Personalização: ${item.customizationDescription}`;
        line += item.referenceImageUrl
          ? `\n  Imagem de referência: ${item.referenceImageUrl}`
          : '\n  Sem imagem de referência';
      }

      return line;
    }).join('\n\n');

    button.textContent = 'A registar encomenda...';

    // Guardar encomenda no Firestore
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

    // EmailJS
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

    // Limpar imagens temporárias
    cart.forEach(item => {
      if (item.referencePreview) {
        URL.revokeObjectURL(item.referencePreview);
      }
    });

    cart = [];
    renderCart();

    $('customerName').value = '';
    $('customerContact').value = '';
    $('copyFeedback').textContent = '';

    closeCart();
    showOrderSuccess(orderRef.id);

  } catch (error) {
    console.error('Erro ao registar encomenda:', error);

    $('copyFeedback').textContent =
      error.message || 'Não foi possível registar a encomenda. Tenta novamente.';

  } finally {
    button.disabled = false;
    button.textContent = 'Finalizar encomenda';
  }
}

$('finishOrder').addEventListener('click', finishOrder);

// INICIALIZAÇÃO
loadProducts();
renderCart();
