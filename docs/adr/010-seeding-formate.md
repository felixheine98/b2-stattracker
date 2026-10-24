# Seeding-Formate, zuerst das EMC-Seeding

Status: Entscheidungen 1–13 von Felix am 24.10.2026 bestätigt; gemeinsames Verständnis noch zu bestätigen, Umsetzung steht aus. Begriffe: [Glossar](../seeding-glossar.md)

## Kontext

Jede Comp hat ihr eigenes Seeding (Qualifikation vor der Gruppenphase). Es gibt so viele Varianten, dass jedes Seeding-Format einzeln eingeführt werden muss; begonnen wird mit **einem**, dem der EMC. Regeltext der EMC (vom 24.10.2026 eingebracht):

> a first series of qualifications will take place in rounds mode on map number 1. 2 servers will be open containing 1 player from each team per server. The same operation will be observed at 6:30 for map number 1 and at 7 and 7:30 p.m CET for map number 2. Each session will consist of 10 rounds. A player can't play twice the same map.
>
> Only the 3 best scores on each map will be kept. The sum of these results will give a qualifying ranking for each team that will be assigned a league thereafter.

Stand der App (nachgeschaut):

- Ein Turnier kann eine Stage `SEEDING` haben (`lib/stages.ts`). Ein Match in ihr ist ein Seeding-Match: kein Gegner, genau ein Sub-Match `TIME_ATTACK_10` (`app/api/tournaments/[id]/matches/route.ts`).
- Seeding-Matches zählen in keiner Statistik (Format-, Map-Stats, Dashboard, Profil); ihre Zahlen stehen nur auf der Match-Seite.
- In Production gibt es noch kein Seeding-Match. EMC S8 hat eine leere Seeding-Stage, EMC S7 keine.
- Runden im Rounds-Modus speichert die App schon pro Spieler mit Platz und Zeit (CSV- und ECM-Import). Einen Score über eine Session (Punkte über 10 Runden) kennt sie nicht.

## Entscheidung

Bestätigt (24.10.2026), Frage 1 – Ziel: Das EMC-Seeding wird vollständig eingeführt, in drei Teilen:

1. **Festhalten:** pro Spieler Map, Session und Score; die App rechnet daraus die Teamsumme (3 beste Scores je Map).
2. **Planung:** vorab aufteilen, wer welche Map in welcher Session fährt, unter der Regel „kein Spieler zweimal dieselbe Map“.
3. **Stats:** Seeding-Ergebnisse zählen in Spielerprofil und Stats (Bereich „Seeding“).

Empfohlen war nur Teil 1 als erster Schritt; Felix wählt alle drei. Die Reihenfolge der Umsetzung ist noch offen.

Bestätigt (24.10.2026), Frage 2 – Herkunft des Scores: beides. Wo es Runden gibt, werden sie wie bei Matches importiert (ECM-Seite oder CSV; laut Felix gibt es für das EMC-Seeding beides) oder eingetragen, und die App berechnet daraus den Score. Wo es nur den Endstand gibt (z. B. alte Seedings von Screenshots), wird nur der Score pro Spieler und Session eingetragen, wie die Summaries aus ADR 007. Nachgeschaut: Weder der ECM-Import (`lib/ecm.ts`) noch die CSV (`lib/match-csv.ts`) liefern Punkte, nur Reihenfolge und Zeiten; der Score muss also aus den Plätzen berechnet werden.

Bestätigt (24.10.2026), Frage 3 – Punkteverteilung: pro Seeding-Format einstellbar, als Liste von Punkten je Platz, vorbelegt mit der Trackmania-Standardverteilung für Rounds (10, 6, 4, 3, 2, 1, danach 0). DNF zählt 0. Welche Verteilung die EMC nutzt, ist noch unbekannt; sie wird an einem echten EMC-Seeding gegen den Endstand auf ECM geprüft.

Bestätigt (24.10.2026), Frage 4a – was es bei der EMC gibt: nur Endstände, keine Runden. Felix hat pro Spieler und Session den Score und das offizielle Qualifying-Ranking mit Platz und Liga. Beides wird festgehalten. Weg A aus Frage 2 und die Punkteverteilung aus Frage 3 bleiben beschlossen, kommen bei der EMC aber nicht zum Einsatz. Ein Mastersheet mit dem Seeding-Ergebnis gibt es noch nicht; bis dahin werden Scores von Hand eingetragen, ein Import wird geklärt, sobald es eins gibt.

