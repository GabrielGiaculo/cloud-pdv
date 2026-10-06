/* =======================================================
   RETAGUARDA - Lógica completa
   ======================================================= */

let usuarioLogadoRet = null;
let produtosRet = [];
let etiquetasSelecionadas = {};

// -------------------------------------------------------
// AUTENTICAÇÃO
// -------------------------------------------------------

async function autenticarRetaguarda() {
    let u = document.getElementById("loginUsuario").value.trim().toLowerCase();
    let s = document.getElementById("loginSenha").value;
    let d = document.getElementById("loginDominio").value.trim().toLowerCase();

    if (!d) return mostrarAviso("Informe o domínio da empresa!");

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: u, senha: s, dominio: d })
        });

        if (!res.ok) {
            const erro = await res.json();
            return mostrarAviso(erro.erro || "Usuário ou senha incorretos!");
        }

        const dados = await res.json();

        if (!['admin', 'gerente'].includes(dados.papel)) {
            return mostrarAviso("Acesso restrito ao administrador ou gerente!");
        }

        localStorage.setItem('token', dados.token);
        localStorage.setItem('plano', dados.plano);
        localStorage.setItem('dominio', dados.dominio);
        usuarioLogadoRet = dados;

        document.getElementById("telaLogin").style.display = "none";
        document.getElementById("appRetaguarda").style.display = "flex";
        document.getElementById("usuarioRetaguarda").innerText = `Logado: ${dados.login.toUpperCase()}`;

        // Aplica cargo correto na sidebar
        const roleLabel = document.getElementById("usuarioRole");
        if (roleLabel) {
            if (dados.papel === 'admin') roleLabel.innerText = 'Administrador';
            else if (dados.papel === 'gerente') roleLabel.innerText = 'Gerente';
            else roleLabel.innerText = 'Operador';
        }

        // Aplica restrições de acesso para gerente
        aplicarPermissoesGerente(dados.papel);

        carregarDadosEmpresa();

        // Gerente vai direto para Produtos, admin vai para Dashboard
        if (dados.papel === 'gerente') {
            const liProdutos = document.querySelector('.sidebar-menu li:nth-child(2)');
            if (liProdutos) mudarAba('produtos', liProdutos);
        } else {
            carregarDashboard();
        }

    } catch (err) {
        mostrarAviso("Erro ao conectar com o servidor!");
    }
}

function aplicarPermissoesGerente(papel) {
    if (papel === 'gerente') {
        // Esconde itens do menu que gerente não pode acessar
        const todosItens = document.querySelectorAll('.sidebar-menu li');
        todosItens.forEach(li => {
            const texto = li.innerText.trim();
            if (['Dashboard', 'Vendas', 'Usuários'].some(t => texto.includes(t))) {
                li.style.display = 'none';
            }
        });
        // Esconde menu Configurações para gerente
        const menuCfg = document.getElementById('menuConfiguracoes');
        if (menuCfg) menuCfg.style.display = 'none';

        // Esconde labels de seção desnecessários
        document.querySelectorAll('.nav-section-label').forEach(label => {
            if (label.innerText.includes('Relatórios') || label.innerText.includes('Gestão')) {
                label.style.display = 'none';
            }
        });
    }

    // Esconde menu Caixas para plano base e para gerente
    const plano = localStorage.getItem('plano') || 'base';
    const menuCaixas = document.getElementById('menuCaixas');
    if (menuCaixas) {
        if (!['intermediario', 'avancado'].includes(plano) || papel === 'gerente') {
            menuCaixas.style.display = 'none';
        }
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById("telaLogin").style.display !== 'none') {
        autenticarRetaguarda();
    }
});

function sairRetaguarda() {
    if (confirm("Deseja sair da retaguarda?")) {
        localStorage.removeItem('token');
        location.reload();
    }
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

// -------------------------------------------------------
// NAVEGAÇÃO
// -------------------------------------------------------

function mudarAba(aba, el) {
    document.querySelectorAll('.aba').forEach(a => a.classList.remove('ativa'));
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('ativo'));
    document.getElementById(`aba-${aba}`).classList.add('ativa');
    el.classList.add('ativo');

    if (aba === 'dashboard') carregarDashboard();
    if (aba === 'produtos') carregarProdutosRetaguarda();
    if (aba === 'etiquetas') carregarEtiquetas();
    if (aba === 'promocoes') carregarPromocoes();
    if (aba === 'vendas') { carregarSelectCaixasVendas(); carregarVendasRetaguarda(); }
    if (aba === 'funcionarios') carregarFuncionarios();
    if (aba === 'usuarios') carregarUsuariosRetaguarda();
    if (aba === 'configuracoes') {
        carregarDadosEmpresa();
        // Esconde seção de caixas nas configurações para plano base
        const plano = localStorage.getItem('plano') || 'base';
        const secaoCaixasCfg = document.querySelector('.form-card-title');
        const caixasCards = document.querySelectorAll('.form-card');
        const papelAtual = usuarioLogadoRet?.papel || 'operador';
        caixasCards.forEach(card => {
            const titulo = card.querySelector('.form-card-title');
            if (titulo && titulo.innerText.includes('Gerenciar Caixas')) {
                const podeVerCaixas = ['intermediario', 'avancado'].includes(plano) && papelAtual === 'admin';
                card.style.display = podeVerCaixas ? '' : 'none';
            }
        });
    }
    if (aba === 'caixas') carregarCaixas();
}

// -------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------

function voltarMesAtual() {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById("dashInicio").value = primeiroDia;
    document.getElementById("dashFim").value = ultimoDia;
    carregarDashboard();
}

