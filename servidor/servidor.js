require("colors");

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const uri = 'mongodb+srv://Arthur:0706@cluster0.kdth2yl.mongodb.net/?appName=Cluster0';
const client = new MongoClient(uri);

// Middleware
app.use(express.static("./public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: 'car-marketplace-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.set('view engine', 'ejs');
app.set('views', './views');

// Database Collections
let usuarios, carros;

async function connectDB() {
    try {
        await client.connect();
        const dbo = client.db("exemplo_bd");
        usuarios = dbo.collection("usuarios");
        carros = dbo.collection("carros");
        console.log("Conectado ao MongoDB com sucesso!".green);
    } catch (e) {
        console.error("Erro ao conectar ao MongoDB:".red, e);
    }
}
connectDB();

// Middleware de Autenticação
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// --- ROTAS PRINCIPAIS ---

// Redirecionamento da rota padrão '/' para '/projetos'
app.get('/', (req, res) => {
    res.redirect('/projetos');
});

// Página pública de listagem dos carros disponíveis
app.get('/projetos', async (req, res) => {
    try {
        if (!carros) {
            return res.status(500).send("Banco de dados inicializando...");
        }
        const allCars = await carros.find({}).toArray();
        res.render('projetos', {
            user: req.session.user || null,
            cars: allCars,
            success_msg: req.session.success_msg || null,
            error_msg: req.session.error_msg || null
        });
        
        // Limpar mensagens da sessão para não repetir no reload
        req.session.success_msg = null;
        req.session.error_msg = null;
    } catch (err) {
        console.error("Erro ao carregar página de listagem:", err);
        res.status(500).send("Erro ao carregar listagem dos carros.");
    }
});

// --- ROTAS DE AUTENTICAÇÃO ---

// Página de Cadastro (GET)
app.get('/cadastro', (req, res) => {
    if (req.session.user) {
        return res.redirect('/gerencia');
    }
    res.render('cadastro');
});

// Página de Cadastro (POST - Criar Usuário)
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
            senha: senha // Em produção deve ser hashada
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

// Página de Login (GET)
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/gerencia');
    }
    res.render('login');
});

// Página de Login (POST - Autenticação)
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

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/projetos');
});

// --- ROTAS DE GERÊNCIA DOS CARROS (PROTEGIDAS) ---

// Página de Gerência - Read
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
        
        // Limpar mensagens após exibir
        req.session.success = null;
        req.session.error = null;
    } catch (err) {
        console.error("Erro ao carregar gerência:", err);
        res.status(500).send("Erro interno ao carregar a página de gerência.");
    }
});

// Cadastrar novo carro - Create
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

// Excluir carro - Delete
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

// Editar carro (GET - Renderiza formulário de edição) - Read
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

// Editar carro (POST - Salvar alterações) - Update
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

// --- ROTA DE VENDA (PROTEGIDA/PÚBLICA DEPENDENDO DA AÇÃO) ---

// Vender carro (Decrementa 1 unidade) - Update
app.post('/vender', async (req, res) => {
    const { id, from } = req.body;
    const redirectUrl = from === '/gerencia' ? '/gerencia' : '/projetos';
    
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
        
        let successMsg = `Venda registrada com sucesso! ${car.marca} ${car.modelo} agora possui ${novaQuantidade} unidades.`;
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

// Inicialização do Servidor
app.listen(80, () => {
    console.log("Servidor rodando perfeitamente na porta 80".cyan);
});
