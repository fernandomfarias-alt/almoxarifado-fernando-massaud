const $ = selector => document.querySelector(selector);

let currentUser = null;
let currentPage = 1;

const pageSize = 5;

async function api(path, options = {}) {
    const response = await fetch(path, {
        ...options,

        headers: {
            ...(options.body
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Ocorreu um erro.');
    }

    return data;
}

function showNotice(message, type = 'success') {
    const notice = $('#notice');

    notice.textContent = message;
    notice.className = type;
    notice.hidden = false;

    setTimeout(() => {
        notice.hidden = true;
    }, 5000);
}

function dateTime(value) {
    return new Date(value).toLocaleString('pt-BR');
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function toggleView(loggedIn) {
    $('#loginView').hidden = loggedIn;
    $('#appView').hidden = !loggedIn;
}

async function loadSession() {
    try {
        const data = await api('/api/me');

        currentUser = data.user;

        enterApp();

    } catch {
        toggleView(false);
    }
}

function enterApp() {
    toggleView(true);

    $('#currentUser').textContent = currentUser.name;

    $('#currentRole').textContent =
        currentUser.role === 'ADMINISTRADOR'
            ? 'Administrador'
            : 'Operador';

    document.querySelectorAll('.admin-only').forEach(element => {
        element.hidden =
            currentUser.role !== 'ADMINISTRADOR';
    });

    refreshAll();
}

async function refreshAll() {
    await Promise.all([
        loadProducts(),
        loadMovements(),
        loadUsersIfAdmin()
    ]);
}

async function loadProducts() {
    const query = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
        q: $('#searchName').value,
        from: $('#filterFrom').value,
        to: $('#filterTo').value
    });

    const data = await api(`/api/products?${query}`);

    $('#productsBody').innerHTML = data.items.length
        ? data.items.map(product => `
            <tr>
                <td>${escapeHtml(product.name)}</td>

                <td>${escapeHtml(product.description || '-')}</td>

                <td>${product.quantity}</td>

                <td>
                    ${new Date(product.createdAt)
                        .toLocaleDateString('pt-BR')}
                </td>

                <td>
                    <button data-edit="${product.id}">
                        Editar
                    </button>

                    ${
                        currentUser.role === 'ADMINISTRADOR'
                            ? `<button data-delete="${product.id}">
                                Excluir
                               </button>`
                            : ''
                    }
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5">Nenhum produto encontrado.</td></tr>';

    $('#pageInfo').textContent =
        `Página ${data.page} de ${data.pages} | ${data.total} produtos`;

    $('#previousPage').disabled = data.page <= 1;
    $('#nextPage').disabled = data.page >= data.pages;

    $('#totalProducts').textContent = data.total;
    $('#totalUnits').textContent = data.totalQuantity;

    const allProducts = await api('/api/products?page=1&limit=50');

    const select = $('#movementProduct');
    const selected = select.value;

    select.innerHTML =
        '<option value="">Selecione um produto</option>' +
        allProducts.items.map(product => `
            <option value="${product.id}">
                ${escapeHtml(product.name)}
                (saldo: ${product.quantity})
            </option>
        `).join('');

    if ([...select.options].some(option => option.value === selected)) {
        select.value = selected;
    }
}

async function loadMovements() {
    const data = await api('/api/movements');

    $('#totalMovements').textContent = data.items.length;

    $('#movementsBody').innerHTML = data.items.length
        ? data.items.map(item => `
            <tr>
                <td>${dateTime(item.createdAt)}</td>
                <td>${escapeHtml(item.productName)}</td>
                <td>${item.type}</td>
                <td>${item.quantity}</td>
                <td>${item.balanceAfter}</td>
                <td>${escapeHtml(item.userName)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="6">Nenhuma movimentação.</td></tr>';
}

async function loadUsersIfAdmin() {
    if (currentUser.role !== 'ADMINISTRADOR') {
        return;
    }

    const data = await api('/api/users');

    $('#usersBody').innerHTML = data.items.map(user => `
        <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${user.role}</td>
        </tr>
    `).join('');
}


// LOGIN
$('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();

    $('#loginMessage').textContent = '';

    const form = new FormData(event.currentTarget);

    try {
        const data = await api('/api/login', {
            method: 'POST',

            body: JSON.stringify({
                email: form.get('email'),
                password: form.get('password')
            })
        });

        currentUser = data.user;

        enterApp();

    } catch (error) {
        $('#loginMessage').textContent = error.message;
    }
});


// LOGOUT
$('#logoutButton').addEventListener('click', async () => {
    await api('/api/logout', {
        method: 'POST'
    });

    currentUser = null;

    toggleView(false);
});


// CADASTRO DE PRODUTOS
$('#productForm').addEventListener('submit', async event => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
        await api('/api/products', {
            method: 'POST',

            body: JSON.stringify({
                name: form.get('name'),
                description: form.get('description')
            })
        });

        formElement.reset();

        currentPage = 1;

        await loadProducts();

        showNotice('Produto cadastrado com sucesso!');

    } catch (error) {
        showNotice(error.message, 'error');
    }
});


// MOVIMENTAÇÃO DE ESTOQUE
$('#movementForm').addEventListener('submit', async event => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
        const result = await api('/api/movements', {
            method: 'POST',

            body: JSON.stringify({
                productId: form.get('productId'),
                type: form.get('type'),
                quantity: Number(form.get('quantity'))
            })
        });

        formElement.reset();

        await refreshAll();

        showNotice(
            `Movimentação registrada. Saldo atual: ${result.product.quantity}.`
        );

    } catch (error) {
        showNotice(error.message, 'error');
    }
});


