# Thirst Project UMinho — Loja

Loja estática para GitHub Pages, com catálogo, filtros, carrinho e dashboard de gestão.

## Publicar no GitHub Pages
1. Cria um repositório GitHub (por exemplo `thirst-project-uminho`).
2. Carrega **todo o conteúdo desta pasta** para a raiz do repositório: `index.html`, `admin.html`, `styles.css`, `app.js`, `admin.js`, `products.json` e a pasta `assets/`.
3. No GitHub, abre **Settings → Pages**.
4. Em **Build and deployment**, escolhe **Deploy from a branch**, branch `main` e pasta `/ (root)`. Guarda.
5. O site ficará disponível em `https://TEU-UTILIZADOR.github.io/thirst-project-uminho/` (pode demorar alguns minutos).

## Gerir produtos
1. Abre o endereço do site seguido de `/admin.html`.
2. Preenche nome, categoria, preço e imagem; também podes editar ou apagar produtos.
3. As alterações no dashboard ficam temporariamente guardadas na memória da página/navegador, não no GitHub.
4. Quando terminares, clica **Exportar catálogo**. O browser descarrega um novo `products.json`.
5. No repositório GitHub, substitui o `products.json` antigo pelo novo e faz **Commit changes**. Depois de o Pages atualizar, os produtos ficam visíveis para todos.

As imagens novas são incorporadas no `products.json` exportado (base64), por isso não precisas de as carregar separadamente. Mantém as imagens otimizadas e com menos de 5 MB.

## Importante sobre o checkout
O carrinho calcula o total e permite copiar o resumo da encomenda. Não processa pagamentos, não recolhe pagamentos online nem envia encomendas automaticamente. Os portes são combinados à parte. Para usar preços reais, edita os preços dos produtos no dashboard. Os produtos importados têm preço inicial de 0 € e não podem ser adicionados ao carrinho até definires o preço.

## Persistência e segurança
O dashboard é uma ferramenta simples de edição local, sem autenticação. Não publiques dados pessoais nem partilhes o acesso de edição como se fosse um painel privado. Qualquer pessoa que conheça `/admin.html` pode editar o catálogo no seu próprio navegador e exportar uma cópia; só as alterações que forem efetivamente enviadas para o GitHub passam a estar no site público. Para uma equipa gerir produtos online com login e gravação direta, será necessário ligar um serviço com autenticação e base de dados ou implementar um CMS com backend.
