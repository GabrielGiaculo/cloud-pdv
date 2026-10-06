/* =======================================================
   HISTÓRICO DE VENDAS + FILTRO POR PERÍODO + CANCELAMENTO
   ======================================================= */

async function abrirHistorico() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("modalHistorico").style.display = "block";
    await carregarHistorico();
}

async function carregarHistorico() {
    const div = document.getElementById("listaHistorico");
    div.innerHTML = "<p style='color:#475569; font-size:13px;'>Carregando...</p>";

    const dataInicio = document.getElementById("filtroInicio").value;
    const dataFim = document.getElementById("filtroFim").value;

    // No PDV, só busca vendas do dia para ser mais rápido
    const todasVendas = await apiBuscarVendasHoje();
    const caixaId = sessionStorage.getItem('caixaId');
    const plano = localStorage.getItem('plano') || 'base';
    const temCaixas = ['intermediario', 'avancado'].includes(plano) && caixaId;

    let vendasFiltradas = temCaixas
        ? todasVendas.filter(v => v.caixaId == caixaId)
        : todasVendas;

    if (dataInicio) vendasFiltradas = vendasFiltradas.filter(v => v.data >= `${dataInicio}T00:00:00`);
    if (dataFim) vendasFiltradas = vendasFiltradas.filter(v => v.data <= `${dataFim}T23:59:59`);
    if (!dataInicio && !dataFim) vendasFiltradas = vendasFiltradas.filter(v => v.data >= inicioCaixa);

    if (vendasFiltradas.length === 0) {
        div.innerHTML = "<p style='color:#475569; font-size:13px;'>Nenhuma venda encontrada.</p>";
        return;
    }

    const vendasAtivas = vendasFiltradas.filter(v => !v.cancelada);
    const vendasCanceladas = vendasFiltradas.filter(v => v.cancelada);
    let totalPeriodo = vendasAtivas.reduce((s, v) => s + parseFloat(v.total), 0);

    div.innerHTML = `
        <div style="background:#060d1a; border-radius:8px; padding:12px; margin-bottom:14px; display:flex; gap:10px;">
            <div style="flex:1; text-align:center;">
                <div style="color:#475569; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Vendas</div>
                <div style="color:#34d399; font-weight:700; font-size:16px;">${vendasAtivas.length}</div>
            </div>
            <div style="flex:1; text-align:center;">
                <div style="color:#475569; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Total</div>
                <div style="color:#60a5fa; font-weight:700; font-size:16px;">R$ ${totalPeriodo.toFixed(2)}</div>
            </div>
            <div style="flex:1; text-align:center;">
                <div style="color:#475569; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Canceladas</div>
                <div style="color:#f87171; font-weight:700; font-size:16px;">${vendasCanceladas.length}</div>
            </div>
        </div>
    ` + vendasFiltradas.map(v => `
        <div style="background:#060d1a; border:1px solid ${v.cancelada ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.04)'}; border-radius:8px; padding:12px; margin-bottom:8px; ${v.cancelada ? 'opacity:0.6;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:12px; color:#475569;">${new Date(v.data).toLocaleString('pt-BR')}</span>
                <span style="font-weight:700; color:${v.cancelada ? '#f87171' : '#60a5fa'};">
                    ${v.cancelada ? '❌ ' : ''}R$ ${parseFloat(v.total).toFixed(2)}
                </span>
            </div>
            <div style="font-size:12px; color:#475569; margin-bottom:8px;">
                ${v.itens.map(i => `${i.qtd}x ${i.nome}`).join(', ')}
            </div>
            ${v.cancelada ? `
                <div style="font-size:11px; color:#f87171; margin-bottom:6px;">
                    Cancelada por: ${v.canceladaPor || '—'} em ${v.canceladaEm ? new Date(v.canceladaEm).toLocaleString('pt-BR') : '—'}
                </div>
            ` : ''}
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; background:rgba(255,255,255,0.06); color:#94a3b8; padding:2px 8px; border-radius:10px;">${v.metodo.toUpperCase()}</span>
                ${!v.cancelada ? `
                <div style="display:flex; gap:6px;">
                    <button onclick="reimprimirCupom(${v.id})" style="background:rgba(96,165,250,0.12);color:#60a5fa;border:1px solid rgba(96,165,250,0.2);border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;font-weight:600;">🖨️ Reimprimir</button>
                    <button onclick="cancelarVenda(${v.id})" style="background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.2);border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;font-weight:600;">❌ Cancelar</button>
                </div>
                ` : ''}
            </div>
        </div>
    `).join("");
}

