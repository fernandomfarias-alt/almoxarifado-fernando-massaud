const { FileRepository } = require('../repositories/fileRepository');
const { AuthService } = require('../services/authService');
const { StockService } = require('../services/stockService');
const { can } = require('../models/permissions');

function readBody(request) {
    return new Promise((resolve, reject) => {
        let raw = '';

        request.on('data', chunk => {
            raw += chunk;

            if (raw.length > 1024 * 1024) {
                reject(new Error('Requisição muito grande.'));
                request.destroy();
            }
        });

        request.on('end', () => {
            if (!raw) return resolve({});

            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error('JSON inválido.'));
            }
        });

        request.on('error', reject);
    });
}

function parseCookies(header = '') {
    return Object.fromEntries(
        header.split(';')
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => {
                const index = part.indexOf('=');

                return index < 0
                    ? [part, '']
                    : [
                        part.slice(0, index),
                        decodeURIComponent(part.slice(index + 1))
                    ];
            })
    );
}

function sendJson(response, status, data, extraHeaders = {}) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extraHeaders
    });

    response.end(JSON.stringify(data));
}

function createApiController({ dataFile }) {
    const repository = new FileRepository(dataFile);
    const sessions = new Map();

    const auth = new AuthService(repository, sessions);
    const stock = new StockService(repository);

    return async function handleApi(request, response, url) {
        const method = request.method;
        const pathname = url.pathname;

        const cookies = parseCookies(
            request.headers.cookie
        );

        const token = cookies.almox_session;

        if (pathname === '/api/login' && method === 'POST') {
            const body = await readBody(request);

            const result = auth.login(
                body.email,
                body.password
            );

            if (!result) {
                return sendJson(response, 401, {
                    error: 'E-mail ou senha inválidos.'
                });
            }

            return sendJson(
                response,
                200,
                { user: result.user },
                {
                    'Set-Cookie':
                        `almox_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
                }
            );
        }

        if (pathname === '/api/logout' && method === 'POST') {
            auth.logout(token);

            return sendJson(
                response,
                200,
                { success: true },
                {
                    'Set-Cookie':
                        'almox_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
                }
            );
        }

        const user = auth.userFromToken(token);

        if (!user) {
            return sendJson(response, 401, {
                error: 'Faça login para continuar.'
            });
        }

        if (pathname === '/api/me' && method === 'GET') {
            return sendJson(response, 200, { user });
        }

        if (pathname === '/api/products' && method === 'GET') {
            return sendJson(
                response,
                200,
                stock.listProducts({
                    q: url.searchParams.get('q') || '',
                    from: url.searchParams.get('from') || '',
                    to: url.searchParams.get('to') || '',
                    page: url.searchParams.get('page') || 1,
                    limit: url.searchParams.get('limit') || 5
                })
            );
        }

        if (pathname === '/api/products' && method === 'POST') {
            const result = stock.createProduct(
                await readBody(request)
            );

            return sendJson(
                response,
                result.error ? 400 : 201,
                result
            );
        }

        const productMatch = pathname.match(
            /^\/api\/products\/([^/]+)$/
        );

        if (productMatch && method === 'PUT') {
            const result = stock.updateProduct(
                productMatch[1],
                await readBody(request)
            );

            return sendJson(
                response,
                result.error ? (result.status || 400) : 200,
                result
            );
        }

        if (productMatch && method === 'DELETE') {
            if (!can(user.role, 'excluir')) {
                return sendJson(response, 403, {
                    error: 'Apenas o administrador pode excluir produtos.'
                });
            }

            const result = stock.deleteProduct(productMatch[1]);

            return sendJson(
                response,
                result.error ? (result.status || 400) : 200,
                result
            );
        }

        if (pathname === '/api/movements' && method === 'GET') {
            return sendJson(response, 200, {
                items: stock.listMovements({
                    from: url.searchParams.get('from') || '',
                    to: url.searchParams.get('to') || ''
                })
            });
        }

        if (pathname === '/api/movements' && method === 'POST') {
            const body = await readBody(request);

            const result = stock.moveStock({
                ...body,
                user
            });

            return sendJson(
                response,
                result.error ? (result.status || 400) : 201,
                result
            );
        }

        if (pathname === '/api/users' && method === 'GET') {
            if (!can(user.role, 'gerenciar_usuarios')) {
                return sendJson(response, 403, {
                    error: 'Apenas o administrador pode gerenciar usuários.'
                });
            }

            const users = repository.read().users.map(
                ({ id, name, email, role, createdAt }) => ({
                    id,
                    name,
                    email,
                    role,
                    createdAt
                })
            );

            return sendJson(response, 200, {
                items: users
            });
        }

        if (pathname === '/api/users' && method === 'POST') {
            if (!can(user.role, 'gerenciar_usuarios')) {
                return sendJson(response, 403, {
                    error: 'Apenas o administrador pode gerenciar usuários.'
                });
            }

            const result = auth.createUser(
                await readBody(request)
            );

            return sendJson(
                response,
                result.error ? 400 : 201,
                result
            );
        }

        return sendJson(response, 404, {
            error: 'Rota não encontrada.'
        });
    };
}

module.exports = { createApiController };