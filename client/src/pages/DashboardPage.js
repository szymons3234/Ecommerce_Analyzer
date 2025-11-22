import React, { useState, useEffect } from 'react';
import DashboardCard from '../components/DashboardCard';

const DashboardPage = () => {
  const [items, setItems] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const itemsResponse = await fetch('/api/items');
        const analysisResponse = await fetch('/api/analysis');
        
        if (!itemsResponse.ok || !analysisResponse.ok) {
          throw new Error('Network response was not ok');
        }

        const itemsData = await itemsResponse.json();
        const analysisData = await analysisResponse.json();

        setItems(itemsData);
        setAnalysis(analysisData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Ładowanie...</div>;
  }

  const soldItemsCount = items.filter(item => item.status === 'sold').length;
  const maxProfit = Math.max(...analysis.map(a => a.total_profit), 0);

  return (
    <div className="dashboard-grid">
      <DashboardCard className="large-card" title="Zysk według kategorii">
        {analysis.map(a => (
          <div className="threshold-item" key={a.category} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
              <div className="threshold-path">{a.category}</div>
              <div className="threshold-max">{a.total_profit.toFixed(2)} PLN</div>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${(a.total_profit / maxProfit) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </DashboardCard>

      <DashboardCard title="Przegląd przedmiotów">
         <div className="job-duration" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>📦 Wszystkie przedmioty</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{items.length}</div>
        </div>
         <div className="job-duration" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>✅ Sprzedane przedmioty</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{soldItemsCount}</div>
        </div>
      </DashboardCard>

      <DashboardCard title="Ostatnie przedmioty">
        {items.slice(0, 4).map(item => (
           <div className="threshold-item" key={item.id}>
            <div>
              <div className="threshold-path">{item.name}</div>
              <small>Kupno: {item.purchase_price.toFixed(2)} {item.sell_price ? `| Sprzedaż: ${item.sell_price.toFixed(2)}` : ''}</small>
            </div>
            <div className={`threshold-max ${item.status === 'sold' ? 'delete' : ''}`}>{item.status}</div>
          </div>
        ))}
      </DashboardCard>
    </div>
  );
};

export default DashboardPage;
