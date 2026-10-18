# Discord-Reaktionen in die Comp-Planung übernehmen

Stand: Am 18.10.2026 hat Felix Merge, Push und Deployment aller lokalen Arbeiten freigegeben. Webapp und Bot sind auf `main` zusammengeführt, gepusht und in Produktion gestartet. Die Formatregeln bleiben in Produktion ausgeschaltet.

## Bedienung

In einer offenen Comp-Planung sehen Admins und Manager unter „Availability“ den
Bereich „Import Discord reactions“. Der Nachrichtenlink wird manuell eingefügt.
„Fetch reactions“ fragt den Bot nach dem aktuellen Stand. Der Abruf allein verändert
weder die Planung noch Discord.

1. Für jedes tatsächlich vorhandene Emoji eine Planungsstufe oder „Ignore“ wählen.
   Mehrere Emojis dürfen dieselbe Stufe bedeuten. Eigene Server-Emojis werden mit
   Bild und Namen angezeigt, ihre Zuordnung bleibt über die Discord-Emoji-ID stabil.
   Zusätzliche Planungsstufen sind ebenfalls auswählbar.
2. Discord-Accounts ausdrücklich Spielern der Planung zuordnen oder ignorieren.
   Es gibt keinen automatischen Namensabgleich. Gäste zuerst zur Planung hinzufügen.
   Gespeicherte Account-Verknüpfungen werden bei weiteren Comps wiederverwendet;
   sie können für einen Abruf ignoriert, aber hier nicht einem anderen Spieler
   zugewiesen werden. Zwei Accounts für denselben Spieler werden abgewiesen.
3. Die Vorschau zeigt alte und neue Antworten. Mehrere Emojis mit derselben
   Bedeutung sind eindeutig; unterschiedliche Bedeutungen müssen aufgelöst oder
   übersprungen werden. Auch eindeutige Antworten können einzeln übersprungen werden.
4. „Apply … changes“ übernimmt ausschließlich die gezeigten Änderungen. Wer keine
   relevante Reaktion hat, behält seine Antwort. Notizen und Lineup-Varianten bleiben
   erhalten. „Save assignments“ speichert die Einstellungen auch ohne Antwortänderung.

Nachrichtenlink und Emoji-Zuordnung werden pro Comp gespeichert, Discord-IDs pro
Spieler. Account-Verknüpfungen und Einstellungen werden erst bei der Übernahme
gespeichert. Neue Emojis werden beim nächsten Abruf erneut zur Zuordnung angeboten.
Die Vorschau ist 15 Minuten gültig. Ändert jemand die Planung seit dem Abruf, ist
vor dem Speichern ein neuer Abruf notwendig. Spätere Discord-Reaktionen werden erst
beim nächsten manuellen Abruf berücksichtigt; es gibt keine Hintergrund-Synchronisation.

## Dev-Anbindung

Am 16.10.2026 in der laufenden Dev-App (`/stats-dev`) aktiviert. Die laufende Dev-Arbeitskopie verwendet nach der Freigabe vom 18.10.2026 `main`, einschließlich Discord-Import und ausschließlich in Dev aktivierten Formatregeln.

`docker-compose.dev.yml` startet einen eigenen Service `discord-bot` aus
`../b2-member/Dockerfile.reactions`. Er verwendet die vorhandene Discord-App,
registriert keine Commands und hat keine Handler für Mitglieder- oder
Nachrichtenänderungen. Der bisherige Member-Bot läuft unverändert weiter. Die API
ist ausschließlich im privaten Docker-Netz erreichbar und veröffentlicht keinen Port.
Die Member-Konfiguration ist nur lesend eingebunden.

Der zufällige gemeinsame `DISCORD_BOT_API_TOKEN` liegt ausschließlich in der lokalen,
nicht versionierten `.env` der Webapp. `DISCORD_BOT_ENV_FILE` (Standard:
`../b2-member/.env`) liefert die Discord-Zugangsdaten; `DISCORD_BOT_SOURCE` erlaubt
einen abweichenden Bot-Checkout. Start: `docker compose -f docker-compose.dev.yml
up -d --build app discord-bot`. Produktion erst nach ausdrücklicher Freigabe des
jeweiligen Deployments ändern.

Bot-Umgebung:

```dotenv
DISCORD_TOKEN=<Token der Discord-App für den Dev-Bot>
CLIENT_ID=<Discord-Anwendungs-ID>
GUILD_ID=<erlaubter Discord-Server>
DISCORD_BOT_API_TOKEN=<gemeinsamer langer zufälliger Schlüssel>
DISCORD_BOT_API_HOST=127.0.0.1
DISCORD_BOT_API_PORT=3080
```

Ohne `DISCORD_BOT_API_TOKEN` startet keine HTTP-Schnittstelle. Die voreingestellte
Loopback-Adresse ist aus einem anderen Container nicht erreichbar. Für Docker den
Bot über ein privates Netz erreichbar machen und die Bind-Adresse passend setzen.
Die Schnittstelle nicht öffentlich ohne TLS veröffentlichen. Für den Abruf benötigt
der Bot Zugriff auf den Channel und dessen Nachrichtenhistorie; zusätzliche Rechte
zur Rollen- oder Channel-Verwaltung sind für diese Funktion nicht nötig.

