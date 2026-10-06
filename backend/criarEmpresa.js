// Cria uma empresa de demonstração com um usuário admin.
// Uso: node criarEmpresa.js <dominio> <login> <senha> [nome da empresa]
// Ex.: node criarEmpresa.js demo admin minhasenha "Mercado Demo"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const [dominio, login, senha, ...resto] = process.argv.slice(2);
    if (!dominio || !login || !senha) {
        console.log('Uso: node criarEmpresa.js <dominio> <login> <senha> [nome da empresa]');
        process.exit(1);
    }
    const nome = resto.join(' ') || dominio;
    const empresa = await prisma.empresa.create({
        data: {
            nome,
            dominio: dominio.toLowerCase().replace(/[^a-z0-9]/g, ''),
            plano: 'avancado',
            usuarios: { create: { login, senha: await bcrypt.hash(senha, 10), papel: 'admin' } }
        }
    });
    console.log(`Empresa "${empresa.nome}" criada. Domínio de login: ${empresa.dominio}`);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