async function carregarDashboard() {
    try {
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

        const inputInicio = document.getElementById("dashInicio");
        const inputFim = document.getElementById("dashFim");

        if (!inputInicio.value) inputInicio.value = primeiroDia;
        if (!inputFim.value) inputFim.value = ultimoDia;

        const inicio = inputInicio.value;
        const fim = inputFim.value;

        const [todasVendas, todasSangrias] = await Promise.all([
            fetch(`${API}/vendas`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API}/sangrias`, { headers: getHeaders() }).then(r => r.json())
        ]);

        let vendas = todasVendas;
        let sangrias = todasSangrias;

        if (inicio) vendas = vendas.filter(v => v.data >= `${inicio}T00:00:00`);
        if (fim) vendas = vendas.filter(v => v.data <= `${fim}T23:59:59`);
        if (inicio) sangrias = sangrias.filter(s => s.data >= `${inicio}T00:00:00`);
        if (fim) sangrias = sangrias.filter(s => s.data <= `${fim}T23:59:59`);

        let faturamento = 0, lucro = 0, dinheiro = 0, pix = 0, cartao = 0;
        const produtosVendidos = {};

        // Separa vendas normais e canceladas
        const vendasNormais = vendas.filter(v => !v.cancelada);
        const vendasCanceladas = vendas.filter(v => v.cancelada);
        let totalCancelado = vendasCanceladas.reduce((s, v) => s + parseFloat(v.total), 0);

        vendasNormais.forEach(v => {
            faturamento += parseFloat(v.total);
            if (v.metodo === 'dinheiro') dinheiro += parseFloat(v.total);
            if (v.metodo === 'pix') pix += parseFloat(v.total);
            if (v.metodo === 'cartao') cartao += parseFloat(v.total);

            if (v.itens) {
                v.itens.forEach(item => {
                    lucro += (parseFloat(item.preco) - parseFloat(item.precoCusto || 0)) * item.qtd;
                    if (!produtosVendidos[item.nome]) produtosVendidos[item.nome] = { qtd: 0, total: 0 };
                    produtosVendidos[item.nome].qtd += item.qtd;
                    produtosVendidos[item.nome].total += parseFloat(item.preco) * item.qtd;
                });
            }
        });

        let totalSangrias = sangrias.reduce((s, x) => s + parseFloat(x.valor), 0);
        let ticket = vendasNormais.length > 0 ? faturamento / vendasNormais.length : 0;

        document.getElementById("dashFaturamento").innerText = faturamento.toFixed(2);
        document.getElementById("dashLucro").innerText = lucro.toFixed(2);
        document.getElementById("dashQtdVendas").innerText = vendasNormais.length;
        document.getElementById("dashTicket").innerText = ticket.toFixed(2);
        document.getElementById("dashDinheiro").innerText = dinheiro.toFixed(2);
        document.getElementById("dashPix").innerText = pix.toFixed(2);
        document.getElementById("dashCartao").innerText = cartao.toFixed(2);
        document.getElementById("dashSangrias").innerText = totalSangrias.toFixed(2);

        // Exibe cancelamentos no dashboard se houver
        const dashCancelDiv = document.getElementById("dashCancelamentos");
        if (dashCancelDiv) {
            dashCancelDiv.innerText = vendasCanceladas.length > 0
                ? `${vendasCanceladas.length} cancelamento(s) — R$ ${totalCancelado.toFixed(2)}`
                : 'Nenhum cancelamento';
        }

        const maisVendidos = Object.entries(produtosVendidos)
            .sort((a, b) => b[1].qtd - a[1].qtd)
            .slice(0, 10);

        document.getElementById("dashMaisVendidos").innerHTML = maisVendidos.length > 0
            ? maisVendidos.map(([nome, dados], i) => `
                <tr>
                    <td><b style="color:#60a5fa;">#${i + 1}</b></td>
                    <td>${nome}</td>
                    <td>${dados.qtd} un</td>
                    <td>R$ ${dados.total.toFixed(2)}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="4" style="color:#475569; text-align:center;">Nenhuma venda no período.</td></tr>`;

        // Gráficos só para plano avançado
        const plano = localStorage.getItem('plano') || 'base';
        const secaoGraficos = document.getElementById("secaoGraficos");
        if (plano === 'avancado' && secaoGraficos) {
            secaoGraficos.style.display = 'block';
            renderizarGraficos(vendas, dinheiro, pix, cartao, inicio, fim);
        } else if (secaoGraficos) {
            secaoGraficos.style.display = 'none';
        }

    } catch (err) {
        mostrarAviso("Erro ao carregar dashboard!");
    }
}

// Instâncias dos gráficos para destruir antes de recriar
let _chartVendasDia = null;
let _chartPagamentos = null;
let _chartQtdDia = null;

function renderizarGraficos(vendas, dinheiro, pix, cartao, inicio, fim) {
    // Agrupa vendas por dia
    const vendasPorDia = {};
    const qtdPorDia = {};
    vendas.filter(v => !v.cancelada).forEach(v => {
        const dia = new Date(v.data).toLocaleDateString('pt-BR');
        vendasPorDia[dia] = (vendasPorDia[dia] || 0) + parseFloat(v.total);
        qtdPorDia[dia] = (qtdPorDia[dia] || 0) + 1;
    });
    const dias = Object.keys(vendasPorDia).sort((a, b) => {
        const [da, ma, aa] = a.split('/');
        const [db, mb, ab] = b.split('/');
        return new Date(`${aa}-${ma}-${da}`) - new Date(`${ab}-${mb}-${db}`);
    });
    const totaisPorDia = dias.map(d => vendasPorDia[d]);
    const qtdsDia = dias.map(d => qtdPorDia[d]);

    const chartDefaults = {
        color: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.06)',
    };

    // Gráfico 1 — Faturamento por dia
    if (_chartVendasDia) _chartVendasDia.destroy();
    const ctx1 = document.getElementById('graficoVendasDia').getContext('2d');
    _chartVendasDia = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: dias,
            datasets: [{
                label: 'Faturamento (R$)',
                data: totaisPorDia,
                backgroundColor: 'rgba(37,99,235,0.5)',
                borderColor: '#2563eb',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#475569', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { ticks: { color: '#475569', font: { size: 10 }, callback: v => 'R$ ' + v.toFixed(0) }, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
        }
    });

    // Gráfico 2 — Pagamentos (rosca)
    if (_chartPagamentos) _chartPagamentos.destroy();
    const ctx2 = document.getElementById('graficoPagamentos').getContext('2d');
    _chartPagamentos = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Dinheiro', 'Pix', 'Cartão'],
            datasets: [{
                data: [dinheiro, pix, cartao],
                backgroundColor: ['rgba(52,211,153,0.7)', 'rgba(96,165,250,0.7)', 'rgba(251,191,36,0.7)'],
                borderColor: ['#34d399', '#60a5fa', '#fbbf24'],
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
            }
        }
    });

    // Gráfico 3 — Qtd de vendas por dia
    if (_chartQtdDia) _chartQtdDia.destroy();
    const ctx3 = document.getElementById('graficoQtdDia').getContext('2d');
    _chartQtdDia = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: dias,
            datasets: [{
                label: 'Vendas',
                data: qtdsDia,
                borderColor: '#a78bfa',
                backgroundColor: 'rgba(167,139,250,0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#a78bfa',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#475569', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { ticks: { color: '#475569', font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } }
            }
        }
    });
}

// -------------------------------------------------------
// PRODUTOS
// -------------------------------------------------------

async function carregarProdutosRetaguarda() {
    try {
        const res = await fetch(`${API}/produtos`, { headers: getHeaders() });
        produtosRet = await res.json();
        renderTabelaProdutos(produtosRet);
    } catch (err) {
        mostrarAviso("Erro ao carregar produtos!");
    }
}

function renderTabelaProdutos(lista) {
    const tbody = document.getElementById("tabelaProdutos");
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#475569; text-align:center;">Nenhum produto cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        let margem = parseFloat(p.precoCusto) > 0
            ? (((parseFloat(p.preco) - parseFloat(p.precoCusto)) / parseFloat(p.precoCusto)) * 100).toFixed(0)
            : "—";
        let estoqueClass = p.estoque < 5 ? 'badge-vermelho' : 'badge-verde';

        return `<tr>
            <td><b style="color:#e2e8f0;">${p.nome}</b></td>
            <td style="color:#475569;">${p.codigoBarras || '—'}</td>
            <td>R$ ${parseFloat(p.precoCusto).toFixed(2)}</td>
            <td>R$ ${parseFloat(p.preco).toFixed(2)}</td>
            <td>${margem !== "—" ? `<span class="badge badge-azul">${margem}%</span>` : "—"}</td>
            <td><span class="badge ${estoqueClass}">${p.estoque} un</span></td>
            <td style="display:flex; gap:6px;">
                <button class="btn-info" onclick="editarProdutoRet(${p.id})">✏️</button>
                <button class="btn-perigo" onclick="deletarProdutoRet(${p.id})">🗑️</button>
            </td>
        </tr>`;
    }).join("");
}

function filtrarProdutos() {
    const busca = document.getElementById("buscaProduto").value.toLowerCase();
    const filtrados = produtosRet.filter(p =>
        p.nome.toLowerCase().includes(busca) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(busca))
    );
    renderTabelaProdutos(filtrados);
}

async function salvarProdutoRetaguarda() {
    const id = document.getElementById("produtoEditId").value;
    const nome = document.getElementById("prodNome").value.trim();
    const precoCusto = parseFloat(document.getElementById("prodCusto").value) || 0;
    const preco = parseFloat(document.getElementById("prodPreco").value) || 0;
    const estoque = parseInt(document.getElementById("prodEstoque").value) || 0;
    const codigoBarras = document.getElementById("prodCodigo").value.trim();

    if (!nome) return mostrarAviso("Nome do produto é obrigatório!");
    if (preco <= 0) return mostrarAviso("Preço de venda deve ser maior que zero!");

    try {
        if (id) {
            await fetch(`${API}/produtos/${id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ nome, precoCusto, preco, estoque, codigoBarras })
            });
            mostrarAviso("Produto atualizado!", "#10b981");
        } else {
            await fetch(`${API}/produtos`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ nome, precoCusto, preco, estoque, codigoBarras })
            });
            mostrarAviso("Produto cadastrado!", "#10b981");
        }
        limparFormProduto();
        carregarProdutosRetaguarda();
    } catch (err) {
        mostrarAviso("Erro ao salvar produto!");
    }
}

