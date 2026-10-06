require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET;
if (!JWT_SECRET || !SUPER_ADMIN_SECRET) {
    console.error('Defina JWT_SECRET e SUPER_ADMIN_SECRET no arquivo .env (veja .env.example).');
    process.exit(1);
}

// Atrás do Nginx, req.ip precisa vir do X-Forwarded-For (senão o limite de tentativas de login é global)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

async function enviarEmailFechamento(emailDestino, dados) {
    const { nomeEmpresa, nomeCaixa, faturamento, lucro, totalVendas, dinheiro, pix, cartao, vr, sangrias, dinheiroCaixa, data, caixas } = dados;
    const tituloRelatorio = nomeCaixa ? `${nomeEmpresa} — ${nomeCaixa}` : nomeEmpresa;
    
    let caixasHtml = '';
    if (caixas && caixas.length > 0) {
        caixasHtml = caixas.map(cx => `
        <div style="background:#f8f9fa;border-radius:8px;padding:14px;margin-bottom:12px;border-left:3px solid #2563eb;">
            <h3 style="color:#1e293b;font-size:14px;margin:0 0 10px;">🖥️ ${cx.nome}</h3>
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:4px 8px;color:#475569;">💵 Dinheiro</td><td style="padding:4px 8px;text-align:right;">R$ ${cx.dinheiro}</td></tr>
                <tr><td style="padding:4px 8px;color:#475569;">📱 Pix</td><td style="padding:4px 8px;text-align:right;">R$ ${cx.pix}</td></tr>
                <tr><td style="padding:4px 8px;color:#475569;">💳 Cartão</td><td style="padding:4px 8px;text-align:right;">R$ ${cx.cartao}</td></tr>
                <tr><td style="padding:4px 8px;color:#475569;">🍽️ VR</td><td style="padding:4px 8px;text-align:right;">R$ ${cx.vr || '0.00'}</td></tr>
                <tr><td style="padding:4px 8px;color:#dc2626;">⬇️ Sangrias</td><td style="padding:4px 8px;text-align:right;color:#dc2626;">R$ ${cx.sangrias}</td></tr>
                <tr style="border-top:1px solid #e2e8f0;"><td style="padding:6px 8px;font-weight:700;color:#1e293b;">Total</td><td style="padding:6px 8px;text-align:right;font-weight:700;color:#2563eb;">R$ ${cx.total}</td></tr>
            </table>
        </div>`).join('');
    }

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:20px;border-radius:12px;">
        <div style="background:#060d1a;padding:24px;border-radius:10px;text-align:center;margin-bottom:20px;">
            <h1 style="color:#60a5fa;margin:0;font-size:22px;">☁️ Cloud System</h1>
            <p style="color:#475569;margin:6px 0 0;font-size:14px;">Relatório de Fechamento de Caixa</p>
        </div>
        <div style="background:white;padding:20px;border-radius:10px;margin-bottom:16px;">
            <h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">📊 ${tituloRelatorio || 'Sua Empresa'} — ${data}</h2>
            ${caixasHtml}
            <div style="background:#eff6ff;border-radius:8px;padding:14px;margin-top:8px;">
                <h3 style="color:#1d4ed8;font-size:14px;margin:0 0 10px;">📈 TOTAL GERAL DO DIA</h3>
                <table style="width:100%;border-collapse:collapse;">
                    <tr style="background:#dbeafe;"><td style="padding:10px 14px;font-weight:bold;color:#334155;">💰 Faturamento Total</td><td style="padding:10px 14px;text-align:right;font-weight:bold;color:#16a34a;font-size:18px;">R$ ${faturamento}</td></tr>
                    <tr><td style="padding:10px 14px;color:#475569;">📈 Lucro Líquido</td><td style="padding:10px 14px;text-align:right;color:#2563eb;font-weight:bold;">R$ ${lucro}</td></tr>
                    <tr style="background:#dbeafe;"><td style="padding:10px 14px;color:#475569;">🛒 Total de Vendas</td><td style="padding:10px 14px;text-align:right;font-weight:bold;">${totalVendas}</td></tr>
                    <tr><td style="padding:10px 14px;color:#475569;">💵 Em Dinheiro</td><td style="padding:10px 14px;text-align:right;">R$ ${dinheiro}</td></tr>
                    <tr style="background:#dbeafe;"><td style="padding:10px 14px;color:#475569;">📱 Em Pix</td><td style="padding:10px 14px;text-align:right;">R$ ${pix}</td></tr>
                    <tr><td style="padding:10px 14px;color:#475569;">💳 Em Cartão</td><td style="padding:10px 14px;text-align:right;">R$ ${cartao}</td></tr>
                    <tr style="background:#dbeafe;"><td style="padding:10px 14px;color:#475569;">🍽️ Em VR</td><td style="padding:10px 14px;text-align:right;">R$ ${vr || '0.00'}</td></tr>
                    <tr style="background:#fef2f2;"><td style="padding:10px 14px;color:#dc2626;">⬇️ Sangrias</td><td style="padding:10px 14px;text-align:right;color:#dc2626;font-weight:bold;">R$ ${sangrias}</td></tr>
                    <tr style="background:#eff6ff;"><td style="padding:10px 14px;color:#1d4ed8;font-weight:bold;">💼 Dinheiro no Caixa</td><td style="padding:10px 14px;text-align:right;color:#1d4ed8;font-weight:bold;">R$ ${dinheiroCaixa}</td></tr>
                </table>
            </div>
        </div>
        <p style="text-align:center;color:#94a3b8;font-size:12px;">Cloud System — Enviado automaticamente no fechamento do caixa</p>
    </div>`;
    await transporter.sendMail({ from: `"Cloud System" <${process.env.EMAIL_USER}>`, to: emailDestino, subject: `☁️ Fechamento${nomeCaixa ? ' — ' + nomeCaixa : ''} — ${nomeEmpresa || 'Cloud System'} — ${data}`, html });
}

function emailValido(e) { return typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

const tentativasLogin = {};
function verificarTentativas(ip) {
    const agora = Date.now();
    if (!tentativasLogin[ip]) tentativasLogin[ip] = { count: 0, bloqueadoAte: null };
    let dados = tentativasLogin[ip];
    if (dados.bloqueadoAte && agora < dados.bloqueadoAte) { return { bloqueado: true, minutosRestantes: Math.ceil((dados.bloqueadoAte - agora) / 60000) }; }
    return { bloqueado: false };
}
function registrarTentativaErrada(ip) {
    if (!tentativasLogin[ip]) tentativasLogin[ip] = { count: 0, bloqueadoAte: null };
    tentativasLogin[ip].count++;
    if (tentativasLogin[ip].count >= 5) { tentativasLogin[ip].bloqueadoAte = Date.now() + (15 * 60 * 1000); tentativasLogin[ip].count = 0; }
}
function resetarTentativas(ip) { delete tentativasLogin[ip]; }

function autenticarToken(req, res, next) {
    // O token também pode vir na query string porque navigator.sendBeacon (liberar caixa ao fechar a aba) não envia headers
    const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ erro: 'Token não fornecido.' });
    try { req.usuario = jwt.verify(token, JWT_SECRET); next(); }
    catch { return res.status(401).json({ erro: 'Token inválido ou expirado.' }); }
}

function autenticarSuperAdmin(req, res, next) {
    const secret = req.headers['x-super-admin'];
    if (!secret || secret !== SUPER_ADMIN_SECRET) return res.status(403).json({ erro: 'Acesso negado.' });
    next();
}

/* SUPER ADMIN */
app.get('/superadmin/empresas', autenticarSuperAdmin, async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany({ orderBy: { criadaEm: 'desc' }, include: { _count: { select: { usuarios: true, produtos: true, vendas: true } } } });
        res.json(empresas);
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao buscar empresas.' }); }
});
app.post('/superadmin/empresas', autenticarSuperAdmin, async (req, res) => {
    try {
        const { nome, dominio, plano, adminLogin, adminSenha, vencimento } = req.body;
        if (!nome || !dominio || !adminLogin || !adminSenha) return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
        const dominioLimpo = dominio.toLowerCase().replace(/[^a-z0-9]/g, '');
        const senhaHash = await bcrypt.hash(adminSenha, 10);
        const data = { nome, dominio: dominioLimpo, plano: plano || 'base', usuarios: { create: { login: adminLogin, senha: senhaHash, papel: 'admin' } } };
        if (vencimento) data.vencimento = new Date(vencimento);
        const empresa = await prisma.empresa.create({ data });
        res.json({ ok: true, empresa: { id: empresa.id, nome: empresa.nome, dominio: empresa.dominio } });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao criar empresa. Domínio pode já estar em uso.' }); }
});
app.put('/superadmin/empresas/:id', autenticarSuperAdmin, async (req, res) => {
    try {
        const { ativa, plano, vencimento } = req.body;
        const data = {};
        if (ativa !== undefined) data.ativa = ativa;
        if (plano !== undefined) data.plano = plano;
        if (vencimento !== undefined) data.vencimento = vencimento ? new Date(vencimento) : null;
        const empresa = await prisma.empresa.update({ where: { id: parseInt(req.params.id) }, data });
        res.json({ ok: true, empresa });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao atualizar empresa.' }); }
});
app.post('/superadmin/empresas/:id/resetsenha', autenticarSuperAdmin, async (req, res) => {
    try {
        const empresaId = parseInt(req.params.id);
        const { novaSenha } = req.body;
        if (!novaSenha || novaSenha.length < 4) return res.status(400).json({ erro: 'Senha deve ter no mínimo 4 caracteres.' });
        const admin = await prisma.usuario.findFirst({ where: { empresaId, papel: 'admin' } });
        if (!admin) return res.status(404).json({ erro: 'Admin não encontrado.' });
        const hash = await bcrypt.hash(novaSenha, 10);
        await prisma.usuario.update({ where: { id: admin.id }, data: { senha: hash } });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao redefinir senha.' }); }
});
app.delete('/superadmin/empresas/:id', autenticarSuperAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.$transaction(async (tx) => {
            await tx.compraFuncionario.deleteMany({ where: { funcionario: { empresaId: id } } });
            await tx.funcionario.deleteMany({ where: { empresaId: id } });
            await tx.promocao.deleteMany({ where: { empresaId: id } });
            await tx.sangria.deleteMany({ where: { empresaId: id } });
            const vendas = await tx.venda.findMany({ where: { empresaId: id }, select: { id: true } });
            await tx.itemVenda.deleteMany({ where: { vendaId: { in: vendas.map(v => v.id) } } });
            await tx.venda.deleteMany({ where: { empresaId: id } });
            await tx.produto.deleteMany({ where: { empresaId: id } });
            await tx.usuario.deleteMany({ where: { empresaId: id } });
            await tx.caixa.deleteMany({ where: { empresaId: id } });
            await tx.empresa.delete({ where: { id } });
        });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao excluir empresa.' }); }
});

/* CAIXAS */
app.get('/caixas', autenticarToken, async (req, res) => {
    try {
        const caixas = await prisma.caixa.findMany({ where: { empresaId: req.usuario.empresaId, ativo: true }, orderBy: { numero: 'asc' } });
        res.json(caixas);
    } catch { res.status(500).json({ erro: 'Erro ao buscar caixas.' }); }
});

app.post('/caixas', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        if (!['intermediario', 'avancado'].includes(req.usuario.plano)) return res.status(403).json({ erro: 'Múltiplos caixas disponível apenas nos planos Intermediário e Avançado.' });
        
        // Limite de caixas por plano
        if (req.usuario.plano === 'intermediario') {
            const qtd = await prisma.caixa.count({ where: { empresaId: req.usuario.empresaId, ativo: true } });
            if (qtd >= 2) return res.status(403).json({ erro: 'Plano Intermediário permite no máximo 2 caixas. Faça upgrade para o Avançado.' });
        }
        
        // Verifica se já existe caixa inativo com mesmo número e reativa
        const { nome, numero } = req.body;
        const existente = await prisma.caixa.findFirst({ where: { empresaId: req.usuario.empresaId, numero } });
        if (existente && !existente.ativo) {
            const reativado = await prisma.caixa.update({ where: { id: existente.id }, data: { nome, ativo: true } });
            return res.json(reativado);
        }
        const caixa = await prisma.caixa.create({ data: { nome, numero, empresaId: req.usuario.empresaId } });
        res.json(caixa);
    } catch { res.status(500).json({ erro: 'Erro ao criar caixa.' }); }
});

app.put('/caixas/:id', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const { nome, ativo } = req.body;
        const r = await prisma.caixa.updateMany({ where: { id: parseInt(req.params.id), empresaId: req.usuario.empresaId }, data: { nome, ativo } });
        if (r.count === 0) return res.status(404).json({ erro: 'Caixa não encontrado.' });
        res.json({ ok: true });
    } catch { res.status(500).json({ erro: 'Erro ao atualizar caixa.' }); }
});

// Operador abre um caixa
app.post('/caixas/:id/abrir', autenticarToken, async (req, res) => {
    try {
        const caixaId = parseInt(req.params.id);
        const caixa = await prisma.caixa.findFirst({ where: { id: caixaId, empresaId: req.usuario.empresaId } });
        if (!caixa) return res.status(404).json({ erro: 'Caixa não encontrado.' });
        if (caixa.emUso) return res.status(400).json({ erro: `Caixa já está em uso por: ${caixa.operador}`, operador: caixa.operador });
        await prisma.caixa.update({ where: { id: caixaId }, data: { emUso: true, operador: req.usuario.login, inicioUso: new Date() } });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao abrir caixa.' }); }
});

// Operador fecha um caixa
app.post('/caixas/:id/fechar', autenticarToken, async (req, res) => {
    try {
        const caixaId = parseInt(req.params.id);
        const r = await prisma.caixa.updateMany({ where: { id: caixaId, empresaId: req.usuario.empresaId }, data: { emUso: false, operador: null, inicioUso: null } });
        if (r.count === 0) return res.status(404).json({ erro: 'Caixa não encontrado.' });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao fechar caixa.' }); }
});

// Resumo de todos os caixas para o admin
app.get('/caixas/resumo', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const { inicio, fim } = req.query;
        const where = { empresaId: req.usuario.empresaId, cancelada: false };
        if (inicio) where.data = { gte: new Date(inicio) };
        if (fim) where.data = { ...where.data, lte: new Date(fim) };
        
        const caixas = await prisma.caixa.findMany({ where: { empresaId: req.usuario.empresaId }, orderBy: { numero: 'asc' } });
        const resumo = await Promise.all(caixas.map(async (cx) => {
            const vendas = await prisma.venda.findMany({ where: { ...where, caixaId: cx.id }, include: { itens: true } });
            const sangrias = await prisma.sangria.findMany({ where: { empresaId: req.usuario.empresaId, caixaId: cx.id } });
            let total = 0, dinheiro = 0, pix = 0, cartao = 0, vr = 0, custoTotal = 0;
            vendas.forEach(v => {
                total += parseFloat(v.total);
                if (v.metodo === 'dinheiro') dinheiro += parseFloat(v.total);
                if (v.metodo === 'pix') pix += parseFloat(v.total);
                if (v.metodo === 'cartao') cartao += parseFloat(v.total);
                if (v.metodo === 'vr') vr += parseFloat(v.total);
                v.itens?.forEach(i => { custoTotal += parseFloat(i.precoCusto || 0) * i.qtd; });
            });
            const totalSangrias = sangrias.reduce((s, x) => s + parseFloat(x.valor), 0);
            return { id: cx.id, nome: cx.nome, numero: cx.numero, emUso: cx.emUso, operador: cx.operador, total: total.toFixed(2), dinheiro: dinheiro.toFixed(2), pix: pix.toFixed(2), cartao: cartao.toFixed(2), vr: vr.toFixed(2), sangrias: totalSangrias.toFixed(2), lucro: (total - custoTotal).toFixed(2), qtdVendas: vendas.length };
        }));
        res.json(resumo);
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao buscar resumo dos caixas.' }); }
});

/* EMAIL ESTOQUE BAIXO */
app.post('/enviarEmailEstoqueBaixo', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const { emailDestino, dados } = req.body;
        if (!emailValido(emailDestino)) return res.status(400).json({ erro: 'Email de destino inválido.' });
        const { nomeEmpresa, produtos, data } = dados;
        const linhas = produtos.map(p => `<tr><td style="padding:10px 14px;color:#334155;">${p.nome}</td><td style="padding:10px 14px;text-align:right;font-weight:700;color:${p.estoque === 0 ? '#f87171' : '#fbbf24'};">${p.estoque === 0 ? '⚠️ SEM ESTOQUE' : p.estoque + ' un'}</td></tr>`).join('');
        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:20px;border-radius:12px;"><div style="background:#060d1a;padding:24px;border-radius:10px;text-align:center;margin-bottom:20px;"><h1 style="color:#fbbf24;margin:0;font-size:22px;">⚠️ Alerta de Estoque Baixo</h1><p style="color:#475569;margin:6px 0 0;font-size:14px;">Cloud System — ${nomeEmpresa}</p></div><div style="background:white;padding:20px;border-radius:10px;margin-bottom:16px;"><h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">📦 Produtos com estoque crítico — ${data}</h2><table style="width:100%;border-collapse:collapse;"><tr style="background:#f1f5f9;"><th style="padding:10px 14px;text-align:left;color:#334155;">Produto</th><th style="padding:10px 14px;text-align:right;color:#334155;">Estoque</th></tr>${linhas}</table></div><p style="text-align:center;color:#94a3b8;font-size:12px;">Cloud System — Verificação automática no fechamento do caixa</p></div>`;
        await transporter.sendMail({ from: `"Cloud System" <${process.env.EMAIL_USER}>`, to: emailDestino, subject: `⚠️ Estoque Baixo — ${nomeEmpresa} — ${data}`, html });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao enviar email de estoque.' }); }
});

