document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const addForm = document.getElementById('add-form');
    const logoutBtn = document.getElementById('logout-btn');
    const adminView = document.getElementById('admin-view');
    const loginView = document.getElementById('login-view');
    const loginError = document.getElementById('login-error');
    const adminItems = document.getElementById('admin-items');

    // Check if session exists by trying to fetch items (not robust but simple)
    // Since items are public, this doesn't actually check auth. Let's just default to login view
    // or we could add a /api/check-auth endpoint. For now, assume unauthenticated,
    // user will login, if successful we show admin view.
    // Actually, we can check document.cookie for admin_session
    if (document.cookie.includes('admin_session=')) {
        showAdminView();
    } else {
        showLoginView();
    }

    function showAdminView() {
        loginView.style.display = 'none';
        adminView.style.display = 'block';
        loadItems();
    }

    function showLoginView() {
        loginView.style.display = 'block';
        adminView.style.display = 'none';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                showAdminView();
            } else {
                loginError.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLoginView();
    });

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('item-type').value;
        const content = document.getElementById('item-content').value;
        const animal = document.getElementById('item-animal').value;

        try {
            const res = await fetch('/api/admin/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, content, animal })
            });
            if (res.ok) {
                document.getElementById('item-content').value = '';
                loadItems();
            } else {
                alert('Failed to add item. Are you logged in?');
            }
        } catch (err) {
            console.error(err);
        }
    });

    window.deleteItem = async (id) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            const res = await fetch(`/api/admin/items/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadItems();
            }
        } catch (err) {
            console.error(err);
        }
    };

    async function loadItems() {
        try {
            const res = await fetch('/api/items');
            const items = await res.json();
            adminItems.innerHTML = '';
            items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'item-row';
                li.innerHTML = `
          <span><strong>${item.content}</strong> (${item.type}) - ${item.animal}</span>
          <button class="delete-btn" onclick="deleteItem(${item.id})">Delete</button>
        `;
                adminItems.appendChild(li);
            });
        } catch (err) {
            console.error(err);
        }
    }
});
