const API = "";

let usuario = null;

async function login() {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-password").value;

    const res = await fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, senha })
    });

    const data = await res.json();

    if (data.token) {
        usuario = data;
        alert("Login OK");
    } else {
        alert("Erro no login");
    }
}

async function register() {
    const nome = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const senha = document.getElementById("reg-password").value;

    const res = await fetch("/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ nome, email, senha })
    });

    const data = await res.json();

    if (data.ok) {
        alert("Conta criada!");
    } else {
        alert("Erro ao cadastrar");
    }
}

async function bater(tipo) {
    if (!usuario) {
        alert("Faça login primeiro!");
        return;
    }

    await fetch("/ponto", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ userId: usuario.id, tipo })
    });

    alert("Ponto registrado!");
}