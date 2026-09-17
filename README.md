# 🚗 StoreCar / StockCar - Sistema de Gerenciamento de Estoque de Veículos

O **StoreCar** é uma aplicação web voltada para o gerenciamento dinâmico de estoque de veículos. O sistema permite o cadastro e autenticação de usuários, bem como a consulta, inclusão, edição e remoção de carros no estoque.

---

## 📌 Funcionalidades

- **Autenticação de Usuários:**
  - Cadastro de novos usuários (`/cadastro`).
  - Login seguro (`/login`) e encerramento de sessão (`/logout`).
  - Saudação personalizada no menu para usuários autenticados.
- **Gerenciamento de Estoque (CRUD):**
  - **Página Inicial:** Apresentação da plataforma (`/`).
  - **Visualização:** Listagem dos carros disponíveis para público/clientes (`/pagina`).
  - **Painel Administrativo:** Área de gerenciamento de estoque (`/gerencia`).
  - **Edição:** Alteração de marca, modelo, ano, quantidade em estoque e valor unitário (`/gerencia/editar/:id`).
- **Interface e UX:**
  - Layout moderno com elementos em *glassmorphism*.
  - Tratamento e exibição de mensagens de erro dinâmicas.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end:** HTML5, CSS3 (variáveis CSS e estilos modernos), EJS (Embedded JavaScript Templates).
- **Back-end:** Node.js, Express.js.
- **Banco de Dados:** MongoDB (com identificadores no padrão Object ID / Mongoose).

---

## 📂 Estrutura do Projeto

```text
├── public/
│   └── css/
│       └── style.css
├── views/
│   ├── cadastro.ejs
│   ├── editar.ejs
│   ├── gerencia.ejs
│   ├── index.ejs
│   ├── login.ejs
│   └── pagina.ejs
├── comandos.txt
├── revisão
├── servidor.js
└── README.md
