# Thirst Project UMinho — loja e dashboard

Loja estática publicada no GitHub Pages, com catálogo e gestão de produtos em Firebase (Authentication + Cloud Firestore + Cloud Storage).

## Preços implementados

- Stickers: 0,50 € por unidade; cada conjunto completo de 7 custa 3,00 €. A fórmula também se aplica a quantidades superiores (ex.: 8 = 3,50 €; 14 = 6,00 €).
- Porta-chaves: 4,00 € cada, incluindo 2 stickers aleatórios por porta-chaves. Os stickers incluídos não são adicionados ao total de stickers escolhidos.
- Portes de envio não incluídos; combinados à parte.

## 1. Criar e configurar o Firebase (gratuito no plano Spark para utilização moderada)

1. Abre https://console.firebase.google.com/ e cria um projeto, por exemplo `thirst-project-uminho`.
2. Em **Authentication → Get started → Sign-in method**, ativa **Email/Password**.
3. Em **Authentication → Users → Add user**, cria a conta de administradora com o teu email e uma palavra-passe forte. Não existe registo público no dashboard.
4. Em **Firestore Database → Create database**, cria a base de dados. Podes iniciar em modo de produção.
5. Em **Storage → Get started**, ativa o armazenamento de imagens.
6. Em **Project settings → General → Your apps**, cria uma aplicação Web (`</>`) e copia o objeto `firebaseConfig`.
7. Abre `firebase-config.js` e substitui todos os valores `COLOCA_AQUI` pelos valores do Firebase. Preenche `ADMIN_EMAIL` com o email usado para criar a conta.
8. Abre `firestore.rules` e `storage.rules`; substitui `COLOCA_AQUI_O_TEU_EMAIL` pelo mesmo email. Publica as regras nas secções **Firestore Database → Rules** e **Storage → Rules**.

> A configuração Firebase da aplicação Web (incluindo apiKey) é pública por desenho. A proteção real é feita pelas regras de segurança no Firestore/Storage e pela autenticação. Não coloques palavras-passe ou chaves privadas no repositório.

## 2. Publicar no GitHub Pages

Carrega para a raiz do repositório todos os ficheiros atualizados deste projeto, incluindo `firebase-config.js`, `firebase.js`, `admin.js`, `app.js`, `firestore.rules` e `storage.rules`, além de `assets/` e `products.json`. Mantém a pasta `assets/stickers/`.

Em **Settings → Pages**, escolhe `Deploy from a branch`, branch `main` e pasta `/ (root)`. O site público ficará em `https://<utilizador>.github.io/<repositorio>/`.

## 3. Primeira importação dos 201 stickers

Depois de configurares o Firebase e publicares os ficheiros:

1. Abre `https://<utilizador>.github.io/<repositorio>/admin.html`.
2. Inicia sessão com o email e palavra-passe criados no Firebase Authentication.
3. Clica uma vez em **Importar catálogo inicial**. O dashboard lê `products.json` e cria os documentos na coleção `products` do Firestore. Produtos com o mesmo nome e categoria são ignorados.
4. A loja passa a ler o catálogo diretamente do Firestore.

As imagens dos 201 stickers continuam a ser servidas pela pasta `assets/stickers/`. As imagens de novos produtos carregadas no dashboard são enviadas automaticamente para Firebase Storage.

## 4. Gestão diária

No dashboard podes adicionar, editar e apagar stickers e porta-chaves. Cada alteração é guardada automaticamente no Firestore e aparece na loja pública sem novo commit no GitHub. O carrinho e o total são calculados no navegador.

## Notas

- O GitHub Pages aloja apenas a parte pública (HTML/CSS/JS); Firebase fornece autenticação e persistência.
- A conta de administradora deve ser criada manualmente na consola Firebase. O site não permite criar contas.
- Qualquer visitante pode ler o catálogo e as imagens públicas, mas só o email definido nas regras pode alterar produtos ou enviar imagens.
- Os preços estão definidos no `app.js`; se a política de preços mudar, atualiza a fórmula e publica a alteração no GitHub.
