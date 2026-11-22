
import { auth, db, firebaseConfigured } from './firebase.js';
import { ADMIN_EMAIL } from './firebase-config.js';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// ==========================================
// CONFIGURAÇÃO
// ==========================================

const OWNER = 'inescastro1900-tech';
const REPO = 'thirst-project-uminho';
const BRANCH = 'main';

const $ = id => document.getElementById(id);

let products = [];
let orders = [];
let imageFiles = [];

let unsubscribeProducts = null;
let unsubscribeOrders = null;

const loginPanel = $('loginPanel');
const dashboardPanel = $('dashboardPanel');

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function message(id, text, isError = false) {
  const el = $(id);

  if (!el) return;

  el.textContent = text;
  el.style.color = isError ? '#b42318' : '#087e83';
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function imageUrl(path) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
}

function requireConfig() {
  if (!firebaseConfigured) {
    message(
      'loginFeedback',
      'Configura primeiro o firebase-config.js.',
      true
    );

    return false;
  }

  return true;
}

// ==========================================
// LOGIN E AUTENTICAÇÃO
// ==========================================

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  if (!requireConfig()) return;

  const button = $('loginForm').querySelector('button');
  button.disabled = true;

  try {
    await signInWithEmailAndPassword(
      auth,
      $('loginEmail').value.trim(),
      $('loginPassword').value
    );

  } catch (err) {
    message(
      'loginFeedback',
      `Erro de autenticação: ${err.message}`,
      true
    );

  } finally {
    button.disabled = false;
  }
});

$('logoutBtn').onclick = () => signOut(auth);

// ==========================================
// ESTADO DA SESSÃO
// ==========================================

onAuthStateChanged(auth, user => {

  if (
    user &&
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  ) {

    loginPanel.hidden = true;
    dashboardPanel.hidden = false;

    $('signedInAs').textContent =
      `Sessão iniciada como ${user.email}`;

    loadImages();

    startProductsListener();
    startOrdersListener();

  } else {

    if (user) {
      signOut(auth);
    }

    if (unsubscribeProducts) {
      unsubscribeProducts();
      unsubscribeProducts = null;
    }

    if (unsubscribeOrders) {
      unsubscribeOrders();
      unsubscribeOrders = null;
    }

    products = [];
    orders = [];

    loginPanel.hidden = false;
    dashboardPanel.hidden = true;
  }
});

// ==========================================
// IMAGENS DO GITHUB
// ==========================================