function editarProdutoRet(id) {
    const p = produtosRet.find(p => p.id === id);
    if (!p) return;
    document.getElementById("produtoEditId").value = p.id;
    document.getElementById("prodNome").value = p.nome;
    document.getElementById("prodCusto").value = parseFloat(p.precoCusto);
    document.getElementById("prodPreco").value = parseFloat(p.preco);
    document.getElementById("prodEstoque").value = p.estoque;
    document.getElementById("prodCodigo").value = p.codigoBarras || "";
    document.getElementById("tituloProdutoForm").innerText = "Editar Produto";
    window.scrollTo(0, 0);
}

async function deletarProdutoRet(id) {
    const p = produtosRet.find(p => p.id === id);
    if (!confirm(`Remover "${p.nome}"?`)) return;
    try {
        await fetch(`${API}/produtos/${id}`, { method: 'DELETE', headers: getHeaders() });
        mostrarAviso("Produto removido!", "#10b981");
        carregarProdutosRetaguarda();
    } catch (err) {
        mostrarAviso("Erro ao remover produto!");
    }
}

function limparFormProduto() {
    document.getElementById("produtoEditId").value = "";
    document.getElementById("prodNome").value = "";
    document.getElementById("prodCusto").value = "";
    document.getElementById("prodPreco").value = "";
    document.getElementById("prodEstoque").value = "";
    document.getElementById("prodCodigo").value = "";
    document.getElementById("tituloProdutoForm").innerText = "Novo Produto";
}

// -------------------------------------------------------
// ETIQUETAS
// -------------------------------------------------------

async function carregarEtiquetas() {
    try {
        const res = await fetch(`${API}/produtos`, { headers: getHeaders() });
        produtosRet = await res.json();
        renderTabelaEtiquetas(produtosRet);
    } catch (err) {
        mostrarAviso("Erro ao carregar produtos!");
    }
}

function renderTabelaEtiquetas(lista) {
    const tbody = document.getElementById("tabelaEtiquetas");
    tbody.innerHTML = lista.map(p => `
        <tr>
            <td>${p.nome}</td>
            <td>R$ ${parseFloat(p.preco).toFixed(2)}</td>
            <td>
                <input type="number" min="1" value="${etiquetasSelecionadas[p.id] || 1}"
                    style="width:60px; background:#060d1a; color:white; border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:4px; text-align:center;"
                    onchange="etiquetasSelecionadas[${p.id}] = parseInt(this.value) || 1">
            </td>
            <td>
                <input type="checkbox" ${etiquetasSelecionadas[p.id] ? 'checked' : ''}
                    onchange="toggleEtiqueta(${p.id}, this.checked, '${p.nome.replace(/'/g, "\\'")}', ${parseFloat(p.preco)}, '${p.codigoBarras || ''}')">
            </td>
        </tr>
    `).join("");
}

function filtrarEtiquetas() {
    const busca = document.getElementById("buscaEtiqueta").value.toLowerCase();
    const filtrados = produtosRet.filter(p => p.nome.toLowerCase().includes(busca));
    renderTabelaEtiquetas(filtrados);
}

function toggleEtiqueta(id, checked, nome, preco, codigo) {
    if (checked) { etiquetasSelecionadas[id] = etiquetasSelecionadas[id] || 1; }
    else { delete etiquetasSelecionadas[id]; }
}

