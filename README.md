# Dashboard de Monitoramento de Tráfego SNMP

Este é um projeto de dashboard web para monitoramento em tempo real do tráfego de rede (recepção e transmissão) de um dispositivo compatível com SNMP, como um roteador MikroTik. A aplicação consiste em um backend Node.js que coleta os dados e um frontend que os exibe em um gráfico interativo.

## ✨ Funcionalidades

* **Visualização em Tempo Real**: O gráfico é atualizado automaticamente a cada 5 segundos com os novos dados de tráfego.
* **Dados de Recepção (Rx) e Transmissão (Tx)**: Monitora ambos os fluxos de dados da interface de rede.
* **Unidades Flexíveis**: Permite ao usuário alternar a visualização dos dados entre **Mbps** e **Kbps**.
* **Navegação Histórica**: Um slider permite navegar pelo histórico de dados coletados desde que a página foi aberta.
* **Indicador de Status**: Um indicador visual mostra se a conexão com o backend está ativa e recebendo dados com sucesso.
* **Backend Robusto**: O servidor inclui um mecanismo de "warm-up" para pré-carregar os dados e lida com erros de conexão SNMP, tentando se reconectar automaticamente em caso de timeout.

## 🛠️ Tecnologias Utilizadas

* **Backend**:
    * **Node.js**: Ambiente de execução para o servidor.
    * **Express.js**: Framework para criar o servidor web e a API.
    * **net-snmp**: Biblioteca para realizar as consultas SNMP ao dispositivo de rede.
* **Frontend**:
    * **HTML5**, **CSS3** e **JavaScript** (Vanilla).
    * **Chart.js**: Biblioteca para a criação dos gráficos dinâmicos.
* **Desenvolvimento**:
    * **Nodemon**: Ferramenta para reiniciar o servidor automaticamente durante o desenvolvimento.

## ⚙️ Configuração Essencial

Antes de iniciar a aplicação, você **precisa** configurar o backend para se conectar ao seu dispositivo de rede.

Abra o arquivo `backend/server.js` e altere as seguintes constantes:

```javascript
// --- CONFIGURAÇÕES SNMP ---
const SNMP_HOST = "192.168.1.12"; // 👈 COLOQUE O IP DO SEU DISPOSITIVO AQUI (por exemplo, o IP do Roteador Mickrotik (usado originalmente no projeto))
const SNMP_COMMUNITY = "public";       // 👈 Altere se sua comunidade SNMP for diferente
const rxOID = "1.3.6.1.2.1.31.1.1.1.6.2"; // OID para tráfego recebido (Rx)
const txOID = "1.3.6.1.2.1.31.1.1.1.10.2"; // OID para tráfego enviado (Tx)
```
* `SNMP_HOST`: O endereço IP do seu roteador ou switch.
* `SNMP_COMMUNITY`: A comunidade SNMP configurada no seu dispositivo (geralmente "public" para leitura).
* `rxOID` e `txOID`: Os OIDs (Object Identifiers) que correspondem aos contadores de bytes recebidos e enviados da interface de rede que você deseja monitorar. Os OIDs fornecidos são comuns para interfaces de 64 bits, mas podem variar dependendo do dispositivo.

## 🚀 Instalação e Execução

**Requisitos**:
* [Node.js](https://nodejs.org/) instalado (versão 18 ou superior).

1.  **Clone o repositório (ou baixe os arquivos):**
    ```bash
    git clone [https://github.com/DevLuizin/ProjetoGraficoWEB-SNMP.git](https://github.com/DevLuizin/ProjetoGraficoWEB-SNMP.git)
    cd seu-repositorio
    ```

2.  **Instale as dependências do projeto:**
    ```bash
    npm install
    ```
    Este comando irá instalar o `express` e o `net-snmp`.

3.  **Inicie o servidor em modo de desenvolvimento:**
    ```bash
    npm run dev
    ```
    O servidor iniciará na porta 3000 e o nodemon ficará observando por alterações nos arquivos.

4.  **Acesse o Dashboard:**
    Abra seu navegador e acesse [http://localhost:3000](http://localhost:3000).

## 📁 Estrutura do Projeto

```
.
├── backend/
│   └── server.js        # Servidor Express, lógica SNMP e API /trafego
├── frontend/
│   ├── index.html       # Estrutura do dashboard
│   ├── script.js        # Lógica do cliente (fetch, Chart.js, eventos)
│   └── style.css        # Estilização da página
├── .gitignore             # Ignora a pasta node_modules
├── package.json         # Metadados e dependências do projeto
├── package-lock.json    # Lockfile das dependências
└── README.md            # Este arquivo
```