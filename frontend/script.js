document.addEventListener('DOMContentLoaded', function() {
    // --- ELEMENTOS DO DOM ---
    const dataContainer = document.getElementById('snmp-data-container');
    const updateTimeSpan = document.getElementById('update-time');
    const statusIndicator = document.querySelector('.status-indicator');
    const unitToggle = document.getElementById('unit-toggle');
    const historySlider = document.getElementById('history-slider');
    const historyTimestamp = document.getElementById('history-timestamp');
    const ctx = document.getElementById('realtimeChart').getContext('2d');

    // --- CONFIGURAÇÕES ---
    const FETCH_INTERVAL_MS = 5000; // 5 segundos
    const MAX_DATA_POINTS_CHART = 30; // Máximo de pontos visíveis no gráfico

    // --- ESTADO DA APLICAÇÃO ---
    let currentUnit = 'Mbps';
    let allData = []; // Array para armazenar todo o histórico de dados
    let isLive = true; // Flag para controlar se a visualização é ao vivo ou histórica

    // --- GRÁFICO (Chart.js) ---
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: `Rx (${currentUnit})`,
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
            }, {
                label: `Tx (${currentUnit})`,
                data: [],
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
            }, ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: `Taxa (${currentUnit})`, color: '#a0a0a0' },
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#a0a0a0', maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: context => `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${currentUnit}`
                    }
                }
            }
        }
    });

    // --- FUNÇÕES ---

    /**
     * Converte o valor de Bps (bits por segundo) para a unidade desejada.
     * @param {number} bps - O valor em bits por segundo.
     * @param {string} toUnit - A unidade de destino ('Mbps' ou 'Kbps').
     * @returns {number} O valor convertido.
     */
    function convertFromBps(bps, toUnit) {
        if (toUnit === 'Kbps') {
            return bps / 1000;
        }
        if (toUnit === 'Mbps') {
            return bps / 1000000;
        }
        return bps;
    }

    /**
     * Atualiza o gráfico com um conjunto de dados.
     * @param {Array} dataPoints - O array de pontos de dados a serem exibidos.
     */
    function updateChart(dataPoints) {
        chart.data.labels = dataPoints.map(d => d.label);
        
        const rxValues = dataPoints.map(d => convertFromBps(d.rxBps, currentUnit));
        const txValues = dataPoints.map(d => convertFromBps(d.txBps, currentUnit));

        chart.data.datasets[0].data = rxValues;
        chart.data.datasets[1].data = txValues;
        
        chart.update('quiet');
    }

    /**
     * Busca os dados do servidor e atualiza a UI.
     */
    async function fetchDataAndUpdateUI() {
        try {
            const res = await fetch('/trafego');
            statusIndicator.classList.remove('success'); // Assume falha até confirmar

            if (!res.ok) {
                 const errorData = await res.json().catch(() => ({ message: res.statusText }));
                 throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
            }
            
            const data = await res.json();
            statusIndicator.classList.add('success');

            // Se o servidor está aquecendo ou enviando uma mensagem, apenas exiba-a.
            if (data.message) {
                dataContainer.innerHTML = `<ul><li>${data.message}</li></ul>`;
                return;
            }

            // --- Processa e armazena os novos dados ---
            const newDataPoint = {
                label: data.lastTime,
                rxBps: parseFloat(data.rxBps),
                txBps: parseFloat(data.txBps)
            };
            allData.push(newDataPoint);

            // --- Atualiza o card de dados ao vivo ---
            const rxConverted = convertFromBps(newDataPoint.rxBps, currentUnit).toFixed(2);
            const txConverted = convertFromBps(newDataPoint.txBps, currentUnit).toFixed(2);
            dataContainer.innerHTML = `
                <ul>
                    <li>Rx (${currentUnit}): ${rxConverted}</li>
                    <li>Tx (${currentUnit}): ${txConverted}</li>
                </ul>`;
            updateTimeSpan.textContent = newDataPoint.label;

            // --- Atualiza o slider de histórico ---
            if (historySlider.disabled) historySlider.disabled = false;
            historySlider.max = allData.length - 1;

            // --- Atualiza o gráfico se estiver em modo "ao vivo" ---
            if (isLive) {
                historySlider.value = historySlider.max; // Mantém o slider no final
                const liveView = allData.slice(-MAX_DATA_POINTS_CHART);
                updateChart(liveView);
                historyTimestamp.textContent = 'Exibindo dados ao vivo';
            }

        } catch (err) {
            console.error("Fetch error:", err);
            dataContainer.innerHTML = `<p class="error">Erro ao carregar dados: ${err.message}</p>`;
            statusIndicator.classList.remove('success');
        }
    }
    
    /**
     * Renderiza a visualização do gráfico com base na posição do slider.
     */
    function renderChartView() {
        const sliderValue = parseInt(historySlider.value, 10);
        const maxSliderValue = parseInt(historySlider.max, 10);
        isLive = (sliderValue === maxSliderValue && allData.length > 0);

        let view;
        if (isLive) {
            view = allData.slice(-MAX_DATA_POINTS_CHART);
            historyTimestamp.textContent = 'Exibindo dados ao vivo';
        } else {
            const end = sliderValue + 1;
            const start = Math.max(0, end - MAX_DATA_POINTS_CHART);
            view = allData.slice(start, end);
            const lastPointInView = view[view.length - 1];
            if (lastPointInView) {
                historyTimestamp.textContent = `Histórico até ${lastPointInView.label}`;
            }
        }
        updateChart(view);
    }


    // --- EVENT LISTENERS ---

    // Listener para o seletor de unidades (Kbps/Mbps)
    unitToggle.addEventListener('change', (event) => {
        currentUnit = event.target.value;
        chart.options.scales.y.title.text = `Taxa (${currentUnit})`;
        chart.data.datasets[0].label = `Rx (${currentUnit})`;
        chart.data.datasets[1].label = `Tx (${currentUnit})`;
        
        // Re-renderiza a visualização atual com a nova unidade
        renderChartView();

        // Atualiza também o card de dados ao vivo
        if (allData.length > 0) {
            const lastPoint = allData[allData.length - 1];
            const rxConverted = convertFromBps(lastPoint.rxBps, currentUnit).toFixed(2);
            const txConverted = convertFromBps(lastPoint.txBps, currentUnit).toFixed(2);
             dataContainer.innerHTML = `
                <ul>
                    <li>Rx (${currentUnit}): ${rxConverted}</li>
                    <li>Tx (${currentUnit}): ${txConverted}</li>
                </ul>`;
        }
    });

    // Listener para o slider de histórico
    historySlider.addEventListener('input', renderChartView);

    // --- INICIALIZAÇÃO ---
    fetchDataAndUpdateUI(); // Primeira chamada
    setInterval(fetchDataAndUpdateUI, FETCH_INTERVAL_MS); // Chamadas recorrentes
});