/* LOGIN */
app.post('/login', async (req, res) => {
    try {
        const ip = req.ip;
        const { login, senha, dominio } = req.body;
        const verificacao = verificarTentativas(ip);
        if (verificacao.bloqueado) return res.status(429).json({ erro: `Muitas tentativas incorretas. Tente novamente em ${verificacao.minutosRestantes} minuto(s).` });
        const empresa = await prisma.empresa.findUnique({ where: { dominio: dominio || 'default' } });
        if (!empresa) { registrarTentativaErrada(ip); return res.status(401).json({ erro: 'Empresa não encontrada.' }); }
        if (!empresa.ativa) return res.status(403).json({ erro: 'Empresa inativa. Entre em contato com o suporte.' });
        const usuario = await prisma.usuario.findUnique({ where: { empresaId_login: { empresaId: empresa.id, login } } });
        if (!usuario) { registrarTentativaErrada(ip); return res.status(401).json({ erro: 'Usuário ou senha incorretos.' }); }
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) { registrarTentativaErrada(ip); return res.status(401).json({ erro: 'Usuário ou senha incorretos.' }); }
        resetarTentativas(ip);
        const token = jwt.sign({ login: usuario.login, papel: usuario.papel, empresaId: empresa.id, dominio: empresa.dominio, plano: empresa.plano }, JWT_SECRET, { expiresIn: '12h' });

        res.json({ login: usuario.login, papel: usuario.papel, empresaId: empresa.id, dominio: empresa.dominio, plano: empresa.plano, token });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao realizar login.' }); }
});

