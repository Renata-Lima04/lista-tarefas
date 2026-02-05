# Sistema Lista de Tarefas

Sistema web para cadastro e gerenciamento de tarefas, desenvolvido conforme as especificações do desafio proposto.

A aplicação permite criar, editar, excluir e reordenar tarefas, mantendo os dados persistidos em banco de dados.

---

## Funcionalidades

- Listagem de tarefas ordenadas pelo campo **ordem de apresentação**
- Inclusão de tarefas com os campos obrigatórios:
  - Nome da tarefa (sem duplicidade)
  - Custo (valor maior ou igual a zero)
  - Data-limite (data válida)
- Edição de tarefas (nome, custo e data-limite)
- Exclusão de tarefas com confirmação
- Destaque visual para tarefas com custo maior ou igual a **R$ 1.000,00**
- Reordenação de tarefas:
  - Botões **Subir** e **Descer**
  - Reordenação por **drag-and-drop** (arrastar e soltar)
- Exibição do **somatório dos custos** no rodapé da lista
- Dados persistidos em banco de dados

---

## Tecnologias Utilizadas

- **Node.js**
- **Express**
- **SQLite** (better-sqlite3)
- **HTML5**
- **CSS3**
- **JavaScript (Vanilla)**

---

## Padrões e Regras

- O campo **nome** não permite duplicidade
- O campo **custo** aceita apenas valores maiores ou iguais a zero
- O campo **data-limite** deve ser uma data válida
- A ordenação das tarefas é controlada internamente pelo sistema
- Datas anteriores ao dia atual não são permitidas na inclusão de tarefas
- O padrão de exibição segue o formato brasileiro

---

## Como Executar o Projeto Localmente

1. Clonar o repositório

git clone https://github.com/Renata-Lima04/lista-tarefas.git

2. Acessar a pasta do projeto
cd lista-tarefas

3. Instalar as dependências
npm install

4. Iniciar o servidor
npm start

5. Acessar no navegador
http://localhost:3000


Estrutura do Projeto
lista-tarefas/
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── src/
│   ├── db.js
│   └── server.js
├── tarefas.db
├── package.json
├── package-lock.json
└── README.md

Observações

O banco de dados utiliza SQLite, com persistência em arquivo local (tarefas.db)

Em ambientes de hospedagem gratuita, o arquivo do banco pode ser recriado em caso de reinicialização do serviço

O projeto foi desenvolvido com foco no funcionamento correto e aderência às especificações



Projeto desenvolvido por Renata Pereira Lima de Aguiar
Estudante de Análise e Desenvolvimento de Sistemas