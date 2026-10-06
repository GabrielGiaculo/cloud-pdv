/* =======================================================
   PRODUTOS: cadastro, listagem/busca, edição e exclusão
   ======================================================= */

let _renderTimer = null;

function render() {
    // Debounce — evita renderizações desnecessárias quando o scanner digita rápido
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(_renderImediato, 80);
}

function _renderImediato() {
    if (!usuarioLogado) return;
    let div = document.getElementById("listaProdutos");
    let busca = document.getElementById("busca").value.toLowerCase().trim();

    if (!busca) {
        div.innerHTML = `<div style="color:#334155; font-size:12px; text-align:center; padding:20px 0;">🔍 Digite ou bipe um produto para buscar</div>`;
        return;
    }

    let termoPesquisa = busca;
    if (busca.includes('*')) {
        termoPesquisa = busca.split('*')[1] || "";
    }

    if (!termoPesquisa) return;

    // Busca LOCAL — sem chamada ao servidor
    // Monta HTML de uma vez (evita reflow do DOM a cada item)
    let html = '';
    produtos.forEach((p) => {
        let cod = p.codigoBarras ? p.codigoBarras.toLowerCase() : "";
        if (p.nome.toLowerCase().includes(termoPesquisa) || cod.includes(termoPesquisa)) {
            let alertaEstoqueHtml = p.estoque < 5 ? `<span class="alerta-estoque">ESTOQUE BAIXO</span>` : '';
            let exibeCod = p.codigoBarras ? `<br><small style="color:#94a3b8;">🔍 Cód: ${p.codigoBarras}</small>` : '';
            let infoCusto = usuarioLogado === 'admin' ? ` <span style="color:#94a3b8; font-size:12px;">(Custo: R$ ${parseFloat(p.precoCusto).toFixed(2)})</span>` : '';

            const promo = promocaoAtiva(p.id);
            const precoExibir = promo ? parseFloat(promo.precoPromocional) : parseFloat(p.preco);
            const badgePromo = promo ? `<span class="alerta-estoque" style="background:#f59e0b;">🎯 PROMOÇÃO</span>` : '';
            const precoOriginal = promo ? `<span style="color:#94a3b8; font-size:12px; text-decoration:line-through;">R$ ${parseFloat(p.preco).toFixed(2)}</span> ` : '';

            const botoesAdmin = usuarioLogado === 'admin' ? `
                <button onclick="edit(${p.id})">✏️</button>
                <button onclick="del(${p.id})" class="btn-danger">🗑️</button>
            ` : '';

            html += `
            <div class="produto">
                <b>${p.nome}</b> ${alertaEstoqueHtml}${badgePromo}${exibeCod}<br>
                ${precoOriginal}<span style="color:${promo ? '#f59e0b' : '#38bdf8'}; font-weight:bold;">R$ ${precoExibir.toFixed(2)}</span>${infoCusto} | Estoque: ${p.estoque} un
                <div class="actions">
                    <button onclick="dispararAddDireto(${p.id})" class="btn-success">Adicionar +</button>
                    ${botoesAdmin}
                </div>
            </div>`;
        }
    });
    div.innerHTML = html || `<div style="color:#334155; font-size:12px; text-align:center; padding:20px 0;">Nenhum produto encontrado</div>`;
}

async function addProduto() {
    let n = document.getElementById("nome").value.trim();
    let pc = parseFloat(document.getElementById("precoCusto").value);
    let p = parseFloat(document.getElementById("preco").value);
    let e = parseInt(document.getElementById("estoque").value);
    let c = document.getElementById("codigoBarras").value.trim();

    if (!n) return mostrarAviso("O nome do produto é obrigatório!");
    if (isNaN(pc) || pc < 0) return mostrarAviso("Preço de custo inválido!");
    if (isNaN(p) || p <= 0) return mostrarAviso("O preço de venda deve ser maior que R$ 0,00!");
    if (isNaN(e) || e < 0) return mostrarAviso("A quantidade de estoque não pode ser negativa!");

    try {
        await apiSalvarProduto({ nome: n, precoCusto: pc, preco: p, estoque: e, codigoBarras: c });
        produtos = await apiBuscarProdutos();

        document.getElementById("nome").value = "";
        document.getElementById("precoCusto").value = "";
        document.getElementById("preco").value = "";
        document.getElementById("estoque").value = "";
        document.getElementById("codigoBarras").value = "";

        render();
        mostrarAviso("Produto cadastrado com sucesso!", "#10b981");
    } catch (err) {
        mostrarAviso("Erro ao cadastrar produto!");
    }
}

async function edit(id) {
    if (usuarioLogado !== 'admin') return mostrarAviso("Acesso restrito ao administrador!");

    let produto = produtos.find(p => p.id === id);
    if (!produto) return;

    let promptNome = prompt("Nome do produto:", produto.nome);
    if (promptNome === null) return;
    let nome = promptNome.trim();
    if (!nome) return mostrarAviso("Nome inválido!");

    let promptCusto = prompt("Preço de Custo:", produto.precoCusto || 0);
    if (promptCusto === null) return;
    let precoCusto = parseFloat(promptCusto);
    if (isNaN(precoCusto) || precoCusto < 0) return mostrarAviso("Custo inválido!");

    let promptPreco = prompt("Preço de venda:", produto.preco);
    if (promptPreco === null) return;
    let preco = parseFloat(promptPreco);
    if (isNaN(preco) || preco <= 0) return mostrarAviso("Preço inválido!");

    let promptEstoque = prompt("Quantidade em estoque:", produto.estoque);
    if (promptEstoque === null) return;
    let estoque = parseInt(promptEstoque);
    if (isNaN(estoque) || estoque < 0) return mostrarAviso("Estoque inválido!");

    let promptCod = prompt("Código de barras:", produto.codigoBarras || "");
    if (promptCod === null) return;
    let codigoBarras = promptCod.trim();

    try {
        await apiAtualizarProduto(id, { nome, precoCusto, preco, estoque, codigoBarras });
        produtos = await apiBuscarProdutos();

        let itemNoCar = carrinho.find(c => c.id === id);
        if (itemNoCar) { itemNoCar.nome = nome; itemNoCar.preco = preco; }

        render();
        update();
        mostrarAviso("Produto atualizado!", "#10b981");
    } catch (err) {
        mostrarAviso("Erro ao atualizar produto!");
    }
}

async function del(id) {
    if (usuarioLogado !== 'admin') return mostrarAviso("Acesso restrito ao administrador!");

    let produto = produtos.find(p => p.id === id);
    if (!produto) return;
    if (confirm(`Remover "${produto.nome}"?`)) {
        try {
            await apiDeletarProduto(id);
            produtos = await apiBuscarProdutos();
            carrinho = carrinho.filter(c => c.id !== id);
            render();
            update();
        } catch (err) {
            mostrarAviso("Erro ao remover produto!");
        }
    }
}

function dispararAddDireto(id) {
    let buscaInput = document.getElementById("busca").value.trim();
    let qtd = 1;

    if (buscaInput.includes('*')) {
        let partes = buscaInput.split('*');
        let fator = parseInt(partes[0]);
        if (!isNaN(fator) && fator > 0) qtd = fator;
    }

    add(id, qtd);
    document.getElementById("busca").value = "";
    render();
}