function imprimirEtiquetas() {
    const area = document.getElementById("areaImpressaoEtiquetas");
    const selecionados = Object.keys(etiquetasSelecionadas);
    if (selecionados.length === 0) return mostrarAviso("Selecione pelo menos um produto!");

    const dominio = localStorage.getItem("dominio") || "default";
    const dadosEmpresa = JSON.parse(localStorage.getItem(`dadosEmpresa_${dominio}`) || "{}");
    const nomeEmpresa = dadosEmpresa.nome || "CLOUD PDV";
    area.innerHTML = "";

    selecionados.forEach(id => {
        const p = produtosRet.find(p => p.id == id);
        if (!p) return;
        const qtd = etiquetasSelecionadas[id] || 1;

        for (let i = 0; i < qtd; i++) {
            const divEtiqueta = document.createElement("div");
            divEtiqueta.className = "etiqueta-preview";
            const preco = parseFloat(p.preco).toFixed(2).replace(".", ",");
            const partes = preco.split(",");
            divEtiqueta.innerHTML = `
                <div class="etiqueta-empresa">${nomeEmpresa}</div>
                <div class="etiqueta-nome">${p.nome}</div>
                ${p.codigoBarras ? `<svg class="etiqueta-barcode" id="barcode-${id}-${i}"></svg><div class="etiqueta-cod-num">${p.codigoBarras}</div>` : ""}
                <div class="etiqueta-preco"><small>R$</small> ${partes[0]},<small>${partes[1]}</small></div>
            `;
            area.appendChild(divEtiqueta);
            if (p.codigoBarras) {
                try { JsBarcode(`#barcode-${id}-${i}`, p.codigoBarras, { format: "CODE128", width: 1.5, height: 30, displayValue: false, margin: 0 }); } catch(e) {}
            }
        }
    });
    setTimeout(() => {
        document.body.classList.add('print-etiqueta');
        window.print();
        setTimeout(() => document.body.classList.remove('print-etiqueta'), 1000);
    }, 500);
}

function limparEtiquetas() {
    etiquetasSelecionadas = {};
    carregarEtiquetas();
    document.getElementById("areaImpressaoEtiquetas").innerHTML = "";
}

// -------------------------------------------------------
// PROMOÇÕES
// -------------------------------------------------------

async function carregarPromocoes() {
    try {
        if (produtosRet.length === 0) {
            const res = await fetch(`${API}/produtos`, { headers: getHeaders() });
            produtosRet = await res.json();
        }
        const select = document.getElementById("promoProduoId");
        select.innerHTML = '<option value="">Selecione um produto...</option>' +
            produtosRet.map(p => `<option value="${p.id}">${p.nome} — R$ ${parseFloat(p.preco).toFixed(2)}</option>`).join("");
        const res = await fetch(`${API}/promocoes`, { headers: getHeaders() });
        const promocoes = await res.json();
        renderTabelaPromocoes(promocoes);
    } catch (err) {
        mostrarAviso("Erro ao carregar promoções!");
    }
}

function renderTabelaPromocoes(lista) {
    const tbody = document.getElementById("tabelaPromocoes");
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#475569; text-align:center;">Nenhuma promoção cadastrada.</td></tr>`;
        return;
    }
    const agora = new Date();
    tbody.innerHTML = lista.map(pr => {
        const inicio = new Date(pr.dataInicio);
        const fim = new Date(pr.dataFim);
        const ativa = pr.ativa && agora >= inicio && agora <= fim;
        const expirada = agora > fim;
        const podeApagar = !pr.ativa || expirada;
        let statusBadge = '';
        if (!pr.ativa) statusBadge = '<span class="badge badge-vermelho">DESATIVADA</span>';
        else if (expirada) statusBadge = '<span class="badge badge-amarelo">EXPIRADA</span>';
        else if (agora < inicio) statusBadge = '<span class="badge badge-azul">AGENDADA</span>';
        else statusBadge = '<span class="badge badge-verde">ATIVA</span>';
        return `<tr>
            <td><b style="color:#e2e8f0;">${pr.produto.nome}</b></td>
            <td>R$ ${parseFloat(pr.produto.preco).toFixed(2)}</td>
            <td style="color:#34d399; font-weight:700;">R$ ${parseFloat(pr.precoPromocional).toFixed(2)}</td>
            <td style="font-size:12px; color:#475569;">${inicio.toLocaleString('pt-BR')}</td>
            <td style="font-size:12px; color:#475569;">${fim.toLocaleString('pt-BR')}</td>
            <td>${statusBadge}</td>
            <td style="display:flex; gap:6px;">
                ${ativa || (!expirada && pr.ativa) ? `<button class="btn-perigo" onclick="desativarPromocao(${pr.id})">⏹️ Desativar</button>` : ''}
                ${podeApagar ? `<button class="btn-perigo" onclick="apagarPromocao(${pr.id})">🗑️ Apagar</button>` : ''}
            </td>
        </tr>`;
    }).join("");
}

function calcularMargem() {
    const produtoId = document.getElementById("promoProduoId").value;
    const precoPromo = parseFloat(document.getElementById("promoPreco").value) || 0;
    const infoBox = document.getElementById("promoInfoBox");
    const avisoPrejuizo = document.getElementById("promoAvisoPrejuizo");
    if (!produtoId) { infoBox.style.display = "none"; return; }
    const p = produtosRet.find(p => p.id == produtoId);
    if (!p) return;
    const custo = parseFloat(p.precoCusto) || 0;
    const precoAtual = parseFloat(p.preco);
    const margemAtual = custo > 0 ? (((precoAtual - custo) / custo) * 100).toFixed(1) : "—";
    const margemNova = custo > 0 && precoPromo > 0 ? (((precoPromo - custo) / custo) * 100).toFixed(1) : "—";
    infoBox.style.display = "block";
    document.getElementById("promoInfoCusto").innerText = `R$ ${custo.toFixed(2)}`;
    document.getElementById("promoInfoPrecoAtual").innerText = `R$ ${precoAtual.toFixed(2)}`;
    document.getElementById("promoInfoMargemAtual").innerText = margemAtual !== "—" ? `${margemAtual}%` : "—";
    document.getElementById("promoInfoPrecoNovo").innerText = precoPromo > 0 ? `R$ ${precoPromo.toFixed(2)}` : "—";
    const spanNova = document.getElementById("promoInfoMargemNova");
    if (margemNova !== "—") {
        const margem = parseFloat(margemNova);
        spanNova.innerText = `${margemNova}%`;
        spanNova.style.color = margem < 0 ? "#f87171" : margem < 10 ? "#fbbf24" : "#34d399";
        avisoPrejuizo.style.display = margem < 0 ? "block" : "none";
    } else {
        spanNova.innerText = "—"; spanNova.style.color = "white"; avisoPrejuizo.style.display = "none";
    }
}

