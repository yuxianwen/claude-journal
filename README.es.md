# AI Journal

Aplicación web local para explorar y revisar el historial de conversaciones de Claude Code y Codex. Lee directamente archivos JSONL desde `~/.claude/projects/` o `~/.codex/sessions/`.

**Idioma:** [简体中文](README.zh-CN.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Interfaz principal](public/screenshot-main.png)

## Funcionalidades

- **Explorador de proyectos y sesiones** — Todos los proyectos agrupados por directorio de trabajo, con historial completo en la barra lateral
- **Filtro de barra lateral** — Escribe una palabra clave para filtrar proyectos y sesiones al instante; el recuento de coincidencias se actualiza en tiempo real
- **Renderizado de conversaciones** — Markdown completo, bloques de código con resaltado de sintaxis (Shiki), tablas GFM y listas de tareas
- **Visualización de llamadas a herramientas** — Muestra cada llamada a herramienta que Claude realizó (Bash, lectura/escritura de archivos, etc.) y su resultado
- **Bloques de pensamiento** — Visualización plegable del proceso de razonamiento de Claude
- **Estadísticas de tokens** — Conteo de tokens de entrada / salida / caché y costo estimado por sesión
- **Búsqueda de texto completo** — `⌘K` para buscar en todas las sesiones al instante
- **Exportar a Markdown / Imagen** — Copia cualquier mensaje como Markdown o captura de pantalla con un clic
- **Selector de tema** — Tema claro, oscuro o del sistema con preferencia persistente
- **Interfaz en 11 idiomas** — Detecta automáticamente el idioma del navegador; cambia en cualquier momento desde el selector
- **Imágenes en línea** — Las imágenes incrustadas en mensajes (base64 o URL) se muestran directamente; haz clic para ampliar
- **Lightbox de imágenes** — Superposición a pantalla completa con desenfoque de fondo; cierra con `Esc` o clic fuera
- **Visualización de comandos slash** — Los mensajes `/comando` se muestran como chips con estilo en lugar de XML sin procesar
- **Salida de comandos locales** — Los bloques de salida de shell se muestran en estilo terminal; los avisos detallados son plegables
- **Barra de filtros persistente** — Los ajustes de filtro (pensamiento, herramientas, mensajes usuario/Claude) se mantienen al cambiar de sesión
- **Memoria de sesión** — La última sesión visitada se restaura al recargar mediante parámetros URL
- **URLs compartibles** — Copia la URL para compartir o marcar la sesión y posición de scroll exactas (`?p=&s=&scroll=`)
- **Volver arriba** — Aparece un botón flotante al bajar mucho; un clic vuelve al principio
- **PWA** — Instala en tu escritorio o pantalla de inicio; se actualiza silenciosamente al desplegar una nueva versión

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

Todos los datos permanecen en tu equipo. La app usa la File System Access API del navegador para leer archivos de sesión directamente; no se sube nada.

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

Cada archivo `.jsonl` corresponde a una sesión e incluye el historial de mensajes y el uso de tokens disponible.

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `⌘K` | Abrir búsqueda de texto completo |
| `⌘\` | Mostrar / ocultar barra lateral |
| `Esc` | Cerrar búsqueda / lightbox |
