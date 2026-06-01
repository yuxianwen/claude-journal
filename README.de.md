# Claude Journal

Lokale Web-App zum Durchsuchen und Nachverfolgen deiner Claude Code Konversationshistorie. Liest JSONL-Sitzungsdateien direkt aus `~/.claude/projects/` — keine Konfiguration erforderlich.

**Sprache:** [简体中文](README.zh-CN.md) | [English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | Deutsch | [Português](README.pt.md) | [Русский](README.ru.md) | [العربية](README.ar.md) | [हिन्दी](README.hi.md)

![Hauptoberfläche](public/screenshot-main.png)

## Funktionen

- **Projekt- & Sitzungs-Browser** — Alle Projekte nach Arbeitsverzeichnis gruppiert, mit vollständigem Sitzungsverlauf in der Seitenleiste
- **Seitenleisten-Filter** — Schlüsselwort eingeben und Projekte/Sitzungen in Echtzeit filtern; Trefferanzahl wird sofort aktualisiert
- **Konversations-Rendering** — Vollständiges Markdown-Rendering, syntaxhervorgehobene Code-Blöcke (Shiki), GFM-Tabellen & Aufgabenlisten
- **Werkzeugaufruf-Visualisierung** — Jeder Werkzeugaufruf von Claude (Bash, Dateilesen/-schreiben usw.) und sein Ergebnis wird angezeigt
- **Denkblöcke** — Einklappbare Anzeige von Claudes Denkprozess
- **Token-Statistiken** — Anzahl der Eingabe-/Ausgabe-/Cache-Tokens und geschätzte Kosten pro Sitzung
- **Volltextsuche** — `⌘K` für sofortige sitzungsübergreifende Suche
- **Als Markdown / Bild exportieren** — Beliebige Nachricht als Markdown oder Screenshot mit einem Klick kopieren
- **Theme-Umschalter** — Helles, dunkles oder System-Theme mit gespeicherter Einstellung
- **11-sprachige Benutzeroberfläche** — Erkennt automatisch die Browser-Sprache; jederzeit über den Sprachauswähler wechselbar

![Suchoberfläche](public/screenshot-search.png)

## Schnellstart

**Voraussetzungen:** [Claude Code](https://claude.ai/code) muss installiert und mindestens einmal verwendet worden sein, damit `~/.claude/projects/` lokal vorhanden ist.

```bash
# Repository klonen
git clone https://github.com/yuxianwen/claude-journal.git
cd claude-journal

# Abhängigkeiten installieren
pnpm install

# Entwicklungsserver starten
pnpm dev
```

Öffne [http://localhost:3000](http://localhost:3000), um alle deine Claude Code Sitzungen zu durchsuchen.

## Tech-Stack

| Technologie | Version | Zweck |
|-------------|---------|-------|
| Next.js | 16 | Framework & API Routes |
| React | 19 | Benutzeroberfläche |
| Tailwind CSS | v4 | Styling |
| Shiki | v4 | Code-Syntaxhervorhebung |
| react-markdown | v10 | Markdown-Rendering |
| remark-gfm | v4 | Erweiterte GFM-Syntax |

## Datenquelle

Die App liest nur lokale Dateien — keine Netzwerkanfragen, keine hochgeladenen Daten. Pfad der Sitzungsdaten:

```
~/.claude/projects/
  └── <project-id>/
        ├── <session-id>.jsonl
        └── ...
```

Jede `.jsonl`-Datei entspricht einer Claude Code Sitzung und enthält den vollständigen Nachrichtenverlauf sowie die Token-Nutzung.

## Tastaturkürzel

| Kürzel | Aktion |
|--------|--------|
| `⌘K` | Volltextsuche öffnen |
| `⌘\` | Seitenleiste ein-/ausblenden |
| `Esc` | Suche schließen |