/* PRODUTOS */
app.get('/produtos', autenticarToken, async (req, res) => { try { res.json(await prisma.produto.findMany({ where: { empresaId: req.usuario.empresaId } })); } catch { res.status(500).json({ erro: 'Erro ao buscar produtos.' }); } });
app.post('/produtos', autenticarToken, async (req, res) => { try { const { nome, precoCusto, preco, estoque, codigoBarras } = req.body; res.json(await prisma.produto.create({ data: { nome, precoCusto, preco, estoque, codigoBarras, empresaId: req.usuario.empresaId } })); } catch { res.status(500).json({ erro: 'Erro ao cadastrar produto.' }); } });
app.put('/produtos/:id', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const { nome, precoCusto, preco, estoque, codigoBarras } = req.body;
        const r = await prisma.produto.updateMany({ where: { id: parseInt(req.params.id), empresaId: req.usuario.empresaId }, data: { nome, precoCusto, preco, estoque, codigoBarras } });
        if (r.count === 0) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json({ ok: true });
    } catch { res.status(500).json({ erro: 'Erro ao atualizar produto.' }); }
});
app.delete('/produtos/:id', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const r = await prisma.produto.deleteMany({ where: { id: parseInt(req.params.id), empresaId: req.usuario.empresaId } });
        if (r.count === 0) return res.status(404).json({ erro: 'Produto não encontrado.' });
        res.json({ ok: true });
    } catch { res.status(500).json({ erro: 'Erro ao deletar produto.' }); }
});

