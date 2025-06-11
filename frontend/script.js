// script.js
document.addEventListener('DOMContentLoaded', function() {
    const dataContainer = document.getElementById('snmp-data-container');
    const updateTimeSpan = document.getElementById('update-time');
    const statusIndicator = document.querySelector('.status-indicator');
    const unitToggle = document.getElementById('unit-toggle');

    const ctx = document.getElementById('realtimeChart').getContext('2d');
    const FETCH_INTERVAL_MS = 5000; // 5 segundos
    const MAX_DATA_POINTS = 30;
    let currentUnit = 'Mbps';

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: `Rx (${currentUnit})`,
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
                    label: `Tx (${currentUnit})`,
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHitRadius: 10,
                    pointHoverBackgroundColor: '#e74c3c',
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: `Taxa (${currentUnit})`, color: '#a0a0a0' },
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
                        label: context => `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${currentUnit}`
                    }
                }
            }
        }
    });

    function convertData(value, toUnit) {
        if (toUnit === 'Kbps') {
            return (value * 1000).toFixed(2);
        }
        return value; // O valor base já está em Mbps
    }

    async function fetchDataAndUpdateUI() {
        try {
            const res = await fetch('/trafego');
            const data = await res.json();

            // Atualiza card
            dataContainer.innerHTML = '';
            const ul = document.createElement('ul');
            if (data.message) {
                const li = document.createElement('li');
                li.textContent = data.message;
                ul.appendChild(li);
            } else {
                const rxValue = convertData(parseFloat(data.rxKbps), currentUnit);
                const txValue = convertData(parseFloat(data.txKbps), currentUnit);

                const itens = [
                    `Rx (${currentUnit}): ${rxValue}`,
                    `Tx (${currentUnit}): ${txValue}`
                ];
                itens.forEach(txt => {
                    const li = document.createElement('li');
                    li.textContent = txt;
                    ul.appendChild(li);
                });
                statusIndicator.classList.add('success');
                updateTimeSpan.textContent = data.lastTime;
            }
            dataContainer.appendChild(ul);

            // Atualiza gráfico
            if (!data.message) {
                const now = new Date();
                const label = now.toLocaleTimeString();
                const rxValue = convertData(parseFloat(data.rxKbps), currentUnit);
                const txValue = convertData(parseFloat(data.txKbps), currentUnit);

                chart.data.labels.push(label);
                chart.data.datasets[0].data.push(parseFloat(rxValue));
                chart.data.datasets[1].data.push(parseFloat(txValue));

                if (chart.data.labels.length > MAX_DATA_POINTS) {
                    chart.data.labels.shift();
                    chart.data.datasets.forEach(ds => ds.data.shift());
                }
                chart.update('quiet');
            }

        } catch (err) {
            console.error(err);
            dataContainer.innerHTML = `<p class="error">Erro ao carregar dados: ${err.message}</p>`;
            statusIndicator.classList.remove('success');
        }
    }

    unitToggle.addEventListener('change', (event) => {
        currentUnit = event.target.value;
        chart.options.scales.y.title.text = `Taxa (${currentUnit})`;
        chart.data.datasets[0].label = `Rx (${currentUnit})`;
        chart.data.datasets[1].label = `Tx (${currentUnit})`;
        
        // Limpa os dados para evitar inconsistências
        chart.data.labels = [];
        chart.data.datasets.forEach(ds => ds.data = []);
        chart.update();
        
        fetchDataAndUpdateUI(); // Atualiza a UI com a nova unidade
    });

    fetchDataAndUpdateUI();
    setInterval(fetchDataAndUpdateUI, FETCH_INTERVAL_MS);
});
