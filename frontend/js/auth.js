/* =======================================================
   AUTENTICAÇÃO - usa a API e salva o token JWT
   ======================================================= */

let caixaAtualId = null;
let caixaAtualNome = null;

async function autenticar() {
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

        localStorage.setItem('token', dados.token);
        localStorage.setItem('empresaId', dados.empresaId);
        localStorage.setItem('dominio', dados.dominio);
        localStorage.setItem('plano', dados.plano);
        usuarioLogado = dados.papel;

        const planoTemCaixas = ['intermediario', 'avancado'].includes(dados.plano);

        if (planoTemCaixas) {
            const resCaixas = await fetch(`${API}/caixas`, {
                headers: { 'Authorization': `Bearer ${dados.token}` }
            });
            const caixas = await resCaixas.json();

            if (caixas.length > 0) {
                renderCaixasLogin(caixas, dados);
                document.getElementById("telaLogin").style.display = "none";
                document.getElementById("telaCaixa").style.display = "flex";
                return;
            }
        }

        await entrarNoSistema(dados, null, null);

    } catch (err) {
        mostrarAviso("Erro ao conectar com o servidor. Verifique se ele está rodando!");
    }
}

function renderCaixasLogin(caixas, dadosLogin) {
    const lista = document.getElementById("listaCaixasLogin");
    lista.innerHTML = caixas.map(cx => {
        const emUso = cx.emUso;
        return `
        <div style="background:${emUso ? 'rgba(248,113,113,0.05)' : 'rgba(37,99,235,0.06)'};
                   border:1px solid ${emUso ? 'rgba(248,113,113,0.2)' : 'rgba(37,99,235,0.2)'};
                   border-radius:10px; padding:14px 18px; margin-bottom:10px;
                   transition:all 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:center;
                        cursor:${emUso ? 'default' : 'pointer'};"
                 onclick="${emUso ? '' : `selecionarCaixa(${cx.id}, '${cx.nome}')`}"
                 onmouseover="if(!${emUso}) this.style.background='rgba(37,99,235,0.08)'"
                 onmouseout="this.style.background=''">
                <div>
                    <div style="font-weight:700; color:#f1f5f9; font-size:15px;">🖥️ ${cx.nome}</div>
                    ${emUso
                        ? `<div style="font-size:12px; color:#f87171; margin-top:3px;">Em uso por: <b>${cx.operador}</b></div>`
                        : '<div style="font-size:12px; color:#34d399; margin-top:3px;">Disponível</div>'}
                </div>
                <div style="font-size:20px;">${emUso ? '🔴' : '🟢'}</div>
            </div>
            ${emUso ? `
            <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(248,113,113,0.15);">
                <p style="color:#94a3b8; font-size:12px; margin:0 0 8px;">A sessão anterior pode ter sido encerrada acidentalmente.</p>
                <button onclick="liberarEEntrar(${cx.id}, '${cx.nome}')"
                    style="background:rgba(251,191,36,0.12); color:#fbbf24; border:1px solid rgba(251,191,36,0.2);
                           border-radius:7px; padding:6px 14px; cursor:pointer; font-size:12px; font-weight:600;
                           font-family:inherit; width:auto;">
                    ⚠️ Liberar e Entrar
                </button>
            </div>` : ''}
        </div>`;
    }).join('');

    window._dadosLoginTemp = dadosLogin;
}

async function liberarEEntrar(caixaId, caixaNome) {
    if (!confirm(`Tem certeza que deseja liberar o ${caixaNome} e entrar? Só faça isso se a sessão anterior foi encerrada sem fechar o caixa.`)) return;
    try {
        await fetch(`${API}/caixas/${caixaId}/fechar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        await selecionarCaixa(caixaId, caixaNome);
    } catch (err) {
        mostrarAviso("Erro ao liberar caixa!");
    }
}

async function selecionarCaixa(caixaId, caixaNome) {
    try {
        const res = await fetch(`${API}/caixas/${caixaId}/abrir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dados = await res.json();
        if (dados.erro) return mostrarAviso(dados.erro);

        caixaAtualId = caixaId;
        caixaAtualNome = caixaNome;
        sessionStorage.setItem('caixaId', caixaId);
        sessionStorage.setItem('caixaNome', caixaNome);

        document.getElementById("telaCaixa").style.display = "none";
        await entrarNoSistema(window._dadosLoginTemp, caixaId, caixaNome);
    } catch (err) {
        mostrarAviso("Erro ao abrir caixa!");
    }
}

function voltarLogin() {
    document.getElementById("telaCaixa").style.display = "none";
    document.getElementById("telaLogin").style.display = "flex";
}

async function entrarNoSistema(dados, caixaId, caixaNome) {
    const painel = document.getElementById("painelResumo");
    painel.style.display = "flex";

    const itensFinanceiros = painel.querySelectorAll('.resumo-linha');
    itensFinanceiros.forEach(item => {
        item.style.display = usuarioLogado === 'admin' ? 'flex' : 'none';
    });

    const btnRelatorio = document.getElementById("btnRelatorio");
    const btnUsuarios = document.getElementById("btnUsuarios");
    const btnHistorico = document.getElementById("btnHistorico");

    if (btnRelatorio) btnRelatorio.style.display = '';
    if (btnHistorico) btnHistorico.style.display = '';
    if (btnUsuarios) btnUsuarios.style.display = usuarioLogado === 'admin' ? '' : 'none';

    const caixaAtivoEl = document.getElementById("caixaAtivo");
    if (caixaId && caixaNome && caixaAtivoEl) {
        caixaAtivoEl.innerText = `🖥️ ${caixaNome}`;
        caixaAtivoEl.style.display = 'inline';
    }

    document.getElementById("usuarioLogadoAviso").innerText = `(Logado como: ${dados.login.toUpperCase()})`;
    document.getElementById("telaLogin").style.display = "none";

    await carregarDados();
    render();
    resumo();
    mostrarAviso("Bem-vindo ao Cloud PDV!", "#10b981");
    setTimeout(() => document.getElementById("busca").focus(), 100);
}
