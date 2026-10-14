# B2 Stattracker

Web-App für die Turnierplanung und Auswertung des Trackmania-Teams **B2 Esports**. Sie verbindet Spielerprofile, Lineups, Matches und Rundenstatistiken mit Importen aus CSV, eCircuitMania und dem TFH-Langstreckenarchiv.

Die Oberfläche ist auf Englisch und unterstützt Desktop und Handy. Die App läuft selbst gehostet mit Docker und PostgreSQL; eine separate Dev-Umgebung ermöglicht Änderungen vor der Übernahme in Produktion.

## Funktionen

- **Turniere und Matches:** mehrere B2-Lineups pro Competition, Abschnitte, Submatches, Formate, Runden und Ergebnisse.
- **Statistiken:** Team- und Fahrerwerte pro Turnier, Abschnitt, Match und Map, persönliche Bestzeiten, Platzierungen und Best Performer.
- **Spielerprofile:** Turnierhistorie, Lifetime-Statistiken, Auswertung nach Fahrstil sowie datierte Namens- und Statusänderungen.
- **Lineup Builder:** Verfügbarkeiten, gemeinsame Planung, Varianten und Übernahme der ausgewählten Lineups in eine Competition.
- **Gegnerverwaltung:** feste Teams, Competition-Lineups und Mixes, Logos, Fahrerzuordnungen und gemeinsame Matchhistorie.
- **Importe:** CSV-Matchdaten, eCircuitMania-Ergebnisse und abgeschlossene TFH-Rennen. CSV- und eCM-Vorschauen prüfen Angaben gegen das eingetragene Match und lassen Abweichungen bestätigen.
- **TFH-Archiv:** historische 24h-/12h-RPG-Rennen, Teamwertungen, B2-Fahrerrankings und Fahrerstatistiken je Ausgabe.
- **Accounts:** Rollen `ADMIN`, `MANAGER` und `PLAYER`, Passwortanmeldung, TOTP mit Recovery-Codes und Passkeys. Member und Trials können mit einem Login verknüpft werden. Statusänderungen entziehen den Zugang nicht automatisch; Accounts werden separat verwaltet. Admins müssen TOTP oder einen Passkey einrichten.
- **Oberfläche:** globale Suche, mobile Navigation, scrollbare Statistiktabellen und sechs Themes mit zusätzlicher Systemauswahl.

## Tech-Stack

| Bereich | Technologie |
| --- | --- |
| Anwendung und API | Next.js 16 (App Router, Route Handler, Standalone-Build) |
| Oberfläche | React 19, TypeScript 5, Tailwind CSS 4, Lucide Icons |
| Formulare und Validierung | React Hook Form, Zod |
| Datenbank | PostgreSQL 16, Prisma 6 |
| Authentifizierung | Auth.js / NextAuth 5 Beta, JWT-Sessions, bcrypt, SimpleWebAuthn |
| Imports | CSV-Verarbeitung, Cheerio für HTML-Quellen, trackmania.io-Anbindung |
| Tests und Codequalität | Vitest 4, ESLint 9, TypeScript |
| Betrieb | Node.js 24 in Docker, Docker Compose, nginx als Reverse Proxy |

Die konkreten Abhängigkeiten stehen in [package.json](package.json) und [package-lock.json](package-lock.json).

## Entwicklung mit Docker

Voraussetzungen: Docker mit Compose-Plugin. Ein lokales Node.js ist für das Container-Setup nicht erforderlich.

### Konfiguration

Im Projektverzeichnis eine `.env` anlegen. Beispiel für lokale Entwicklung:

```dotenv
POSTGRES_USER=stattracker
POSTGRES_PASSWORD=replace-with-a-database-password
POSTGRES_DB=stattracker
NEXTAUTH_SECRET=replace-with-a-random-secret
AUTH_URL=http://localhost:3052/api/auth
TMIO_USER_AGENT="B2 Stats (your-site.example; you@example.com)"
BASE_PATH=/b2-stats
DEV_BASE_PATH=/stats-dev
PORT=3050
DEV_PORT=3052
```

Einen zufälligen Wert für `NEXTAUTH_SECRET` kann `openssl rand -base64 32` erzeugen. `.env` wird nicht ins Repository aufgenommen.

| Variable | Bedeutung |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Zugangsdaten der jeweiligen Compose-Datenbank; `DATABASE_URL` wird daraus im Container gesetzt. |
| `NEXTAUTH_SECRET` | Wird als `AUTH_SECRET` an die App übergeben; auch für die Verschlüsselung der TOTP-Secrets verwendet. |
| `AUTH_URL` | Adresse der Authentifizierung auf dem verwendeten Host. Für Passkeys sind Host und Origin dieser URL maßgeblich. Beim Hosting auf einer Domain eine passende HTTPS-URL setzen. |
| `TMIO_USER_AGENT` | Kennung für trackmania.io mit App-Name, Website und Kontakt. |
| `BASE_PATH` | Produktionspfad, standardmäßig `/b2-stats`; wird beim Image-Build festgelegt. |
| `DEV_BASE_PATH` | Dev-Pfad, standardmäßig `/stats-dev`. |
| `PORT`, `DEV_PORT` | Host-Ports, standardmäßig `3050` und `3052`; beide sind an `127.0.0.1` gebunden. |

