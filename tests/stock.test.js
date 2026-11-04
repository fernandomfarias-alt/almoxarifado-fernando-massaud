const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createServer } = require('../server');

const projectDir = path.resolve(__dirname, '..');

const evidenceDir = path.join(
    projectDir,
    'docs',
    'testes'
);

fs.mkdirSync(evidenceDir, { recursive: true });

async function startTestServer(
    email = 'operador@almox.local',
    password = 'operador123'
) {
    const temporaryDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'almox-test-')
    );

    const server = createServer({
        dataFile: path.join(temporaryDir, 'db.json')
    });

    await new Promise(resolve => {
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();

    const baseUrl = `http://127.0.0.1:${address.port}`;

    let cookie = '';

    async function request(url, options = {}) {
        const response = await fetch(`${baseUrl}${url}`, {
            ...options,

            headers: {
                ...(options.body
                    ? { 'Content-Type': 'application/json' }
                    : {}),

                ...(cookie
                    ? { Cookie: cookie }
                    : {}),

                ...(options.headers || {})
            }
        });

        const setCookie = response.headers.get('set-cookie');

        if (setCookie) {
            cookie = setCookie.split(';')[0];
        }

        const body = await response.json();

        return {
            status: response.status,
            body
        };
    }

    const login = await request('/api/login', {
        method: 'POST',

        body: JSON.stringify({
            email,
            password
        })
    });

    assert.equal(login.status, 200);

    return {
        request,

        close: async () => {
            await new Promise((resolve, reject) => {
                server.close(error => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            fs.rmSync(temporaryDir, {
                recursive: true,
                force: true
            });
        }
    };
}

async function createProductAndAddTen(request, name) {
    const created = await request('/api/products', {
        method: 'POST',

        body: JSON.stringify({
            name,
            description: 'Produto utilizado no teste'
        })
    });

    assert.equal(created.status, 201);

    const productId = created.body.product.id;

    const entry = await request('/api/movements', {
        method: 'POST',

        body: JSON.stringify({
            productId,
            type: 'ENTRADA',
            quantity: 10
        })
    });

    assert.equal(entry.status, 201);

    return productId;
}

function saveEvidence(fileName, lines) {
    const content = [
        'SISTEMA DE ALMOXARIFADO',
        `Data: ${new Date().toLocaleString('pt-BR')}`,
        ...lines
    ].join('\n');

    fs.writeFileSync(
        path.join(evidenceDir, fileName),
        content + '\n',
        'utf8'
    );
}


// CENÁRIO 1
test('Bloqueia saída maior que o estoque', async () => {
    const app = await startTestServer();

    try {
        const productId = await createProductAndAddTen(
            app.request,
            'Produto teste 1'
        );

        const attempt = await app.request('/api/movements', {
            method: 'POST',

            body: JSON.stringify({
                productId,
                type: 'SAIDA',
                quantity: 15
            })
        });

        assert.equal(attempt.status, 400);

        const list = await app.request(
            '/api/products?q=Produto%20teste%201'
        );

        assert.equal(list.body.items[0].quantity, 10);

        saveEvidence('cenario1.log', [
            'Pré-condição: estoque inicial de 10 unidades.',
            'Entrada: retirada de 15 unidades.',
            'Esperado: bloquear a operação.',
            `Obtido: ${attempt.body.error}`,
            'Saldo final: 10 unidades.',
            'Conclusão: APROVADO.'
        ]);

    } finally {
        await app.close();
    }
});


// CENÁRIO 2
test('Permite saída igual ao estoque', async () => {
    const app = await startTestServer();

    try {
        const productId = await createProductAndAddTen(
            app.request,
            'Produto teste 2'
        );

        const result = await app.request('/api/movements', {
            method: 'POST',

            body: JSON.stringify({
                productId,
                type: 'SAIDA',
                quantity: 10
            })
        });

        assert.equal(result.status, 201);

        const list = await app.request(
            '/api/products?q=Produto%20teste%202'
        );

        assert.equal(list.body.items[0].quantity, 0);

        saveEvidence('cenario2.log', [
            'Pré-condição: estoque inicial de 10 unidades.',
            'Entrada: retirada de 10 unidades.',
            'Esperado: permitir a operação.',
            'Obtido: saída registrada.',
            'Saldo final: 0 unidades.',
            'Conclusão: APROVADO.'
        ]);

    } finally {
        await app.close();
    }
});


// CENÁRIO 3
test('Permite saída menor que o estoque', async () => {
    const app = await startTestServer();

    try {
        const productId = await createProductAndAddTen(
            app.request,
            'Produto teste 3'
        );

        const result = await app.request('/api/movements', {
            method: 'POST',

            body: JSON.stringify({
                productId,
                type: 'SAIDA',
                quantity: 4
            })
        });

        assert.equal(result.status, 201);

        const list = await app.request(
            '/api/products?q=Produto%20teste%203'
        );

        assert.equal(list.body.items[0].quantity, 6);

        saveEvidence('cenario3.log', [
            'Pré-condição: estoque inicial de 10 unidades.',
            'Entrada: retirada de 4 unidades.',
            'Esperado: permitir a operação.',
            'Obtido: saída registrada.',
            'Saldo final: 6 unidades.',
            'Conclusão: APROVADO.'
        ]);

    } finally {
        await app.close();
    }
});


// TESTE ADICIONAL DE PERMISSÃO
test('Operador não pode excluir produtos', async () => {
    const app = await startTestServer();

    try {
        const created = await app.request('/api/products', {
            method: 'POST',

            body: JSON.stringify({
                name: 'Produto protegido'
            })
        });

        const deletion = await app.request(
            `/api/products/${created.body.product.id}`,
            {
                method: 'DELETE'
            }
        );

        assert.equal(deletion.status, 403);

    } finally {
        await app.close();
    }
});