Webapp-Dev-Umgebung (URL in Compose gesetzt, Schlüssel aus der lokalen `.env`):

```dotenv
DISCORD_BOT_URL=http://discord-bot:3080
DISCORD_BOT_API_TOKEN=<derselbe Schlüssel wie beim Bot>
```

`AUTH_SECRET` signiert die Vorschau serverseitig und wird bereits von der App verwendet.
Die Prisma-Migration `20261015000000_add_discord_planning` ergänzt ausschließlich
`Player.discordUserId` mit Unique-Index und `Planning.discordSettings`.
Schemaänderungen zunächst ausschließlich in Dev anwenden. Beim Start einer eigenen
Dev-Instanz aus diesem Branch auf eine eigene Dev-Datenbank/-Kopie achten: ein
`db push` vom Main-basierten Schema darf keine Dev-Tabellen der Formatregeln entfernen.

## Produktionsanbindung

Die Freigabe vom 18.10.2026 umfasst das Produktionsdeployment. `docker-compose.yml`
startet einen eigenen lesenden `discord-bot` im Produktionsnetz. Die API hat keinen
veröffentlichten Host-Port. Die App verwendet `http://discord-bot:3080`; der separate
Schlüssel `DISCORD_BOT_PROD_API_TOKEN` liegt in der lokalen Webapp-`.env` und wird
in App und Bot als `DISCORD_BOT_API_TOKEN` übergeben. Discord-Zugangsdaten und
Member-Konfiguration kommen wie in Dev vom `b2-member`-Checkout, nur lesend.

Beide Compose-Dateien bauen den Bot standardmäßig aus `../b2-member` (`main`).
Der native Member-Directory-Service bleibt für seine bisherigen Funktionen zuständig.
Die Formatregeln bleiben auch nach dem Merge in Produktion immer ausgeschaltet;
`MATCH_RULES` wird in der Produktions-Compose-Datei nicht gesetzt.

## Schnittstelle

Der Bot stellt authentifiziert und nur lesend bereit:

```text
GET /reactions?guildId=…&channelId=…&messageId=…
Authorization: Bearer <DISCORD_BOT_API_TOKEN>
```

Er erlaubt nur `GUILD_ID`, lädt die Nachricht frisch, liest alle Seiten normaler
und Super-Reaktionen, entfernt Bots und liefert Emoji-Schlüssel sowie Discord-IDs
und Anzeigenamen. Ein Abruf kann zur gleichen Zeit laufen. Die Webapp greift nicht
direkt mit einem Discord-Token auf Discord zu.

Die Webapp-Route `/api/tournaments/[id]/planning/discord` erlaubt nur Admins und
Manager. `fetch` liefert einen signierten Schnappschuss, `apply` prüft Signatur,
Competition, Ablaufzeit, Planungsrevision, Stufen und Spielerzuordnung und speichert
atomar. Geschlossene Planungen lehnen beide Aktionen ab.

## Prüfstand

Unit-Tests decken die Emoji-Zuordnung, Konflikte, unveränderte Nichtantworten,
Account-Zuordnungen, signierte Vorschauen und Zugriffsrechte ab. Bot-Tests decken
Authentifizierung, Serverbeschränkung, eigene Emojis, Pagination und Super-Reaktionen ab.
Aktivierung geprüft: 419 Webapp-Tests und 14 Bot-Tests bestanden, Typecheck und
Lint der betroffenen Dateien bestanden. Am 18.10. wurden auch die bestehenden
Lint-Meldungen für den Hydration-Mount des Dialog-Portals und den CommonJS-Seed
gezielt konfiguriert; vollständiger Lint, Typecheck, 419 Webapp-Tests, 14 Bot-Tests
und Produktionsbuild sind grün.
Ein echter lesender Abruf der bestehenden Member-Verzeichnisnachricht lieferte HTTP
200 (ohne Reaktionen); die Verbindung aus der Webapp zum Bot und die Beschränkung
auf den erlaubten Server sind geprüft. Login und Dev-App sind erreichbar.
Die Browserprüfung erreicht die Login-Seite; eine angemeldete visuelle Prüfung auf
Desktop/Telefon sowie ein vollständiger Import eines Comp-Announcements mit
Reaktionen und Übernahme stehen noch aus. Es wurden keine Planungsantworten geändert.

Produktionsprüfung am 18.10.2026: App und Datenbank healthy, separater Reaktionsbot
läuft, nativer Member-Bot neu gestartet und angemeldet. Echter Discord-Leseabruf
aus dem Produktions-App-Container über die neue API: HTTP 200. Öffentliche
Login-Seite erreichbar, ursprüngliches B2-Logo und Favicon aktiv. Datenbanksicherung
und vorheriges Produktionsimage wurden vor dem Austausch aufbewahrt.