async function criarPromocao() {
    const produtoId = document.getElementById("promoProduoId").value;
    const precoPromocional = parseFloat(document.getElementById("promoPreco").value);
    const dataInicio = document.getElementById("promoInicio").value;
    const dataFim = document.getElementById("promoFim").value;
    if (!produtoId) return mostrarAviso("Selecione um produto!");
    if (!precoPromocional || precoPromocional <= 0) return mostrarAviso("Informe o preço promocional!");
    if (!dataInicio || !dataFim) return mostrarAviso("Informe as datas de início e fim!");
    if (new Date(dataInicio) >= new Date(dataFim)) return mostrarAviso("A data de fim deve ser após a data de início!");
    const p = produtosRet.find(p => p.id == produtoId);
    if (p && parseFloat(p.precoCusto) > 0 && precoPromocional < parseFloat(p.precoCusto)) {
        if (!confirm("⚠️ O preço promocional está abaixo do custo! Você terá prejuízo. Deseja continuar mesmo assim?")) return;
    }
    try {
        const res = await fetch(`${API}/promocoes`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ produtoId, precoPromocional, dataInicio, dataFim })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        document.getElementById("promoProduoId").value = "";
        document.getElementById("promoPreco").value = "";
        document.getElementById("promoInicio").value = "";
        document.getElementById("promoFim").value = "";
        document.getElementById("promoInfoBox").style.display = "none";
        document.getElementById("promoAvisoPrejuizo").style.display = "none";
        mostrarAviso("Promoção criada com sucesso!", "#10b981");
        carregarPromocoes();
    } catch (err) { mostrarAviso("Erro ao criar promoção!"); }
}

async function desativarPromocao(id) {
    if (!confirm("Desativar esta promoção?")) return;
    try {
        await fetch(`${API}/promocoes/${id}`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ apagar: false }) });
        mostrarAviso("Promoção desativada!", "#10b981");
        carregarPromocoes();
    } catch (err) { mostrarAviso("Erro ao desativar promoção!"); }
}

async function apagarPromocao(id) {
    if (!confirm("Apagar esta promoção permanentemente?")) return;
    try {
        await fetch(`${API}/promocoes/${id}`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ apagar: true }) });
        mostrarAviso("Promoção apagada!", "#10b981");
        carregarPromocoes();
    } catch (err) { mostrarAviso("Erro ao apagar promoção!"); }
}

// -------------------------------------------------------
// VENDAS
// -------------------------------------------------------

async function carregarSelectCaixasVendas() {
    const plano = localStorage.getItem('plano') || 'base';
    const select = document.getElementById("filtroVendasCaixa");
    if (!select) return;
    if (!['intermediario', 'avancado'].includes(plano)) {
        select.style.display = 'none';
        return;
    }
    try {
        const res = await fetch(`${API}/caixas`, { headers: getHeaders() });
        const caixas = await res.json();
        select.innerHTML = '<option value="">Todos os caixas</option>' +
            caixas.map(cx => `<option value="${cx.id}">${cx.nome}</option>`).join('');
        select.style.display = '';
    } catch { select.style.display = 'none'; }
}

async function carregarVendasRetaguarda() {
    try {
        const inicio = document.getElementById("vendasInicio").value;
        const fim = document.getElementById("vendasFim").value;
        const mostrarCanceladas = document.getElementById("filtroMostrarCanceladas")?.checked || false;
        const plano = localStorage.getItem('plano') || 'base';
        const filtroCaixa = ['intermediario', 'avancado'].includes(plano)
            ? document.getElementById("filtroVendasCaixa")?.value || ''
            : '';
        const res = await fetch(`${API}/vendas`, { headers: getHeaders() });
        let todasVendas = await res.json();
        if (inicio) todasVendas = todasVendas.filter(v => v.data >= `${inicio}T00:00:00`);
        if (fim) todasVendas = todasVendas.filter(v => v.data <= `${fim}T23:59:59`);
        if (filtroCaixa) todasVendas = todasVendas.filter(v => v.caixaId == filtroCaixa);

        const vendasNormais = todasVendas.filter(v => !v.cancelada);
        const vendasCanceladas = todasVendas.filter(v => v.cancelada);
        const vendas = mostrarCanceladas ? todasVendas : vendasNormais;

        let total = vendasNormais.reduce((s, v) => s + parseFloat(v.total), 0);
        let totalCancelado = vendasCanceladas.reduce((s, v) => s + parseFloat(v.total), 0);

        document.getElementById("resumoVendas").innerHTML = `
            <div style="display:flex; gap:15px; flex-wrap:wrap;">
                <div class="card" style="flex:1; padding:12px;"><h4>Vendas realizadas</h4><div class="valor amarelo">${vendasNormais.length}</div></div>
                <div class="card" style="flex:1; padding:12px;"><h4>Total do período</h4><div class="valor verde">R$ ${total.toFixed(2)}</div></div>
                <div class="card" style="flex:1; padding:12px;"><h4>Cancelamentos</h4><div class="valor vermelho">${vendasCanceladas.length}</div></div>
                <div class="card" style="flex:1; padding:12px;"><h4>Valor cancelado</h4><div class="valor vermelho">R$ ${totalCancelado.toFixed(2)}</div></div>
            </div>`;

        document.getElementById("tabelaVendas").innerHTML = vendas.length > 0
            ? vendas.map(v => {
                const cancelada = v.cancelada;
                return `<tr style="${cancelada ? 'opacity:0.6;' : ''}">
                    <td>
                        ${new Date(v.data).toLocaleString('pt-BR')}
                        ${cancelada ? `<br><span style="color:#f87171;font-size:11px;">❌ Cancelada${v.canceladaEm ? ' em ' + new Date(v.canceladaEm).toLocaleString('pt-BR') : ''}</span>` : ''}
                        ${cancelada && v.canceladaPor ? `<br><span style="color:#f87171;font-size:11px;">por: ${v.canceladaPor}</span>` : ''}
                    </td>
                    <td style="color:#475569; font-size:12px;">${v.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ')}</td>
                    <td><span class="badge badge-azul">${v.metodo.toUpperCase()}</span></td>
                    <td><b style="color:${cancelada ? '#f87171' : '#60a5fa'};">${cancelada ? '<s>' : ''}R$ ${parseFloat(v.total).toFixed(2)}${cancelada ? '</s>' : ''}</b></td>
                </tr>`;
            }).join("")
            : `<tr><td colspan="4" style="color:#475569; text-align:center;">Nenhuma venda encontrada.</td></tr>`;
    } catch (err) { mostrarAviso("Erro ao carregar vendas!"); }
}

// -------------------------------------------------------
// USUÁRIOS
// -------------------------------------------------------