function reimprimirCupom(id) {
    apiBuscarVendasHoje().then(todasVendas => {
        const venda = todasVendas.find(v => v.id === id);
        if (!venda) return mostrarAviso("Venda não encontrada!");

        const dataFormatada = new Date(venda.data).toLocaleString('pt-BR');
        const metodoLabels = { dinheiro: 'DINHEIRO', pix: 'PIX', cartao: 'CARTÃO', vr: 'VR (VALE REFEIÇÃO)', cheque_funcionario: 'CHEQUE FUNCIONÁRIO' };
        const metodoLabel = metodoLabels[venda.metodo] || venda.metodo.toUpperCase();
        const _dominio = localStorage.getItem('dominio') || 'default';
        const dadosEmpresa = JSON.parse(localStorage.getItem(`dadosEmpresa_${_dominio}`) || '{}');

        // Cupom tela
        document.getElementById("data").innerText = dataFormatada;
        document.getElementById("itens").innerHTML = venda.itens.map(item =>
            `<div style="display:flex; justify-content:space-between; font-size:13px;">
                <span>${item.qtd}x ${item.nome}</span>
                <span>R$ ${(parseFloat(item.preco) * item.qtd).toFixed(2)}</span>
             </div>`
        ).join("");
        document.getElementById("metodo").innerHTML = `Forma: <b>${metodoLabel}</b>`;
        document.getElementById("totalRecibo").innerText = "TOTAL: R$ " + parseFloat(venda.total).toFixed(2);
        document.getElementById("descontoRecibo").innerText = "";
        document.getElementById("trocoRecibo").innerText = venda.metodo === "dinheiro" && parseFloat(venda.troco) > 0
            ? "TROCO: R$ " + parseFloat(venda.troco).toFixed(2) : "";

        // Cupom impressão profissional
        document.getElementById("cupomNomeEmpresa").innerText = dadosEmpresa.nome ? dadosEmpresa.nome.toUpperCase() : 'CLOUD PDV';
        document.getElementById("cupomEnderecoEmpresa").innerText = dadosEmpresa.endereco || '';
        document.getElementById("cupomTelefoneEmpresa").innerText = dadosEmpresa.telefone ? `Tel: ${dadosEmpresa.telefone}` : '';
        document.getElementById("cupomData").innerText = dataFormatada;
        document.getElementById("cupomItens").innerHTML = venda.itens.map(item => {
            const subtotalItem = (parseFloat(item.preco) * item.qtd).toFixed(2);
            const nome = item.nome.length > 18 ? item.nome.substring(0, 18) + '..' : item.nome;
            return `<div style="display:flex; justify-content:space-between;"><span>${item.qtd}x ${nome}</span><span>R$ ${subtotalItem}</span></div>`;
        }).join('');
        document.getElementById("cupomTotal").innerHTML = `<div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>R$ ${parseFloat(venda.total).toFixed(2)}</span></div>`;
        document.getElementById("cupomDesconto").innerHTML = "";
        document.getElementById("cupomMetodo").innerHTML = `<div style="display:flex; justify-content:space-between;"><span>FORMA:</span><span>${metodoLabel}</span></div>`;
        document.getElementById("cupomTroco").innerHTML = venda.metodo === "dinheiro" && parseFloat(venda.troco) > 0
            ? `<div style="display:flex; justify-content:space-between;"><span>TROCO:</span><span>R$ ${parseFloat(venda.troco).toFixed(2)}</span></div>` : '';

        document.getElementById("modalHistorico").style.display = "none";
        document.getElementById("receipt").style.display = "block";
        document.body.classList.add("print-receipt");
        document.body.classList.remove("print-fechamento");
    });
}

async function cancelarVenda(id) {
    if (!confirm("Cancelar esta venda? O estoque será devolvido.")) return;

    let pinSupervisor = null;

    if (usuarioLogado !== "admin") {
        pinSupervisor = await pedirPinSupervisor("Autorização necessária para cancelar venda");
        if (!pinSupervisor) return;
    }

    try {
        const res = await fetch(`${API}/vendas/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ pinSupervisor })
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);

        const todasVendas = await apiBuscarVendasHoje();
        const _caixaId = sessionStorage.getItem('caixaId');
        const _plano = localStorage.getItem('plano') || 'base';
        const _temCaixas = ['intermediario', 'avancado'].includes(_plano) && _caixaId;
        vendas = todasVendas.filter(v => {
            if (v.data < inicioCaixa || v.cancelada) return false;
            if (_temCaixas) return v.caixaId === parseInt(_caixaId);
            return true;
        });
        produtos = await apiBuscarProdutos();

        render();
        resumo();
        mostrarAviso(`Venda cancelada! Autorizado por: ${dados.canceladaPor}`, "#10b981");
        await carregarHistorico();
    } catch (err) {
        mostrarAviso("Erro ao cancelar venda!");
    }
}
