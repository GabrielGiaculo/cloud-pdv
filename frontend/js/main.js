/* =======================================================
   INTERCEPTADORES DE EVENTO / ATALHOS / SCANNER
   ======================================================= */

document.getElementById("telaLogin").addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { autenticar(); }
});

document.getElementById("busca").addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        let valorInput = this.value.trim().toLowerCase();
        if (!valorInput) return;

        let quantidadeMultiplicadora = 1;
        let termoPesquisa = valorInput;

        if (valorInput.includes('*')) {
            let partes = valorInput.split('*');
            let fator = parseInt(partes[0]);
            if (!isNaN(fator) && fator > 0) {
                quantidadeMultiplicadora = fator;
                termoPesquisa = partes[1] || "";
            }
        }

        if (!termoPesquisa) return;

        let encontrado = produtos.find(p => p.codigoBarras && p.codigoBarras.toLowerCase() === termoPesquisa);

        if (!encontrado) {
            let correspondencias = produtos.filter(p => p.nome.toLowerCase() === termoPesquisa);
            if (correspondencias.length === 1) { encontrado = correspondencias[0]; }
        }

        if (encontrado) {
            e.preventDefault();
            add(encontrado.id, quantidadeMultiplicadora);
            this.value = "";
            render();
        } else {
            mostrarAviso("Produto não localizado com esse código/nome!");
        }
    }
});

document.getElementById("busca").addEventListener('input', function () {
    render();
});

window.addEventListener('keydown', function (e) {
    if (!usuarioLogado) return;
    if (e.key === 'F2') { e.preventDefault(); document.getElementById("busca").focus(); }
    if (e.key === 'F4') { e.preventDefault(); document.getElementById("pagamento").focus(); }
    if (e.key === 'F7') { e.preventDefault(); abrirFechamento(); }
    if (e.key === 'F6') { e.preventDefault(); abrirVendaAvulsa(); }
    if (e.key === 'F8') { e.preventDefault(); finalizar(); }
    if (e.key === 'Escape') { fecharModais(); }
});

// ── LIBERA CAIXA AO FECHAR A ABA ──
window.addEventListener('beforeunload', () => {
    const caixaId = sessionStorage.getItem('caixaId');
    const token = localStorage.getItem('token');
    if (caixaId && token && usuarioLogado) {
        navigator.sendBeacon(`${API}/caixas/${caixaId}/fechar?token=${token}`, '{}');
    }
});

toggleValorPago();
