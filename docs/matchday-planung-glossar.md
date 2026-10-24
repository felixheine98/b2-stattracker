# Glossar: Matchday-Planung

Begriffe aus [ADR 008](adr/008-matchday-planung.md).

- **Comp-Planung**: die bestehende Planung pro Comp: Verfügbarkeit, Varianten der Lineup-Aufteilung, Übernahme in die `TournamentLineup`s.
- **Match Day**: eine Stage der Gruppenphase (`GROUP`), z. B. „Match Day 2“. In der Matchday-Planung zählt auch eine Playoff-Stage als Match Day; das Seeding kommt dazu, mit einem Raster der Fahrten statt der Matches ([ADR 010](adr/010-seeding-formate.md), Entwurf).
- **Kader**: die Spieler eines Turnier-Lineups (`TournamentLineupSlot`), festgelegt durch die Comp-Planung.
- **Matchday-Planung**: die Planung eines Lineups für einen Match Day: wer antritt und wer in jedem Match welches Format fährt.
- **Geplantes Match**: ein vorab angelegtes Match ohne Sub-Matches und Ergebnis. Es wird zum gespielten Match, sobald Ergebnisse eingetragen oder importiert sind.
- **Matchday-Announcement**: der wöchentliche Ping im Discord-Channel eines Lineups, auf den Spieler mit Reaktionen ihre Verfügbarkeit für den Match Day angeben; gehört zu genau einem Lineup und Match Day und wird vom Bot erfasst wie das Comp-Announcement. Erkennbar daran, dass der Ping den Bot markiert.
- **Lineup-Channel**: der eigene Discord-Channel eines Turnier-Lineups.
- **Teilweise verfügbar**: Antwort auf das Matchday-Announcement für Spieler, die nur einen Teil der Matches können. Der Planer klärt die Details und trägt Ausnahmen pro Match von Hand ein.
- **Ausnahme**: die von Hand gesetzte Verfügbarkeit eines Spielers für ein einzelnes Match, abweichend von seiner Antwort für den Match Day.
- **Anwesende**: die Spieler des Kaders mit FIX oder „teilweise“ für den Match Day; sie stehen in der Planung oben. Darunter, abgesetzt und ebenfalls einteilbar: MAYBE und keine Antwort. OUT ist nicht einteilbar.
- **Tagesbesetzung**: die Formatbesetzung, die für alle Matches eines Match Days gilt, solange ein Match keine eigene hat.
- **Abweichende Besetzung**: die Formatbesetzung eines einzelnen Matches, die von der Tagesbesetzung abweicht, z. B. weil jemand nur einen Teil des Abends da ist.
- **Formatbesetzung**: wer in einem Match ein bestimmtes Format (Sub-Match) fährt; geplant als Vorstufe der `LineupSlot`s des Sub-Matches.
- **Variante**: ein vollständiger Plan eines Lineups für einen Match Day (Tagesbesetzung plus abweichende Besetzungen). Meist gibt es nur eine; weitere sind Alternativen. Nur für Lineup-Manager (und Admins/Manager) sichtbar.
- **Finalisieren**: ein Lineup-Manager bestätigt eine Variante; ihre Besetzung wird an den Matches des Match Days für alle sichtbar.
- **Veröffentlichter Stand**: die zuletzt finalisierte Besetzung, die Spieler an den Matches sehen. Spätere Änderungen in der Planung sind **unveröffentlichte Änderungen**, bis erneut finalisiert wird.
- **Planabweichung**: ein Format, in dem im Import andere eigene Fahrer stehen als in der finalisierten Besetzung. Reiner Hinweis in der Import-Vorschau, ohne Bestätigen.
- **Lineup-Manager**: ein Konto, das einem Turnier-Lineup zugeordnet ist (`TournamentLineupManager`) und dessen Matches pflegen darf.
