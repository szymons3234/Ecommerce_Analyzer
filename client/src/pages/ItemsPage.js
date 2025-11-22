import React, { useState, useEffect, useMemo } from 'react';

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config);

  const sortedItems = useMemo(() => {
    let sortableItems = items.map(item => ({
      ...item,
      profit: item.status === 'sold' ? item.sell_price - item.purchase_price : null
    }));

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA === null) return 1;
        if (valB === null) return -1;
        
        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

const ItemsPage = () => {
  const [items, setItems] = useState([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredItems = useMemo(() => {
    let filtered = items;

    if (filterCategory !== 'All') {
      filtered = filtered.filter(item => item.category === filterCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [items, filterCategory, searchTerm]);

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(filteredItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    purchase_price: '',
    category: '',
  });
  const [sellFormData, setSellFormData] = useState({
    sell_price: '',
    sell_date: '',
  });
  const [importFile, setImportFile] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/items');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSellInputChange = (e) => {
    const { name, value } = e.target;
    setSellFormData({ ...sellFormData, [name]: value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const url = currentItem ? `/api/items/${currentItem.id}` : '/api/items';
    const method = currentItem ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save item');
      }
      
      fetchItems();
      closeModal();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSellFormSubmit = async (e) => {
    e.preventDefault();
    if (!currentItem) return;

    try {
      const response = await fetch(`/api/items/${currentItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sellFormData),
      });

      if (!response.ok) {
        throw new Error('Failed to sell item');
      }
      
      fetchItems();
      closeSellModal();
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileChange = (e) => {
    setImportFile(e.target.files[0]);
    setImportMessage('');
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportMessage('Proszę wybrać plik.');
      return;
    }

    setIsLoading(true);
    setImportMessage('');
    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Błąd podczas importu.');
      }

      setImportMessage(result.message);
      setImportFile(null);
      fetchItems(); // Refresh the list
    } catch (error) {
      setImportMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten przedmiot?')) {
      try {
        const response = await fetch(`/api/items/${itemId}`, {
          method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
          throw new Error('Failed to delete item');
        }
        fetchItems();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const openModal = (item = null) => {
    setCurrentItem(item);
    if (item) {
      setFormData({
        name: item.name,
        purchase_price: item.purchase_price,
        category: item.category,
      });
    } else {
      setFormData({ name: '', purchase_price: '', category: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(null);
  };

  const openSellModal = (item) => {
    setCurrentItem(item);
    setSellFormData({ sell_price: '', sell_date: new Date().toISOString().slice(0, 10) });
    setIsSellModalOpen(true);
  };

  const closeSellModal = () => {
    setIsSellModalOpen(false);
    setCurrentItem(null);
  };

  const getSortIndicator = (name) => {
    if (!sortConfig || sortConfig.key !== name) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? ' 🔼' : ' 🔽';
  };

  const categories = useMemo(() => ['All', ...new Set(items.map(item => item.category))], [items]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1>Przedmioty</h1>
        <div className="page-header-actions">
          <input
            type="text"
            placeholder="Wyszukaj po nazwie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select onChange={(e) => setFilterCategory(e.target.value)} value={filterCategory} className="category-filter">
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button onClick={() => openModal()} className="add-item-btn">Dodaj przedmiot</button>
        </div>
      </div>

      <div className="import-section">
        <input type="file" onChange={handleFileChange} accept=".csv, .xlsx" disabled={isLoading} />
        <button onClick={handleImport} disabled={isLoading}>
          {isLoading ? 'Importowanie...' : 'Importuj'}
        </button>
        {importMessage && <p className="import-message">{importMessage}</p>}
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th onClick={() => requestSort('name')}>Nazwa{getSortIndicator('name')}</th>
            <th onClick={() => requestSort('category')}>Kategoria{getSortIndicator('category')}</th>
            <th onClick={() => requestSort('purchase_price')}>Cena zakupu{getSortIndicator('purchase_price')}</th>
            <th onClick={() => requestSort('status')}>Status{getSortIndicator('status')}</th>
            <th onClick={() => requestSort('sell_price')}>Cena sprzedaży{getSortIndicator('sell_price')}</th>
            <th onClick={() => requestSort('sell_date')}>Data sprzedaży{getSortIndicator('sell_date')}</th>
            <th onClick={() => requestSort('profit')}>Zysk{getSortIndicator('profit')}</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map(item => (
            <tr key={item.id}>
              <td data-label="Nazwa">{item.name}</td>
              <td data-label="Kategoria">{item.category}</td>
              <td data-label="Cena zakupu">{item.purchase_price.toFixed(2)} PLN</td>
              <td data-label="Status">{item.status}</td>
              <td data-label="Cena sprzedaży">{item.sell_price ? item.sell_price.toFixed(2) + ' PLN' : '-'}</td>
              <td data-label="Data sprzedaży">{item.sell_date || '-'}</td>
              <td data-label="Zysk">{item.profit !== null ? item.profit.toFixed(2) + ' PLN' : '-'}</td>
              <td data-label="Akcje">
                <div className="item-actions">
                  {item.status !== 'sold' && <button onClick={() => openSellModal(item)}>Sprzedaj</button>}
                  <button onClick={() => openModal(item)}>Edytuj</button>
                  <button onClick={() => handleDelete(item.id)} className="delete">Usuń</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>{currentItem ? 'Edytuj przedmiot' : 'Dodaj przedmiot'}</h2>
            <form onSubmit={handleFormSubmit}>
              <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Nazwa" required />
              <input name="purchase_price" type="number" value={formData.purchase_price} onChange={handleInputChange} placeholder="Cena zakupu" required />
              <input name="category" value={formData.category} onChange={handleInputChange} placeholder="Kategoria" required />
              <button type="submit">Zapisz</button>
              <button type="button" onClick={closeModal}>Anuluj</button>
            </form>
          </div>
        </div>
      )}

      {isSellModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Sprzedaj przedmiot</h2>
            <form onSubmit={handleSellFormSubmit}>
              <input name="sell_price" type="number" value={sellFormData.sell_price} onChange={handleSellInputChange} placeholder="Cena sprzedaży" required />
              <input name="sell_date" type="date" value={sellFormData.sell_date} onChange={handleSellInputChange} required />
              <button type="submit">Potwierdź sprzedaż</button>
              <button type="button" onClick={closeSellModal}>Anuluj</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
