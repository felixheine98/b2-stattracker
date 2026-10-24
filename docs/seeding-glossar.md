# Glossar: Seeding

Begriffe aus [ADR 010](adr/010-seeding-formate.md). Stand: Entwurf, im Interview.

- **Seeding**: die Qualifikation einer Comp vor der Gruppenphase; ihr Ergebnis bestimmt, in welche Liga oder Gruppe ein Team kommt. In der App die Stage `SEEDING`.
- **Seeding-Typ**: ein im Code eingeführtes Seeding-Format mit seiner Art der Wertung, z. B. „EMC“; eine Comp wählt einen Typ und kann dessen Zahlen ändern.
- **Seeding-Format**: die Regeln, nach denen eine Comp ihr Seeding spielt und wertet (Modus, Maps, Sessions, welche Ergebnisse zählen). Jede Comp hat ihr eigenes; eingeführt wird zuerst das der EMC.
- **Session** (EMC): ein Server-Durchgang von 10 Runden im Rounds-Modus auf einer Map, mit je einem Spieler jedes Teams. Zu einem Zeitfenster laufen zwei Sessions parallel (zwei Server).
- **Zeitfenster** (EMC): 18:00 und 18:30 für Map 1, 19:00 und 19:30 für Map 2 (CET).
- **Fahrt**: ein Spieler von uns in einer Session, also Map + Zeitfenster + Server. In der App ein Sub-Match des Seeding-Matches. Ein Lineup hat bei der EMC 8 Fahrten, 4 je Map; ein Spieler darf dieselbe Map nicht zweimal fahren.
- **Seeding-Match**: das eine Match eines Lineups in der Stage `SEEDING`; seine Seite ist die Gesamttabelle des Lineups.
- **Score** (EMC): das Ergebnis eines Spielers in einer Session: die Summe seiner Punkte über die Runden, nach der Punkteverteilung berechnet; ohne Runden als Endstand eingetragen.
- **Punkteverteilung**: Punkte je Platz in einer Runde, pro Seeding-Format eingestellt (vorbelegt 10, 6, 4, 3, 2, 1, danach 0; DNF 0). *Ungeklärt:* die tatsächliche Verteilung der EMC.
- **Teamsumme**: die Summe der 3 besten Scores je Map über beide Maps; von der App gerechnet.
- **Qualifying-Ranking** (EMC): die offizielle Rangliste der Teams aus der Teamsumme, mit Platz und zugewiesener Liga. Die App kennt die anderen Teams nicht; Platz und Liga werden eingetragen.
