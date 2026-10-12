# TFH-Glossar

Begriffe der bestätigten TFH-Integration. Die Ergebnisse stammen aus der Quelle und werden im Stattracker archiviert.

| Begriff | Bedeutung |
| --- | --- |
| TFH | Trackmania For Hours, Veranstalter bzw. Veranstaltungsreihe der untersuchten Rennen. |
| Ausgabe | Ein konkretes Rennen, etwa „TFH 24h #4“ oder „TFH 12h RPG #2“, mit eigenem Datum und Teilnehmerfeld. |
| Teamteilnahme | Ein für eine Ausgabe gemeldetes Team mit Name, Tag und Spielerbesetzung. B2-Teamteilnahmen werden jeweils als eigenes Turnier-Lineup mit damaligem Namen und damaliger Besetzung abgebildet. |
| Gesamtwertung | Platzierungen und Checkpoint-Ergebnisse aller Teams einer Ausgabe; wird für das vollständige Teilnehmerfeld archiviert. |
| Checkpoints (CP) | Von der Quelle ausgewiesene passierte Checkpoints pro Team oder Spieler. |
| Checkpoints pro Minute (CPM) | Von TFH ausgewiesene Rate pro Spieler. Werte kleiner oder gleich null gelten wie auf der TFH-Seite als fehlend. Kein direkter Leistungsvergleich über verschiedene Strecken. |
| Fahrzeit | Von TFH in `CalculatedTotalPlayTime` ausgewiesene Spielzeit eines Spielers in Sekunden. Wird übernommen und nicht aus Rundenabschlüssen neu berechnet. |
| Rundenabschluss | Ein Eintrag in `Finishes` mit Zeitstempel, Zeit in Millisekunden, Rang und unverändert gespeichertem Typ. Keine vollständige Aufzeichnung von Fahrerwechseln oder Stints. |
| Account-ID | Trackmania-Account-UUID eines Spielers; Schlüssel für automatische Zuordnung zu bekannten Spielern. Unbekannte IDs werden vor dem Speichern zugeordnet. |
| Checkpoint-Splits | Kumulative Zeiten einer Runde in Millisekunden; der letzte Split liefert wie auf TFH die beste bzw. durchschnittliche Rundenzeit. |
| Importvorschau | Vollständig geladener Datenstand, den ein Admin vor dem Speichern prüft. Gilt 30 Minuten und wird beim Bestätigen unverändert als Ergebnisquelle verwendet. |
| Importrevision | Versionsnummer eines archivierten Rennens. Eine ältere Vorschau kann nach einem zwischenzeitlichen Import nicht mehr bestätigt werden. |
