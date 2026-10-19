# Discord-Konten der Spieler hinterlegen und Import kompakter machen

Status: Akzeptiert – gemeinsames Verständnis von Felix am 19.10.2026 bestätigt, einschließlich der abgeleiteten Punkte. Umsetzung zuerst in Dev; Production, einschließlich der Übernahme der Dev-Verknüpfungen, erst nach ausdrücklicher Freigabe. Begriffe: [Glossar](../discord-konten-glossar.md). Grundlage: [Discord-Anbindung](../discord-planning.md).

## Kontext

Der Discord-Import der Comp-Planung (`components/planning/discord-import.tsx`) hat drei Schritte: Emojis zuordnen, Discord-Accounts Spielern zuordnen, Vorschau prüfen. Die Account-Zuordnung wird als `Player.discordUserId` gespeichert und bei späteren Comps wiederverwendet; Umbenennungen in Discord spielen danach keine Rolle mehr, weil nur die ID zählt. Der Aufwand entsteht beim ersten Mal und bei jedem neuen Account: Er muss von Hand zugeordnet werden, und zwar nur im Import einer konkreten Planung.

Stand der Daten am 19.10.2026: In Dev sind 41 von 62 eigenen Spielern verknüpft (aus Tests), in Production keiner. Der Member-Bot (`../b2-member/data/config.json`) führt 52 Discord-IDs mit Anzeigenamen (`names`) und Ländern, gepflegt über seine Commands. Diese Namen sind Kurznamen („Uso“, „Exo“, „Vex“) und stimmen nur bei 22 von 52 mit dem Spielernamen im Stattracker überein; für einen Namensabgleich taugen sie nicht. Alle 41 Dev-Verknüpfungen liegen im Member-Verzeichnis.

Der Reaktions-Bot (`Dockerfile.reactions`) meldet sich nur mit dem Intent `Guilds` an. Der Member-Bot derselben Discord-App nutzt bereits `GuildMembers` und lädt die Mitglieder mit ihren Rollen (Manager, Racing Team, Trial); der privilegierte Intent ist für die App also freigeschaltet.

## Entscheidung

Bestätigt (19.10.2026): Discord-Konten werden auf einer zentralen Seite „Discord accounts“ für Admins und Manager mit Spielern verknüpft, unabhängig von einer Comp. Der Bot liefert dafür die Mitglieder des Servers. Der Reaktionsimport fragt danach nur noch bei Konten, die noch nicht verknüpft sind.

Bestätigt (19.10.2026): Die Seite zeigt standardmäßig die Mitglieder mit den Rollen Manager, Racing Team oder Trial, jeweils mit ihrer Rolle. Ein Schalter „Show all server members“ blendet die übrigen Mitglieder ein (Gäste, frühere Mitglieder); Bots erscheinen nie. Der Reaktions-Bot bekommt dafür einen lesenden Endpunkt für die Mitgliederliste und den Intent `GuildMembers`.

Bestätigt (19.10.2026): Die 41 Verknüpfungen aus Dev werden beim Rollout einmalig nach Production übernommen. Felix prüft sie vorher auf der neuen Seite in Dev; geschrieben wird in Production erst nach seiner ausdrücklichen Freigabe. Eine dauerhafte Export-/Importfunktion gibt es nicht.

Bestätigt (19.10.2026): Für ein noch nicht verknüpftes Konto schlägt die Seite einen Spieler vor, wenn der Discord-Anzeigename, der Name im Member-Verzeichnis oder ein aktueller oder früherer Spielername ohne Rücksicht auf Groß- und Kleinschreibung übereinstimmt. Der Vorschlag ist vorausgewählt und als „Suggested“ markiert, wird aber erst gespeichert, wenn er bestätigt wird – einzeln oder über „Confirm all suggestions“. Ohne Bestätigung wird nie verknüpft. Den Namen aus dem Member-Verzeichnis liefert der Bot mit der Mitgliederliste.

Bestätigt (19.10.2026): Im Reaktionsimport erscheinen nur noch unbekannte Konten, also reagierende Konten ohne Verknüpfung, in einer kurzen Zeile („2 unlinked accounts reacted“) mit Spielerauswahl samt Vorschlag oder „Not a player“ (siehe unten). Eine dort gewählte Verknüpfung gilt dauerhaft wie auf der Seite „Discord accounts“. Verknüpfte Konten zeigt der Import nicht mehr. Gäste müssen wie bisher zuerst zur Planung hinzugefügt werden.

Bestätigt (19.10.2026): Ein Konto lässt sich dauerhaft als „Not a player“ markieren, im Import mit einem Klick oder auf der Seite „Discord accounts“. Der Import zeigt es danach nicht mehr; auf der Seite bleibt es sichtbar und lässt sich wieder freigeben oder verknüpfen. Ein einmaliges „Ignore“ gibt es nicht mehr.

Bestätigt (19.10.2026): Ein unbekanntes Konto, das im Import weder verknüpft noch als „Not a player“ markiert wird, blockiert die Übernahme nicht; seine Reaktionen werden für diesen Abruf nicht übernommen („not imported“), beim nächsten Abruf erscheint es wieder. Damit bleibt der Fall „Gast diesmal nicht importieren“ ohne eigene Schaltfläche lösbar.

