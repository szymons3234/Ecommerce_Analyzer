import React, { useState, useEffect, useMemo } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AnalysisPage = () => {
  const [analysisData, setAnalysisData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'total_profit', direction: 'desc' });

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/analysis');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setAnalysisData(data);
      } catch (error) {
        console.error("Failed to fetch analysis data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, []);

  const sortedData = useMemo(() => {
    let sortableData = [...analysisData];
    if (sortConfig.key) {
      sortableData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [analysisData, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'desc' ? ' ▼' : ' ▲';
    }
    return '';
  };

  const pieChartData = useMemo(() => {
    const profitableData = sortedData.filter(d => d.total_profit > 0);
    return {
      labels: profitableData.map(d => d.category),
      datasets: [
        {
          data: profitableData.map(d => d.total_profit),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
          ],
        },
      ],
    };
  }, [sortedData]);

  const barChartData = useMemo(() => {
    return {
      labels: sortedData.map(d => d.category),
      datasets: [
        {
          label: 'Całkowity przychód',
          data: sortedData.map(d => d.total_revenue),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
        },
        {
          label: 'Całkowity zysk',
          data: sortedData.map(d => d.total_profit),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
      ],
    };
  }, [sortedData]);

  if (loading) {
    return <div>Ładowanie danych...</div>;
  }

  return (
    <div>
      <h1>Analiza zysków</h1>
      <p>Poniżej znajduje się szczegółowa analiza zysków dla poszczególnych kategorii.</p>
      
      {sortedData.length > 0 ? (
        <>
          <div className="charts-container">
            <div className="chart-wrapper">
              <h2>Udział w zysku (kategorie zyskowne)</h2>
              <Pie data={pieChartData} />
            </div>
            <div className="chart-wrapper">
              <h2>Przychód vs Zysk</h2>
              <Bar data={barChartData} options={{ responsive: true, scales: { y: { beginAtZero: true } } }} />
            </div>
          </div>

          <table className="analysis-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('category')}>
                  Kategoria {getSortIndicator('category')}
                </th>
                <th onClick={() => requestSort('items_sold')}>
                  Sprzedane sztuki {getSortIndicator('items_sold')}
                </th>
                <th onClick={() => requestSort('total_revenue')}>
                  Przychód {getSortIndicator('total_revenue')}
                </th>
                <th onClick={() => requestSort('average_profit')}>
                  Średni zysk {getSortIndicator('average_profit')}
                </th>
                <th onClick={() => requestSort('total_profit')}>
                  Całkowity zysk {getSortIndicator('total_profit')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => (
                <tr key={item.category}>
                  <td>{item.category}</td>
                  <td>{item.items_sold}</td>
                  <td>{item.total_revenue.toFixed(2)} PLN</td>
                  <td>{item.average_profit.toFixed(2)} PLN</td>
                  <td className={item.total_profit >= 0 ? 'profit' : 'loss'}>
                    {item.total_profit.toFixed(2)} PLN
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>Brak danych do wyświetlenia. Sprzedaj przedmiot, aby zobaczyć analizę.</p>
      )}
    </div>
  );
};

export default AnalysisPage;
