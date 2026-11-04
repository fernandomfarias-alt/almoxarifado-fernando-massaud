const crypto = require('node:crypto');
const { hashPassword } = require('../repositories/fileRepository');

function safeUser(user) {
    if (!user) return null;

    const {
        passwordHash,
        salt,
        ...publicUser
    } = user;

    return publicUser;
}

class AuthService {
    constructor(repository, sessions) {
        this.repository = repository;
        this.sessions = sessions;
    }

    login(email, password) {
        const data = this.repository.read();

        const user = data.users.find(item =>
            item.email.toLowerCase() ===
            String(email || '').toLowerCase()
        );

        if (!user || typeof password !== 'string') {
            return null;
        }

        const supplied = crypto.scryptSync(
            password,
            user.salt,
            64
        );

        const stored = Buffer.from(
            user.passwordHash,
            'hex'
        );

        if (
            supplied.length !== stored.length ||
            !crypto.timingSafeEqual(supplied, stored)
        ) {
            return null;
        }

        const token = crypto.randomBytes(32).toString('hex');

        this.sessions.set(token, user.id);

        return {
            token,
            user: safeUser(user)
        };
    }

    userFromToken(token) {
        if (!token) return null;

        const userId = this.sessions.get(token);

        if (!userId) return null;

        const user = this.repository.read().users.find(
            item => item.id === userId
        );

        if (!user) {
            this.sessions.delete(token);
            return null;
        }

        return safeUser(user);
    }

    logout(token) {
        if (token) {
            this.sessions.delete(token);
        }
    }

    createUser({ name, email, password, role }) {
        if (
            !name ||
            !email ||
            !password ||
            !['OPERADOR', 'ADMINISTRADOR'].includes(role)
        ) {
            return {
                error: 'Informe nome, e-mail, senha e perfil válidos.'
            };
        }

        if (String(password).length < 6) {
            return {
                error: 'A senha deve ter pelo menos 6 caracteres.'
            };
        }

        return this.repository.update(data => {
            if (
                data.users.some(user =>
                    user.email.toLowerCase() ===
                    String(email).toLowerCase()
                )
            ) {
                return {
                    error: 'Já existe um usuário com esse e-mail.'
                };
            }

            const credentials = hashPassword(password);

            const user = {
                id: crypto.randomUUID(),
                name: String(name).trim(),
                email: String(email).trim().toLowerCase(),
                role,
                ...credentials,
                createdAt: new Date().toISOString()
            };

            data.users.push(user);

            return {
                user: safeUser(user)
            };
        });
    }
}

module.exports = {
    AuthService,
    safeUser
};