/* =======================================================
   VENDAS: finalizar compra, recibo e impressão
   ======================================================= */

function toggleValorPago() {
    let m = document.getElementById("pagamento").value;
    document.getElementById("valorPago").style.display = (m === "dinheiro") ? "block" : "none";
    document.getElementById("valorPago").placeholder = "Valor Recebido (Dinheiro)";
}

function calcularDesconto() {
    let total = carrinho.reduce((s, item) => s + (item.preco * item.qtd), 0);
    let tipoDesconto = document.getElementById("tipoDesconto").value;
    let valorDesconto = parseFloat(document.getElementById("valorDesconto").value) || 0;

    let desconto = tipoDesconto === "percent" ? total * (valorDesconto / 100) : valorDesconto;
    if (desconto > total) desconto = total;
    let totalComDesconto = total - desconto;
    document.getElementById("totalComDesconto").innerText = totalComDesconto.toFixed(2);
    document.getElementById("total").innerText = totalComDesconto.toFixed(2);

    const box = document.getElementById("totalComDescontoBox");
    if (box) box.style.display = desconto > 0 ? "block" : "none";
}

async function finalizar() {
    if (carrinho.length === 0) return mostrarAviso("Carrinho vazio!");

    let metodo = document.getElementById("pagamento").value;

    // Se for cheque funcionário, abre modal de CPF
    if (metodo === "cheque_funcionario") {
        await finalizarChequeFuncionario();
        return;
    }

    await processarVenda(metodo, null);
}

async function finalizarChequeFuncionario() {
    const subtotal = carrinho.reduce((s, item) => s + (item.preco * item.qtd), 0);
    const tipoDesconto = document.getElementById("tipoDesconto").value;
    const valorDesconto = parseFloat(document.getElementById("valorDesconto").value) || 0;
    let desconto = tipoDesconto === "percent" ? subtotal * (valorDesconto / 100) : valorDesconto;
    if (desconto > subtotal) desconto = subtotal;
    const total = subtotal - desconto;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#0a1628;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:30px;width:360px;text-align:center;">
                <div style="font-size:32px;margin-bottom:10px;">👷</div>
                <h3 style="color:#e2e8f0;font-size:15px;font-weight:700;margin:0 0 6px;">Cheque Funcionário</h3>
                <p style="color:#475569;font-size:13px;margin:0 0 6px;">Total: <b style="color:#60a5fa;">R$ ${total.toFixed(2)}</b></p>
                <p style="color:#475569;font-size:12px;margin:0 0 20px;">Digite o CPF do funcionário para confirmar</p>
                <input id="inputCpfFuncionario" type="text" inputmode="numeric" maxlength="14"
                    placeholder="000.000.000-00" autocomplete="off"
                    style="width:100%;background:#060d1a;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;font-size:16px;box-sizing:border-box;margin-bottom:6px;text-align:center;letter-spacing:2px;"
                    oninput="mascaraCpfPdv(this)">
                <div id="infoFuncionario" style="background:#060d1a;border-radius:8px;padding:10px;margin-bottom:14px;display:none;text-align:left;">
                    <div id="nomeFuncionario" style="color:#e2e8f0;font-size:13px;font-weight:600;"></div>
                    <div id="limiteFuncionario" style="color:#475569;font-size:12px;margin-top:2px;"></div>
                </div>
                <div id="erroFuncionario" style="color:#f87171;font-size:12px;margin-bottom:12px;display:none;"></div>
                <div style="display:flex;gap:8px;">
                    <button id="btnCancelarFunc" style="flex:1;background:rgba(255,255,255,0.06);color:#94a3b8;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">Cancelar</button>
                    <button id="btnConfirmarFunc" style="flex:1;background:#2563eb;color:white;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">Confirmar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        const input = overlay.querySelector('#inputCpfFuncionario');
        const erro = overlay.querySelector('#erroFuncionario');
        const info = overlay.querySelector('#infoFuncionario');
        input.focus();

        let funcionarioEncontrado = null;

        // Busca funcionário ao digitar CPF completo
        input.addEventListener('input', async () => {
            const cpfLimpo = input.value.replace(/\D/g, '');
            if (cpfLimpo.length === 11) {
                try {
                    const res = await fetch(`${API}/funcionarios/buscarCpf`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify({ cpf: cpfLimpo })
                    });
                    const dados = await res.json();
                    if (dados.erro) {
                        erro.innerText = dados.erro;
                        erro.style.display = 'block';
                        info.style.display = 'none';
                        funcionarioEncontrado = null;
                    } else {
                        funcionarioEncontrado = dados;
                        erro.style.display = 'none';
                        info.style.display = 'block';
                        overlay.querySelector('#nomeFuncionario').innerText = `👷 ${dados.nome}`;
                        const dispColor = dados.limiteDisponivel >= total ? '#34d399' : '#f87171';
                        overlay.querySelector('#limiteFuncionario').innerHTML =
                            `Disponível: <b style="color:${dispColor}">R$ ${dados.limiteDisponivel.toFixed(2)}</b> de R$ ${parseFloat(dados.limite).toFixed(2)}`;
                        if (dados.limiteDisponivel < total) {
                            erro.innerText = `Limite insuficiente! Disponível: R$ ${dados.limiteDisponivel.toFixed(2)}`;
                            erro.style.display = 'block';
                            funcionarioEncontrado = null;
                        }
                    }
                } catch { erro.innerText = 'Erro ao buscar funcionário.'; erro.style.display = 'block'; }
            } else {
                info.style.display = 'none';
                erro.style.display = 'none';
                funcionarioEncontrado = null;
            }
        });

        overlay.querySelector('#btnCancelarFunc').onclick = () => {
            document.body.removeChild(overlay);
            resolve(null);
        };

        overlay.querySelector('#btnConfirmarFunc').onclick = async () => {
            if (!funcionarioEncontrado) { erro.innerText = 'Funcionário não encontrado ou limite insuficiente!'; erro.style.display = 'block'; return; }
            document.body.removeChild(overlay);
            await processarVenda('cheque_funcionario', funcionarioEncontrado);
            resolve(funcionarioEncontrado);
        };
    });
}

