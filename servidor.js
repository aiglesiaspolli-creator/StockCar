require("colors");

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { MongoClient, ObjectId } = require("mongodb");

// ===== 2. CONFIGURAÇÃO DO SERVIDOR =====
const app = express();
const uri = 'mongodb+srv://Arthur:0706@cluster0.kdth2yl.mongodb.net/?appName=Cluster0';
const client = new MongoClient(uri);

// Servir arquivos estáticos (CSS, imagens) da pasta "public"
app.use(express.static("./public"));

// Permite ler dados de formulários HTML
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configura sessões para manter o login do usuário
app.use(session({
    secret: 'car-marketplace-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Define EJS como motor de templates e a pasta "views" para as páginas
app.set('view engine', 'ejs');
app.set('views', './views');

// ===== 3. CONEXÃO COM O BANCO DE DADOS =====
let usuarios, carros;

async function connectDB() {
    try {
        await client.connect();
        const dbo = client.db("exemplo_bd");
        usuarios = dbo.collection("usuarios");
        carros = dbo.collection("carros");
        console.log("Conectado ao MongoDB com sucesso!".blue);
    } catch (e) {
        console.error("Erro ao conectar ao MongoDB:".red, e);
    }
}
connectDB();

// ===== 4. MIDDLEWARE DE AUTENTICAÇÃO =====
// Verifica se o usuário está logado antes de acessar páginas protegidas
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ===== 5. ROTAS PÚBLICAS =====

// Redireciona a página inicial para a listagem de carros
app.get('/', (req, res) => {
    res.redirect('/pagina');
});

// Página pública que mostra todos os carros disponíveis
app.get('/pagina', async (req, res) => {
    try {
        if (!carros) {
            return res.status(500).send("Banco de dados inicializando...");
        }
        const allCars = await carros.find({}).toArray();
        res.render('pagina', {
            user: req.session.user || null,
            cars: allCars,
            success_msg: req.session.success_msg || null,
            error_msg: req.session.error_msg || null
        });
        req.session.success_msg = null;
        req.session.error_msg = null;
    } catch (err) {
        console.error("Erro ao carregar listagem:", err);
        res.status(500).send("Erro ao carregar listagem dos carros.");
    }
});

// ===== 6. ROTAS DE AUTENTICAÇÃO =====

// Exibe o formulário de cadastro de novo usuário
app.get('/cadastro', (req, res) => {
    if (req.session.user) {
        return res.redirect('/gerencia');
    }
    res.render('cadastro');
});

// Processa o cadastro de um novo usuário
app.post('/cadastro', async (req, res) => {
    const { nome, login, senha } = req.body;
    try {
        if (!usuarios) {
            return res.render('cadastro', { error: "Banco de dados inicializando..." });
        }
        const existe = await usuarios.findOne({ login: login });
        if (existe) {
            return res.render('cadastro', { error: "Este login já está cadastrado!" });
        }
        const novoUsuario = {
            nome: nome.trim(),
            login: login.trim(),
            senha: senha
        };
        const result = await usuarios.insertOne(novoUsuario);
        req.session.user = {
            id: result.insertedId,
            nome: novoUsuario.nome,
            login: novoUsuario.login
        };
        res.redirect('/gerencia');
    } catch (err) {
        console.error("Erro ao cadastrar usuário:", err);
        res.render('cadastro', { error: "Erro interno ao cadastrar usuário." });
    }
});

// Exibe o formulário de login
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/gerencia');
    }
    res.render('login');
});

// Processa o login do usuário
app.post('/login', async (req, res) => {
    const { login, senha } = req.body;
    try {
        if (!usuarios) {
            return res.render('login', { error: "Banco de dados inicializando..." });
        }
        const user = await usuarios.findOne({ login: login.trim(), senha: senha });
        if (user) {
            req.session.user = {
                id: user._id,
                nome: user.nome,
                login: user.login
            };
            res.redirect('/gerencia');
        } else {
            res.render('login', { error: "Login ou senha incorretos!" });
        }
    } catch (err) {
        console.error("Erro ao realizar login:", err);
        res.render('login', { error: "Erro interno ao processar login." });
    }
});

// Encerra a sessão do usuário e redireciona para a listagem
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/pagina');
});

// ===== 7. ROTAS DE GERÊNCIA (PROTEGIDAS POR LOGIN) =====

// Exibe o painel de gerência com a lista de carros e formulário de cadastro
app.get('/gerencia', checkAuth, async (req, res) => {
    try {
        if (!carros) {
            return res.status(500).send("Banco de dados inicializando...");
        }
        const allCars = await carros.find({}).toArray();
        res.render('gerencia', {
            user: req.session.user,
            cars: allCars,
            success: req.session.success || null,
            error: req.session.error || null
        });
        req.session.success = null;
        req.session.error = null;
    } catch (err) {
        console.error("Erro ao carregar gerência:", err);
        res.status(500).send("Erro interno ao carregar a página de gerência.");
    }
});

