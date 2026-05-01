# Claude Journal

Aplicación web local para explorar y revisar el historial de conversaciones de Claude Code. Lee directamente los archivos JSONL de `~/.claude/projects/` — sin configuración.

**Idioma:** [简体中文](README.zh-CN.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Interfaz principal](public/screenshot-main.png)

## Funcionalidades

- **Explorador de proyectos y sesiones** — Todos los proyectos agrupados por directorio de trabajo, con historial completo en la barra lateral
- **Renderizado de conversaciones** — Markdown completo, bloques de código con resaltado de sintaxis (Shiki), tablas GFM y listas de tareas
- **Visualización de llamadas a herramientas** — Muestra cada llamada a herramienta que Claude realizó (Bash, lectura/escritura de archivos, etc.) y su resultado
- **Bloques de pensamiento** — Visualización plegable del proceso de razonamiento de Claude
- **Estadísticas de tokens** — Conteo de tokens de entrada / salida / caché y costo estimado por sesión
- **Búsqueda de texto completo** — `⌘K` para buscar en todas las sesiones al instante
- **Exportar a Markdown** — Copia cualquier conversación como Markdown con un clic

![Interfaz de búsqueda](public/screenshot-search.png)

## Inicio rápido

**Requisitos previos:** [Claude Code](https://claude.ai/code) debe estar instalado y haber sido usado al menos una vez, para que exista `~/.claude/projects/` localmente.

```bash
# Clonar el repositorio
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal

# Instalar dependencias
pnpm install

# Iniciar el servidor de desarrollo
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) para explorar todas tus sesiones de Claude Code.

## Stack tecnológico

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Next.js | 16 | Framework y API Routes |
| React | 19 | Interfaz de usuario |
| Tailwind CSS | v4 | Estilos |
| Shiki | v4 | Resaltado de sintaxis de código |
| react-markdown | v10 | Renderizado de Markdown |
| remark-gfm | v4 | Sintaxis extendida GFM |

## Fuente de datos

La app solo lee archivos locales — sin peticiones de red, sin datos subidos. Ruta de datos de sesión:

```
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

Cada archivo `.jsonl` corresponde a una sesión de Claude Code y contiene el historial completo de mensajes junto con el uso de tokens.

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `⌘K` | Abrir búsqueda de texto completo |
| `Esc` | Cerrar búsqueda |
