const express = require('express');
const path = require('path');
const snmp = require('net-snmp');
const app = express();
const PORT = 3000;

// --- Configurações SNMP ---
const MIKROTIK_IP = '192.168.1.11'; 
const SNMP_COMMUNITY = 'public';
// CORREÇÃO 1: Removido o ponto (.) no início dos OIDs
const OID_TRAFEGO_RX = '1.3.6.1.2.1.31.1.1.1.6.2'; // OID para RX (Recebimento)
const OID_TRAFEGO_TX = '1.3.6.1.2.1.31.1.1.1.10.2'; // OID para TX (Envio)

// --- Variáveis para o cálculo da taxa ---
let dadosAnterioresRx = { valor: null, timestamp: null };
let dadosAnterioresTx = { valor: null, timestamp: null };
const INTERVALO_COLETA_MS = 1000;

// --- Função para buscar dados SNMP (com lógica de validação corrigida) ---
function fetchSnmpData() {
    return new Promise((resolve, reject) => {
        // Usando SNMP v2c, como confirmado pelo seu snmpwalk
        const session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY, { version: snmp.Version2c });
        
        const oids = [OID_TRAFEGO_RX, OID_TRAFEGO_TX];

        session.get(oids, (error, varbinds) => {
            if (error) {
                console.error("Erro na sessão SNMP:", error.toString());
                return reject(error);
            }

            // CORREÇÃO 2: Lógica de validação para múltiplos OIDs
            if (!varbinds || varbinds.length !== 2) {
                console.error("SNMP: Resposta inesperada. Esperava 2 varbinds, recebeu:", varbinds ? varbinds.length : 0);
                return reject(new Error("SNMP: Número inesperado de respostas do roteador."));
            }

            const [varbindRx, varbindTx] = varbinds;

            // Valida o varbind de RX
            if (snmp.isVarbindError(varbindRx)) {
                return reject(new Error(`Erro no Varbind SNMP para RX: ${snmp.varbindError(varbindRx)}`));
            }
            if (varbindRx.oid !== OID_TRAFEGO_RX || typeof varbindRx.value !== 'number') {
                return reject(new Error(`SNMP: Resposta inválida para RX. OID: ${varbindRx.oid}, Tipo: ${typeof varbindRx.value}`));
            }

            // Valida o varbind de TX
            if (snmp.isVarbindError(varbindTx)) {
                return reject(new Error(`Erro no Varbind SNMP para TX: ${snmp.varbindError(varbindTx)}`));
            }
            if (varbindTx.oid !== OID_TRAFEGO_TX || typeof varbindTx.value !== 'number') {
                return reject(new Error(`SNMP: Resposta inválida para TX. OID: ${varbindTx.oid}, Tipo: ${typeof varbindTx.value}`));
            }
            
            // Se tudo estiver OK, resolve com os valores
            resolve({
                rx: varbindRx.value,
                tx: varbindTx.value
            });

            session.close();
        });
    });
}

// --- API Endpoint: /api/taxa ---
app.get('/api/taxa', async (req, res) => {
    try {
        const valoresAtuais = await fetchSnmpData(); // Busca dados RX e TX
        const timestampAtual = Date.now();

        // Primeira coleta, apenas armazena os valores
        if (dadosAnterioresRx.valor === null || dadosAnterioresTx.valor === null) {
            dadosAnterioresRx = { valor: valoresAtuais.rx, timestamp: timestampAtual };
            dadosAnterioresTx = { valor: valoresAtuais.tx, timestamp: timestampAtual };
            return res.json({ bpsRx: 0, mbpsRx: 0, rawBytesRx: valoresAtuais.rx, bpsTx: 0, mbpsTx: 0, rawBytesTx: valoresAtuais.tx });
        }

        // Calcula taxa para RX
        const diffTempoRx = (timestampAtual - dadosAnterioresRx.timestamp) / 1000;
        const diffBytesRx = valoresAtuais.rx - dadosAnterioresRx.valor;
        let taxaBpsRx = 0;
        if (diffTempoRx > 0 && diffBytesRx >= 0) {
            taxaBpsRx = (diffBytesRx * 8) / diffTempoRx;
        }

        // Calcula taxa para TX
        const diffTempoTx = (timestampAtual - dadosAnterioresTx.timestamp) / 1000;
        const diffBytesTx = valoresAtuais.tx - dadosAnterioresTx.valor;
        let taxaBpsTx = 0;
        if (diffTempoTx > 0 && diffBytesTx >= 0) {
            taxaBpsTx = (diffBytesTx * 8) / diffTempoTx;
        }
        
        // Atualiza os dados anteriores para a próxima chamada
        dadosAnterioresRx = { valor: valoresAtuais.rx, timestamp: timestampAtual };
        dadosAnterioresTx = { valor: valoresAtuais.tx, timestamp: timestampAtual };
        
        res.json({
            bpsRx: taxaBpsRx.toFixed(2),
            mbpsRx: (taxaBpsRx / 1000000).toFixed(2),
            rawBytesRx: valoresAtuais.rx,
            bpsTx: taxaBpsTx.toFixed(2),
            mbpsTx: (taxaBpsTx / 1000000).toFixed(2),
            rawBytesTx: valoresAtuais.tx
        });

    } catch (error) {
        console.error("Erro ao processar /api/taxa:", error.message || error);
        res.status(500).json({ error: "Erro ao obter dados SNMP do roteador.", details: error.message });
    }
});

// --- Servir os arquivos estáticos do frontend ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Conectando ao Mikrotik em: ${MIKROTIK_IP}`);
    console.log(`Monitorando OID Rx: ${OID_TRAFEGO_RX}`);
    console.log(`Monitorando OID Tx: ${OID_TRAFEGO_TX}`);
});