// CADASTRO DE USUÁRIOS
$('#userForm').addEventListener('submit', async event => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
        await api('/api/users', {
            method: 'POST',

            body: JSON.stringify(
                Object.fromEntries(form.entries())
            )
        });

        formElement.reset();

        await loadUsersIfAdmin();

        showNotice('Usuário criado com sucesso!');

    } catch (error) {
        showNotice(error.message, 'error');
    }
});


// FILTROS
$('#filterButton').addEventListener('click', () => {
    currentPage = 1;

    loadProducts().catch(error => {
        showNotice(error.message, 'error');
    });
});


// PAGINAÇÃO
$('#previousPage').addEventListener('click', () => {
    currentPage = Math.max(1, currentPage - 1);

    loadProducts();
});

$('#nextPage').addEventListener('click', () => {
    currentPage++;

    loadProducts();
});


// EDITAR E EXCLUIR PRODUTOS
$('#productsBody').addEventListener('click', async event => {
    const editButton = event.target.closest('[data-edit]');

    const deleteButton = event.target.closest('[data-delete]');

    if (editButton) {
        const id = editButton.dataset.edit;

        const row = editButton.closest('tr');

        const name = prompt(
            'Novo nome:',
            row.children[0].innerText.trim()
        );

        if (name === null) return;

        const description = prompt(
            'Nova descrição:',
            row.children[1].innerText === '-'
                ? ''
                : row.children[1].innerText
        );

        if (description === null) return;

        try {
            await api(`/api/products/${id}`, {
                method: 'PUT',

                body: JSON.stringify({
                    name,
                    description
                })
            });

            await loadProducts();

            showNotice('Produto atualizado!');

        } catch (error) {
            showNotice(error.message, 'error');
        }
    }

    if (
        deleteButton &&
        confirm('Deseja realmente excluir este produto?')
    ) {
        try {
            await api(
                `/api/products/${deleteButton.dataset.delete}`,
                { method: 'DELETE' }
            );

            await loadProducts();

            showNotice('Produto excluído!');

        } catch (error) {
            showNotice(error.message, 'error');
        }
    }
});


// VERIFICAÇÃO INICIAL
loadSession();