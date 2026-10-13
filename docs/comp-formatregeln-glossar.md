# Glossar: Formatregeln pro Comp

Begriffe aus [ADR 005](adr/005-comp-formatregeln.md).

- **Formatregeln**: die Angaben einer Comp dazu, wie ein Match abläuft und entschieden wird. Ein Regelsatz umfasst Format-Folge, Ablauf sowie „Rounds to win“ und „Max rounds“ je Format und die Punkte für Sieg, Unentschieden und Niederlage.
- **Format-Folge**: die Reihenfolge der Formate einer Comp (`Tournament.formats`), aus der beim Anlegen eines Matches die Sub-Matches entstehen.
- **Sub-Match**: ein Teil eines Matches in einem Format, in der Regel auf einer Map; in der Oberfläche auch „Map“.
- **Runde**: ein Durchgang eines Sub-Matches. Die Punkte der Plätze entscheiden, wer sie gewinnt; bei Punktgleichheit ist sie unentschieden und zählt für keine Seite.
- **Rounds to win**: die Zahl gewonnener Runden, mit der ein Sub-Match entschieden ist. Ein Wert pro Format innerhalb der Comp, ohne Vorbelegung.
- **Faustregel**: die heutige Bestimmung des Sub-Match-Siegers über „mehr Runden gewonnen“. Wird durch die Formatregeln ersetzt.
- **Vorschlag**: das Ergebnis eines Matches, wie es die App aus den Sub-Matches errechnet, bevor es beim Schließen bestätigt wird.
- **Hinweis**: die Meldung, dass Daten nicht zu den Formatregeln passen. Ein Hinweis sperrt nicht; beim Schließen des Matches muss er bestätigt werden, wie in ADR 004 beim Import.
- **Ablauf**: die Art, wie ein Match einer Comp entschieden wird; einer von „alle Sub-Matches“, „bis entschieden“ und „Entscheider bei Gleichstand“.
- **Entscheider**: das letzte Sub-Match der Format-Folge, das nur bei Gleichstand nach den übrigen gespielt wird.
- **Draw**: ein Match mit gleich vielen gewonnenen Sub-Matches auf beiden Seiten; nur im Ablauf „alle Sub-Matches“ ein gültiges Ergebnis, sobald alle gespielt sind (auch bei ungerader Zahl, wenn ein Sub-Match unentschieden endet).
- **Regelsatz**: die Formatregeln, die für einen Teil der Comp gelten. Jede neu angelegte Comp mit Format-Folge hat einen, bestehende erst nach dem Eintragen; das Playoff kann einen eigenen haben, sonst gilt der der Comp.
- **Max rounds**: die optionale Obergrenze der Rundenzahl eines Sub-Matches, pro Format innerhalb der Comp. Ist sie erreicht, gewinnt, wer mehr Runden gewonnen hat; bei Gleichstand ist das Sub-Match ein Draw. Unentschiedene Runden zählen mit.
- **Entschiedenes Sub-Match**: ein Sub-Match, in dem eine Seite „Rounds to win“ erreicht hat oder „Max rounds“ gespielt sind.
- **Unvollständiges Sub-Match**: ein Sub-Match mit Runden, das nicht entschieden ist. Es zählt trotzdem (Führender gewinnt, Gleichstand ist Draw) und trägt einen Hinweis.
- **Punkte**: die Wertung eines Matches nach seinem Ergebnis (Sieg, Unentschieden, Niederlage), drei Zahlen pro Regelsatz. Nur für Gruppen-Matches. Angezeigt am Match und als Summe pro Lineup; kein Punktestand gegen andere Teams.
- **Vorlage**: ein benannter, eigener Datensatz mit Format-Folge, Regelsatz und gegebenenfalls Playoff-Regelsatz, dessen Werte beim Anlegen in eine Comp kopiert werden. Comp und Vorlage sind danach unabhängig.
