import { auth, db, storage, firebaseConfigured } from './firebase.js';
import { ADMIN_EMAIL } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const $ = id => document.getElementById(id);
let products = [], selectedFile = null, unsubscribe = null;
const loginPanel = $('loginPanel'), dashboardPanel = $('dashboardPanel');

function message(id, text, isError=false) { const el=$(id); el.textContent=text; el.style.color=isError?'#b42318':'#087e83'; }
function escapeHTML(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function requireConfig() { if (!firebaseConfigured) { message('loginFeedback','Falta configurar o ficheiro firebase-config.js antes de iniciar sessão.',true); $('loginForm').querySelector('button').disabled=true; return false; } return true; }

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); if(!requireConfig()) return;
  const button=$('loginForm').querySelector('button'); button.disabled=true; button.textContent='A iniciar sessão…';
  try { await signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value); message('loginFeedback','Sessão iniciada.'); }
  catch(err) { message('loginFeedback',authError(err.code),true); }
  finally { button.disabled=false; button.textContent='Iniciar sessão'; }
});
function authError(code) {
  const map={'auth/invalid-credential':'Email ou palavra-passe incorretos.','auth/user-not-found':'Não existe uma conta com este email. Cria primeiro o utilizador no Firebase Authentication.','auth/wrong-password':'Palavra-passe incorreta.','auth/too-many-requests':'Demasiadas tentativas. Tenta novamente mais tarde.','auth/invalid-email':'O endereço de email não é válido.'};
  return map[code] || `Não foi possível iniciar sessão (${code}). Confirma a configuração do Firebase.`;
}
$('logoutBtn').onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{
  if(user && ADMIN_EMAIL && user.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase()) {
    loginPanel.hidden=true; dashboardPanel.hidden=false; $('signedInAs').textContent=`Sessão iniciada como ${user.email}`; startProductsListener();
  } else {
    if(user) signOut(auth);
    if(unsubscribe) { unsubscribe(); unsubscribe=null; }
    loginPanel.hidden=false; dashboardPanel.hidden=true;
    if(user) message('loginFeedback','Esta conta não está autorizada a gerir a loja.',true);
  }
});
function startProductsListener(){ if(unsubscribe) unsubscribe(); unsubscribe=onSnapshot(collection(db,'products'),snap=>{products=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt'));renderProducts();},err=>message('saveFeedback',`Erro ao ler catálogo: ${err.message}`,true)); }
function renderProducts(){const q=$('adminSearch').value.toLowerCase();const visible=products.filter(p=>(p.name+' '+p.id).toLowerCase().includes(q));$('productCount').textContent=products.length;$('adminProducts').innerHTML=visible.map(p=>`<article class="admin-product"><img src="${escapeHTML(p.image||'')}" alt=""><div class="admin-product-info"><b>${escapeHTML(p.name)}</b><small>${p.category==='keychain'?'Porta-chaves':'Sticker'} · ${p.category==='keychain'?'4,00 €':'Preço por packs'}</small></div><div class="admin-product-actions"><button data-edit="${p.id}">Editar</button><button class="delete" data-delete="${p.id}">Apagar</button></div></article>`).join('')||'<p>Não foram encontrados produtos.</p>';}
$('adminProducts').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');const del=e.target.closest('[data-delete]');if(edit)editProduct(edit.dataset.edit);if(del)removeProduct(del.dataset.delete);});
$('adminSearch').oninput=renderProducts;
$('productImage').addEventListener('change',e=>{selectedFile=e.target.files[0]||null;if(!selectedFile)return;if(!selectedFile.type.startsWith('image/')||selectedFile.size>5*1024*1024){alert('Escolhe uma imagem válida com menos de 5 MB.');e.target.value='';selectedFile=null;return;}const url=URL.createObjectURL(selectedFile);$('imagePreview').src=url;$('previewWrap').hidden=false;});
function resetForm(){ $('productForm').reset();$('editId').value='';selectedFile=null;$('previewWrap').hidden=true;$('formTitle').textContent='Adicionar produto';$('saveProduct').textContent='Adicionar produto';$('cancelEdit').hidden=true; }
$('cancelEdit').onclick=resetForm;
$('productForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=$('saveProduct');button.disabled=true;button.textContent='A guardar…';
 try{
  const id=$('editId').value;const old=products.find(p=>p.id===id);let image=old?.image||'';let imagePath=old?.imagePath||'';
  if(selectedFile){const safeName=selectedFile.name.replace(/[^a-zA-Z0-9._-]/g,'_');imagePath=`products/${crypto.randomUUID()}-${safeName}`;const storageRef=ref(storage,imagePath);await uploadBytes(storageRef,selectedFile,{contentType:selectedFile.type});image=await getDownloadURL(storageRef);}
  if(!image)throw new Error('Adiciona uma fotografia ao produto.');
  const data={name:$('productName').value.trim(),category:$('productCategory').value,description:$('productDescription').value.trim(),image,imagePath:imagePath||old?.imagePath||'',updatedAt:serverTimestamp()};
  if(id){await updateDoc(doc(db,'products',id),data);if(selectedFile&&old?.imagePath)deleteObject(ref(storage,old.imagePath)).catch(()=>{});}
  else {data.createdAt=serverTimestamp();await addDoc(collection(db,'products'),data);}
  resetForm();message('saveFeedback','Produto guardado e sincronizado com a loja.');
 }catch(err){message('saveFeedback',`Não foi possível guardar: ${err.message}`,true);}
 finally{button.disabled=false;button.textContent=$('editId').value?'Guardar alterações':'Adicionar produto';}
});
function editProduct(id){const p=products.find(x=>x.id===id);if(!p)return;$('editId').value=id;$('productName').value=p.name||'';$('productCategory').value=p.category||'sticker';$('productDescription').value=p.description||'';$('imagePreview').src=p.image;$('previewWrap').hidden=false;$('formTitle').textContent='Editar produto';$('saveProduct').textContent='Guardar alterações';$('cancelEdit').hidden=false;selectedFile=null;window.scrollTo({top:0,behavior:'smooth'});}
async function removeProduct(id){const p=products.find(x=>x.id===id);if(!p||!confirm(`Apagar “${p.name}”?`))return;try{await deleteDoc(doc(db,'products',id));if(p.imagePath)await deleteObject(ref(storage,p.imagePath)).catch(()=>{});message('saveFeedback','Produto apagado.');}catch(err){message('saveFeedback',`Erro ao apagar: ${err.message}`,true);}}
$('seedBtn').onclick=async()=>{if(!confirm('Importar os produtos de products.json para a base de dados? Produtos com o mesmo nome e categoria serão ignorados.'))return;const btn=$('seedBtn');btn.disabled=true;btn.textContent='A importar…';try{const response=await fetch('./products.json');if(!response.ok)throw new Error('Não foi possível ler products.json.');const initial=await response.json();const existing=new Set(products.map(p=>`${p.name}|${p.category}`));let batch=writeBatch(db),pending=0,added=0;for(const p of initial){if(existing.has(`${p.name}|${p.category}`))continue;const newDoc=doc(collection(db,'products'));batch.set(newDoc,{name:p.name,category:p.category,description:p.description||'',image:p.image,imagePath:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});pending++;added++;if(pending===450){await batch.commit();batch=writeBatch(db);pending=0;}}if(pending)await batch.commit();message('saveFeedback',`${added} produtos importados. Os existentes foram preservados.`);}catch(err){message('saveFeedback',`Erro na importação: ${err.message}`,true);}finally{btn.disabled=false;btn.textContent='Importar catálogo inicial';}};