Bestätigt (24.10.2026), Frage 4 – Abbildung: ein Seeding-Match pro Lineup, darin ein Sub-Match pro **Fahrt** (Map, Zeitfenster, Server, ein Spieler von uns). Das Sub-Match trägt den eingetragenen Score wie eine Summary (ADR 007); Runden späterer Formate kommen in dasselbe Sub-Match. Die Wertung (beste 3 je Map, Teamsumme) wird über alle Fahrten des Matches gerechnet.

Dazu geklärt: Die Match-Seite des Seeding-Matches ist die Gesamttabelle pro Lineup (alle Fahrten, die besten 3 je Map markiert, Summe je Map, Teamsumme, offizieller Platz und Liga). Die Turnierseite bekommt eine Seeding-Übersicht über alle Lineups (Teamsumme, Platz, Liga).

Bestätigt (24.10.2026), Frage 5 – Festlegung pro Comp: Es gibt **Seeding-Typen im Code**; ein Typ legt fest, wie gewertet wird (EMC: „beste N Scores je Map, summiert“). Eine Comp wählt beim Anlegen oder Bearbeiten ihren Typ; dessen Zahlen sind pro Comp änderbar und mit den Werten des Typs vorbelegt (EMC: 2 Maps, 2 Zeitfenster je Map, 2 Server, 10 Runden, beste 3 je Map, Punkteverteilung). Ein neues Seeding-Format mit anderer Wertung ist ein neuer Typ im Code. Getrennt von den Formatregeln (ADR 005), damit das Seeding nicht an deren Freigabe hängt (Empfehlung, von Felix mit B übernommen).

Bestätigt (24.10.2026), Frage 6 – Inhalt einer Fahrt: Map, Zeitfenster, Server, Spieler und Score; alles wird festgehalten. Die Map ist eine der Maps der Seeding-Stage (`Stage.maps`). Empfohlen war, den Server wegzulassen; Felix hält ihn fest.

Bestätigt (24.10.2026), Frage 7 – Regel „kein Spieler zweimal dieselbe Map“: In der Planung gesperrt, bei den Ergebnissen nur ein Hinweis (speichern geht, der Verstoß wird markiert).

Bestätigt (24.10.2026), Frage 8 – Planung: Das Seeding wird eine Stage der Matchday-Planung (ADR 008): dieselbe Seite mit Kader, Discord-Announcement, Antworten und Finalisieren. Statt der Matches mit Formaten zeigt sie ein Raster der Fahrten (Map × Zeitfenster × Server), belegt per Drag & Drop; die Sperre aus Frage 7 gilt dort. Die finalisierte Planung belegt die Sub-Matches des Seeding-Matches vor.

Bestätigt (24.10.2026), Frage 9 – Stats: Ein eigener Bereich „Seeding“ im Spielerprofil (pro Comp die Fahrten mit Map, Zeitfenster und Score, markiert ob unter den besten 3; Ø-Score und Anteil gezählter Fahrten) und eine Seeding-Tabelle in den Stats der Turnierseite (pro Spieler über alle Lineups: Fahrten, Ø-Score, gezählte Fahrten). Format-, Map-Stats und Dashboard bleiben ohne Seeding, weil Scores etwas anderes messen als Plätze und Runden.

Bestätigt (24.10.2026), Frage 10 – Reihenfolge: zuerst das gemeinsame Fundament (Seeding-Typ an der Comp, Seeding-Match, Fahrten als Sub-Matches), dann die Planung, damit sie zum Seeding von EMC S8 (Start 08.11.2026) die Aufstellung liefert, dann das Festhalten (Scores, Lineup-Tabelle, Turnier-Übersicht), zuletzt die Stats.

Bestätigt (24.10.2026), Frage 11 – Comps ohne Seeding-Typ: Alles bleibt wie bisher (Seeding-Match mit einem `TIME_ATTACK_10`-Sub-Match, außerhalb der Stats). Nur Comps mit gewähltem Typ bekommen Fahrten, Wertung und Planung. EMC S8 wird auf den Typ „EMC“ umgestellt. Da es in Production kein Seeding-Match gibt, muss nichts umgezogen werden.

Bestätigt (24.10.2026), Frage 12 – Weg nach Production: ohne Schalter. Jeder Teil (Fundament mit Planung, Festhalten, Stats) geht wie üblich erst nach Dev und nach Felix' Prüfung dort nach Production. Comps ohne Seeding-Typ ändern sich nicht.

