/* =======================================================
   CARRINHO: adicionar, remover e atualizar o cupom atual
   ======================================================= */

function add(id, qtd = 1) {
    let prodEstoque = produtos.find(p => p.id === id);
    if (!prodEstoque || prodEstoque.estoque <= 0) return mostrarAviso("Produto sem estoque!");

    let itemNoCarrinho = carrinho.find(item => item.id === id);

    if (itemNoCarrinho) {
        if (itemNoCarrinho.qtd + qtd > prodEstoque.estoque) return mostrarAviso(`Estoque insuficiente! Restam ${prodEstoque.estoque} un.`);
        itemNoCarrinho.qtd += qtd;
    } else {
        if (qtd > prodEstoque.estoque) return mostrarAviso(`Estoque insuficiente! Restam ${prodEstoque.estoque} un.`);
        carrinho.push({ id: id, nome: prodEstoque.nome, precoCusto: parseFloat(prodEstoque.precoCusto) || 0, preco: parseFloat(prodEstoque.preco), qtd: qtd });
    }
    update();
}

function update() {
    let div = document.getElementById("carrinho");
    div.innerHTML = "";
    let total = 0;
    let totalItens = 0;

    carrinho.forEach((item, i) => {
        let preco = parseFloat(item.preco);
        let subtotal = preco * item.qtd;
        total += subtotal;
        totalItens += item.qtd;

        div.innerHTML += `
        <div class="carrinho-item">
            <div style="flex:1;">
                <b>${item.nome}</b><br>
                <small style="color:#94a3b8;">R$ ${preco.toFixed(2)} cada</small>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <button onclick="alterarQtd(${i}, -1)" style="width:28px; height:28px; padding:0; background:#334155; color:white; border:none; border-radius:4px; cursor:pointer; font-size:16px;">−</button>
                <span style="min-width:24px; text-align:center; font-weight:bold;">${item.qtd}</span>
                <button onclick="alterarQtd(${i}, 1)" style="width:28px; height:28px; padding:0; background:#334155; color:white; border:none; border-radius:4px; cursor:pointer; font-size:16px;">+</button>
                <span style="min-width:70px; text-align:right; font-weight:bold; color:#38bdf8;">R$ ${subtotal.toFixed(2)}</span>
                <button onclick="rm(${i})" class="btn-danger" style="width:28px; height:28px; padding:0; font-size:11px;">X</button>
            </div>
        </div>`;
    });

    document.getElementById("total").innerText = total.toFixed(2);
    document.getElementById("contador-itens").innerText = `${totalItens} item(ns)`;
}

function alterarQtd(i, delta) {
    let prodEstoque = produtos.find(p => p.id === carrinho[i].id);
    let novaQtd = carrinho[i].qtd + delta;

    if (novaQtd <= 0) {
        if (confirm(`Remover "${carrinho[i].nome}" do carrinho?`)) {
            carrinho.splice(i, 1);
        }
    } else if (prodEstoque && novaQtd > prodEstoque.estoque) {
        mostrarAviso(`Estoque insuficiente! Restam ${prodEstoque.estoque} un.`);
    } else {
        carrinho[i].qtd = novaQtd;
    }
    update();
}

function rm(i) {
    carrinho.splice(i, 1);
    update();
}

// ── VENDA AVULSA (F9) ──
function abrirVendaAvulsa() {
    const overlay = document.createElement('div');
    overlay.id = 'overlayVendaAvulsa';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:#0a1628;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:30px;width:320px;text-align:center;">
            <div style="font-size:32px;margin-bottom:10px;">🛒</div>
            <h3 style="color:#e2e8f0;font-size:15px;font-weight:700;margin:0 0 6px;">Venda Avulsa</h3>
            <p style="color:#475569;font-size:13px;margin:0 0 20px;">Lança um item livre no carrinho</p>
            <input id="avulsaDescricao" type="text" placeholder="Descrição (opcional)"
                style="width:100%;background:#060d1a;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;font-size:14px;box-sizing:border-box;margin-bottom:10px;text-align:left;">
            <input id="avulsaValor" type="number" step="0.01" placeholder="Valor (R$)"
                style="width:100%;background:#060d1a;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;font-size:18px;box-sizing:border-box;margin-bottom:10px;text-align:center;">
            <div id="erroAvulsa" style="color:#f87171;font-size:12px;margin-bottom:12px;display:none;"></div>
            <div style="display:flex;gap:8px;">
                <button onclick="document.getElementById('overlayVendaAvulsa').remove()" style="flex:1;background:rgba(255,255,255,0.06);color:#94a3b8;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">Cancelar</button>
                <button onclick="confirmarVendaAvulsa()" style="flex:1;background:#2563eb;color:white;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">Adicionar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('avulsaValor').focus(), 100);
    document.getElementById('avulsaValor').addEventListener('keydown', e => { if (e.key === 'Enter') confirmarVendaAvulsa(); });
}

function confirmarVendaAvulsa() {
    const descricao = document.getElementById('avulsaDescricao').value.trim() || 'Diversos';
    const valor = parseFloat(document.getElementById('avulsaValor').value);
    const erro = document.getElementById('erroAvulsa');
    if (!valor || valor <= 0) {
        erro.innerText = 'Informe um valor maior que R$ 0,00!';
        erro.style.display = 'block';
        return;
    }
    carrinho.push({ id: null, nome: descricao, precoCusto: 0, preco: valor, qtd: 1 });
    document.getElementById('overlayVendaAvulsa').remove();
    update();
    mostrarAviso(`"${descricao}" adicionado ao carrinho!`, "#10b981");
}