async function carregarUsuariosRetaguarda() {
    try {
        const res = await fetch(`${API}/usuarios`, { headers: getHeaders() });
        const usuarios = await res.json();
        document.getElementById("tabelaUsuarios").innerHTML = usuarios.map(u => {
            const badgePapel = u.papel === 'admin'
                ? '<span class="badge badge-amarelo">ADMIN</span>'
                : u.papel === 'gerente'
                ? '<span class="badge badge-roxo">GERENTE</span>'
                : '<span class="badge badge-azul">OPERADOR</span>';
            const temPin = u.pin ? '<span class="badge badge-verde">✅ PIN</span>' : '<span class="badge badge-vermelho">❌ Sem PIN</span>';
            const mostraPinStatus = ['admin', 'gerente'].includes(u.papel) ? temPin : '—';
            const botaoPin = ['admin', 'gerente'].includes(u.papel)
                ? `<button class="btn-info" onclick="definirPinUsuario(${u.id}, '${u.login}')">🔐 PIN</button>` : '';
            return `<tr>
                <td><b style="color:#e2e8f0;">${u.login}</b></td>
                <td>${badgePapel}</td>
                <td>${mostraPinStatus}</td>
                <td style="display:flex; gap:6px;">
                    <button class="btn-info" onclick="redefinirSenha(${u.id}, '${u.login}')">🔑 Senha</button>
                    ${botaoPin}
                    <button class="btn-perigo" onclick="deletarUsuarioRet(${u.id}, '${u.login}')">🗑️ Remover</button>
                </td>
            </tr>`;
        }).join("");
    } catch (err) { mostrarAviso("Erro ao carregar usuários!"); }
}

async function criarUsuarioRetaguarda() {
    const login = document.getElementById("novoLoginRet").value.trim().toLowerCase();
    const papel = document.getElementById("novoPapelRet").value;
    const senha = document.getElementById("novaSenhaRet").value;
    const confirmar = document.getElementById("confirmarSenhaRet").value;
    if (!login || !senha) return mostrarAviso("Preencha login e senha!");
    if (senha !== confirmar) return mostrarAviso("As senhas não coincidem!");
    if (senha.length < 4) return mostrarAviso("A senha deve ter pelo menos 4 caracteres!");
    try {
        const res = await fetch(`${API}/usuarios`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ login, senha, papel })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        document.getElementById("novoLoginRet").value = "";
        document.getElementById("novaSenhaRet").value = "";
        document.getElementById("confirmarSenhaRet").value = "";
        mostrarAviso("Usuário criado com sucesso!", "#10b981");
        carregarUsuariosRetaguarda();
    } catch (err) { mostrarAviso("Erro ao criar usuário!"); }
}

async function deletarUsuarioRet(id, login) {
    if (!confirm(`Remover o usuário "${login}"?`)) return;
    try {
        await fetch(`${API}/usuarios/${id}`, { method: 'DELETE', headers: getHeaders() });
        mostrarAviso("Usuário removido!", "#10b981");
        carregarUsuariosRetaguarda();
    } catch (err) { mostrarAviso("Erro ao remover usuário!"); }
}

async function redefinirSenha(id, login) {
    const novaSenha = prompt(`Nova senha para "${login}":`);
    if (!novaSenha) return;
    if (novaSenha.length < 4) return mostrarAviso("A senha deve ter pelo menos 4 caracteres!");
    const confirmar = prompt(`Confirme a nova senha para "${login}":`);
    if (novaSenha !== confirmar) return mostrarAviso("As senhas não coincidem!");
    try {
        const res = await fetch(`${API}/usuarios/${id}/senha`, {
            method: 'PUT', headers: getHeaders(),
            body: JSON.stringify({ novaSenha })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        mostrarAviso(`Senha de "${login}" redefinida com sucesso!`, "#10b981");
    } catch (err) { mostrarAviso("Erro ao redefinir senha!"); }
}

// Admin define PIN de outro usuário (admin ou gerente)
async function definirPinUsuario(id, login) {
    const pin = prompt(`Novo PIN para "${login}" (4-6 dígitos numéricos):`);
    if (!pin) return;
    if (!/^\d{4,6}$/.test(pin)) return mostrarAviso("PIN deve ter 4 a 6 dígitos numéricos!");
    const confirmar = prompt(`Confirme o PIN para "${login}":`);
    if (pin !== confirmar) return mostrarAviso("Os PINs não coincidem!");
    try {
        const res = await fetch(`${API}/usuarios/${id}/pin`, {
            method: 'PUT', headers: getHeaders(),
            body: JSON.stringify({ pin })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        mostrarAviso(`PIN de "${login}" definido com sucesso!`, "#10b981");
        carregarUsuariosRetaguarda();
    } catch (err) { mostrarAviso("Erro ao definir PIN!"); }
}

// -------------------------------------------------------
// CONFIGURAÇÕES — DADOS DA EMPRESA
// -------------------------------------------------------

function carregarDadosEmpresa() {
    const dominio = localStorage.getItem('dominio') || 'default';
    const dados = JSON.parse(localStorage.getItem(`dadosEmpresa_${dominio}`) || '{}');
    document.getElementById("cfgNomeEmpresa").value = dados.nome || "";
    document.getElementById("cfgCnpj").value = dados.cnpj || "";
    document.getElementById("cfgEndereco").value = dados.endereco || "";
    document.getElementById("cfgTelefone").value = dados.telefone || "";
    document.getElementById("cfgEmail").value = dados.email || "";
}

function salvarDadosEmpresa() {
    const dados = {
        nome: document.getElementById("cfgNomeEmpresa").value.trim(),
        cnpj: document.getElementById("cfgCnpj").value.trim(),
        endereco: document.getElementById("cfgEndereco").value.trim(),
        telefone: document.getElementById("cfgTelefone").value.trim(),
        email: document.getElementById("cfgEmail").value.trim()
    };
    const dominio = localStorage.getItem('dominio') || 'default';
    localStorage.setItem(`dadosEmpresa_${dominio}`, JSON.stringify(dados));
    mostrarAviso("Dados da empresa salvos!", "#10b981");
}

// -------------------------------------------------------
// CONFIGURAÇÕES — ALTERAR SENHA
// -------------------------------------------------------

async function alterarSenha() {
    const senhaAtual = document.getElementById("senhaAtual").value;
    const novaSenha = document.getElementById("novaSenha").value;
    const confirmar = document.getElementById("confirmarNovaSenha").value;
    if (!senhaAtual || !novaSenha) return mostrarAviso("Preencha todos os campos!");
    if (novaSenha !== confirmar) return mostrarAviso("As senhas não coincidem!");
    if (novaSenha.length < 4) return mostrarAviso("A nova senha deve ter pelo menos 4 caracteres!");
    try {
        const res = await fetch(`${API}/alterarSenha`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ senhaAtual, novaSenha })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        document.getElementById("senhaAtual").value = "";
        document.getElementById("novaSenha").value = "";
        document.getElementById("confirmarNovaSenha").value = "";
        mostrarAviso("Senha alterada com sucesso!", "#10b981");
    } catch (err) { mostrarAviso("Erro ao alterar senha!"); }
}

// -------------------------------------------------------
// CONFIGURAÇÕES — PIN DE SUPERVISOR
// -------------------------------------------------------

async function salvarPin() {
    const pin = document.getElementById("cfgPin").value.trim();
    const confirmar = document.getElementById("cfgPinConfirm").value.trim();
    if (!pin) return mostrarAviso("Digite o PIN!");
    if (!/^\d{4,6}$/.test(pin)) return mostrarAviso("PIN deve ter 4 a 6 dígitos numéricos!");
    if (pin !== confirmar) return mostrarAviso("Os PINs não coincidem!");
    try {
        const res = await fetch(`${API}/meuPin`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ pin })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        document.getElementById("cfgPin").value = "";
        document.getElementById("cfgPinConfirm").value = "";
        const ok = document.getElementById("pinStatusOk");
        ok.style.display = "block";
        setTimeout(() => ok.style.display = "none", 3000);
        mostrarAviso("PIN cadastrado com sucesso!", "#10b981");
    } catch (err) { mostrarAviso("Erro ao salvar PIN!"); }
}

// -------------------------------------------------------
// FUNCIONÁRIOS — CHEQUE FUNCIONÁRIO
// -------------------------------------------------------

function mascaraCpf(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    input.value = v;
}

function cpfMascarado(cpf) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**');
}

async function carregarFuncionarios() {
    try {
        const res = await fetch(`${API}/funcionarios`, { headers: getHeaders() });
        const funcionarios = await res.json();
        renderTabelaFuncionarios(funcionarios);
    } catch { mostrarAviso("Erro ao carregar funcionários!"); }
}

function renderTabelaFuncionarios(lista) {
    const tbody = document.getElementById("tabelaFuncionarios");
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#475569; text-align:center;">Nenhum funcionário cadastrado.</td></tr>`;
        return;
    }
    tbody.innerHTML = lista.map(f => {
        const totalDevido = f.compras.filter(c => !c.pago).reduce((s, c) => s + parseFloat(c.valor), 0);
        const limiteDisp = parseFloat(f.limite) - totalDevido;
        const pct = parseFloat(f.limite) > 0 ? (totalDevido / parseFloat(f.limite)) * 100 : 0;
        const corDisp = limiteDisp <= 0 ? '#f87171' : limiteDisp < parseFloat(f.limite) * 0.3 ? '#fbbf24' : '#34d399';
        return `<tr>
            <td><b style="color:#e2e8f0;">${f.nome}</b></td>
            <td style="color:#475569; font-family:monospace;">${cpfMascarado(f.cpf)}</td>
            <td>R$ ${parseFloat(f.limite).toFixed(2)}</td>
            <td style="color:#f87171;">R$ ${totalDevido.toFixed(2)}</td>
            <td style="color:${corDisp}; font-weight:700;">R$ ${limiteDisp.toFixed(2)}</td>
            <td>${f.ativo ? '<span class="badge badge-verde">ATIVO</span>' : '<span class="badge badge-vermelho">INATIVO</span>'}</td>
            <td style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-info" onclick="editarFuncionario(${f.id})">✏️ Editar</button>
                ${totalDevido > 0 ? `<button class="btn-primario" style="font-size:11px; padding:5px 10px;" onclick="quitarDivida(${f.id}, '${f.nome}', ${totalDevido.toFixed(2)})">✅ Quitar R$ ${totalDevido.toFixed(2)}</button>` : ''}
                <button class="btn-perigo" onclick="verHistoricoFuncionario(${f.id}, '${f.nome}')">📋 Histórico</button>
                ${totalDevido === 0 ? `<button class="btn-perigo" onclick="excluirFuncionario(${f.id}, '${f.nome}')">🗑️ Excluir</button>` : ''}
            </td>
        </tr>`;
    }).join("");
}