Bestätigt (19.10.2026): Link zum Announcement und Emoji-Zuordnung bleiben pro Comp (`Planning.discordSettings`) und werden im Discord-Bereich der Planung gepflegt. Der Link wird gespeichert, sobald der erste Abruf gelingt, jede Emoji-Zuordnung sofort beim Wählen – nicht erst bei „Apply“. Danach ist der Bereich eine Zeile („Announcement ↗ · ✅ Fix · ❓ Maybe · ❌ Out · Edit“) mit „Fetch reactions“; neue Emojis fragt der Abruf nach. Eine gemeinsame Standard-Zuordnung über alle Comps gibt es nicht.

Bestätigt (19.10.2026): Die Vorschau zeigt nur Änderungen und Konflikte, je eine Zeile („UsoTM: Maybe → Fix“) mit Häkchen zum Überspringen; Konflikte bieten ihre Kandidaten in der Zeile an. Darüber eine Zusammenfassung („5 changes · 1 conflict · 12 unchanged · 3 without reaction“), die unveränderten Spieler lassen sich aufklappen. Übernommen wird mit „Apply 5 changes“; ohne Vorschau wird nie übernommen.

Bestätigt (19.10.2026): Die Seite liegt unter `/players/discord` und ist über einen Knopf „Discord accounts“ im Kopf der Spielerliste erreichbar, nur für Admins und Manager. Es gibt keinen eigenen Navigationseintrag. Der Discord-Bereich der Planung verweist bei unbekannten Konten auf die Seite.

Bestätigt (19.10.2026): Ein Spieler hat höchstens ein Discord-Konto. Ein neu verknüpftes Konto ersetzt nach Bestätigung das bisherige („replaces Siri's current account“); das alte gilt danach wieder als unverknüpft.

Bestätigt (19.10.2026), aus den Entscheidungen abgeleitet:

- Die Seite verknüpft nur mit vorhandenen Spielern; sie legt keine Spieler an. Mitglieder mit Teamrolle ohne passenden Spieler bleiben unverknüpft, bis der Spieler angelegt ist.
- Die Seite zeigt zusätzlich, welche eigenen Spieler (Member, Trial) noch kein Konto haben.
- Eine Verknüpfung lässt sich auf der Seite auch wieder lösen.
- Die Änderungen am Reaktions-Bot entstehen im Repository `b2-member`; Rollout wie immer zuerst in Dev, Production nach ausdrücklicher Freigabe.

## Erwogene Alternativen

- Feld „Discord account“ im Bearbeiten-Dialog des Spielers: passt zum Profil, ist für die Ersteinrichtung von rund 50 Spielern aber mühsam.
- Beides (Seite und Feld): mehr Oberfläche für denselben Zweck.
- Immer alle Server-Mitglieder zeigen: vollständig, aber unübersichtlich. Nur die drei Rollen ohne Schalter: Gäste ließen sich nicht vorab verknüpfen.
- Kein Vorschlag, nur durchsuchbare Auswahl: sicher, aber mehr Klicks. Automatisch verknüpfen bei gleichem Namen: zu riskant bei zufälligen Treffern („Agent“, „Rain“).
- Unbekannte Konten im Import übergehen und auf die Seite verweisen: zwingt zu einem zweiten Abruf. Den Import blockieren, bis alle zugeordnet sind: unnötig streng.
- „Ignore“ nur für einen Abruf: Konten, die nie fahren, erschienen bei jeder Comp wieder. „Ignore once“ und „Not a player“ nebeneinander: jede Zeile wird größer.
- Gemeinsame Emoji-Zuordnung für alle Comps: von Felix verworfen, die Zuordnung bleibt pro Comp. Link und Emojis im Dialog „Edit tournament“: Emojis sind erst aus den Reaktionen bekannt, Server-Emojis müssten eigens abgefragt werden.
- Ohne Vorschau sofort übernehmen, wenn es keine Konflikte gibt: bräuchte ein Undo, das es nicht gibt. Vorschau wie bisher mit allen Spielern: unnötig lang.
- Abschnitt auf „Accounts“ (`/admin`): Verwechslungsgefahr mit den App-Logins. Eigener Navigationseintrag: zu viel Gewicht für eine selten genutzte Seite.
- Mehrere Konten pro Spieler: eigene Kontentabelle und Konflikte zwischen den Konten eines Spielers für einen seltenen Fall.
- Keine eigene Pflege, nur Dev-Verknüpfungen übernehmen und den Import straffen: löst das Problem bei jedem neuen Mitglied nicht.

## Konsequenzen

- Das sofortige Speichern von Link und Emoji-Zuordnung darf die Planungsrevision nicht so erhöhen, dass eine laufende Vorschau ungültig wird; oder die Vorschau rechnet mit der neuen Zuordnung neu. *Umsetzung offen.*
- „Not a player“ braucht eine eigene Speicherung pro Discord-ID, unabhängig vom Spieler (neue Tabelle); die Verknüpfung bleibt `Player.discordUserId`.
- Die bisherige Regel aus der Discord-Anbindung, dass gespeicherte Verknüpfungen im Import nicht umgehängt werden können, wird durch die Seite ersetzt: Dort lässt sich eine Verknüpfung ändern.
- Der Reaktions-Bot braucht den Intent `GuildMembers` und einen Endpunkt für die Mitgliederliste mit Rollen und Namen aus dem Member-Verzeichnis.

## Offene Fragen

Keine.
