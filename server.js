const http = require('node:http');
const path = require('node:path');
const { createHandler } = require('./src/routes');

function createServer(options = {}) {
    const root = __dirname;

    const dataFile = options.dataFile ||
        path.join(root, 'src', 'data', 'db.json');

    const publicDir = options.publicDir ||
        path.join(root, 'public');

    return http.createServer(
        createHandler({ dataFile, publicDir })
    );
}

if (require.main === module) {
    const port = Number(process.env.PORT || 3000);

    const server = createServer();

    server.listen(port, () => {
        console.log(
            `Sistema disponível em http://localhost:${port}`
        );
    });
}

module.exports = { createServer };