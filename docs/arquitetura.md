# Arquitetura do Sistema de Almoxarifado

O sistema foi organizado em camadas para facilitar
a manutenção e a organização do código.

## Camadas utilizadas

### Models
Define os perfis e as permissões dos usuários.

### Repositories
Responsável por salvar e consultar os dados.

### Services
Contém as regras de negócio, como login,
cadastro de usuários e movimentações de estoque.

### Controllers
Recebe as solicitações e devolve as respostas
para o sistema.

### Routes
Organiza os caminhos e entrega os arquivos
da interface.

### Public
Contém HTML, CSS e JavaScript da interface.

### Tests
Contém os testes automatizados do sistema.

## Funcionamento de uma saída

1. O usuário informa o produto e a quantidade.
2. O sistema consulta o estoque.
3. Compara a quantidade solicitada com o saldo.
4. Se não houver saldo suficiente, bloqueia a operação.
5. Caso contrário, atualiza o estoque.
6. Registra data, horário e responsável.