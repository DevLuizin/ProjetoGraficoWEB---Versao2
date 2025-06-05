const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// --- Variáveis para o cálculo da taxa ---
// Armazena o valor e o timestamp da leitura anterior para calcular a taxa.
let dadosAnteriores = { valor: null, timestamp: null };
const ARQUIVO_DADOS_SNMP = path.join(__dirname, 'dados-snmp.txt');
const INTERVALO_SIMULADOR_MS = 5000; // Intervalo para o simulador de dados (5 segundos)
const INTERVALO_CALCULO_TAXA_MS = 5000; // Intervalo que o frontend vai buscar os dados

// --- Inicialização do arquivo de dados, se não existir ---
if (!fs.existsSync(ARQUIVO_DADOS_SNMP)) {
    fs.writeFileSync(ARQUIVO_DADOS_SNMP, '100000000'); // Valor inicial em bytes
    console.log(`Arquivo ${ARQUIVO_DADOS_SNMP} criado com valor inicial.`);
} else {
    // Garante que o valor inicial seja lido corretamente na primeira vez.
    const valorInicial = parseInt(fs.readFileSync(ARQUIVO_DADOS_SNMP, 'utf-8'));
    if (isNaN(valorInicial)) {
        fs.writeFileSync(ARQUIVO_DADOS_SNMP, '100000000');
        console.log(`Arquivo ${ARQUIVO_DADOS_SNMP} continha valor inválido. Resetado para valor inicial.`);
    }
}


// --- Simulador: Incrementa o valor no arquivo ---
// Esta função simula o contador de octetos de uma interface de rede aumentando com o tempo.
setInterval(() => {
    try {
        let valorAtualStr = fs.readFileSync(ARQUIVO_DADOS_SNMP, 'utf-8');
        let valorAtual = parseInt(valorAtualStr);

        if (isNaN(valorAtual)) { // Verificação de segurança
            console.error("Simulador: Valor inválido no arquivo de dados. Resetando.");
            valorAtual = 100000000;
        }

        // Incrementa um valor aleatório para tornar o gráfico mais dinâmico
        // Simulando entre 100KB e 600KB de tráfego no intervalo
        const incremento = Math.floor(Math.random() * 500000) + 100000;
        valorAtual += incremento;
        fs.writeFileSync(ARQUIVO_DADOS_SNMP, valorAtual.toString());
        // console.log(`Simulador: Novo valor de octetos é ${valorAtual}`); // Log opcional
    } catch (error) {
        console.error("Erro no simulador de dados:", error.message);
        // Tenta recriar o arquivo se houver um erro crítico de leitura/escrita
        fs.writeFileSync(ARQUIVO_DADOS_SNMP, '100000000');
    }
}, INTERVALO_SIMULADOR_MS);


// --- API Endpoint: /api/taxa ---
// O frontend chamará esta rota para obter a taxa de BPS (Bits Por Segundo) atual.
app.get('/api/taxa', (req, res) => {
    try {
        const valorAtualStr = fs.readFileSync(ARQUIVO_DADOS_SNMP, 'utf-8');
        const valorAtual = parseInt(valorAtualStr);
        const timestampAtual = Date.now();

        if (isNaN(valorAtual)) {
            console.error("API: Valor inválido no arquivo de dados ao calcular taxa.");
            return res.status(500).json({ error: "Erro ao ler dados simulados (valor inválido)" });
        }

        // Se for a primeira medição ou se o timestamp anterior não estiver definido,
        // não há como calcular a taxa. Retorna 0 e armazena os dados atuais para a próxima.
        if (dadosAnteriores.valor === null || dadosAnteriores.timestamp === null) {
            dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };
            // console.log("API: Primeira medição, retornando taxa 0.");
            return res.json({ bps: 0, mbps: 0, rawBytes: valorAtual });
        }

        // Calcula a diferença de tempo em segundos
        // Usamos o intervalo definido para o frontend como referência, mas o cálculo real é mais preciso.
        const diffTempoSegundos = (timestampAtual - dadosAnteriores.timestamp) / 1000;

        // Se o tempo for 0 ou negativo (improvável, mas para segurança), evita divisão por zero ou resultados estranhos.
        if (diffTempoSegundos <= 0) {
            // console.log("API: Diferença de tempo inválida ou muito pequena, retornando taxa 0.");
            // Atualiza os dados para a próxima tentativa válida
            dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };
            return res.json({ bps: 0, mbps: 0, rawBytes: valorAtual });
        }

        // Calcula a diferença de bytes
        const diffBytes = valorAtual - dadosAnteriores.valor;

        // Se o valor atual for menor que o anterior (ex: contador SNMP resetou),
        // considera como se não houvesse tráfego ou reseta a base.
        if (diffBytes < 0) {
            // console.log("API: Contador de bytes parece ter resetado (valor atual < anterior). Retornando taxa 0.");
            dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };
            return res.json({ bps: 0, mbps: 0, rawBytes: valorAtual });
        }

        // Calcula a taxa em bits por segundo (BPS)
        // (diferença de bytes * 8 bits por byte) / diferença de tempo em segundos
        const taxaBps = (diffBytes * 8) / diffTempoSegundos;
        const taxaMbps = taxaBps / 1000000; // Converte para Megabits por segundo

        // Atualiza os dados anteriores para o próximo cálculo
        dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };

        // Retorna o valor como JSON
        // console.log(`API: Taxa calculada - BPS: ${taxaBps.toFixed(2)}, Mbps: ${taxaMbps.toFixed(2)}`);
        res.json({
            bps: taxaBps.toFixed(2),
            mbps: taxaMbps.toFixed(2),
            rawBytes: valorAtual // Envia o valor bruto para debug, se necessário
        });

    } catch (error) {
        console.error("Erro ao calcular a taxa:", error.message);
        res.status(500).json({ error: "Erro interno do servidor ao calcular a taxa." });
    }
});

// --- Servir os arquivos estáticos do frontend ---
// O servidor Node.js também entregará a página HTML e o script JS.
// Isso permite que você acesse a aplicação diretamente pelo navegador.
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Rota principal para servir o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Frontend servido a partir de: ${frontendPath}`);
    console.log(`Arquivo de dados SNMP simulado: ${ARQUIVO_DADOS_SNMP}`);
});