Bestätigt (24.10.2026), Frage 13 – Platz und Liga: werden auf der Seite des Seeding-Matches (Gesamttabelle des Lineups) eingetragen, als „Platz“ (Zahl) und „Liga“ (freier Text, z. B. „Liga 2“ oder „Gold“). Die Turnier-Übersicht zeigt sie für alle Lineups.

## Erwogene Alternativen

- Frage 1: nur festhalten (A), festhalten plus Planung (B), festhalten plus Stats (C). Gewählt: alles (D).
- Frage 2: Score nur aus Runden berechnet (A) oder nur Endstand eingetragen (B). Gewählt: beides (C).
- Frage 3: feste Trackmania-Standardverteilung (A) oder gar nicht rechnen, Score immer übernehmen (C). Gewählt: pro Format einstellbar (B).
- Frage 4: eigene Tabelle „Seeding-Fahrt“ ohne Match/Sub-Match (B) – schlanker, aber Planung, Anzeige und Runden müssten eigens gebaut werden; ein Match pro Zeitfenster (C) – verteilt die gemeinsame Wertung auf mehrere Matches. Gewählt: ein Match pro Lineup, ein Sub-Match pro Fahrt (A).
- Frage 5: Typ im Code mit festen Zahlen (A) – jede Season-Änderung bräuchte Code; alles frei einstellbar ohne Typ (C) – trifft künftige Formate kaum, die sich in der Art der Wertung unterscheiden. Gewählt: Typ im Code, Zahlen pro Comp änderbar (B).
- Frage 6: nur Map, Spieler, Score (B); ohne Server (C, empfohlen). Gewählt: alles inklusive Server (A).
- Frage 7: überall sperren (A) – verhindert das Eintragen tatsächlicher Abweichungen; überall nur Hinweis (B). Gewählt: Planung sperrt, Ergebnisse weisen hin (C).
- Frage 8: eigene einfache Seeding-Planung ohne Announcement und Antworten (B); keine Planung, Sub-Matches vorab anlegen (C). Gewählt: Stage der Matchday-Planung (A).
- Frage 9: nur Profilbereich (A); Seeding in die bestehenden Stats mischen (C). Gewählt: Profilbereich plus Seeding-Tabelle auf der Turnierseite (B).
- Frage 10: Festhalten → Planung → Stats (A); Festhalten → Stats → Planung (C). Gewählt: Planung → Festhalten → Stats (B), nach dem gemeinsamen Fundament.
- Frage 11: Seeding nur noch mit Typ (B); eigener Typ „Ohne Wertung“ (C). Gewählt: ohne Typ wie bisher (A).
- Frage 12: hinter einem Schalter `SEEDING` bis zur Freigabe (A). Gewählt: ohne Schalter, schrittweise (B).
- Frage 13: Eintragen in der Turnier-Übersicht (B) oder an beiden Stellen (C). Gewählt: auf der Seite des Seeding-Matches (A).

## Konsequenzen

- Neu: Seeding-Typen im Code (zuerst „EMC“) und pro Comp der gewählte Typ mit seinen Zahlen (Maps, Zeitfenster je Map, Server, Runden, beste N je Map, Punkteverteilung).
- Seeding-Matches einer Comp mit Typ bekommen statt des `TIME_ATTACK_10`-Sub-Matches ein Sub-Match pro Fahrt (Map, Zeitfenster, Server, Spieler) mit Score; dazu am Seeding-Match Platz und Liga. Comps ohne Typ bleiben unverändert.
- Neu zu entscheiden bei der Umsetzung: ein Format-Wert für Fahrt-Sub-Matches (statt der Team-Formate `ROUND_*`), und wo der Score ohne Runden liegt (an `SubMatchSummary` oder einem eigenen Feld).
- Die Matchday-Planung bekommt für Seeding-Stages ein Raster der Fahrten statt der Matches; die Sperre „kein Spieler zweimal dieselbe Map“ gilt dort.
- Die Ergebnisseite weist auf Verstöße gegen diese Regel hin, sperrt aber nicht.
- Spielerprofil und Turnierseite bekommen Seeding-Bereiche; Format-, Map-Stats und Dashboard bleiben ohne Seeding.
- Jedes weitere Seeding-Format ist ein neuer Typ mit eigener Wertung.
- Offen bleiben: die tatsächliche Punkteverteilung der EMC (nur relevant, wenn es Runden gibt) und ein Import, sobald es ein Mastersheet gibt.
