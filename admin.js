
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

const OWNER = 'inescastro1900-tech';
const REPO = 'thirst-project-uminho';
const BRANCH = 'main';

const $ = id => document.getElementById(id);

let products = [];
let unsubscribe = null;
let imageFiles = [];

const loginPanel = $('loginPanel');
const dashboardPanel = $('dashboardPanel');

function message(id, text, isError = false) {
  const el = $(id);
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
    message('loginFeedback', 'Configura primeiro o firebase-config.js.', true);
    return false;
  }
  return true;
}

// LOGIN
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
    message('loginFeedback', `Erro de autenticação: ${err.message}`, true);
  } finally {
    button.disabled = false;
  }
});

$('logoutBtn').onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (
    user &&
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  ) {
    loginPanel.hidden = true;
    dashboardPanel.hidden = false;
    $('signedInAs').textContent = `Sessão iniciada como ${user.email}`;

    loadImages();
    startProductsListener();
  } else {
    if (user) signOut(auth);

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    loginPanel.hidden = false;
    dashboardPanel.hidden = true;
  }
});

// IMAGENS DO GITHUB
async function loadImages() {
  const folders = ['stickers', 'portachaves'];
  imageFiles = [];

  try {
    for (const folder of folders) {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/assets/${folder}?ref=${BRANCH}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Não foi possível consultar assets/${folder}.`);
      }

      const files = await response.json();

      files
        .filter(file => file.type === 'file' && /\.(png|jpe?g|webp|gif)$/i.test(file.name))
        .forEach(file => {
          imageFiles.push({
            name: file.name,
            path: `assets/${folder}/${file.name}`,
            category: folder === 'stickers' ? 'sticker' : 'keychain'
          });
        });
    }

    updateImageSelector();
  } catch (err) {
    message('saveFeedback', `Erro ao carregar imagens: ${err.message}`, true);
  }
}

function updateImageSelector(selectedPath = '') {
  const category = $('productCategory').value;
  const select = $('productImage');

  const previous = selectedPath || select.value;

  const available = imageFiles.filter(img => img.category === category);

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

// LISTA DE PRODUTOS
function startProductsListener() {
  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(
    collection(db, 'products'),
    snap => {
      products = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt'));

      renderProducts();
    },
    err => message('saveFeedback', `Erro ao ler catálogo: ${err.message}`, true)
  );
}

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
        <small>${p.category === 'keychain' ? 'Porta-chaves · 4,00 €' : 'Sticker · Preço por packs'}</small>
      </div>
      <div class="admin-product-actions">
        <button data-edit="${escapeHTML(p.id)}">Editar</button>
        <button class="delete" data-delete="${escapeHTML(p.id)}">Apagar</button>
      </div>
    </article>
  `).join('') || '<p>Não foram encontrados produtos.</p>';
}

$('adminSearch').oninput = renderProducts;

$('adminProducts').addEventListener('click', e => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');

  if (edit) editProduct(edit.dataset.edit);
  if (del) removeProduct(del.dataset.delete);
});

// FORMULÁRIO
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
      await updateDoc(doc(db, 'products', id), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'products'), data);
    }

    resetForm();
    message('saveFeedback', 'Produto guardado com sucesso!');
  } catch (err) {
    message('saveFeedback', `Não foi possível guardar: ${err.message}`, true);
  } finally {
    button.disabled = false;
    button.textContent = $('editId').value ? 'Guardar alterações' : 'Adicionar produto';
  }
});

// EDITAR
function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  $('editId').value = id;
  $('productName').value = p.name || '';
  $('productCategory').value = p.category || 'sticker';
  $('productDescription').value = p.description || '';

  updateImageSelector(p.imagePath || '');

  if (!p.imagePath && p.image) {
    $('imagePreview').src = p.image;
    $('previewWrap').hidden = false;
  }

  $('formTitle').textContent = 'Editar produto';
  $('saveProduct').textContent = 'Guardar alterações';
  $('cancelEdit').hidden = false;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ELIMINAR
async function removeProduct(id) {
  const p = products.find(x => x.id === id);

  if (!p || !confirm(`Apagar "${p.name}"?`)) return;

  try {
    await deleteDoc(doc(db, 'products', id));
    message('saveFeedback', 'Produto apagado.');
  } catch (err) {
    message('saveFeedback', `Erro ao apagar: ${err.message}`, true);
  }
}

// IMPORTAR CATÁLOGO INICIAL
$('seedBtn').onclick = async () => {
  if (!confirm('Importar os produtos de products.json?')) return;

  const btn = $('seedBtn');
  btn.disabled = true;

  try {
    const response = await fetch('./products.json');

    if (!response.ok) {
      throw new Error('Não foi possível ler products.json.');
    }

    const initial = await response.json();
    const snapshot = await getDocs(collection(db, 'products'));

    const existing = new Set(
      snapshot.docs.map(d => d.data().id || d.id)
    );

    const batch = writeBatch(db);
    let added = 0;

    for (const p of initial) {
      if (existing.has(p.id)) continue;

      const newDoc = doc(db, 'products', p.id);

      batch.set(newDoc, {
        ...p,
        image: imageUrl(p.image),
        imagePath: p.image,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      added++;
    }

    if (added) await batch.commit();

    message('saveFeedback', `${added} produtos importados.`);
  } catch (err) {
    message('saveFeedback', `Erro na importação: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
};