/* VENDAS */
app.post('/vendas', autenticarToken, async (req, res) => {
    const { itens, total, metodo, valorPago, troco, caixaId } = req.body;
    if (!itens || itens.length === 0) return res.status(400).json({ erro: 'Carrinho vazio.' });
    try {
        const venda = await prisma.$transaction(async (tx) => {
            // Verifica estoque antes de finalizar
            for (const item of itens) {
                if (item.id) {
                    const produto = await tx.produto.findFirst({ where: { id: item.id, empresaId: req.usuario.empresaId } });
                    if (!produto) throw new Error(`Produto "${item.nome}" não encontrado.`);
                    if (produto.estoque < item.qtd) {
                        throw new Error(`Estoque insuficiente para "${item.nome}". Disponível: ${produto.estoque} un.`);
                    }
                }
            }
            const novaVenda = await tx.venda.create({ data: { total, metodo, valorPago, troco, empresaId: req.usuario.empresaId, caixaId: caixaId || null, itens: { create: itens.map(item => ({ produtoId: item.id, nome: item.nome, precoCusto: item.precoCusto || 0, preco: item.preco, qtd: item.qtd })) } }, include: { itens: true } });
            for (const item of itens) { if (item.id) await tx.produto.updateMany({ where: { id: item.id, empresaId: req.usuario.empresaId }, data: { estoque: { decrement: item.qtd } } }); }
            return novaVenda;
        });
        res.json(venda);
    } catch (err) { console.error(err); res.status(500).json({ erro: err.message || 'Erro ao registrar a venda.' }); }
});
app.get('/vendas', autenticarToken, async (req, res) => { try { res.json(await prisma.venda.findMany({ where: { empresaId: req.usuario.empresaId }, include: { itens: true }, orderBy: { data: 'desc' } })); } catch { res.status(500).json({ erro: 'Erro ao buscar vendas.' }); } });
app.delete('/vendas/:id', autenticarToken, async (req, res) => {
    try {
        const { pinSupervisor } = req.body; const id = parseInt(req.params.id); let autorizadoPor = req.usuario.login;
        if (req.usuario.papel === 'operador') {
            if (!pinSupervisor) return res.status(403).json({ erro: 'PIN de supervisor obrigatório.' });
            const supervisores = await prisma.usuario.findMany({ where: { empresaId: req.usuario.empresaId, papel: { in: ['admin', 'gerente'] }, pin: { not: null } } });
            let supervisorValido = null;
            for (const sup of supervisores) { if (await bcrypt.compare(String(pinSupervisor), sup.pin)) { supervisorValido = sup; break; } }
            if (!supervisorValido) return res.status(401).json({ erro: 'PIN de supervisor incorreto.' });
            autorizadoPor = supervisorValido.login;
        }
        const venda = await prisma.venda.findFirst({ where: { id, empresaId: req.usuario.empresaId }, include: { itens: true } });
        if (!venda) return res.status(404).json({ erro: 'Venda não encontrada.' });
        if (venda.cancelada) return res.status(400).json({ erro: 'Venda já foi cancelada.' });
        await prisma.$transaction(async (tx) => {
            for (const item of venda.itens) { if (item.produtoId) await tx.produto.update({ where: { id: item.produtoId }, data: { estoque: { increment: item.qtd } } }); }
            await tx.venda.update({ where: { id }, data: { cancelada: true, canceladaPor: autorizadoPor, canceladaEm: new Date() } });
        });
        res.json({ ok: true, canceladaPor: autorizadoPor });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao cancelar venda.' }); }
});

/* SANGRIAS */
app.post('/sangrias', autenticarToken, async (req, res) => {
    try {
        const { valor, motivo, pinSupervisor, caixaId } = req.body; let autorizadoPor = req.usuario.login;
        if (req.usuario.papel === 'operador') {
            if (!pinSupervisor) return res.status(403).json({ erro: 'PIN de supervisor obrigatório.' });
            const supervisores = await prisma.usuario.findMany({ where: { empresaId: req.usuario.empresaId, papel: { in: ['admin', 'gerente'] }, pin: { not: null } } });
            let supervisorValido = null;
            for (const sup of supervisores) { if (await bcrypt.compare(String(pinSupervisor), sup.pin)) { supervisorValido = sup; break; } }
            if (!supervisorValido) return res.status(401).json({ erro: 'PIN de supervisor incorreto.' });
            autorizadoPor = supervisorValido.login;
        }
        res.json(await prisma.sangria.create({ data: { valor, motivo, autorizadaPor: autorizadoPor, empresaId: req.usuario.empresaId, caixaId: caixaId || null } }));
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao registrar sangria.' }); }
});
app.get('/sangrias', autenticarToken, async (req, res) => { try { res.json(await prisma.sangria.findMany({ where: { empresaId: req.usuario.empresaId }, orderBy: { data: 'desc' } })); } catch { res.status(500).json({ erro: 'Erro ao buscar sangrias.' }); } });

/* VERIFICAR PIN */
app.post('/verificarSupervisor', autenticarToken, async (req, res) => {
    try {
        const { pin } = req.body; if (!pin) return res.status(400).json({ erro: 'PIN obrigatório.' });
        const supervisores = await prisma.usuario.findMany({ where: { empresaId: req.usuario.empresaId, papel: { in: ['admin', 'gerente'] }, pin: { not: null } } });
        let supervisorValido = null;
        for (const sup of supervisores) { if (await bcrypt.compare(String(pin), sup.pin)) { supervisorValido = sup; break; } }
        if (!supervisorValido) return res.status(401).json({ erro: 'PIN incorreto.' });
        res.json({ ok: true, supervisor: supervisorValido.login, papel: supervisorValido.papel });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao verificar PIN.' }); }
});

/* PIN */
app.post('/meuPin', autenticarToken, async (req, res) => {
    try {
        if (!['admin', 'gerente'].includes(req.usuario.papel)) return res.status(403).json({ erro: 'Apenas admin e gerente podem ter PIN.' });
        const { pin } = req.body;
        if (!pin || String(pin).length < 4 || String(pin).length > 6) return res.status(400).json({ erro: 'PIN deve ter entre 4 e 6 dígitos.' });
        if (!/^\d+$/.test(String(pin))) return res.status(400).json({ erro: 'PIN deve conter apenas números.' });
        const pinHash = await bcrypt.hash(String(pin), 10);
        await prisma.usuario.update({ where: { empresaId_login: { empresaId: req.usuario.empresaId, login: req.usuario.login } }, data: { pin: pinHash } });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao salvar PIN.' }); }
});
app.put('/usuarios/:id/pin', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const { pin } = req.body;
        if (!pin || !/^\d{4,6}$/.test(String(pin))) return res.status(400).json({ erro: 'PIN deve ter entre 4 e 6 dígitos numéricos.' });
        const pinHash = await bcrypt.hash(String(pin), 10);
        const r = await prisma.usuario.updateMany({ where: { id: parseInt(req.params.id), empresaId: req.usuario.empresaId }, data: { pin: pinHash } });
        if (r.count === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao definir PIN.' }); }
});

/* EMAIL FECHAMENTO */
app.post('/enviarEmailFechamento', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const { emailDestino, dados } = req.body;
        if (!emailValido(emailDestino)) return res.status(400).json({ erro: 'Email de destino inválido.' });
        await enviarEmailFechamento(emailDestino, dados);
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao enviar email.' }); }
});

/* USUÁRIOS */
app.get('/usuarios', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); res.json(await prisma.usuario.findMany({ where: { empresaId: req.usuario.empresaId }, select: { id: true, login: true, papel: true, pin: true } })); } catch { res.status(500).json({ erro: 'Erro ao buscar usuários.' }); } });
app.post('/usuarios', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); const { login, senha, papel } = req.body; if (!login || !senha || !papel) return res.status(400).json({ erro: 'Login, senha e papel são obrigatórios.' }); const senhaHash = await bcrypt.hash(senha, 10); const usuario = await prisma.usuario.create({ data: { login, senha: senhaHash, papel, empresaId: req.usuario.empresaId } }); res.json({ id: usuario.id, login: usuario.login, papel: usuario.papel }); } catch { res.status(500).json({ erro: 'Erro ao criar usuário. Login pode já estar em uso.' }); } });
app.delete('/usuarios/:id', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); const r = await prisma.usuario.deleteMany({ where: { id: parseInt(req.params.id), empresaId: req.usuario.empresaId } }); if (r.count === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' }); res.json({ ok: true }); } catch { res.status(500).json({ erro: 'Erro ao deletar usuário.' }); } });
app.put('/usuarios/:id/senha', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); const { novaSenha } = req.body; if (!novaSenha || novaSenha.length < 4) return res.status(400).json({ erro: 'A senha deve ter pelo menos 4 caracteres.' }); const hash = await bcrypt.hash(novaSenha, 10); const r = await prisma.usuario.updateMany({ where: { id: parseInt(req.params.id), empresaId: req.usuario.empresaId }, data: { senha: hash } }); if (r.count === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' }); res.json({ ok: true }); } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao redefinir senha.' }); } });
app.post('/alterarSenha', autenticarToken, async (req, res) => { try { const { senhaAtual, novaSenha } = req.body; const usuario = await prisma.usuario.findUnique({ where: { empresaId_login: { empresaId: req.usuario.empresaId, login: req.usuario.login } } }); if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' }); const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha); if (!senhaValida) return res.status(401).json({ erro: 'Senha atual incorreta.' }); if (!novaSenha || novaSenha.length < 4) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 4 caracteres.' }); const novaHash = await bcrypt.hash(novaSenha, 10); await prisma.usuario.update({ where: { empresaId_login: { empresaId: req.usuario.empresaId, login: req.usuario.login } }, data: { senha: novaHash } }); res.json({ ok: true }); } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao alterar senha.' }); } });

