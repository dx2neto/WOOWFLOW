require('dotenv').config();
const evo = require('../services/evolutionService');

async function testarConexoes() {
  console.log('\n🔍 WOOWFLOW — Teste de Conexões\n');

  // ── Evolution API ────────────────────────────────────────────────────────
  console.log('📡 Testando Evolution API...');
  try {
    const status = await evo.verificarStatusInstancia();
    const state = status?.instance?.state || status?.state || JSON.stringify(status);
    console.log(`   ✅ Evolution OK — Estado: ${state}`);
  } catch (err) {
    console.log(`   ❌ Evolution ERRO: ${err.response?.status || err.message}`);
    console.log(`      URL: ${process.env.EVOLUTION_BASE_URL}`);
    console.log(`      Instância: ${process.env.EVOLUTION_INSTANCE}`);
  }

  // ── IXC ──────────────────────────────────────────────────────────────────
  console.log('\n🏢 Testando IXC Soft...');
  try {
    const axios = require('axios');
    const { data } = await axios.get(`${process.env.IXC_BASE_URL}/cliente/1`, {
      auth: { username: process.env.IXC_USERNAME, password: process.env.IXC_TOKEN },
      timeout: 10000,
    });
    console.log(`   ✅ IXC OK — Conexão estabelecida`);
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) {
      console.log(`   ❌ IXC ERRO 401: Token ou usuário inválidos`);
    } else if (status === 404) {
      console.log(`   ✅ IXC OK (404 esperado — autenticação funcionou)`);
    } else {
      console.log(`   ❌ IXC ERRO: ${status || err.message}`);
      console.log(`      URL: ${process.env.IXC_BASE_URL}`);
    }
  }

  console.log('\n📋 Variáveis configuradas:');
  const vars = ['IXC_BASE_URL', 'IXC_USERNAME', 'IXC_TOKEN', 'EVOLUTION_BASE_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE', 'BASE_URL', 'PORT'];
  vars.forEach((v) => {
    const val = process.env[v];
    const ok = val && !val.includes('SEU_') && !val.includes('SUA_');
    console.log(`   ${ok ? '✅' : '❌'} ${v}: ${ok ? '(configurado)' : '(FALTANDO ou padrão)'}`);
  });

  console.log('\n🚀 Execute: npm start\n');
}

testarConexoes().catch(console.error);
