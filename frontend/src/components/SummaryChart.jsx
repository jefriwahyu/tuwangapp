import { useEffect, useState } from "react";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function SummaryChart() {
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        fetch('http://localhost:8080/api/v1/summary?period=month')
            .then((res) => res.json())
            .then((data) => setSummary(data));
    }, []);

    if (!summary) return <p>Memuat rekap...</p>;

    const chartData = {
        labels: ['Bulan ini'],
        datasets: [
            { label: 'Pemasukan', data: [summary.income], backgroundColor: '#5f8d7c' },
            { label: 'Pengeluaran', data: [summary.expense], backgroundColor: '#e0a458'},
        ],
    };

    return <Bar data={chartData} />;
}

export default SummaryChart;