### Dev starten

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Mit den Standardwerten ist Dev unter **http://localhost:3052/stats-dev** erreichbar. Der Quellcode ist eingebunden; `next dev` lädt Änderungen automatisch. Abhängigkeiten liegen in einem eigenen Docker-Volume.

Beim Start installiert der Dev-Entrypoint die Abhängigkeiten, generiert Prisma Client, führt die Comp-Style-SQL-Migration aus, synchronisiert das Schema mit `prisma db push` und startet den Seed.

Eine leere Datenbank erhält den B2-Spielerbestand und Startkonten aus [prisma/seed.js](prisma/seed.js). Das Admin-Konto heißt `shoffy`; initial entsprechen die Passwörter den Benutzernamen. Vor öffentlicher Nutzung die Passwörter ändern und die Admin-Anmeldesicherheit einrichten. Weitere Accounts werden in der App verwaltet.

Dev verwendet eine eigene Datenbank. Ein frisches Setup erzeugt die Seed-Daten; eine Kopie der Produktionsdaten muss separat eingespielt werden.

### Tests und Prüfungen

Die Prüfungen laufen im Dev-Container, dessen Node-Version auch Vitest unterstützt:

```bash
docker compose -f docker-compose.dev.yml exec app npm test
docker compose -f docker-compose.dev.yml exec app npx tsc --noEmit -p .
docker compose -f docker-compose.dev.yml exec app npm run lint
```

Datenbank- und Live-Tests sind im normalen Testlauf ausgeschaltet. Sie lassen sich einzeln aktivieren:

```bash
# API-Route-Tests mit PostgreSQL
docker compose -f docker-compose.dev.yml exec app env DB_TESTS=1 npm test

# Gegnerverwaltung mit PostgreSQL
docker compose -f docker-compose.dev.yml exec app env OPPONENT_DB_TESTS=1 npm test

# TFH-Archiv mit PostgreSQL
docker compose -f docker-compose.dev.yml exec app env TFH_DB_TESTS=1 npm test

# TFH-Tests gegen die öffentliche Quelle
docker compose -f docker-compose.dev.yml exec app env TFH_LIVE_TESTS=1 npm test
```

Datenbanktests legen temporäre Schemas in der Dev-Datenbank an und entfernen diese anschließend. Logiktests liegen als `*.test.ts` direkt neben den Modulen in `lib/`; Route-Tests neben den API-Routen.

Schemaänderungen werden in Dev beim App-Neustart angewendet:

```bash
docker compose -f docker-compose.dev.yml restart app
```

## Produktion

Die Produktion läuft mit [docker-compose.yml](docker-compose.yml) als gebautes Image. Für den Produktionshost `AUTH_URL` und `BASE_PATH` passend konfigurieren. Eine Änderung am Basispfad erfordert einen neuen Build.

**Änderungen werden zuerst in Dev geprüft. Ein Produktionsbuild erfolgt jeweils erst nach Felix' Freigabe der aktuellen Änderungen.**

Nach der Freigabe:

```bash
docker compose up -d --build
docker compose ps
```

Mit den Standardwerten antwortet die App unter `http://127.0.0.1:3050/b2-stats`. Für öffentliche Nutzung leitet nginx den konfigurierten Pfad an diesen Port weiter und stellt HTTPS bereit. Eine Beispielkonfiguration für die Website und `/stats` liegt unter [landing/nginx/](landing/nginx/b2-esports.com.conf); die Einrichtung ist in [landing/README.md](landing/README.md) beschrieben.

Der Produktions-Entrypoint führt beim Start ebenfalls die Comp-Style-SQL-Migration, `prisma db push` und den Seed aus. `db push` verwendet dort derzeit `--accept-data-loss`; vor Deployments mit Schemaänderungen die Änderungen prüfen und die Datenbank sichern. PostgreSQL-Daten bleiben im Compose-Volume erhalten.

Das **orange Logo und Favicon sind ausschließlich Dev-Marker** (`NODE_ENV=development`). Produktionsbuilds verwenden die originalen B2-Assets.

## Projektstruktur

```text
app/          Seiten, Layouts und API-Routen
components/   UI, Navigation, Planung und Statistikanzeigen
lib/          Berechnungen, Imports, Authentifizierung und Datenbankzugriff
prisma/       Datenmodell, Migrationen und Seed
public/       Logos, Icons und weitere statische Assets
docs/         Bedienung, Konzepte, Glossare und Architekturentscheidungen
landing/      Statische Team-Website und nginx-Beispielkonfiguration
```

## Weitere Dokumentation

- [Offene Aufgaben und erledigte Änderungen](todos.md)
- [Ideensammlung](ideen.md)
- [TFH-Import und Auswertungen](docs/tfh-import.md)
- [Gegnerverwaltung](docs/gegner-db.md)
- [Importvalidierung](docs/adr/004-import-validierung.md)
- [Competition-Fahrstile](docs/adr/002-comp-styles.md)
- [Seitenbreite und responsive Layouts](docs/adr/003-seitenbreite.md)
- [Beitrags- und Arbeitsregeln für Coding-Agenten](AGENTS.md)
