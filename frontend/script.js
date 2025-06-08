document.addEventListener('DOMContentLoaded', function() {
    // --- Elementos para o card de dados ---
    const dataContainer = document.getElementById('snmp-data-container');
    const updateTimeSpan = document.getElementById('update-time');
    const statusIndicator = document.querySelector('.status-indicator');

    // --- Elementos para o gráfico ---
    const ctx = document.getElementById('realtimeChart').getContext('2d');
    const FETCH_INTERVAL_MS = 1000; // 5 segundos
    const MAX_DATA_POINTS = 10; // Mostrar 30 pontos no gráfico (2.5 minutos de histórico)

    // --- Configuração inicial do Gráfico com TEMA ESCURO ---
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Rx (Mbps)',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHitRadius: 10,
                pointHoverBackgroundColor: '#3498db',
            },
            {
                label: 'Tx (Mbps)',
                data: [],
                borderColor: '#643255',
                backgroundColor: 'rgba(219, 52, 52, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHitRadius: 10,
                pointHoverBackgroundColor: '#643255',
            },
        ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Taxa (Mbps)', color: '#a0a0a0' },
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    title: { display: true, text: 'Tempo', color: '#a0a0a0' },
                    ticks: { color: '#a0a0a0', maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: {
                    backgroundColor: '#000',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)} Mbps`
                    }
                }
            }
        }
    });

    // --- Função ÚNICA para buscar dados e atualizar TUDO (Card e Gráfico) ---
    async function fetchDataAndUpdateUI() {
        try {
            const response = await fetch('/api/taxa');
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || `HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();

            // 1. ATUALIZAR O CARD DE DADOS (Lógica anterior)
            dataContainer.innerHTML = '';
            const list = document.createElement('ul');
            const dataToShow = {
                "Taxa Rx (Mbps)": data.mbpsRx,
                "Taxa Rx (Bps)": data.bpsRx,
                "Total de Bytes Rx (Raw)": data.rawBytesRx,
                "Taxa Tx (Mbps)": data.mbpsTx,
                "Taxa Tx (Bps)": data.bpsTx,
                "Total de Bytes Tx (Raw)": data.rawBytesTx
            };
            for (const key in dataToShow) {
                const listItem = document.createElement('li');
                listItem.textContent = `${key}: ${dataToShow[key]}`;
                list.appendChild(listItem);
            }

            dataContainer.appendChild(list);
            statusIndicator.classList.add('success');
            updateTimeSpan.textContent = new Date().toLocaleTimeString();

            // 2. ATUALIZAR O GRÁFICO (Lógica do projeto original, adaptada)
            const now = new Date();
            const newLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            
            chart.data.labels.push(newLabel);
            chart.data.datasets[0].data.push(parseFloat(data.mbpsRx));
            chart.data.datasets[1].data.push(parseFloat(data.mbpsTx))
            /* if (chart.data.labels.length > MAX_DATA_POINTS) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            } */
            chart.update('quiet'); // 'quiet' faz uma animação mais sutil

        } catch (error) {
            console.error('Falha ao buscar dados da API:', error);
            dataContainer.innerHTML = `<p class="error">Falha ao carregar dados: ${error.message}</p>`;
            statusIndicator.classList.remove('success');
        }
    }

    // Busca os dados iniciais e configura a atualização periódica
    fetchDataAndUpdateUI();
    setInterval(fetchDataAndUpdateUI, FETCH_INTERVAL_MS);
});
