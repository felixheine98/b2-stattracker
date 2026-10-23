# Discord-Reaktionen in die Comp-Planung übernehmen

Stand: Am 18.10.2026 hat Felix Merge, Push und Deployment aller lokalen Arbeiten freigegeben. Webapp und Bot sind auf `main` zusammengeführt, gepusht und in Produktion gestartet. Die Formatregeln bleiben in Produktion ausgeschaltet.

## Bedienung

Seit ADR 006 ([Entscheidung](adr/006-discord-konten.md)) werden Discord-Konten zentral
auf der Seite „Discord accounts“ (`/players/discord`, Knopf in der Spielerliste, nur
Admins und Manager) mit Spielern verknüpft. Sie zeigt die Server-Mitglieder mit den
Rollen Manager, Racing Team und Trial, auf Wunsch alle Mitglieder. Bei gleichem Namen
(Discord, Member-Verzeichnis, Namensverlauf) ist ein Spieler vorgeschlagen; verknüpft
wird erst nach Bestätigung, einzeln oder mit „Confirm all suggestions“. Konten, die nie
importiert werden sollen, werden als „Not a player“ markiert.

Im Bereich „Discord reactions“ einer offenen Comp-Planung:

1. Den Link zum Announcement einmal eintragen und „Fetch reactions“ wählen. Der Link
   wird beim ersten erfolgreichen Abruf gespeichert, danach genügt der Knopf.
2. Nur neue Emojis werden nach ihrer Bedeutung gefragt; jede Wahl wird sofort für diese
   Comp gespeichert. „Edit“ zeigt alle Emojis und den Link zum Ändern.
3. Verknüpfte Konten werden ohne Rückfrage zugeordnet. Reagierende Konten ohne
   Verknüpfung erscheinen mit Spielerauswahl (samt Vorschlag) oder „Not a player“;
   offen gelassen werden sie diesmal nicht importiert. Gäste zuerst zur Planung hinzufügen.
4. Die Vorschau zeigt nur Änderungen und Konflikte, darüber die Zusammenfassung.
   Änderungen lassen sich einzeln überspringen, Konflikte müssen aufgelöst werden.
   „Apply … changes“ übernimmt die Antworten und speichert neue Verknüpfungen und
   Markierungen. Wer keine relevante Reaktion hat, behält seine Antwort.

## Zeitpunkt der Reaktionen

Discord liefert zu einer Reaktion keinen Zeitstempel, weder beim Abruf noch im Gateway-Ereignis.
Der Bot schreibt deshalb den Moment mit, in dem er eine Reaktion eintreffen sieht (Gateway-Intent
`GuildMessageReactions`, Datei `reaction-times.json` im Volume `reaction_times`, Pfad über
`REACTION_TIMES_DIR`). Jede Nachricht in den Channels aus `REACTION_TIMES_CHANNELS` (Standard:
der Ankündigungs-Channel `940049796633341983`) wird ab ihrer ersten Reaktion erfasst, auch wenn
sie noch nie abgerufen wurde; jede andere Nachricht erst ab ihrem ersten Abruf. Davor
liegende Reaktionen haben keine Zeit (`trackedSince` im Snapshot: der spätere Zeitpunkt aus
Beobachtungsbeginn und Posting der Nachricht, in der Vorschau als Hinweis). Nachrichten, die
60 Tage niemand angefasst hat, vergisst der Bot beim Start. Wird eine Reaktion zurückgenommen,
vergisst der Bot ihre Zeit; eine neue Reaktion zählt ab dann. War der Bot zwischendurch
aus, fehlen die Zeiten dieser Phase.

Eine erfasste Nachricht, die keiner Comp zugewiesen ist, vergisst die App eine Woche nach Beginn der
Aufzeichnung (`trackedAt`): `instrumentation-node.ts` fragt eine Minute nach dem Start und danach
stündlich den Bot nach seiner Liste und lässt ihn die abgelaufenen Nachrichten entfernen. Zugewiesen
heißt: der Link steht bei einer Comp im Bereich „Discord reactions“. Lassen sich die Comps nicht
lesen, wird nichts entfernt. Von Hand entfernen geht jederzeit auf „Discord accounts“ unter
„Tracked messages“, wo auch steht, wann eine Nachricht verfällt.

