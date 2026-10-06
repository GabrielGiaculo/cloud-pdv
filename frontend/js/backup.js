/* =======================================================
   BACKUP: exportar e importar dados em JSON
   ======================================================= */

function exportarDados() {
    let dadosBackup = {
        produtos: produtos,
        vendas: vendas,
        sangrias: sangrias
    };

    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dadosBackup));
    let downloadAnchor = document.createElement('a');

    let dataAtual = new Date().toISOString().split('T')[0].replace(/-/g, '_');

    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `backup_cloud_pdv_${dataAtual}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    mostrarAviso("Backup baixado com sucesso!", "#10b981");
}

function importarDados() {
    if (confirm("ATENÇÃO: Importar um backup vai substituir os produtos e vendas atuais deste computador. Deseja continuar?")) {
        document.getElementById("importFile").click();
    }
}

function processarArquivoBackup(event) {
    let file = event.target.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.onload = function (e) {
        try {
            let dadosJson = JSON.parse(e.target.result);

            if (dadosJson.produtos && dadosJson.vendas) {
                produtos = dadosJson.produtos;
                vendas = dadosJson.vendas;
                sangrias = dadosJson.sangrias || [];

                salvarProdutos();
                salvarVendas();
                salvarSangrias();

                render();
                resumo();
                mostrarAviso("Dados restaurados com sucesso!", "#10b981");
            } else {
                mostrarAviso("Arquivo de backup inválido ou corrompido!");
            }
        } catch (err) {
            mostrarAviso("Erro ao ler o arquivo selecionado!");
        }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reseta o input de arquivo
}
