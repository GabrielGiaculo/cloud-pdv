/* =======================================================
   CAIXA: fechamento do dia, sangria e resumo do turno
   ======================================================= */
function imprimirFechamento() {
    document.body.classList.add("print-fechamento");
    document.body.classList.remove("print-receipt");
    window.print();
}
async function abrirFechamento() {
    if (!['admin', 'gerente', 'operador'].includes(usuarioLogado)) return mostrarAviso("Acesso negado!");
    try {
        const todasAPI = await apiBuscarVendas();
        const caixaId = sessionStorage.getItem('caixaId');
        const plano = localStorage.getItem('plano') || 'base';
        const temCaixas = ['intermediario', 'avancado'].includes(plano) && caixaId;
        vendas = todasAPI.filter(v => {
            if (v.data < inicioCaixa) return false;
            if (temCaixas) return v.caixaId == caixaId;
            return true;
        });
    } catch(e) { console.error("Erro ao recarregar vendas:", e); }
    let vTodas = vendas;
    let v = vendas.filter(x => !x.cancelada);
    let s = sangrias;
    let total = 0, d = 0, p = 0, c = 0, totalVr = 0, custoTotal = 0;
    v.forEach(x => {
        total += parseFloat(x.total);
        if (x.metodo === "dinheiro") d += parseFloat(x.total);
        if (x.metodo === "pix") p += parseFloat(x.total);
        if (x.metodo === "cartao") c += parseFloat(x.total);
        if (x.metodo === "vr") totalVr += parseFloat(x.total);
        if (x.itens) {
            x.itens.forEach(item => {
                custoTotal += parseFloat(item.precoCusto || 0) * item.qtd;
            });
        }
    });
    let totalSangria = s.reduce((soma, item) => soma + parseFloat(item.valor), 0);
    let dinheiroCaixa = d - totalSangria;
    let lucroLiquido = total - custoTotal;
    let listaSangrias = s.length ? s.map(item => `
        <div class="fechamento-item-print" style="margin-bottom:6px; color:#f87171;">
            <span>${new Date(item.data).toLocaleString('pt-BR')} - ${item.motivo || "Sem motivo"}${item.autorizadaPor ? ` (autorizado por: ${item.autorizadaPor})` : ''}</span>
            <span>R$ ${parseFloat(item.valor).toFixed(2)}</span>
        </div>
    `).join("") : `<div style="color:#475569; font-size:12px;">Nenhuma sangria registrada hoje.</div>`;
    const canceladas = vTodas.filter(x => x.cancelada);
    const totalCancelado = canceladas.reduce((s, x) => s + parseFloat(x.total), 0);
    const listaCanceladas = canceladas.length ? canceladas.map(x => `
        <div class="fechamento-item-print" style="margin-bottom:6px; color:#f87171; font-size:12px;">
            <span>${new Date(x.data).toLocaleString('pt-BR')} — ${x.itens.map(i => i.nome).join(', ')}</span>
            <span>R$ ${parseFloat(x.total).toFixed(2)}${x.canceladaPor ? ` (por: ${x.canceladaPor})` : ''}${x.canceladaEm ? ` às ${new Date(x.canceladaEm).toLocaleTimeString('pt-BR')}` : ''}</span>
        </div>
    `).join('') : '<div style="color:#475569; font-size:12px;">Nenhum cancelamento no turno.</div>';
    const nomeCaixa = sessionStorage.getItem('caixaNome') || '';
    document.getElementById("dataFechamentoPrint").innerText = `Emissão: ${new Date().toLocaleString('pt-BR')}${nomeCaixa ? ' — ' + nomeCaixa : ''}`;
    document.getElementById("conteudoFechamento").innerHTML = `
        <div class="fechamento-item-print" style="margin-bottom:8px;"><span>💰 Dinheiro:</span> <b>R$ ${d.toFixed(2)}</b></div>
        <div class="fechamento-item-print" style="margin-bottom:8px; color:#f87171;"><span>Sangrias:</span> <b>R$ ${totalSangria.toFixed(2)}</b></div>
        <div class="fechamento-item-print" style="margin-bottom:8px; color:#60a5fa;"><span>Dinheiro no Caixa:</span> <b>R$ ${dinheiroCaixa.toFixed(2)}</b></div>
        <div class="fechamento-item-print" style="margin-bottom:8px;"><span>📱 Pix:</span> <b>R$ ${p.toFixed(2)}</b></div>
        <div class="fechamento-item-print" style="margin-bottom:8px;"><span>💳 Cartão:</span> <b>R$ ${c.toFixed(2)}</b></div>
        ${totalVr > 0 ? `<div class="fechamento-item-print" style="margin-bottom:8px;"><span>🍽️ VR:</span> <b>R$ ${totalVr.toFixed(2)}</b></div>` : ''}
        <hr style="border: 1px solid rgba(255,255,255,0.06);">
        <div style="margin-bottom:8px; color:#94a3b8; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Sangrias do Turno</div>
        ${listaSangrias}
        <hr style="border: 1px solid rgba(255,255,255,0.06);">
        <div style="margin-bottom:8px; color:#94a3b8; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">❌ Cancelamentos (${canceladas.length}) — R$ ${totalCancelado.toFixed(2)}</div>
        ${listaCanceladas}
        <hr style="border: 1px solid rgba(255,255,255,0.06);">
        <div class="fechamento-item-print" style="margin-bottom:8px; color:#475569;"><span>📉 Custo das Mercadorias:</span> <span>R$ ${custoTotal.toFixed(2)}</span></div>
        <div class="fechamento-item-print" style="margin-bottom:8px; font-size:16px; font-weight:bold; color:#34d399;"><span>📈 Lucro Líquido Real:</span> <span>R$ ${lucroLiquido.toFixed(2)}</span></div>
        <div class="fechamento-item-print" style="margin-top:15px; font-size:18px; font-weight:bold; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px;">
            <span>TOTAL MOVIMENTADO:</span> <span style="color:#60a5fa;">R$ ${total.toFixed(2)}</span>
        </div>
    `;
    document.getElementById("overlay").style.display = "block";
    document.getElementById("fechamento").style.display = "block";
    document.body.classList.add("print-fechamento");
    document.body.classList.remove("print-receipt");
}
async function registrarSangria() {
    let valor = parseFloat(document.getElementById("valorSangria").value) || 0;
    let motivo = document.getElementById("motivoSangria").value.trim();
    if (valor <= 0) return mostrarAviso("Informe um valor de sangria maior que R$ 0,00!");
    let dinheiroDia = vendas.filter(x => x.metodo === "dinheiro").reduce((soma, item) => soma + parseFloat(item.total), 0);
    let sangriaDia = sangrias.reduce((soma, item) => soma + parseFloat(item.valor), 0);
    if (valor > (dinheiroDia - sangriaDia)) return mostrarAviso("Sangria maior que o dinheiro disponível no caixa!");
    if (!confirm(`Confirmar sangria de R$ ${valor.toFixed(2)}?`)) return;
    if (usuarioLogado !== "admin") {
        const pin = await pedirPinSupervisor("Autorização necessária para registrar sangria");
        if (!pin) return;
        try {
            const caixaId = sessionStorage.getItem('caixaId');
            await apiSalvarSangria({ valor, motivo, pinSupervisor: pin, caixaId: caixaId ? parseInt(caixaId) : null });
            await recarregarSangrias();
            mostrarAviso("Sangria registrada com sucesso!", "#10b981");
        } catch (err) {
            mostrarAviso(err.message || "Erro ao registrar sangria!");
        }
    } else {
        try {
            const caixaId = sessionStorage.getItem('caixaId');
            await apiSalvarSangria({ valor, motivo, caixaId: caixaId ? parseInt(caixaId) : null });
            await recarregarSangrias();
            mostrarAviso("Sangria registrada com sucesso!", "#10b981");
        } catch (err) {
            mostrarAviso("Erro ao registrar sangria!");
        }
    }
    document.getElementById("valorSangria").value = "";
    document.getElementById("motivoSangria").value = "";
}
async function recarregarSangrias() {
    const todasSangrias = await apiBuscarSangrias();
    const caixaId = sessionStorage.getItem('caixaId');
    const plano = localStorage.getItem('plano') || 'base';
    const temCaixas = ['intermediario', 'avancado'].includes(plano) && caixaId;
    sangrias = todasSangrias.filter(s => {
        if (s.data < inicioCaixa) return false;
        if (temCaixas) return s.caixaId === parseInt(caixaId);
        return true;
    });
    resumo();
}
async function fecharDia() {
    if (!['admin', 'gerente', 'operador'].includes(usuarioLogado)) return mostrarAviso("Acesso negado!");
    if (usuarioLogado !== 'admin') {
        const pin = await pedirPinSupervisor("PIN necessário para fechar o caixa");
        if (!pin) return;
    }
    if (!confirm("Tem certeza que deseja fechar o caixa? O resumo do turno será zerado.")) return;
    let v = vendas.filter(x => !x.cancelada);
    let s = sangrias;
    let total = 0, d = 0, p = 0, c = 0, totalVr = 0, custoTotal = 0;
    v.forEach(x => {
        total += parseFloat(x.total);
        if (x.metodo === "dinheiro") d += parseFloat(x.total);
        if (x.metodo === "pix") p += parseFloat(x.total);
        if (x.metodo === "cartao") c += parseFloat(x.total);
        if (x.metodo === "vr") totalVr += parseFloat(x.total);
        if (x.itens) x.itens.forEach(item => { custoTotal += parseFloat(item.precoCusto || 0) * item.qtd; });
    });
    let totalSangria = s.reduce((soma, item) => soma + parseFloat(item.valor), 0);
    let lucroLiquido = total - custoTotal;
    const _dominio = localStorage.getItem('dominio') || 'default';
    const dadosEmpresa = JSON.parse(localStorage.getItem(`dadosEmpresa_${_dominio}`) || '{}');
    const planoAtual = localStorage.getItem('plano') || 'base';
    const planoTemEmail = ['intermediario', 'avancado'].includes(planoAtual);
    if (dadosEmpresa.email && planoTemEmail) {
        try {
            await fetch(`${API}/enviarEmailFechamento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({
                    emailDestino: dadosEmpresa.email,
                    dados: {
                        nomeEmpresa: dadosEmpresa.nome || 'Cloud System',
                        nomeCaixa: sessionStorage.getItem('caixaNome') || '',
                        faturamento: total.toFixed(2),
                        lucro: lucroLiquido.toFixed(2),
                        totalVendas: v.length,
                        dinheiro: d.toFixed(2),
                        pix: p.toFixed(2),
                        cartao: c.toFixed(2),
                        vr: totalVr.toFixed(2),
                        sangrias: totalSangria.toFixed(2),
                        dinheiroCaixa: (d - totalSangria).toFixed(2),
                        data: new Date().toLocaleString('pt-BR'),
                        caixas: []
                    }
                })
            });
            mostrarAviso("Relatório enviado por email!", "#10b981");
        } catch (err) {
            console.error("Erro ao enviar email:", err);
        }
    }
    if (dadosEmpresa.email && planoTemEmail) {
        try {
            const produtosBaixos = produtos.filter(p => p.estoque < 5 && p.estoque >= 0);
            if (produtosBaixos.length > 0) {
                await fetch(`${API}/enviarEmailEstoqueBaixo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({
                        emailDestino: dadosEmpresa.email,
                        dados: {
                            nomeEmpresa: dadosEmpresa.nome || 'Cloud System',
                            produtos: produtosBaixos.map(p => ({ nome: p.nome, estoque: p.estoque })),
                            data: new Date().toLocaleString('pt-BR')
                        }
                    })
                });
            }
        } catch (err) {
            console.error("Erro ao enviar email de estoque:", err);
        }
    }
    imprimirFechamento();
    const caixaIdFecha = sessionStorage.getItem('caixaId');
    if (caixaIdFecha) {
        try {
            await fetch(`${API}/caixas/${caixaIdFecha}/fechar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            sessionStorage.removeItem('caixaId');
            sessionStorage.removeItem('caixaNome');
            const badge = document.getElementById('caixaAtivo');
            if (badge) badge.style.display = 'none';
        } catch(e) { console.error('Erro ao fechar caixa na API:', e); }
    }
    inicioCaixa = new Date().toISOString();
    localStorage.setItem('inicioCaixa', inicioCaixa);
    vendas = [];
    sangrias = [];
    resumo();
    fecharModais();
    mostrarAviso("Caixa fechado com sucesso!", "#10b981");
}
async function resumo() {
    if (!usuarioLogado) return;
    let v = vendas;
    let s = sangrias;
    let t = 0, d = 0, p = 0, c = 0, vrResumo = 0;
    v.forEach(x => {
        t += parseFloat(x.total);
        if (x.metodo === "dinheiro") d += parseFloat(x.total);
        if (x.metodo === "pix") p += parseFloat(x.total);
        if (x.metodo === "cartao") c += parseFloat(x.total);
        if (x.metodo === "vr") vrResumo += parseFloat(x.total);
    });
    let totalSangria = s.reduce((soma, item) => soma + parseFloat(item.valor), 0);
    document.getElementById("totalDia").innerText = t.toFixed(2);
    document.getElementById("dinheiro").innerText = d.toFixed(2);
    document.getElementById("sangriaTotal").innerText = totalSangria.toFixed(2);
    document.getElementById("dinheiroCaixa").innerText = (d - totalSangria).toFixed(2);
    document.getElementById("pix").innerText = p.toFixed(2);
    document.getElementById("cartao").innerText = c.toFixed(2);
    const vrEl = document.getElementById("vr");
    if (vrEl) vrEl.innerText = vrResumo.toFixed(2);
}
// -------------------------------------------------------
// MODAL DE PIN DE SUPERVISOR
// -------------------------------------------------------
function pedirPinSupervisor(mensagem) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#0a1628;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:30px;width:320px;text-align:center;">
                <div style="font-size:32px;margin-bottom:10px;">🔐</div>
                <h3 style="color:#e2e8f0;font-size:15px;font-weight:700;margin:0 0 6px;">PIN de Supervisor</h3>
                <p style="color:#475569;font-size:13px;margin:0 0 20px;">${mensagem}</p>
                <input id="inputPinSupervisor" type="text" inputmode="numeric" maxlength="6" autocomplete="off"
                    placeholder="Digite o PIN (4-6 dígitos)"
                    style="width:100%;background:#060d1a;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;font-size:18px;box-sizing:border-box;margin-bottom:10px;text-align:center;letter-spacing:6px;-webkit-text-security:disc;">
                <div id="erroPinSupervisor" style="color:#f87171;font-size:12px;margin-bottom:12px;display:none;"></div>
                <div style="display:flex;gap:8px;">
                    <button id="btnCancelarPin" style="flex:1;background:rgba(255,255,255,0.06);color:#94a3b8;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">Cancelar</button>
                    <button id="btnConfirmarPin" style="flex:1;background:#2563eb;color:white;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:13px;font-weight:600;">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#inputPinSupervisor');
        const erro = overlay.querySelector('#erroPinSupervisor');
        input.focus();
        overlay.querySelector('#btnCancelarPin').onclick = () => {
            document.body.removeChild(overlay);
            resolve(null);
        };
        const confirmar = async () => {
            const pin = input.value.trim();
            if (!pin) { erro.innerText = 'Digite o PIN!'; erro.style.display = 'block'; return; }
            if (!/^\d{4,6}$/.test(pin)) { erro.innerText = 'PIN deve ter 4 a 6 dígitos numéricos.'; erro.style.display = 'block'; return; }
            try {
                const res = await fetch(`${API}/verificarSupervisor`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ pin })
                });
                const dados = await res.json();
                if (dados.erro) {
                    erro.innerText = dados.erro;
                    erro.style.display = 'block';
                    input.value = '';
                    input.focus();
                    return;
                }
                document.body.removeChild(overlay);
                resolve(pin);
            } catch (e) {
                erro.innerText = 'Erro ao verificar PIN.';
                erro.style.display = 'block';
            }
        };
        overlay.querySelector('#btnConfirmarPin').onclick = confirmar;
        input.addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); });
    });
}