// Cadastra um novo carro no banco de dados
app.post('/gerencia/cadastrar', checkAuth, async (req, res) => {
    const { marca, modelo, ano, qtde_disponivel } = req.body;
    try {
        const novoCarro = {
            marca: marca.trim(),
            modelo: modelo.trim(),
            ano: parseInt(ano),
            qtde_disponivel: parseInt(qtde_disponivel)
        };
        await carros.insertOne(novoCarro);
        req.session.success = "Veículo adicionado com sucesso!";
        res.redirect('/gerencia');
    } catch (err) {
        console.error("Erro ao adicionar veículo:", err);
        req.session.error = "Erro interno ao cadastrar veículo.";
        res.redirect('/gerencia');
    }
});

// Remove um carro do banco de dados
app.post('/gerencia/remover', checkAuth, async (req, res) => {
    const { id } = req.body;
    try {
        await carros.deleteOne({ _id: new ObjectId(id) });
        req.session.success = "Veículo removido com sucesso!";
        res.redirect('/gerencia');
    } catch (err) {
        console.error("Erro ao remover veículo:", err);
        req.session.error = "Erro interno ao remover veículo.";
        res.redirect('/gerencia');
    }
});

// Exibe o formulário para editar um carro existente
app.get('/gerencia/editar/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const car = await carros.findOne({ _id: new ObjectId(id) });
        if (!car) {
            req.session.error = "Veículo não encontrado!";
            return res.redirect('/gerencia');
        }
        res.render('editar', {
            user: req.session.user,
            car: car,
            error: req.session.error || null
        });
        req.session.error = null;
    } catch (err) {
        console.error("Erro ao buscar veículo para edição:", err);
        req.session.error = "Erro interno ao acessar formulário de edição.";
        res.redirect('/gerencia');
    }
});

// Salva as alterações feitas em um carro
app.post('/gerencia/editar/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    const { marca, modelo, ano, qtde_disponivel } = req.body;
    try {
        await carros.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    marca: marca.trim(),
                    modelo: modelo.trim(),
                    ano: parseInt(ano),
                    qtde_disponivel: parseInt(qtde_disponivel)
                }
            }
        );
        req.session.success = "Veículo atualizado com sucesso!";
        res.redirect('/gerencia');
    } catch (err) {
        console.error("Erro ao atualizar veículo:", err);
        req.session.error = "Erro interno ao atualizar veículo.";
        res.redirect(`/gerencia/editar/${id}`);
    }
});

// ===== 8. ROTA DE VENDA =====
// Diminui 1 unidade do estoque do carro vendido
app.post('/vender', async (req, res) => {
    const { id, from } = req.body;
    const redirectUrl = from === '/gerencia' ? '/gerencia' : '/pagina';

    try {
        if (!carros) {
            if (from === '/gerencia') req.session.error = "Banco de dados inicializando...";
            else req.session.error_msg = "Banco de dados inicializando...";
            return res.redirect(redirectUrl);
        }

        const car = await carros.findOne({ _id: new ObjectId(id) });
        if (!car) {
            if (from === '/gerencia') req.session.error = "Veículo não encontrado!";
            else req.session.error_msg = "Veículo não encontrado!";
            return res.redirect(redirectUrl);
        }

        if (car.qtde_disponivel <= 0) {
            if (from === '/gerencia') req.session.error = "Este veículo já está Esgotado!";
            else req.session.error_msg = "Este veículo já está Esgotado!";
            return res.redirect(redirectUrl);
        }

        const novaQuantidade = car.qtde_disponivel - 1;
        await carros.updateOne(
            { _id: new ObjectId(id) },
            { $set: { qtde_disponivel: novaQuantidade } }
        );

        let successMsg = `Venda registrada! ${car.marca} ${car.modelo} agora possui ${novaQuantidade} unidades.`;
        if (novaQuantidade === 0) {
            successMsg += " (Modelo Esgotado!)";
        }

        if (from === '/gerencia') {
            req.session.success = successMsg;
        } else {
            req.session.success_msg = successMsg;
        }

        res.redirect(redirectUrl);
    } catch (err) {
        console.error("Erro ao processar venda:", err);
        if (from === '/gerencia') req.session.error = "Erro interno ao realizar venda.";
        else req.session.error_msg = "Erro interno ao realizar venda.";
        res.redirect(redirectUrl);
    }
});

// ===== 9. INICIAR O SERVIDOR =====
app.listen(80, () => {
    console.log("Servidor rodando na porta 80");
});