/* PROMOÇÕES */
app.get('/promocoes', autenticarToken, async (req, res) => { try { res.json(await prisma.promocao.findMany({ where: { empresaId: req.usuario.empresaId }, include: { produto: true }, orderBy: { criadaEm: 'desc' } })); } catch { res.status(500).json({ erro: 'Erro ao buscar promoções.' }); } });
app.get('/promocoes/ativas', autenticarToken, async (req, res) => { try { const agora = new Date(); res.json(await prisma.promocao.findMany({ where: { empresaId: req.usuario.empresaId, ativa: true, dataInicio: { lte: agora }, dataFim: { gte: agora } }, include: { produto: true } })); } catch { res.status(500).json({ erro: 'Erro ao buscar promoções ativas.' }); } });
app.post('/promocoes', autenticarToken, async (req, res) => { try { if (!['admin', 'gerente'].includes(req.usuario.papel)) return res.status(403).json({ erro: 'Acesso restrito ao administrador ou gerente.' }); const { produtoId, precoPromocional, dataInicio, dataFim } = req.body; if (!produtoId || !precoPromocional || !dataInicio || !dataFim) return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' }); const produtoOk = await prisma.produto.findFirst({ where: { id: parseInt(produtoId), empresaId: req.usuario.empresaId } }); if (!produtoOk) return res.status(404).json({ erro: 'Produto não encontrado.' }); const promocao = await prisma.promocao.create({ data: { produtoId: parseInt(produtoId), precoPromocional, dataInicio: new Date(dataInicio), dataFim: new Date(dataFim), ativa: true, empresaId: req.usuario.empresaId }, include: { produto: true } }); res.json(promocao); } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao criar promoção.' }); } });
app.delete('/promocoes/:id', autenticarToken, async (req, res) => { try { if (!['admin', 'gerente'].includes(req.usuario.papel)) return res.status(403).json({ erro: 'Acesso restrito ao administrador ou gerente.' }); const { apagar } = req.body; const where = { id: parseInt(req.params.id), empresaId: req.usuario.empresaId }; const r = apagar ? await prisma.promocao.deleteMany({ where }) : await prisma.promocao.updateMany({ where, data: { ativa: false } }); if (r.count === 0) return res.status(404).json({ erro: 'Promoção não encontrada.' }); res.json({ ok: true }); } catch { res.status(500).json({ erro: 'Erro ao processar promoção.' }); } });