async function salvarFuncionario() {
    const id = document.getElementById("funcEditId").value;
    const nome = document.getElementById("funcNome").value.trim();
    const cpf = document.getElementById("funcCpf").value.trim();
    const limite = parseFloat(document.getElementById("funcLimite").value) || 0;

    if (!nome) return mostrarAviso("Nome é obrigatório!");
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) return mostrarAviso("CPF inválido!");
    if (limite <= 0) return mostrarAviso("Limite deve ser maior que zero!");

    try {
        if (id) {
            await fetch(`${API}/funcionarios/${id}`, {
                method: 'PUT', headers: getHeaders(),
                body: JSON.stringify({ nome, limite, ativo: true })
            });
            mostrarAviso("Funcionário atualizado!", "#10b981");
        } else {
            const res = await fetch(`${API}/funcionarios`, {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ nome, cpf, limite })
            });
            const dados = await res.json();
            if (dados.erro) return mostrarAviso(dados.erro);
            mostrarAviso("Funcionário cadastrado!", "#10b981");
        }
        limparFormFuncionario();
        carregarFuncionarios();
    } catch { mostrarAviso("Erro ao salvar funcionário!"); }
}

function editarFuncionario(id) {
    fetch(`${API}/funcionarios`, { headers: getHeaders() })
        .then(r => r.json())
        .then(lista => {
            const f = lista.find(f => f.id === id);
            if (!f) return;
            document.getElementById("funcEditId").value = f.id;
            document.getElementById("funcNome").value = f.nome;
            document.getElementById("funcCpf").value = f.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            document.getElementById("funcCpf").disabled = true; // CPF não pode mudar
            document.getElementById("funcLimite").value = parseFloat(f.limite);
            document.getElementById("tituloFuncForm").innerText = "Editar Funcionário";
            window.scrollTo(0, 0);
        });
}

function limparFormFuncionario() {
    document.getElementById("funcEditId").value = "";
    document.getElementById("funcNome").value = "";
    document.getElementById("funcCpf").value = "";
    document.getElementById("funcCpf").disabled = false;
    document.getElementById("funcLimite").value = "";
    document.getElementById("tituloFuncForm").innerText = "Novo Funcionário";
}

async function quitarDivida(id, nome, total) {
    if (!confirm(`Quitar toda a dívida de "${nome}" (R$ ${parseFloat(total).toFixed(2)})?`)) return;
    try {
        await fetch(`${API}/funcionarios/${id}/quitar`, { method: 'POST', headers: getHeaders() });
        mostrarAviso(`Dívida de "${nome}" quitada!`, "#10b981");
        carregarFuncionarios();
    } catch { mostrarAviso("Erro ao quitar dívida!"); }
}

async function excluirFuncionario(id, nome) {
    if (!confirm(`Excluir o funcionário "${nome}"? Esta ação não pode ser desfeita!`)) return;
    try {
        const res = await fetch(`${API}/funcionarios/${id}`, { method: 'DELETE', headers: getHeaders() });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        mostrarAviso(`Funcionário "${nome}" excluído!`, "#10b981");
        carregarFuncionarios();
    } catch { mostrarAviso("Erro ao excluir funcionário!"); }
}

