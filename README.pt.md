# AI Journal

Aplicativo web local para navegar e revisar o histórico de conversas do Claude Code e do Codex. Lê arquivos JSONL diretamente de `~/.claude/projects/` ou `~/.codex/sessions/`.

**Idioma:** [简体中文](README.zh-CN.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | Português | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Interface principal](public/screenshot-main.png)

## Funcionalidades

- **Explorador de projetos e sessões** — Todos os projetos agrupados por diretório de trabalho, com histórico completo na barra lateral
- **Filtro da barra lateral** — Digite uma palavra-chave para filtrar projetos e sessões em tempo real; a contagem de correspondências é atualizada instantaneamente
- **Renderização de conversas** — Markdown completo, blocos de código com destaque de sintaxe (Shiki), tabelas GFM e listas de tarefas
- **Visualização de chamadas de ferramentas** — Mostra cada chamada de ferramenta feita pelo Claude (Bash, leitura/escrita de arquivos, etc.) e seu resultado
- **Blocos de pensamento** — Exibição recolhível do processo de raciocínio do Claude
- **Estatísticas de tokens** — Contagem de tokens de entrada / saída / cache e custo estimado por sessão
- **Pesquisa de texto completo** — `⌘K` para pesquisar em todas as sessões instantaneamente
- **Exportar para Markdown / Imagem** — Copie qualquer mensagem como Markdown ou captura de tela com um clique
- **Seletor de tema** — Tema claro, escuro ou do sistema com preferência persistente
- **Interface em 11 idiomas** — Detecta automaticamente o idioma do navegador; troca a qualquer momento pelo seletor
- **Imagens em linha** — Imagens incorporadas em mensagens (base64 ou URL) são renderizadas diretamente; clique para ampliar
- **Lightbox de imagens** — Sobreposição em tela cheia com desfoque de fundo; feche com `Esc` ou clicando fora
- **Exibição de comandos slash** — Mensagens `/comando` são exibidas como chips estilizados em vez de XML bruto
- **Saída de comandos locais** — Blocos de saída de shell exibidos em estilo de terminal; avisos detalhados são recolhíveis
- **Barra de filtros persistente** — Configurações de filtro (pensamento, ferramentas, mensagens usuário/Claude) mantidas ao trocar de sessão
- **Memória de sessão** — A última sessão visitada é restaurada ao recarregar via parâmetros URL
- **URLs compartilháveis** — Copie a URL para compartilhar ou favoritar a sessão e posição de rolagem exatas (`?p=&s=&scroll=`)
- **Voltar ao topo** — Botão flutuante aparece ao rolar muito para baixo; um clique volta ao início
- **PWA** — Instale na área de trabalho ou tela inicial; atualizações silenciosas automáticas ao implantar nova versão

![Interface de pesquisa](public/screenshot-search.png)

## Início rápido

**Pré-requisitos:** O [Claude Code](https://claude.ai/code) deve estar instalado e ter sido usado pelo menos uma vez para que `~/.claude/projects/` exista localmente.

```bash
# Clonar o repositório
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal

# Instalar dependências
pnpm install

# Iniciar o servidor de desenvolvimento
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) para navegar por todas as suas sessões do Claude Code.

## Stack tecnológico

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Next.js | 16 | Framework & API Routes |
| React | 19 | Interface do usuário |
| Tailwind CSS | v4 | Estilização |
| Shiki | v4 | Destaque de sintaxe de código |
| react-markdown | v10 | Renderização de Markdown |
| remark-gfm | v4 | Sintaxe GFM estendida |

## Fonte de dados

Todos os dados permanecem no seu computador. O app usa a File System Access API do navegador para ler arquivos de sessão diretamente; nada é enviado.

Claude Code:

```txt
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

Codex:

```txt
~/.codex/sessions/
  └── YYYY/MM/DD/
        ├── rollout-<timestamp>-<id>.jsonl
        └── ...
```

Cada arquivo `.jsonl` corresponde a uma sessão e contém o histórico de mensagens e o uso de tokens disponível.

## Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `⌘K` | Abrir pesquisa de texto completo |
| `⌘\` | Mostrar / ocultar barra lateral |
| `Esc` | Fechar pesquisa / lightbox |
