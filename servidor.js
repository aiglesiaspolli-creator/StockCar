require("colors");

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { MongoClient, ObjectId } = require("mongodb");

// ===== 2. CONFIGURAÇÃO DO SERVIDOR =====
const app = express();
const uri = '';
const client = new MongoClient(uri);

app.use(express.static("./public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({
    secret: 'car-marketplace-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

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
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ===== 5. ROTAS PÚBLICAS =====
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user || null });
});

app.get('/pagina', async (req, res) => {
    try {
        if (!carros) return res.status(500).send("Banco de dados inicializando...");
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
        res.status(500).send("Erro ao carregar listagem.");
    }
});

// ===== 6. ROTAS DE AUTENTICAÇÃO =====
app.get('/cadastro', (req, res) => { if (req.session.user) return res.redirect('/gerencia'); res.render('cadastro'); });
app.post('/cadastro', async (req, res) => {
    const { nome, login, senha } = req.body;
    try {
        const existe = await usuarios.findOne({ login: login });
        if (existe) return res.render('cadastro', { error: "Login já cadastrado!" });
        const result = await usuarios.insertOne({ nome: nome.trim(), login: login.trim(), senha: senha });
        req.session.user = { id: result.insertedId, nome, login };
        res.redirect('/gerencia');
    } catch (err) { res.render('cadastro', { error: "Erro interno." }); }
});

app.get('/login', (req, res) => { if (req.session.user) return res.redirect('/gerencia'); res.render('login'); });
app.post('/login', async (req, res) => {
    const { login, senha } = req.body;
    const user = await usuarios.findOne({ login: login.trim(), senha: senha });
    if (user) {
        req.session.user = { id: user._id, nome: user.nome, login: user.login };
        res.redirect('/gerencia');
    } else {
        res.render('login', { error: "Login ou senha incorretos!" });
    }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// ===== 7. ROTAS DE GERÊNCIA =====
app.get('/gerencia', checkAuth, async (req, res) => {
    // Filtro para listar apenas carros do usuário logado
    const allCars = await carros.find({ criadoPor: req.session.user.id }).toArray();
    res.render('gerencia', { user: req.session.user, cars: allCars, success: req.session.success, error: req.session.error });
    req.session.success = null; req.session.error = null;
});

app.post('/gerencia/cadastrar', checkAuth, async (req, res) => {
    const { marca, modelo, ano, qtde_disponivel, valor } = req.body;
    try {
        await carros.insertOne({ 
            marca: marca.trim(), 
            modelo: modelo.trim(), 
            ano: parseInt(ano), 
            qtde_disponivel: parseInt(qtde_disponivel), 
            valor: parseFloat(valor), // Campo valor adicionado
            criadoPor: req.session.user.id // Vinculação ao usuário logado
        });
        req.session.success = "Veículo adicionado!";
        res.redirect('/gerencia');
    } catch (err) { req.session.error = "Erro ao cadastrar."; res.redirect('/gerencia'); }
});

app.post('/gerencia/remover', checkAuth, async (req, res) => {
    const result = await carros.deleteOne({ _id: new ObjectId(req.body.id), criadoPor: req.session.user.id });
    req.session.success = result.deletedCount > 0 ? "Veículo removido!" : "Erro: Acesso negado.";
    res.redirect('/gerencia');
});

app.get('/gerencia/editar/:id', checkAuth, async (req, res) => {
    const car = await carros.findOne({ _id: new ObjectId(req.params.id), criadoPor: req.session.user.id });
    if (!car) return res.status(403).send("Acesso negado.");
    res.render('editar', { user: req.session.user, car, error: null });
});

app.post('/gerencia/editar/:id', checkAuth, async (req, res) => {
    const { marca, modelo, ano, qtde_disponivel, valor } = req.body;
    await carros.updateOne(
        { _id: new ObjectId(req.params.id), criadoPor: req.session.user.id }, 
        { $set: { marca: marca.trim(), modelo: modelo.trim(), ano: parseInt(ano), qtde_disponivel: parseInt(qtde_disponivel), valor: parseFloat(valor) } } 
    );
    req.session.success = "Veículo atualizado!";
    res.redirect('/gerencia');
});

// ===== 8. ROTA DE VENDA =====
app.post('/vender', async (req, res) => {
    const { id, from } = req.body;
    const car = await carros.findOne({ _id: new ObjectId(id) });
    if (car && car.qtde_disponivel > 0) {
        await carros.updateOne({ _id: new ObjectId(id) }, { $set: { qtde_disponivel: car.qtde_disponivel - 1 } });
    }
    res.redirect(from);
});

app.listen(80, () => console.log("Servidor rodando na porta 80"));
