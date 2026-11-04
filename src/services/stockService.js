const crypto = require('node:crypto');

class StockService {
    constructor(repository) {
        this.repository = repository;
    }

    listProducts({
        q = '',
        from = '',
        to = '',
        page = 1,
        limit = 5
    } = {}) {
        const data = this.repository.read();

        const search = String(q).toLowerCase();

        const filtered = data.products.filter(product => {
            const matchesName = product.name
                .toLowerCase()
                .includes(search);

            const date = product.createdAt.slice(0, 10);

            return matchesName &&
                (!from || date >= from) &&
                (!to || date <= to);
        });

        const safePage = Math.max(
            1,
            Number.parseInt(page, 10) || 1
        );

        const safeLimit = Math.min(
            50,
            Math.max(1, Number.parseInt(limit, 10) || 5)
        );

        const start = (safePage - 1) * safeLimit;

        return {
            items: filtered.slice(start, start + safeLimit),
            total: filtered.length,
            totalQuantity: filtered.reduce(
                (sum, product) => sum + product.quantity,
                0
            ),
            page: safePage,
            limit: safeLimit,
            pages: Math.max(
                1,
                Math.ceil(filtered.length / safeLimit)
            )
        };
    }

    createProduct({ name, description = '' }) {
        if (!String(name || '').trim()) {
            return { error: 'Informe o nome do produto.' };
        }

        return this.repository.update(data => {
            const product = {
                id: crypto.randomUUID(),
                name: String(name).trim(),
                description: String(description).trim(),
                quantity: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            data.products.push(product);

            return { product };
        });
    }

    updateProduct(id, { name, description = '' }) {
        if (!String(name || '').trim()) {
            return { error: 'Informe o nome do produto.' };
        }

        return this.repository.update(data => {
            const product = data.products.find(
                item => item.id === id
            );

            if (!product) {
                return {
                    error: 'Produto não encontrado.',
                    status: 404
                };
            }

            product.name = String(name).trim();
            product.description = String(description).trim();
            product.updatedAt = new Date().toISOString();

            return { product };
        });
    }

    deleteProduct(id) {
        return this.repository.update(data => {
            const index = data.products.findIndex(
                item => item.id === id
            );

            if (index === -1) {
                return {
                    error: 'Produto não encontrado.',
                    status: 404
                };
            }

            const hasMovements = data.movements.some(
                movement => movement.productId === id
            );

            if (hasMovements) {
                return {
                    error: 'Não é possível excluir um produto que possui movimentações.',
                    status: 409
                };
            }

            data.products.splice(index, 1);

            return { success: true };
        });
    }

    moveStock({ productId, type, quantity, user }) {
        const amount = Number(quantity);

        if (!Number.isInteger(amount) || amount <= 0) {
            return {
                error: 'A quantidade deve ser um número inteiro maior que zero.'
            };
        }

        if (!['ENTRADA', 'SAIDA'].includes(type)) {
            return {
                error: 'Tipo de movimentação inválido.'
            };
        }

        return this.repository.update(data => {
            const product = data.products.find(
                item => item.id === productId
            );

            if (!product) {
                return {
                    error: 'Produto não encontrado.',
                    status: 404
                };
            }

            if (
                type === 'SAIDA' &&
                amount > product.quantity
            ) {
                return {
                    error:
                        `Saída não permitida: estoque insuficiente. ` +
                        `Disponível: ${product.quantity}. ` +
                        `Solicitado: ${amount}.`,
                    status: 400
                };
            }

            if (type === 'ENTRADA') {
                product.quantity += amount;
            } else {
                product.quantity -= amount;
            }

            product.updatedAt = new Date().toISOString();

            const movement = {
                id: crypto.randomUUID(),
                productId,
                productName: product.name,
                type,
                quantity: amount,
                balanceAfter: product.quantity,
                userId: user.id,
                userName: user.name,
                createdAt: new Date().toISOString()
            };

            data.movements.push(movement);

            return {
                movement,
                product
            };
        });
    }

    listMovements({ from = '', to = '' } = {}) {
        return this.repository.read().movements
            .filter(item => {
                const date = item.createdAt.slice(0, 10);

                return (!from || date >= from) &&
                    (!to || date <= to);
            })
            .sort((a, b) =>
                b.createdAt.localeCompare(a.createdAt)
            );
    }
}

module.exports = { StockService };