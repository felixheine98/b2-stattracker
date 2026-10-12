# TFH-Archiv

Ein Admin öffnet in **Tournaments → Import TFH race** den Import. Die erste Version archiviert abgeschlossene Rennen; laufende Ausgaben werden abgewiesen.

1. Eine TFH-URL einfügen oder unter **Historical B2 editions** eine bekannte Ausgabe wählen und **Load preview** drücken.
2. Die B2-Auswahl kontrollieren. Alle Teams werden mit Platzierung und Checkpoints archiviert, ausgewählte Teams zusätzlich mit Fahrerstatistiken. Nach einer geänderten Auswahl **Load details for selected teams** drücken.
3. Alle Fahrerzuordnungen prüfen. Bekannte Account-IDs sind vorausgewählt. Unbekannte Fahrer einem bestehenden Profil zuordnen oder mit Namen und bewusst gewähltem Status neu anlegen. Der Status gilt zunächst von Anfang an; spätere Änderungen können auf dem Profil datiert werden.
4. Bei einem bereits importierten Rennen die Änderungen prüfen. **Confirm and import race** bzw. **Confirm and update race** speichert den geprüften Vorschau-Stand gemeinsam.

Die Vorschau gilt 30 Minuten. Bei Ladefehlern oder zwischenzeitlichen Änderungen erneut laden; vorhandene Ergebnisse bleiben unverändert. Importierte Ergebniswerte lassen sich ausschließlich über einen erneuten Import ändern.

## Historische Ausgaben mit B2-Beteiligung

| Ausgabe | Teams insgesamt | B2-Vorschläge | Quelle |
| --- | ---: | ---: | --- |
| 24h Race #0 | 60 | 0 (von Hand: „Bavaria Two") | [TFH](https://trackmaniaforhours.com/event/24h/race/0/teams) |
| 24h Race #1 | 60 | 0 (von Hand: „Bavaria Two Gold", „Bavaria Two Silver") | [TFH](https://trackmaniaforhours.com/event/24h/race/1/teams) |
| 24h Race #2 | 159 | 4 | [TFH](https://trackmaniaforhours.com/event/24h/race/2/teams) |
| 24h Race #3 | 168 | 4 | [TFH](https://trackmaniaforhours.com/event/24h/race/3/teams) |
| 24h Race #4 | 188 | 6 | [TFH](https://trackmaniaforhours.com/event/24h/race/4/teams) |
| 12h RPG #1 | 150 | 6 | [TFH](https://trackmaniaforhours.com/event/12h/rpg/1/teams) |
| 12h RPG #2 | 169 | 5 | [TFH](https://trackmaniaforhours.com/event/12h/rpg/2/teams) |
| 12h RPG #3 | 189 | 6 | [TFH](https://trackmaniaforhours.com/event/12h/rpg/3/teams) |

## Anzeige

TFH-Ausgaben erscheinen in der gemeinsamen Turnierübersicht. Jede ausgewählte Teamteilnahme erhält ein eigenes historisches Lineup mit Links zu den Spielerprofilen. Die Rennseite zeigt Gesamtwertung, Fahrerkennzahlen und einzelne Rundenabschlüsse; breite Tabellen scrollen auf dem Handy mit fester erster Spalte.

Über den B2-Lineups steht auf der Rennseite das **B2 driver ranking**: alle Fahrer aller B2-Teams dieser Ausgabe in einer Tabelle, standardmäßig nach CPM, per Klick auf eine Spalte nach Checkpoints, Fahrzeit, bester oder durchschnittlicher Runde oder Abschlüssen. Fahrer mit gleichem Wert teilen sich den Rang, Fahrer ohne Wert stehen ohne Rang am Ende.

Unter **Tournaments → TFH driver totals** (`/tfh`) steht die Übersicht über alle Ausgaben. Sie zeigt pro Fahrer für jede Ausgabe eine eigene CPM-Spalte mit dem Rang unter den B2-Fahrern dieser Ausgabe, dazu gefahrene Ausgaben, Fahrzeit, Checkpoints und Abschlüsse. Sortiert ist standardmäßig nach dem CPM der neuesten Ausgabe; jede Spalte lässt sich per Klick sortieren. Ein über alle Ausgaben zusammengerechnetes CPM gibt es bewusst nicht, weil die Strecken je Ausgabe verschieden schnell sind. Rundenzeiten werden nur auf der Rennseite verglichen. 24h- und 12h-RPG-Rennen stehen dort standardmäßig getrennt, weil es verschiedene Fahrstile sind; der Schalter „24h and 12h apart" fasst sie zusammen. Fehlt bei einem Fahrer ein Quellwert, ist seine Summe mit * als unvollständig markiert.

Spielerprofile haben einen separaten **TFH endurance**-Abschnitt mit Anzahl der Ausgaben und gesamter bekannter Fahrzeit. Fehlen Fahrzeiten, wird die Zusammenfassung als unvollständig gekennzeichnet. CPM und Rundenzeiten werden je Rennen angezeigt; TFH zählt nicht in die bisherigen Round-Statistiken hinein.

Fahrzeiten kommen in Sekunden, Runden- und Checkpointzeiten in Millisekunden. Fehlende Kennzahlen erscheinen als **—**. Die genauen Typwerte der Rundenabschlüsse bleiben gespeichert, werden aber nicht interpretiert. Stints und Fahrerwechsel werden nicht aus den Abschlüssen abgeleitet.

## Prüfungen

Alle Befehle laufen im Dev-Container:

```sh
docker compose -f docker-compose.dev.yml exec app npm test
docker compose -f docker-compose.dev.yml exec app env TFH_DB_TESTS=1 npm test -- lib/tfh-db.test.ts
docker compose -f docker-compose.dev.yml exec app env TFH_LIVE_TESTS=1 npm test -- lib/tfh-live.test.ts
docker compose -f docker-compose.dev.yml exec app npx tsc --noEmit -p .
```

Die Datenbanktests verwenden ein temporäres PostgreSQL-Schema und entfernen es anschließend. Live-Tests lesen nur die öffentliche Quelle und sind im normalen Testlauf ausgeschaltet.

Die Schemaerweiterung liegt auch als Prisma-Migration vor. Dev wendet sie wie üblich beim App-Neustart per `db push` an. Produktion übernimmt das Schema beim Start des neu gebauten Images über den bestehenden Entrypoint; die Implementierung wurde ausschließlich in Dev angewendet.
