// ARQUIVO PARA CONECTAR AO MIKROTIK E OBTER DADOS SNMP

const express = require('express');
const path = require('path');
const snmp = require('net-snmp'); // Biblioteca SNMP
const app = express();
const PORT = 3000;

// --- Configurações SNMP (VOCÊ PRECISA ALTERAR ESTAS!) ---
const MIKROTIK_IP = '192.168.88.1'; // Substitua pelo IP do seu Mikrotik
const SNMP_COMMUNITY = 'public';    // Substitua pela comunidade SNMP configurada no Mikrotik
// Escolha UM OID para monitorar. ifHCInOctets é recomendado para tráfego de entrada em interfaces rápidas.
// Se for ifOutOctets, ifHCInOctets, ifHCOutOctets, etc., ajuste conforme necessário.
// Lembre-se de substituir o '.1' no final pelo ÍNDICE CORRETO da sua interface.
const OID_TRAFEGO = '1.3.6.1.2.1.31.1.1.1.6.1'; // Exemplo: ifHCInOctets para interface com índice 1

// --- Variáveis para o cálculo da taxa ---
let dadosAnteriores = { valor: null, timestamp: null };
const INTERVALO_COLETA_MS = 5000; // Intervalo para buscar dados SNMP (e para o frontend)

// --- Função para buscar dados SNMP ---
function fetchSnmpData() {
    return new Promise((resolve, reject) => {
        // Cria uma sessão SNMP
        // Para SNMP v1 (comum em Mikrotiks por padrão para 'public')
        const session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY, { version: snmp.Version1 });
        // Se seu Mikrotik estiver configurado para SNMP v2c, use:
        // const session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY, { version: snmp.Version2c });

        const oids = [OID_TRAFEGO];

        session.get(oids, (error, varbinds) => {
            if (error) {
                console.error("Erro SNMP:", error.toString());
                reject(error);
            } else {
                if (varbinds && varbinds.length > 0) {
                    const varbind = varbinds[0];
                    // Verifica se o OID retornado é o esperado e se o valor é um número
                    if (snmp.isVarbindError(varbind)) {
                        console.error("Erro no Varbind SNMP:", snmp.varbindError(varbind));
                        reject(new Error(snmp.varbindError(varbind)));
                    } else if (varbind.oid === OID_TRAFEGO && typeof varbind.value === 'number') {
                        // console.log(`SNMP: Valor de octetos obtido (${varbind.oid}) = ${varbind.value}`);
                        resolve(varbind.value);
                    } else {
                        console.error(`SNMP: OID inesperado ou valor não numérico. OID: ${varbind.oid}, Tipo: ${typeof varbind.value}, Valor: ${varbind.value}`);
                        reject(new Error('SNMP: OID inesperado ou valor não numérico.'));
                    }
                } else {
                    console.error("SNMP: Nenhuma varbind retornada.");
                    reject(new Error('SNMP: Nenhuma varbind retornada. Verifique IP, comunidade e OID.'));
                }
            }
            session.close();
        });
    });
}

// --- API Endpoint: /api/taxa ---
app.get('/api/taxa', async (req, res) => {
    try {
        const valorAtual = await fetchSnmpData(); // Busca dados via SNMP
        const timestampAtual = Date.now();

        if (dadosAnteriores.valor === null || dadosAnteriores.timestamp === null) {
            dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };
            return res.json({ bps: 0, mbps: 0, rawBytes: valorAtual });
        }

        const diffTempoSegundos = (timestampAtual - dadosAnteriores.timestamp) / 1000;

        if (diffTempoSegundos <= 0) {
            dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };
            return res.json({ bps: 0, mbps: 0, rawBytes: valorAtual });
        }

        const diffBytes = valorAtual - dadosAnteriores.valor;

        if (diffBytes < 0) { // Contador SNMP pode ter sido resetado
            console.warn("SNMP: Contador de bytes parece ter resetado (valor atual < anterior). Resetando base de cálculo.");
            dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };
            return res.json({ bps: 0, mbps: 0, rawBytes: valorAtual });
        }

        const taxaBps = (diffBytes * 8) / diffTempoSegundos;
        const taxaMbps = taxaBps / 1000000;

        dadosAnteriores = { valor: valorAtual, timestamp: timestampAtual };

        // console.log(`API: Taxa calculada - BPS: ${taxaBps.toFixed(2)}, Mbps: ${taxaMbps.toFixed(2)}`);
        res.json({
            bps: taxaBps.toFixed(2),
            mbps: taxaMbps.toFixed(2),
            rawBytes: valorAtual
        });

    } catch (error) {
        console.error("Erro ao processar /api/taxa:", error.message || error);
        // Retorna um erro específico para o frontend saber que algo deu errado na coleta
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
    console.log(`Usando comunidade SNMP: ${SNMP_COMMUNITY}`);
    console.log(`Monitorando OID: ${OID_TRAFEGO}`);
    console.log(`Intervalo de coleta: ${INTERVALO_COLETA_MS / 1000} segundos`);
});