Die Vorschau nennt pro Antwort die Zeit der letzten Reaktion dafür (bei Konflikten pro
Auswahl). „Apply“ speichert sie als `answeredAt` am Eintrag; Admins und Manager sehen sie in der
Planung in der Gruppen- und Listenansicht. Eine Antwort, die jemand von Hand setzt, löscht sie.
Beim Knopf „Fetch reactions“ steht unter „Last fetched“ außerdem der letzte erfolgreiche Abruf
mit Datum und Uhrzeit (Europe/Berlin), auch beim Bearbeiten des Announcement-Links.
Fehlt ein gespeicherter Abrufzeitpunkt, steht dort „No fetch time recorded“.

Die Vorschau ist 15 Minuten gültig. Ändert jemand die Antworten der Planung seit dem
Abruf, ist vor dem Speichern ein neuer Abruf notwendig; Link und Emoji-Zuordnung zu
speichern macht die Vorschau nicht ungültig. Es gibt keine Hintergrund-Synchronisation.

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
GET /members
Authorization: Bearer <DISCORD_BOT_API_TOKEN>
```

`/members` liefert die Mitglieder des konfigurierten Servers ohne Bots mit Teamrollen und
Namen aus dem Member-Verzeichnis. Der Reaktions-Bot meldet sich dafür mit dem Intent
`GuildMembers` an; die vollständige Abfrage läuft wegen Discords Gateway-Limit nur einmal,
danach hält Discord den Cache über Ereignisse aktuell.

Er erlaubt nur `GUILD_ID`, lädt die Nachricht frisch, liest alle Seiten normaler
und Super-Reaktionen, entfernt Bots und liefert Emoji-Schlüssel sowie Discord-IDs
und Anzeigenamen. Ein Abruf kann zur gleichen Zeit laufen. Die Webapp greift nicht
direkt mit einem Discord-Token auf Discord zu.

Die Webapp-Route `/api/tournaments/[id]/planning/discord` erlaubt nur Admins und
Manager. `fetch` liefert einen signierten Schnappschuss, `apply` prüft Signatur,
Competition, Ablaufzeit, Planungsrevision, Stufen und Spielerzuordnung und speichert
atomar. Geschlossene Planungen lehnen beide Aktionen ab.

## Rollout Discord-Konten (ADR 006)

Am 19.10.2026 nach Felix' Freigabe: Datenbanksicherung `~/backups/prod-before-discord-accounts-20261019-1230.sql.gz`,
vorherige Images als `b2-stattracker-app:before-discord-accounts` und
`b2-stattracker-discord-bot:before-discord-accounts` getaggt. Schemaänderung in Production
vorab gegen eine Kopie des Produktionsschemas geprüft: ausschließlich die neue Tabelle
`DiscordNonPlayer`. App healthy, `/members` aus dem Produktions-App-Container HTTP 200
(232 Mitglieder), 52 Verknüpfungen aus Dev über `tmId` übernommen, Login erreichbar.

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

## Matchday-Announcements (ADR 008, nur Dev)

Die Matchday-Planung (`/tournaments/[comp]/[lineup]/plan/[stage]`) hat über dem Kader einen
Bereich „Discord“, wenn die App einen Bot kennt (`DISCORD_BOT_URL`):

1. Einmal pro Lineup den Link zum Lineup-Channel eintragen (Channel oder eine Nachricht darin).
2. Wer den wöchentlichen Ping postet, erwähnt darin den Bot (oder seine Rolle). „Find announcement“
   listet diese Pings und hebt den vorgeschlagenen hervor; „Use this“ ordnet ihn dem Match Day zu.
3. „Fetch reactions“, Emojis auf Fix/Partly/Maybe/Out oder Ignore setzen (pro Match Day gespeichert),
   Vorschau prüfen, „Apply“. Nur verknüpfte Konten des Kaders werden übernommen; nicht verknüpfte
   erscheinen als Hinweis, verknüpfen bleibt bei Admins und Managern („Discord accounts“).

Route: `/api/tournaments/[id]/lineups/[lineupId]/plan/[stageId]/discord` (Aktionen `channel`,
`announcements`, `choose`, `settings`, `fetch`, `apply`), für Lineup-Manager, Admins und Manager,
nur mit `MATCHDAY_PLANNING=on`. Der Bot braucht dafür `ANNOUNCEMENTS=on` (Intent `GuildMessages`,
nicht privilegiert) und Lesezugriff samt Nachrichtenhistorie auf die Lineup-Channels.
Migration `20261023010000_add_matchday_discord`: `TournamentLineup.discordChannelId`,
`MatchdayPlan.discordSettings`.
