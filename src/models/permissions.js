const ROLES = Object.freeze({
    OPERATOR: 'OPERADOR',
    ADMIN: 'ADMINISTRADOR'
});

const PERMISSIONS = Object.freeze({
    [ROLES.OPERATOR]: [
        'consultar',
        'inserir',
        'atualizar'
    ],

    [ROLES.ADMIN]: [
        'consultar',
        'inserir',
        'atualizar',
        'excluir',
        'gerenciar_usuarios'
    ]
});

function can(role, permission) {
    return Boolean(
        PERMISSIONS[role]?.includes(permission)
    );
}

module.exports = {
    ROLES,
    PERMISSIONS,
    can
};