/* FUNCIONÁRIOS */
app.get('/funcionarios', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); res.json(await prisma.funcionario.findMany({ where: { empresaId: req.usuario.empresaId }, include: { compras: true }, orderBy: { nome: 'asc' } })); } catch { res.status(500).json({ erro: 'Erro ao buscar funcionários.' }); } });
app.post('/funcionarios', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); const { nome, cpf, limite } = req.body; if (!nome || !cpf || !limite) return res.status(400).json({ erro: 'Nome, CPF e limite são obrigatórios.' }); const cpfLimpo = cpf.replace(/\D/g, ''); if (cpfLimpo.length !== 11) return res.status(400).json({ erro: 'CPF inválido.' }); const func = await prisma.funcionario.create({ data: { nome, cpf: cpfLimpo, limite: parseFloat(limite), empresaId: req.usuario.empresaId } }); res.json(func); } catch { res.status(500).json({ erro: 'Erro ao cadastrar funcionário. CPF pode já estar em uso.' }); } });
app.put('/funcionarios/:id', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); const { nome, limite, ativo } = req.body; const r = await prisma.funcionario.updateMany({ where: { id: parseInt(req.params.id), empresaId: req.usuario.empresaId }, data: { nome, limite: parseFloat(limite), ativo } }); if (r.count === 0) return res.status(404).json({ erro: 'Funcionário não encontrado.' }); res.json({ ok: true }); } catch { res.status(500).json({ erro: 'Erro ao atualizar funcionário.' }); } });
app.delete('/funcionarios/:id', autenticarToken, async (req, res) => {
    try {
        if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
        const id = parseInt(req.params.id);
        // Verifica se tem dívidas em aberto
        const func = await prisma.funcionario.findFirst({ where: { id, empresaId: req.usuario.empresaId }, include: { compras: { where: { pago: false } } } });
        if (!func) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
        if (func.compras.length > 0) return res.status(400).json({ erro: 'Funcionário possui dívidas em aberto. Quite antes de excluir.' });
        // Deleta compras pagas e o funcionário
        await prisma.compraFuncionario.deleteMany({ where: { funcionarioId: id } });
        await prisma.funcionario.delete({ where: { id } });
        res.json({ ok: true });
    } catch { res.status(500).json({ erro: 'Erro ao excluir funcionário.' }); }
});
app.post('/funcionarios/buscarCpf', autenticarToken, async (req, res) => { try { const { cpf } = req.body; const cpfLimpo = cpf.replace(/\D/g, ''); const func = await prisma.funcionario.findUnique({ where: { empresaId_cpf: { empresaId: req.usuario.empresaId, cpf: cpfLimpo } }, include: { compras: { where: { pago: false } } } }); if (!func) return res.status(404).json({ erro: 'Funcionário não encontrado.' }); if (!func.ativo) return res.status(400).json({ erro: 'Funcionário inativo.' }); const totalDevido = func.compras.reduce((s, c) => s + parseFloat(c.valor), 0); const limiteDisponivel = parseFloat(func.limite) - totalDevido; res.json({ ...func, totalDevido, limiteDisponivel }); } catch { res.status(500).json({ erro: 'Erro ao buscar funcionário.' }); } });
app.post('/funcionarios/:id/compras', autenticarToken, async (req, res) => { try { const { valor, descricao } = req.body; const funcionarioId = parseInt(req.params.id); const func = await prisma.funcionario.findFirst({ where: { id: funcionarioId, empresaId: req.usuario.empresaId }, include: { compras: { where: { pago: false } } } }); if (!func || !func.ativo) return res.status(400).json({ erro: 'Funcionário não encontrado ou inativo.' }); const totalDevido = func.compras.reduce((s, c) => s + parseFloat(c.valor), 0); const limiteDisponivel = parseFloat(func.limite) - totalDevido; if (parseFloat(valor) > limiteDisponivel) return res.status(400).json({ erro: `Limite insuficiente. Disponível: R$ ${limiteDisponivel.toFixed(2)}` }); const compra = await prisma.compraFuncionario.create({ data: { funcionarioId, valor: parseFloat(valor), descricao } }); res.json(compra); } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao registrar compra.' }); } });
app.post('/funcionarios/:id/quitar', autenticarToken, async (req, res) => { try { if (req.usuario.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador.' }); const funcionarioId = parseInt(req.params.id); const dono = await prisma.funcionario.findFirst({ where: { id: funcionarioId, empresaId: req.usuario.empresaId } }); if (!dono) return res.status(404).json({ erro: 'Funcionário não encontrado.' }); await prisma.compraFuncionario.updateMany({ where: { funcionarioId, pago: false }, data: { pago: true, pagoEm: new Date() } }); res.json({ ok: true }); } catch { res.status(500).json({ erro: 'Erro ao quitar dívida.' }); } });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
