// backend/server.js

const snmp    = require("net-snmp");
const express = require("express");
const path    = require("path");
const app     = express();

// Criar sessão SNMP
const session = snmp.createSession("192.168.1.12", "public");

// OIDs de Rx e Tx
const rxOID = "1.3.6.1.2.1.31.1.1.1.6.2";
const txOID = "1.3.6.1.2.1.31.1.1.1.10.2";

// Armazenar valores anteriores
let lastRx   = null;
let lastTx   = null;
let lastTime = null;

// Converte Buffer SNMP para BigInt
function bufferToBigInt(buffer) {
  let result = 0n;
  for (const byte of buffer) {
    result = (result << 8n) + BigInt(byte);
  }
  return result;
}

// SERVIR OS ARQUIVOS ESTÁTICOS (frontend)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Rota de coleta de tráfego
app.get("/trafego", (req, res) => {
  session.get([rxOID, txOID], (err, varbinds) => {
    if (err) {
      return res.status(500).send(err.toString());
    }

    const now   = Date.now();
    const rxNow = bufferToBigInt(varbinds[0].value);
    const txNow = bufferToBigInt(varbinds[1].value);

    if (lastRx !== null && lastTx !== null && lastTime !== null) {
      const deltaTime = (now - lastTime) / 1000; // em segundos

      const rxDelta = rxNow - lastRx;
      const txDelta = txNow - lastTx;

      const rxKbps = Number(rxDelta) * 8 / deltaTime / 1_000_000;
      const txKbps = Number(txDelta) * 8 / deltaTime / 1_000_000;

      // Atualiza valores anteriores
      lastRx   = rxNow;
      lastTx   = txNow;
      lastTime = now;

      return res.json({
        rxKbps:   rxKbps.toFixed(2),
        txKbps:   txKbps.toFixed(2),
        lastTime: new Date(now).toLocaleTimeString(),
      });

    } else {
      // Primeira requisição: só inicializa e avisa
      lastRx   = rxNow;
      lastTx   = txNow;
      lastTime = now;

      return res.json({ message: "Coleta inicial feita. Acesse novamente em alguns segundos." });
    }
  });
});

// Inicia o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor SNMP rodando em http://localhost:${PORT}`);
});
