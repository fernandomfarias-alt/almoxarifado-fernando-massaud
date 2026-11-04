const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(
        password,
        salt,
        64
    ).toString('hex');

    return {
        salt,
        passwordHash: hash
    };
}

function createInitialData() {
    const admin = hashPassword('admin123');
    const operator = hashPassword('operador123');

    return {
        users: [
            {
                id: 'u-admin',
                name: 'Administrador',
                email: 'admin@almox.local',
                role: 'ADMINISTRADOR',
                ...admin,
                createdAt: new Date().toISOString()
            },
            {
                id: 'u-operator',
                name: 'Operador',
                email: 'operador@almox.local',
                role: 'OPERADOR',
                ...operator,
                createdAt: new Date().toISOString()
            }
        ],

        products: [],
        movements: []
    };
}

class FileRepository {
    constructor(filePath) {
        this.filePath = filePath;

        fs.mkdirSync(
            path.dirname(filePath),
            { recursive: true }
        );

        if (!fs.existsSync(filePath)) {
            this.write(createInitialData());
        }
    }

    read() {
        try {
            return JSON.parse(
                fs.readFileSync(this.filePath, 'utf8')
            );
        } catch (error) {
            throw new Error(
                `Erro ao ler os dados: ${error.message}`
            );
        }
    }

    write(data) {
        const temporaryFile = `${this.filePath}.tmp`;

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 2)
        );

        fs.renameSync(temporaryFile, this.filePath);
    }

    update(callback) {
        const data = this.read();

        const result = callback(data);

        this.write(data);

        return result;
    }
}

module.exports = {
    FileRepository,
    hashPassword
};