# Privates App-Feedback aus Discord

Felix hat am 24.10.2026 die Umsetzung und nach dem Dev-Start die Aktivierung in Production bestätigt.

Unter **Accounts → App feedback** können ausschließlich Konten mit der globalen Rolle `ADMIN` die
Rückmeldungen sehen, nach Status filtern und auf **Open / In progress / Done** setzen. Auch direkte
API-Aufrufe sind auf diese Rolle beschränkt. Die Liste lädt 50 Einträge pro Seite; ältere Einträge
sind über „Older submissions“ erreichbar.

Ein Admin trägt dort die ID des gewünschten Discord-Textchannels ein (Discord: Entwicklermodus,
Rechtsklick auf Channel → ID kopieren) und klickt **Set up feedback message**. Der Bot braucht dort
Channelzugriff, Nachrichtenhistorie und das Recht, Nachrichten zu senden. Der Channel sollte für
Mitglieder lesbar sein; normale Nachrichten können bei Bedarf über die Channelrechte gesperrt werden.
Nach dem Einrichten kann die bestehende Nachricht aktualisiert werden. Die Channelbindung bleibt
bestehen; sie wird nicht durch erneutes Einrichten in einem anderen Channel ersetzt.

Die Bot-Nachricht erklärt, dass Name und Inhalt für die App-Admins gespeichert werden:

- **Feedback abgeben** öffnet eine nur dem Absender sichtbare Kategorieauswahl (Fehler, Verbesserung,
  Sonstiges), dann ein Formular mit Kurzbeschreibung und Details.
- Erst nach erfolgreichem Speichern bestätigt der Bot den Eingang, ebenfalls nur für den Absender.
- **Mein Feedback** listet nur eigene Rückmeldungen mit Status, fünf pro Seite und gekürzten Details.
  „Weitere“ blättert, „Neueste / aktualisieren“ lädt den aktuellen Stand.

Keine Rückmeldung wird öffentlich im Discord-Channel gepostet. Die privaten Bot-Antworten sind
vergänglich; dauerhaft gespeichert wird in PostgreSQL (`AppFeedback`). Eine Stattracker-Anmeldung
oder Verknüpfung des Discord-Kontos ist zum Abgeben nicht nötig. Gespeichert werden Discord-Nutzer-ID,
Anzeigename, Server und Channel, Kategorie, Titel, Text und Zeitpunkte. Es gibt keine automatische
Löschung und keine automatische Nachricht an den Absender bei Statusänderungen.

## Verbindung und Betrieb

Der Bot-Code liegt in `../b2-member/src/feedback.js`. Seine bestehende interne API bietet zusätzlich
`POST /feedback/panel` an, geschützt durch `DISCORD_BOT_API_TOKEN`. Der Bot schreibt über
`FEEDBACK_API_URL` an den exakten App-Endpunkt `/api/internal/feedback`, mit demselben Bearer-Token.
Der Endpunkt ist von der Browseranmeldung ausgenommen, prüft aber selbst Token und konfigurierte
Server-/Channelbindung. Discord-Interaction-IDs deduplizieren wiederholte Zustellungen. Für „Mein
Feedback“ setzt ausschließlich der Bot die Nutzer-ID aus der authentifizierten Discord-Interaktion.

Schalter:

- App und Bot: `APP_FEEDBACK=on`.
- Bot: `FEEDBACK_API_URL` mit vollständigem Base-Path und `FEEDBACK_NAMESPACE` (in Dev
  `stattracker-dev`). Verschiedene Umgebungen müssen unterschiedliche Namespaces verwenden,
  damit mehrere Bot-Verbindungen derselben Discord-App nicht dieselben Interaktionen beantworten.
- In `docker-compose.dev.yml` und `docker-compose.yml` eingeschaltet, mit getrennten Namespaces
  `stattracker-dev` und `stattracker-prod` und den jeweiligen internen API-Tokens. Der Bot braucht
  keine neuen Slash-Commands und kein Message-Content-Intent.

Die App legt die Tabellen beim normalen Dev-Start über `prisma db push` an. Zum Laden der neuen
Umgebungsvariablen müssen die Dev-App neu erstellt und der Dev-Bot neu gebaut und erstellt werden:

```sh
docker compose -f docker-compose.dev.yml up -d --build app discord-bot
```

Felix hat diesen Dev-Neustart am 24.10.2026 freigegeben; App und Bot wurden neu erstellt, die
Feedback-Tabellen in der Dev-Datenbank angelegt. Eine echte Discord-Nachricht entsteht erst beim
Einrichten im Adminbereich.

Nach Felix' Production-Freigabe am selben Tag wurden auch die Production-App und der Production-Bot
neu gebaut und gestartet. Die Tabellen sind dort angelegt; Bot-Verbindung, Token-Schutz und Login
wurden geprüft. Einstieg: **Accounts → App feedback** unter `/stats/admin/feedback`.
