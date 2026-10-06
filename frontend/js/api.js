const API = 'http://localhost:3000';

function getToken() {
    return localStorage.getItem('token');
}

function headers() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

async function apiBuscarProdutos() {
    const res = await fetch(`${API}/produtos`, { headers: headers() });
    return await res.json();
}

async function apiSalvarProduto(produto) {
    const res = await fetch(`${API}/produtos`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(produto)
    });
    return await res.json();
}

async function apiAtualizarProduto(id, produto) {
    const res = await fetch(`${API}/produtos/${id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(produto)
    });
    return await res.json();
}

async function apiDeletarProduto(id) {
    await fetch(`${API}/produtos/${id}`, {
        method: 'DELETE',
        headers: headers()
    });
}

async function apiSalvarVenda(venda) {
    const res = await fetch(`${API}/vendas`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(venda)
    });
    return await res.json();
}

async function apiBuscarVendas() {
    const res = await fetch(`${API}/vendas`, { headers: headers() });
    return await res.json();
}

async function apiBuscarVendasHoje() {
    const hoje = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API}/vendas`, { headers: headers() });
    const todas = await res.json();
    return todas.filter(v => v.data >= `${hoje}T00:00:00`);
}

async function apiSalvarSangria(sangria) {
    const res = await fetch(`${API}/sangrias`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(sangria)
    });
    return await res.json();
}

async function apiBuscarSangrias() {
    const res = await fetch(`${API}/sangrias`, { headers: headers() });
    return await res.json();
}

async function apiCancelarVenda(id) {
    const res = await fetch(`${API}/vendas/${id}`, {
        method: 'DELETE',
        headers: headers()
    });
    return await res.json();
}

// Busca promoções ativas agora (usada pelo PDV)
async function apiBuscarPromocoesAtivas() {
    const res = await fetch(`${API}/promocoes/ativas`, { headers: headers() });
    return await res.json();
}
