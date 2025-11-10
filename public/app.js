document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('addItemForm');
    const tableBody = document.querySelector('#itemsTable tbody');

    async function fetchItems() {
        const response = await fetch('/api/items');
        const data = await response.json();
        renderItems(data.items);
    }

    function renderItems(items) {
        tableBody.innerHTML = '';
        items.forEach(item => {
            const profit = item.sell_price - item.purchase_price;
            const row = `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.purchase_price.toFixed(2)} zł</td>
                    <td>${item.sell_price.toFixed(2)} zł</td>
                    <td>${profit.toFixed(2)} zł</td>
                    <td>${new Date(item.sell_date).toLocaleDateString()}</td>
                    <td>${item.category}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newItem = {
            name: document.getElementById('name').value,
            purchase_price: parseFloat(document.getElementById('purchase_price').value),
            sell_price: parseFloat(document.getElementById('sell_price').value),
            sell_date: document.getElementById('sell_date').value,
            category: document.getElementById('category').value,
        };

        const response = await fetch('/api/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newItem),
        });

        if (response.ok) {
            form.reset();
            fetchItems();
        } else {
            alert('Wystąpił błąd podczas dodawania przedmiotu.');
        }
    });

    fetchItems();
});
