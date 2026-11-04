const path = require('node:path');
const fs = require('node:fs');

const {
    createApiController
} = require('../controllers/apiController');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

function createHandler({ dataFile, publicDir }) {
    const api = createApiController({ dataFile });

    return async (request, response) => {
        try {
            const url = new URL(
                request.url,
                'http://localhost'
            );

            if (url.pathname.startsWith('/api/')) {
                return await api(request, response, url);
            }

            if (
                request.method !== 'GET' &&
                request.method !== 'HEAD'
            ) {
                response.writeHead(405);
                return response.end('Método não permitido.');
            }

            const requested = url.pathname === '/'
                ? 'index.html'
                : decodeURIComponent(url.pathname.slice(1));

            const filePath = path.resolve(
                publicDir,
                requested
            );

            if (
                !filePath.startsWith(
                    path.resolve(publicDir) + path.sep
                )
            ) {
                response.writeHead(403);
                return response.end('Acesso negado.');
            }

            if (
                !fs.existsSync(filePath) ||
                !fs.statSync(filePath).isFile()
            ) {
                response.writeHead(404);
                return response.end('Arquivo não encontrado.');
            }

            response.writeHead(200, {
                'Content-Type':
                    MIME_TYPES[path.extname(filePath)] ||
                    'application/octet-stream',
                'Cache-Control': 'no-cache'
            });

            if (request.method === 'HEAD') {
                return response.end();
            }

            fs.createReadStream(filePath).pipe(response);

        } catch (error) {
            if (!response.headersSent) {
                response.writeHead(500, {
                    'Content-Type':
                        'application/json; charset=utf-8'
                });
            }

            response.end(
                JSON.stringify({
                    error: error.message || 'Erro interno.'
                })
            );
        }
    };
}

module.exports = { createHandler };