function mascaraCpfPdv(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    input.value = v;
}

async function processarVenda(metodo, funcionario) {
    // Verifica estoque antes de processar (ignora itens avulsos sem id)
    for (const item of carrinho) {
        if (!item.id) continue; // item avulso, pula verificação
        const produto = produtos.find(p => p.id === item.id);
        if (produto && produto.estoque < item.qtd) {
            return mostrarAviso(`Estoque insuficiente para "${item.nome}". Disponível: ${produto.estoque} un.`);
        }
    }

    let subtotal = carrinho.reduce((s, item) => s + (item.preco * item.qtd), 0);
    let tipoDesconto = document.getElementById("tipoDesconto").value;
    let valorDesconto = parseFloat(document.getElementById("valorDesconto").value) || 0;
    let desconto = tipoDesconto === "percent" ? subtotal * (valorDesconto / 100) : valorDesconto;
    if (desconto > subtotal) desconto = subtotal;
    let total = subtotal - desconto;

    let valorPago = parseFloat(document.getElementById("valorPago").value) || 0;
    if (metodo === "dinheiro" && valorPago < total) return mostrarAviso("Valor pago é menor que o total!");
    let troco = metodo === "dinheiro" ? valorPago - total : 0;

    try {
        const caixaId = sessionStorage.getItem('caixaId');
        // Formata itens — itens avulsos não têm id de produto
        const itensFormatados = carrinho.map(item => ({
            id: item.id || null,
            nome: item.nome,
            preco: parseFloat(item.preco),
            precoCusto: parseFloat(item.precoCusto) || 0,
            qtd: item.qtd
        }));
        await apiSalvarVenda({ itens: itensFormatados, total, subtotal, desconto, metodo, valorPago, troco, caixaId: caixaId ? parseInt(caixaId) : null });

        // Registra na conta do funcionário se for cheque
        if (metodo === "cheque_funcionario" && funcionario) {
            const itensDesc = carrinho.map(i => `${i.qtd}x ${i.nome}`).join(', ');
            await fetch(`${API}/funcionarios/${funcionario.id}/compras`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ valor: total, descricao: itensDesc })
            });
        }

        const todasVendas = await apiBuscarVendas();
        const _caixaId = sessionStorage.getItem('caixaId');
        const _plano = localStorage.getItem('plano') || 'base';
        const _temCaixas = ['intermediario', 'avancado'].includes(_plano) && _caixaId;
        vendas = todasVendas.filter(v => {
            if (v.data < inicioCaixa || v.cancelada) return false;
            if (_temCaixas) return v.caixaId == _caixaId;
            return true;
        });
        produtos = await apiBuscarProdutos();
        render();

        const agora = new Date();
        const dataFormatada = agora.toLocaleString('pt-BR');
        document.getElementById("data").innerText = dataFormatada;

        const _dominio = localStorage.getItem('dominio') || 'default';
        const dadosEmpresa = JSON.parse(localStorage.getItem('dadosEmpresa_' + _dominio) || '{}');
        const metodoLabels = { dinheiro: 'DINHEIRO', pix: 'PIX', cartao: 'CARTÃO', vr: 'VR (VALE REFEIÇÃO)', cheque_funcionario: `CHEQUE — ${funcionario?.nome || ''}` };
        const metodoLabel = metodoLabels[metodo] || metodo.toUpperCase();

        // Cupom tela
        document.getElementById("itens").innerHTML = carrinho.map(item =>
            `<div style="display:flex; justify-content:space-between; font-size:13px;">
                <span>${item.qtd}x ${item.nome}</span>
                <span>R$ ${(parseFloat(item.preco) * item.qtd).toFixed(2)}</span>
             </div>`
        ).join("");
        document.getElementById("metodo").innerHTML = `Forma: <b>${metodoLabel}</b>`;
        document.getElementById("totalRecibo").innerText = "TOTAL: R$ " + total.toFixed(2);
        document.getElementById("descontoRecibo").innerText = desconto > 0 ? `DESCONTO: R$ ${desconto.toFixed(2)}` : "";
        document.getElementById("trocoRecibo").innerText = metodo === "dinheiro" ? "TROCO: R$ " + troco.toFixed(2) : "";

        // Cupom impressão profissional
        document.getElementById("cupomNomeEmpresa").innerText = dadosEmpresa.nome ? `${dadosEmpresa.nome.toUpperCase()}` : 'CLOUD PDV';
        document.getElementById("cupomEnderecoEmpresa").innerText = dadosEmpresa.endereco || '';
        document.getElementById("cupomTelefoneEmpresa").innerText = dadosEmpresa.telefone ? `Tel: ${dadosEmpresa.telefone}` : '';
        document.getElementById("cupomData").innerText = dataFormatada;
        document.getElementById("cupomItens").innerHTML = carrinho.map(item => {
            const subtotalItem = (parseFloat(item.preco) * item.qtd).toFixed(2);
            const nome = item.nome.length > 18 ? item.nome.substring(0, 18) + '..' : item.nome;
            return `<div style="display:flex; justify-content:space-between;"><span>${item.qtd}x ${nome}</span><span>R$ ${subtotalItem}</span></div>`;
        }).join('');
        document.getElementById("cupomTotal").innerHTML = `<div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>R$ ${total.toFixed(2)}</span></div>`;
        document.getElementById("cupomDesconto").innerHTML = desconto > 0 ? `<div style="display:flex; justify-content:space-between;"><span>DESCONTO:</span><span>R$ ${desconto.toFixed(2)}</span></div>` : '';
        document.getElementById("cupomMetodo").innerHTML = `<div style="display:flex; justify-content:space-between;"><span>FORMA:</span><span>${metodoLabel}</span></div>`;
        document.getElementById("cupomTroco").innerHTML = metodo === "dinheiro" ? `<div style="display:flex; justify-content:space-between;"><span>TROCO:</span><span>R$ ${troco.toFixed(2)}</span></div>` : '';

        document.getElementById("overlay").style.display = "block";
        document.getElementById("receipt").style.display = "block";
        document.body.classList.add("print-receipt");
        document.body.classList.remove("print-fechamento");

        carrinho = [];
        document.getElementById("valorPago").value = "";
        document.getElementById("valorDesconto").value = "";
        document.getElementById("total").innerText = "0,00";
        document.getElementById("totalComDesconto").innerText = "0,00";
        update();
        resumo();

    } catch { mostrarAviso("Erro ao finalizar a venda. Tente novamente!"); }
}

function imprimirRecibo() {
    document.body.classList.add("print-receipt");
    document.body.classList.remove("print-fechamento");
    window.print();
}