async function verHistoricoFuncionario(id, nome) {
    try {
        const res = await fetch(`${API}/funcionarios`, { headers: getHeaders() });
        const lista = await res.json();
        const f = lista.find(f => f.id === id);
        if (!f) return;

        const compras = f.compras.sort((a, b) => new Date(b.data) - new Date(a.data));
        const totalAberto = compras.filter(c => !c.pago).reduce((s, c) => s + parseFloat(c.valor), 0);

        const overlay = document.createElement('div');
        overlay.id = 'overlayHistoricoFunc';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#0a1628;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:28px;width:560px;max-height:80vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <div>
                        <h3 style="color:#e2e8f0;margin:0;font-size:16px;">📋 ${nome}</h3>
                        <p style="color:#475569;margin:4px 0 0;font-size:12px;">Total em aberto: <span style="color:#f87171;font-weight:700;">R$ ${totalAberto.toFixed(2)}</span></p>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="imprimirHistoricoFuncionario('${nome}')" style="background:rgba(96,165,250,0.12);color:#60a5fa;border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;">🖨️ Imprimir</button>
                        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:rgba(255,255,255,0.06);color:#94a3b8;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;">✕ Fechar</button>
                    </div>
                </div>
                ${compras.length === 0 ? '<p style="color:#475569;text-align:center;">Nenhuma compra registrada.</p>' :
                compras.map(c => `
                    <div style="background:#060d1a;border:1px solid ${c.pago ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)'};border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="color:#e2e8f0;font-size:13px;">${c.descricao || 'Compra no PDV'}</div>
                            <div style="color:#475569;font-size:11px;">${new Date(c.data).toLocaleString('pt-BR')}</div>
                            ${c.pago ? `<div style="color:#34d399;font-size:11px;">✅ Pago em ${new Date(c.pagoEm).toLocaleDateString('pt-BR')}</div>` : ''}
                        </div>
                        <div style="font-weight:700;color:${c.pago ? '#34d399' : '#f87171'};">R$ ${parseFloat(c.valor).toFixed(2)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    } catch { mostrarAviso("Erro ao carregar histórico!"); }
}

function imprimirHistoricoFuncionario(nome) {
    const overlay = document.getElementById('overlayHistoricoFunc');
    if (!overlay) return;
    const conteudo = overlay.querySelector('div[style*="background:#0a1628"]').innerHTML;

    const janela = window.open('', '_blank', 'width=700,height=600');
    janela.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Histórico — ${nome}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: white; color: #1e293b; padding: 24px; margin: 0; }
                h3 { font-size: 16px; margin: 0 0 4px; }
                p { font-size: 12px; color: #64748b; margin: 0 0 20px; }
                .item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
                .item-desc { font-size: 13px; font-weight: 600; color: #1e293b; }
                .item-data { font-size: 11px; color: #64748b; margin-top: 2px; }
                .item-pago { font-size: 11px; color: #16a34a; margin-top: 2px; }
                .item-valor { font-weight: 700; font-size: 14px; }
                .valor-aberto { color: #dc2626; }
                .valor-pago { color: #16a34a; }
                .rodape { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; }
                button { display: none !important; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h3>📋 Histórico — ${nome}</h3>
            <p>Emitido em: ${new Date().toLocaleString('pt-BR')}</p>
            ${conteudo}
            <div class="rodape">Cloud System PDV — ${new Date().toLocaleDateString('pt-BR')}</div>
            <script>setTimeout(() => { window.print(); window.close(); }, 500);<\/script>
        </body>
        </html>
    `);
    janela.document.close();
}

// -------------------------------------------------------
// CAIXAS
// -------------------------------------------------------

async function carregarCaixas() {
    try {
        const res = await fetch(`${API}/caixas`, { headers: getHeaders() });
        const caixas = await res.json();
        renderTabelaCaixas(caixas, 'listaCaixasAba');
    } catch { mostrarAviso("Erro ao carregar caixas!"); }
}

function renderTabelaCaixas(lista, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:#475569; text-align:center;">Nenhum caixa cadastrado. Adicione um caixa acima.</td></tr>`;
        return;
    }
    tbody.innerHTML = lista.map(cx => {
        const statusBadge = cx.emUso
            ? `<span class="badge badge-verde">Em uso</span>`
            : `<span class="badge badge-azul">Disponível</span>`;
        const operador = cx.emUso ? `<b style="color:#34d399;">${cx.operador}</b>` : '—';
        const inicio = cx.inicioUso ? new Date(cx.inicioUso).toLocaleTimeString('pt-BR') : '—';
        return `<tr>
            <td><b style="color:#60a5fa;">#${cx.numero}</b></td>
            <td><b style="color:#e2e8f0;">${cx.nome}</b></td>
            <td>${statusBadge}</td>
            <td>${operador}</td>
            <td style="color:#475569; font-size:12px;">${inicio}</td>
            <td>
                <button class="btn-perigo" onclick="desativarCaixa(${cx.id}, '${cx.nome}')">🗑️ Remover</button>
            </td>
        </tr>`;
    }).join("");
}

async function criarCaixaAba() {
    const plano = localStorage.getItem('plano') || 'base';
    if (!['intermediario', 'avancado'].includes(plano)) {
        return mostrarAviso("Múltiplos caixas disponível apenas nos planos Intermediário e Avançado!");
    }
    // Verifica limite do plano intermediário
    if (plano === 'intermediario') {
        const res = await fetch(`${API}/caixas`, { headers: getHeaders() });
        const caixas = await res.json();
        if (caixas.length >= 2) {
            return mostrarAviso("Plano Intermediário permite no máximo 2 caixas. Faça upgrade para o Avançado!");
        }
    }
    const nome = document.getElementById("caixaNomeInputAba").value.trim();
    const numero = parseInt(document.getElementById("caixaNumeroInputAba").value);
    if (!nome) return mostrarAviso("Informe o nome do caixa!");
    if (!numero || numero < 1) return mostrarAviso("Informe o número do caixa!");
    try {
        const res = await fetch(`${API}/caixas`, {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ nome, numero })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);
        document.getElementById("caixaNomeInputAba").value = "";
        document.getElementById("caixaNumeroInputAba").value = "";
        mostrarAviso(`${nome} criado com sucesso!`, "#10b981");
        carregarCaixas();
    } catch { mostrarAviso("Erro ao criar caixa!"); }
}

async function desativarCaixa(id, nome) {
    if (!confirm(`Remover "${nome}"? Isso impedirá que seja usado no PDV.`)) return;
    try {
        await fetch(`${API}/caixas/${id}`, {
            method: 'PUT', headers: getHeaders(),
            body: JSON.stringify({ ativo: false })
        });
        mostrarAviso(`${nome} removido!`, "#10b981");
        carregarCaixas();
    } catch { mostrarAviso("Erro ao remover caixa!"); }
}
