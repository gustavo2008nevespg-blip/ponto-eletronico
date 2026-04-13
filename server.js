const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const SECRET = "segredo_super_secreto_2026";
const PORT = process.env.PORT || 10000;
const SENHA_ADMIN = "110908";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("banco.db");

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pontos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        tipo TEXT NOT NULL,
        data TEXT NOT NULL,
        hora TEXT NOT NULL
    )`);
});

// Middleware de autenticação
function autenticar(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ erro: "Token não fornecido" });
    }

    jwt.verify(authHeader.split(" ")[1], SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ erro: "Token inválido" });
        req.user = decoded;
        next();
    });
}

// CADASTRO - Senha 110908 cria Admin
app.post("/register", async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
    }

    try {
        const hash = await bcrypt.hash(senha, 10);
        const role = (senha === SENHA_ADMIN) ? "admin" : "user";

        db.run("INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)",
            [nome.trim(), email.toLowerCase().trim(), hash, role],
            (err) => {
                if (err) {
                    if (err.code === "SQLITE_CONSTRAINT") {
                        return res.status(409).json({ erro: "Este email já está cadastrado" });
                    }
                    return res.status(500).json({ erro: "Erro ao cadastrar" });
                }
                res.json({ 
                    ok: true, 
                    mensagem: role === "admin" ? "Administrador cadastrado com sucesso!" : "Usuário cadastrado com sucesso!" 
                });
            });
    } catch (e) {
        res.status(500).json({ erro: "Erro interno" });
    }
});

app.post("/login", (req, res) => {
    const { email, senha } = req.body;

    db.get("SELECT * FROM usuarios WHERE email = ?", [email.toLowerCase().trim()], async (err, user) => {
        if (err || !user) return res.status(401).json({ erro: "Email ou senha incorretos" });

        const ok = await bcrypt.compare(senha, user.senha);
        if (!ok) return res.status(401).json({ erro: "Email ou senha incorretos" });

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "12h" });
        res.json({ ok: true, token, id: user.id, nome: user.nome, role: user.role });
    });
});

app.post("/ponto", autenticar, (req, res) => {
    const { tipo } = req.body;
    const userId = req.user.id;

    if (!["entrada", "saida", "almoco"].includes(tipo)) {
        return res.status(400).json({ erro: "Tipo inválido" });
    }

    const agora = new Date();
    const data = agora.toLocaleDateString("pt-BR");
    const hora = agora.toTimeString().slice(0, 5);

    db.run("INSERT INTO pontos (userId, tipo, data, hora) VALUES (?, ?, ?, ?)",
        [userId, tipo, data, hora],
        (err) => {
            if (err) return res.status(500).json({ erro: "Erro ao registrar ponto" });
            res.json({ ok: true });
        });
});

app.get("/pontos/:id", autenticar, (req, res) => {
    const requestedId = parseInt(req.params.id);
    if (requestedId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ erro: "Acesso negado" });
    }

    db.all("SELECT * FROM pontos WHERE userId = ? ORDER BY id DESC", [requestedId], (err, rows) => {
        if (err) return res.status(500).json({ erro: "Erro ao carregar pontos" });
        res.json(rows);
    });
});

app.get("/admin", autenticar, (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ erro: "Acesso negado" });

    db.all(`
        SELECT u.nome, p.* 
        FROM pontos p
        JOIN usuarios u ON u.id = p.userId 
        ORDER BY p.id DESC
    `, (err, rows) => {
        if (err) return res.status(500).json({ erro: "Erro ao carregar admin" });
        res.json(rows);
    });
});

app.post("/corrigir", autenticar, (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ erro: "Acesso negado" });

    const { id, hora } = req.body;
    if (!id || !hora) return res.status(400).json({ erro: "ID e hora são obrigatórios" });

    db.run("UPDATE pontos SET hora = ? WHERE id = ?", [hora, id], function(err) {
        if (err) return res.status(500).json({ erro: "Erro ao atualizar" });
        if (this.changes === 0) return res.status(404).json({ erro: "Ponto não encontrado" });
        res.json({ ok: true });
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});