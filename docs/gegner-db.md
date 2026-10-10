# Gegnerdatenbank

Unter **Gegner** können feste Teams und Competition-Lineups gepflegt werden. Ein Lineup kann ein Mix ohne festes Team sein. Geplanter Teamkader, geplanter Competition-Kader und tatsächlich gefahrene Runden bleiben getrennt.

## Bedienung

- **Bestehende Lineups zuordnen** verbindet bereits erfasste Competition-Teilnahmen mit einem festen Team. Die bisherigen Begegnungen erscheinen dadurch im Teamprofil; der damalige Kader und alle Rundenergebnisse bleiben erhalten.
- Ein festes Team liefert den Anfangskader für neue Competition-Lineups. Bestehende Lineups übernehmen spätere Teamänderungen erst über **Gegner bearbeiten → Teamkader abgleichen**.
- **In neuer Comp übernehmen** verbindet Teilnahmen und kopiert auf Wunsch den geplanten Kader. Die Historie kann verbundene Teilnahmen einbeziehen; Notizen bleiben bei ihrer jeweiligen Teilnahme.
- CSV-IDs bestätigen einen Account direkt. Namen aus eCM und dem Spreadsheet bleiben zunächst unbestätigt. **TM.io zuordnen** erlaubt die ausdrückliche Auswahl einzelner Einsätze über Competitions hinweg und optionaler Kadereinträge. Anonyme Gegner werden nicht als Personen erfasst. Gegner allein erscheinen nicht im eigenen Spielerpool.
- Matchdetails enthalten **Match bearbeiten** für Datum, Gegner und Notizen. **Match abschließen** schlägt ein Ergebnis vor, das bestätigt oder geändert werden kann. Geänderte Runden öffnen das Match wieder; frühere Bestätigungen bleiben nachvollziehbar. Ein veralteter Abschluss wird abgewiesen.
- Stats verwenden bestätigte IDs, trennen Formate und gruppieren Zeiten nach Competition und Mapname. Die Matchbilanz zählt nur abgeschlossene Matches; die Rundenbilanz wird aus Gegnersicht angezeigt. Anonyme und unbestätigte Personen tragen nicht zur personenbezogenen Statistik bei.

## Team-Spreadsheet

Die Quelle ist die [öffentliche Trackmania-Teamliste](https://docs.google.com/spreadsheets/d/1VRB3b8dS38T8CadWAu-SZj8A5BK7eEwA3jFb-O0Aufo/edit#gid=492976099).

**Teamliste** lädt eine Suchvorschau. Erst **Team übernehmen** speichert die gewählten Blöcke und Mitglieder. Weitere Gruppen, Academy oder Staff müssen ausdrücklich ausgewählt werden. Das Logo wird als eigene Bildkopie gespeichert. Gleichnamige bisher unzugeordnete Competition-Lineups werden in der Vorschau zur Zuordnung angeboten; die Auswahl kann abgewählt werden.

**Änderungen prüfen** lädt die Quelle erneut. Name, Logo und Kader werden einzeln bestätigt; bewusst abgewählte Personen bleiben abgewählt, neue Quellmitglieder werden angeboten. Lokale Ergänzungen können erhalten bleiben. Es gibt keinen Gesamtimport oder Hintergrundabgleich. Competition-Kader und historische Einsätze werden dabei nicht verändert.

## Rechte und Datenmodell

Admins und Manager können Gegner pflegen und Identitäten zuordnen. Verantwortliche eines eigenen Lineups können innerhalb der bestehenden Bearbeitungsfrist Gegner für ihre Competition pflegen. Globale Löschung und das Zusammenführen fester Teams bleiben Admins vorbehalten. Benutzte Lineups werden archiviert statt gelöscht.

`OpponentTeam` hält das feste Team, `OpponentLineup` die Teilnahme samt Notizen, Logoausnahme und optionaler Vorgängerteilnahme. Separate Slot-Tabellen halten die geplanten Kader. `OpponentIdentity` hält unbestätigte Namen und ausdrücklich zugeordnete Einsätze. Die gemeinsame `Player`-Identität verwendet `isOpponentOnly` zur Trennung vom eigenen Pool und `opponentNames` für historische Namen. `MatchConfirmation` hält bestätigte Ergebnisse und deren Revision.

## Migration und Validierung

Die neuen Migrationen sind:

- `20261010040000_add_opponents`: Tabellen, Matchabschluss und Übernahme bisheriger Gegnertexte pro Competition. Gleichnamige Texte verschiedener Competitions werden nicht automatisch zusammengeführt. Echte UUIDs werden bestehenden Spielern zugeordnet; reine Namen und anonyme Platzhalter bleiben getrennt.
- `20261010050000_add_opponent_player_aliases`: historische Gegnernamen bei bestätigten Personen.

Auf einer regulär migrierten Installation werden beide über `prisma migrate deploy` angewandt. Eine bisher mit `db push` betriebene Installation muss zuerst ihre bestehende Migrationshistorie korrekt abgleichen; die alten Migrationen dürfen dort nicht erneut blind ausgeführt werden.

Prüfungen im App-Container:

```sh
docker compose exec app npm test
docker compose exec -e OPPONENT_DB_TESTS=1 app npx vitest run lib/opponents.integration.test.ts
docker compose exec app npx tsc --noEmit -p .
docker compose exec app npm run build
```

Die opt-in PostgreSQL-Tests erzeugen eigene temporäre Schemas und entfernen diese anschließend. Sie prüfen unter anderem selektive Identitätszuordnung, Kollisionen, Kaderkopien, Matchrevisionen und die Bestandsmigration. Zusätzlich wurden die zentralen UI-Abläufe einschließlich manuellem Spreadsheet-Import mit kopiertem Logo und der Handyansicht im Browser geprüft.
