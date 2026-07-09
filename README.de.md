# AI Journal

Lokale Web-App zum Durchsuchen und Nachverfolgen deiner Claude-Code- und Codex-Konversationshistorie. Liest JSONL-Sitzungsdateien direkt aus `~/.claude/projects/` oder `~/.codex/sessions/`.

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
- **Inline-Bilder** — In Nachrichten eingebettete Bilder (base64 oder URL) werden direkt angezeigt; Klick zum Vergrößern
- **Bild-Lightbox** — Vollbild-Overlay mit Hintergrundunschärfe; schließen mit `Esc` oder Klick außerhalb
- **Slash-Befehlsanzeige** — `/Befehl`-Nachrichten werden als stilisierte Chips statt als rohem XML angezeigt
- **Lokale Befehlsausgabe** — Shell-Ausgabeblöcke werden im Terminal-Stil angezeigt; ausführliche Hinweise sind einklappbar
- **Dauerhafte Filterleiste** — Filtereinstellungen (Denken, Tools, Nutzer-/Claude-Nachrichten) bleiben beim Sessionwechsel erhalten
- **Sitzungsgedächtnis** — Die zuletzt besuchte Sitzung wird beim Neuladen über URL-Parameter wiederhergestellt
- **Teilbare URLs** — URL kopieren, um die genaue Sitzung und Scrollposition zu teilen oder zu speichern (`?p=&s=&scroll=`)
- **Nach oben** — Ein schwebendes Button erscheint bei tiefem Scrollen; ein Klick springt zurück nach oben
- **PWA** — Auf Desktop oder Startbildschirm installierbar; automatische stille Updates bei neuen Versionen

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

Alle Daten bleiben auf deinem Rechner. Die App liest Sitzungsdateien direkt über die File System Access API des Browsers; es wird nichts hochgeladen.

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

Jede `.jsonl`-Datei entspricht einer Sitzung und enthält den Nachrichtenverlauf sowie verfügbare Token-Nutzungsdaten.

## Tastaturkürzel

| Kürzel | Aktion |
|--------|--------|
| `⌘K` | Volltextsuche öffnen |
| `⌘\` | Seitenleiste ein-/ausblenden |
| `Esc` | Suche / Lightbox schließen |
