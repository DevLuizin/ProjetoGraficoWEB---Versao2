// backend/server.js

const snmp = require("net-snmp");
const express = require("express");
const path = require("path");
const app = express();

// --- CONFIGURAÇÕES SNMP ---
const SNMP_HOST = "192.168.1.12";
const SNMP_COMMUNITY = "public";
const rxOID = "1.3.6.1.2.1.31.1.1.1.6.2";
const txOID = "1.3.6.1.2.1.31.1.1.1.10.2";

let session;
let lastRx = null;
let lastTx = null;
let lastTime = null;
let isWarmingUp = true; // Flag para controlar o estado de aquecimento

// --- FUNÇÕES ---

/**
 * Converte um Buffer SNMP para um BigInt para cálculos precisos.
 * @param {Buffer} buffer - O buffer recebido da consulta SNMP.
 * @returns {BigInt}
 */
function bufferToBigInt(buffer) {
    let result = 0n;
    for (const byte of buffer) {
        result = (result << 8n) + BigInt(byte);
    }
    return result;
}

/**
 * Cria e configura uma nova sessão SNMP.
 */
function createSession() {
    console.log(`[${new Date().toLocaleTimeString()}] Criando nova sessão SNMP para ${SNMP_HOST}...`);
    session = snmp.createSession(SNMP_HOST, SNMP_COMMUNITY);

    session.on("error", (err) => {
        console.error(`[${new Date().toLocaleTimeString()}] Erro na sessão SNMP:`, err);
        // A lógica de recriação será tratada na rota /trafego
    });
}

/**
 * Realiza a coleta inicial de dados para "aquecer" o servidor.
 * Evita que a primeira requisição do usuário seja apenas para inicializar.
 */
function warmUp() {
    console.log(`[${new Date().toLocaleTimeString()}] Servidor em modo de aquecimento (warm-up)...`);
    isWarmingUp = true;
    session.get([rxOID, txOID], (err, varbinds) => {
        if (err) {
            console.error(`[${new Date().toLocaleTimeString()}] Erro no warm-up: ${err.toString()}. Tentando novamente em 10s.`);
            // Se falhar, tenta novamente após um tempo
            setTimeout(warmUp, 10000);
            return;
        }

        const now = Date.now();
        lastRx = bufferToBigInt(varbinds[0].value);
        lastTx = bufferToBigInt(varbinds[1].value);
        lastTime = now;
        isWarmingUp = false;

        console.log(`[${new Date().toLocaleTimeString()}] Warm-up concluído. O servidor está pronto para fornecer dados.`);
    });
}

// --- ROTAS E SERVIDOR ---

// Servir os arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Rota principal para coleta de tráfego
app.get("/trafego", (req, res) => {
    if (isWarmingUp) {
        return res.status(202).json({
            message: "Servidor está inicializando a coleta de dados. Por favor, aguarde."
        });
    }

    session.get([rxOID, txOID], (err, varbinds) => {
        // --- TRATAMENTO DE ERROS E RECONEXÃO ---
        if (err) {
            console.error(`[${new Date().toLocaleTimeString()}] Erro na coleta:`, err.toString());

            // Se for timeout, tenta recriar a sessão para a próxima tentativa
            if (err.message.toLowerCase().includes("timeout")) {
                createSession(); // Recria a sessão em segundo plano
                return res.status(503).json({
                    message: "Dispositivo não respondeu (timeout). Tentando reconectar. Verifique em instantes."
                });
            }

            return res.status(500).json({
                message: `Erro inesperado no SNMP: ${err.toString()}`
            });
        }
        
        // --- CÁLCULO DE TRÁFEGO ---
        const now = Date.now();
        const rxNow = bufferToBigInt(varbinds[0].value);
        const txNow = bufferToBigInt(varbinds[1].value);

        const deltaTime = (now - lastTime) / 1000; // segundos

        // Evita divisão por zero ou deltas de tempo muito pequenos
        if (deltaTime < 1) {
            return res.status(202).json({
                message: "Aguardando intervalo mínimo para nova coleta."
            });
        }
        
        const rxDelta = rxNow - lastRx;
        const txDelta = txNow - lastTx;
        
        // Converte para Mbps (Bits por segundo / 1,000,000)
        const rxMbps = (Number(rxDelta) * 8) / deltaTime / 1_000_000;
        const txMbps = (Number(txDelta) * 8) / deltaTime / 1_000_000;

        // Atualiza os valores anteriores para o próximo cálculo
        lastRx = rxNow;
        lastTx = txNow;
        lastTime = now;
        
        res.json({
            rxKbps: rxMbps.toFixed(2), // O frontend espera rxKbps, mantido para compatibilidade
            txKbps: txMbps.toFixed(2), // O frontend espera txKbps, mantido para compatibilidade
            lastTime: new Date(now).toLocaleTimeString(),
        });
    });
});

// Inicia o servidor e os processos de conexão
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    createSession(); // Cria a sessão inicial
    warmUp();        // Inicia o processo de aquecimento
});
