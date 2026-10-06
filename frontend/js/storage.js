/* =======================================================
   ESTADO GLOBAL E PERSISTÊNCIA
   ======================================================= */

let hoje = new Date().toISOString().split("T")[0];

let produtos = [];
let vendas = [];
let sangrias = [];
let promocoes = [];
let carrinho = [];
let usuarioLogado = null;

// Reseta o inicioCaixa se for de um dia anterior
let _inicioCaixaSalvo = localStorage.getItem('inicioCaixa');
let _hoje = new Date().toISOString().split('T')[0];
if (_inicioCaixaSalvo && _inicioCaixaSalvo.split('T')[0] < _hoje) {
    _inicioCaixaSalvo = null; // Dia novo — reseta
}
let inicioCaixa = _inicioCaixaSalvo || new Date().toISOString();
localStorage.setItem('inicioCaixa', inicioCaixa);

// ── RESTAURA SESSÃO APÓS F5 ──
(function restaurarSessao() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('token');
            return;
        }
        usuarioLogado = payload.papel;
    } catch(e) {
        localStorage.removeItem('token');
    }
})();

async function carregarDados() {
    produtos = await apiBuscarProdutos();
    const todasVendas = await apiBuscarVendas();
    const todasSangrias = await apiBuscarSangrias();

    const caixaId = sessionStorage.getItem('caixaId');
    const plano = localStorage.getItem('plano') || 'base';
    const temCaixas = ['intermediario', 'avancado'].includes(plano) && caixaId;

    vendas = todasVendas.filter(v => {
        if (v.data < inicioCaixa) return false;
        if (v.cancelada) return false;
        if (temCaixas) return v.caixaId == caixaId;
        return true;
    });

    sangrias = todasSangrias.filter(s => {
        if (s.data < inicioCaixa) return false;
        if (temCaixas) return s.caixaId == caixaId;
        return true;
    });

    promocoes = await apiBuscarPromocoesAtivas();
}

// ── ATUALIZAÇÃO AUTOMÁTICA DE PRODUTOS E PROMOÇÕES A CADA 1 MINUTO ──
setInterval(async () => {
    if (!usuarioLogado) return;
    try {
        produtos = await apiBuscarProdutos();
        promocoes = await apiBuscarPromocoesAtivas();
        render(); // Atualiza a lista visível se tiver algo na busca
    } catch(e) {}
}, 60000);

function precoAtual(produto) {
    const promo = promocoes.find(p => p.produtoId === produto.id);
    return promo ? parseFloat(promo.precoPromocional) : parseFloat(produto.preco);
}

function promocaoAtiva(produtoId) {
    return promocoes.find(p => p.produtoId === produtoId) || null;
}