async function loadImages() {

  const folders = ['stickers', 'portachaves'];

  imageFiles = [];

  try {

    for (const folder of folders) {

      const url =
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/assets/${folder}?ref=${BRANCH}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Não foi possível consultar assets/${folder}.`
        );
      }

      const files = await response.json();

      files
        .filter(file =>
          file.type === 'file' &&
          /\.(png|jpe?g|webp|gif)$/i.test(file.name)
        )
        .forEach(file => {

          imageFiles.push({
            name: file.name,
            path: `assets/${folder}/${file.name}`,
            category: folder === 'stickers'
              ? 'sticker'
              : 'keychain'
          });

        });
    }

    updateImageSelector();

  } catch (err) {

    message(
      'saveFeedback',
      `Erro ao carregar imagens: ${err.message}`,
      true
    );
  }
}

// ==========================================
// SELEÇÃO DE IMAGENS
// ==========================================

function updateImageSelector(selectedPath = '') {

  const category = $('productCategory').value;
  const select = $('productImage');

  const previous = selectedPath || select.value;

  const available = imageFiles.filter(
    img => img.category === category
  );

  select.innerHTML =
    '<option value="">Seleciona uma imagem...</option>' +

    available.map(img =>
      `<option value="${escapeHTML(img.path)}">${escapeHTML(img.name)}</option>`
    ).join('');

  if (available.some(img => img.path === previous)) {
    select.value = previous;
  }

  updatePreview();
}

$('productCategory').addEventListener('change', () => {
  updateImageSelector();
});

$('productImage').addEventListener('change', updatePreview);

function updatePreview() {

  const path = $('productImage').value;

  if (!path) {
    $('previewWrap').hidden = true;
    return;
  }

  $('imagePreview').src = imageUrl(path);
  $('previewWrap').hidden = false;
}

// ==========================================
// GESTÃO DE PRODUTOS
// ==========================================

// IMPORTANTE: Esta função estava em falta no código anterior.

function startProductsListener() {

  if (unsubscribeProducts) {
    unsubscribeProducts();
    unsubscribeProducts = null;
  }

  console.log('A iniciar listener dos produtos...');

  unsubscribeProducts = onSnapshot(
    collection(db, 'products'),

    snapshot => {

      console.log(
        'Produtos recebidos do Firestore:',
        snapshot.size
      );

      products = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderProducts();
    },

    error => {

      console.error(
        'Erro ao carregar produtos:',
        error
      );

      message(
        'saveFeedback',
        `Erro ao carregar produtos: ${error.message}`,
        true
      );
    }
  );
}

// ==========================================
// MOSTRAR PRODUTOS
// ==========================================

function renderProducts() {

  const q = $('adminSearch').value.toLowerCase();

  const visible = products.filter(p =>
    `${p.name || ''} ${p.id}`.toLowerCase().includes(q)
  );

  $('productCount').textContent = products.length;

  $('adminProducts').innerHTML = visible.map(p => `

    <article class="admin-product">

      <img src="${escapeHTML(p.image || '')}" alt="">

      <div class="admin-product-info">

        <b>${escapeHTML(p.name)}</b>

        <small>
          ${p.category === 'keychain'
            ? 'Porta-chaves · 4,00 €'
            : 'Sticker · Preço por packs'}
        </small>

      </div>

      <div class="admin-product-actions">

        <button data-edit="${escapeHTML(p.id)}">
          Editar
        </button>

        <button
          class="delete"
          data-delete="${escapeHTML(p.id)}"
        >
          Apagar
        </button>

      </div>

    </article>

  `).join('') || '<p>Não foram encontrados produtos.</p>';
}

$('adminSearch').oninput = renderProducts;

$('adminProducts').addEventListener('click', e => {

  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');

  if (edit) {
    editProduct(edit.dataset.edit);
  }

  if (del) {
    removeProduct(del.dataset.delete);
  }
});

// ==========================================
// FORMULÁRIO DE PRODUTOS
// ==========================================

function resetForm() {

  $('productForm').reset();

  $('editId').value = '';

  $('previewWrap').hidden = true;

  $('formTitle').textContent = 'Adicionar produto';
  $('saveProduct').textContent = 'Adicionar produto';

  $('cancelEdit').hidden = true;

  updateImageSelector();
}

$('cancelEdit').onclick = resetForm;

$('productForm').addEventListener('submit', async e => {

  e.preventDefault();

  const button = $('saveProduct');

  button.disabled = true;

  try {

    const id = $('editId').value;

    const data = {
      name: $('productName').value.trim(),
      category: $('productCategory').value,
      description: $('productDescription').value.trim(),
      image: imageUrl($('productImage').value),
      imagePath: $('productImage').value,
      updatedAt: serverTimestamp()
    };

    if (!data.imagePath) {
      throw new Error('Seleciona uma imagem.');
    }

    if (id) {

      await updateDoc(
        doc(db, 'products', id),
        data
      );

    } else {

      data.createdAt = serverTimestamp();

      await addDoc(
        collection(db, 'products'),
        data
      );
    }

    resetForm();

    message(
      'saveFeedback',
      'Produto guardado com sucesso!'
    );

  } catch (err) {

    message(
      'saveFeedback',
      `Não foi possível guardar: ${err.message}`,
      true
    );

  } finally {

    button.disabled = false;

    button.textContent =
      $('editId').value
        ? 'Guardar alterações'
        : 'Adicionar produto';
  }
});

// ==========================================
// EDITAR PRODUTO
// ==========================================

function editProduct(id) {

  const p = products.find(x => x.id === id);

  if (!p) return;

  $('editId').value = id;

  $('productName').value = p.name || '';

  $('productCategory').value =
    p.category || 'sticker';

  $('productDescription').value =
    p.description || '';

  updateImageSelector(p.imagePath || '');

  if (!p.imagePath && p.image) {
    $('imagePreview').src = p.image;
    $('previewWrap').hidden = false;
  }

  $('formTitle').textContent = 'Editar produto';

  $('saveProduct').textContent =
    'Guardar alterações';

  $('cancelEdit').hidden = false;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// ==========================================
// ELIMINAR PRODUTO
// ==========================================

async function removeProduct(id) {

  const p = products.find(x => x.id === id);

  if (!p || !confirm(`Apagar "${p.name}"?`)) {
    return;
  }

  try {

    await deleteDoc(
      doc(db, 'products', id)
    );

    message(
      'saveFeedback',
      'Produto apagado.'
    );

  } catch (err) {

    message(
      'saveFeedback',
      `Erro ao apagar: ${err.message}`,
      true
    );
  }
}

// ==========================================
// IMPORTAR CATÁLOGO INICIAL
// ==========================================

$('seedBtn').onclick = async () => {

  if (!confirm('Importar os produtos de products.json?')) {
    return;
  }

  const btn = $('seedBtn');

  btn.disabled = true;

  try {

    const response = await fetch('./products.json');

    if (!response.ok) {
      throw new Error(
        'Não foi possível ler products.json.'
      );
    }

    const initial = await response.json();

    const snapshot = await getDocs(
      collection(db, 'products')
    );

    const existing = new Set(
      snapshot.docs.map(d => d.data().id || d.id)
    );

    const batch = writeBatch(db);

    let added = 0;

    for (const p of initial) {

      if (existing.has(p.id)) continue;

      const newDoc = doc(
        db,
        'products',
        p.id
      );

      batch.set(newDoc, {
        ...p,
        image: imageUrl(p.image),
        imagePath: p.image,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      added++;
    }

    if (added) {
      await batch.commit();
    }

    message(
      'saveFeedback',
      `${added} produtos importados.`
    );

  } catch (err) {

    message(
      'saveFeedback',
      `Erro na importação: ${err.message}`,
      true
    );

  } finally {

    btn.disabled = false;
  }
};

// ==========================================
// GESTÃO DE ENCOMENDAS
// ==========================================

function startOrdersListener() {

  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = null;
  }

  const container = $('adminOrders');

  if (!container) {
    console.error(
      'Elemento adminOrders não encontrado.'
    );

    return;
  }

  container.innerHTML =
    '<p>A carregar encomendas...</p>';

  console.log(
    '1. A iniciar listener das encomendas...'
  );

  unsubscribeOrders = onSnapshot(
    collection(db, 'orders'),

    snapshot => {

      console.log(
        '2. Listener executado!'
      );

      console.log(
        '3. Número de encomendas:',
        snapshot.size
      );

      orders = snapshot.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .sort((a, b) => {

          const dateA =
            a.createdAt?.toDate?.()?.getTime() || 0;

          const dateB =
            b.createdAt?.toDate?.()?.getTime() || 0;

          return dateB - dateA;
        });

      console.log(
        '4. Encomendas recebidas:',
        orders
      );

      renderOrders();
    },

    error => {

      console.error(
        'Erro ao carregar encomendas:',
        error
      );

      container.innerHTML = `
        <p class="feedback">
          Não foi possível carregar as encomendas:
          ${escapeHTML(error.message)}
        </p>
      `;
    }
  );
}

// ==========================================
// FORMATAÇÃO DAS ENCOMENDAS
// ==========================================

function formatOrderDate(timestamp) {

  if (!timestamp?.toDate) {
    return 'Data indisponível';
  }

  return timestamp.toDate().toLocaleString(
    'pt-PT',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
}

function orderStatusOptions(current) {

  const statuses = [
    'Pendente',
    'Em preparação',
    'Pronta',
    'Entregue',
    'Cancelada'
  ];

  return statuses.map(status => `

    <option
      value="${status}"
      ${current === status ? 'selected' : ''}
    >
      ${status}
    </option>

  `).join('');
}

// ==========================================
// MOSTRAR ENCOMENDAS
// ==========================================

function renderOrders() {

  const container = $('adminOrders');

  if (!container) return;

  const search =
    $('orderSearch').value.trim().toLowerCase();

  const statusFilter =
    $('orderStatusFilter').value;

  $('orderCount').textContent = orders.length;

  const visible = orders.filter(order => {

    const matchesSearch =
      (order.customerName || '')
        .toLowerCase()
        .includes(search) ||
      order.id.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === 'all' ||
      (order.status || 'Pendente') === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!visible.length) {

    container.innerHTML = `
      <p class="empty-orders">
        ${orders.length
          ? 'Não existem encomendas com estes filtros.'
          : 'Ainda não existem encomendas.'}
      </p>
    `;

    return;
  }

  container.innerHTML = visible.map(order => {

    const items =
      Array.isArray(order.items)
        ? order.items
        : [];

    const itemHTML = items.map(item => `

      <div class="order-item">

        <span>
          ${escapeHTML(item.name || 'Produto')}
          ${item.category === 'keychain'
            ? '(Porta-chaves)'
            : '(Sticker)'}
        </span>

        <b>
          ${Number(item.quantity) || 0} ×
        </b>

      </div>

    `).join('');

    const total = Number(
      order.total || 0
    ).toLocaleString('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    });

    const status =
      order.status || 'Pendente';

    return `

      <article class="order-card">

        <div class="order-header">

          <div>

            <span class="order-number">
              ENCOMENDA #${escapeHTML(order.id.slice(0, 8))}
            </span>

            <h3>
              ${escapeHTML(order.customerName || 'Cliente sem nome')}
            </h3>

            <small>
              ${formatOrderDate(order.createdAt)}
            </small>

          </div>

          <strong class="order-total">
            ${total}
          </strong>

        </div>

        <div class="order-items">
          ${itemHTML}
        </div>

        <div class="order-footer">

          <label>
            Estado:

            <select
              class="order-status"
              data-order-status="${escapeHTML(order.id)}"
            >
              ${orderStatusOptions(status)}
            </select>

          </label>

          <button
            class="delete"
            type="button"
            data-delete-order="${escapeHTML(order.id)}"
          >
            Apagar encomenda
          </button>

        </div>

      </article>

    `;

  }).join('');
}

// ==========================================
// PESQUISA E FILTROS
// ==========================================

$('orderSearch').addEventListener(
  'input',
  renderOrders
);

$('orderStatusFilter').addEventListener(
  'change',
  renderOrders
);

// ==========================================
// ALTERAR ESTADO DA ENCOMENDA
// ==========================================

$('adminOrders').addEventListener(
  'change',
  async event => {

    const select =
      event.target.closest('[data-order-status]');

    if (!select) return;

    const id = select.dataset.orderStatus;
    const newStatus = select.value;

    select.disabled = true;

    try {

      await updateDoc(
        doc(db, 'orders', id),
        {
          status: newStatus
        }
      );

    } catch (error) {

      alert(
        `Não foi possível atualizar a encomenda: ${error.message}`
      );

      renderOrders();

    } finally {

      select.disabled = false;
    }
  }
);

// ==========================================
// ELIMINAR ENCOMENDA
// ==========================================

$('adminOrders').addEventListener(
  'click',
  async event => {

    const button =
      event.target.closest('[data-delete-order]');

    if (!button) return;

    const id = button.dataset.deleteOrder;

    if (!confirm(
      'Tens a certeza de que queres apagar esta encomenda?'
    )) {
      return;
    }

    button.disabled = true;

    try {

      await deleteDoc(
        doc(db, 'orders', id)
      );

    } catch (error) {

      alert(
        `Não foi possível apagar a encomenda: ${error.message}`
      );

      button.disabled = false;
    }
  }
);
