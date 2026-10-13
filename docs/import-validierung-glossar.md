# Glossar: Import-Validierung

Begriffe aus [ADR 004](adr/004-import-validierung.md).

- **Import**: das Einlesen der Runden eines Matches aus einer Quelle, als CSV eines Match-Dumpers oder von der eCircuitMania-Seite (eCM). Der TFH-Import ist nicht gemeint.
- **Vorschau**: der Dialog, der zeigt, was ein Import speichern würde, bevor er es tut. Dort erscheinen die Hinweise.
- **Eingetragenes Match**: das von Hand angelegte Match mit eigenem Lineup, Gegner, Datum und Sub-Matches, gegen das der Import geprüft wird.
- **Abweichung**: Der Import passt in einer geprüften Angabe (Gegner, eigenes Lineup, Datum) nicht zum eingetragenen Match.
- **Hinweis**: die Meldung einer Abweichung in der Vorschau. Ein Hinweis sperrt nicht, verlangt aber das Bestätigen.
- **Bestätigen**: die ausdrückliche Erklärung in der Vorschau, trotz Hinweisen zu importieren. Erst danach lässt sich speichern.
- **Angebot**: ein Vorschlag der Vorschau, eine Angabe des Matches aus dem Import zu übernehmen; bisher nur das Datum. Ein angenommenes Angebot behebt die Abweichung und braucht kein Bestätigen.
- **Eigener Fahrer / fremder Fahrer**: Fahrer im Import, die als unser Team markiert sind, und alle übrigen.
- **Kader**: die eingetragenen Spieler eines Lineups, beim eigenen Lineup wie beim Gegner-Lineup oder festen Team.
- **Bekannter Fahrer (eines Gegners)**: wer im Kader des Gegner-Lineups oder seines festen Teams steht oder in einem früheren Match gegen dieses Gegner-Lineup gefahren ist. Gilt nur innerhalb eines Turniers.
- **Notizzeile**: die Zeile, die ein Import trotz Hinweisen an die Notizen des Matches hängt und die der nächste Import ersetzt.
