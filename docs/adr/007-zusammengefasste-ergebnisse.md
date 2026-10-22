# Zusammengefasste Sub-Match-Ergebnisse aus alten Stats-Screenshots

Status: Akzeptiert – von Felix am 19.10.2026 bestätigt, mit der Änderung, dass Seeding-Stats vorerst nicht übernommen werden. Umsetzung steht aus. Begriffe: [Glossar](../zusammengefasste-ergebnisse-glossar.md).

## Kontext

Die Stats vergangener Comps wurden im Discord-Channel #admins als Screenshots von Tabellen gepostet (Export vom 19.10.2026 in `~/discord-export/admins-1060207503046082592/`, Übersicht in `index.md`): 176 Nachrichten zu 16 Comp-Jahrgängen seit Mai 2024, für die Teams Main, Academy, Rising und Horizon. Pro Match und Sub-Match zeigen sie Gegner, Format, meist die Map, das Ergebnis (z. B. 7:4) und pro Spieler gespielte Runden, Platzsumme und Durchschnittsplatz. Dazu kommen „Gesamt“-Tabellen über eine Comp. Platzierungen einzelner Runden und Zeiten enthalten sie nicht.

Der Stattracker speichert ein Sub-Match als Runden (`Round`) mit dem Ergebnis jedes Fahrers (`RoundResult`: Platz, Zeit, DNF). Spielerstatistiken (`StatLine`) rechnen mit gespielten Runden, Platzsumme, DNFs, gewonnenen und verlorenen Runden sowie der Pace aus den Zeiten.

Im Stattracker fehlen die Comps RRCS (2024), PIL S2, FSM, WTT, MTS (Dez. 2025) und das SMS von Feb./März 2025; die vorhandenen Comps enthalten nur einen Teil der Lineups. In Discord heißt das SMS von 2026 „SMS S2“, im Stattracker „SMS S1“.

Felix hat am 19.10.2026 entschieden, die Screenshots als zusammengefasste Ergebnisse zu übernehmen (Variante B), unter der Bedingung: Abgleich mit ihm und seine Bestätigung bei jeder Unklarheit.

## Entscheidung

Bestätigt (19.10.2026): Alte Stats werden als zusammengefasste Sub-Match-Ergebnisse übernommen, nicht nur als Matches und Lineups. Jede abgelesene Comp wird erst in Dev eingetragen und von Felix mit dem Screenshot abgeglichen; bei Unklarheiten (Spieler, Team, Comp, Zahlen) wird er gefragt, nicht geraten. Production erst nach seiner Freigabe.

Bestätigt (19.10.2026): Zusammengefasste Ergebnisse zählen in dieselben Statistiken wie Rundenergebnisse, soweit die Werte dieselben sind: gespielte Runden, Platzsumme und Durchschnittsplatz, gewonnene und verlorene Runden, Map- und Match-Bilanz. In Pace, Map-Zeiten und DNFs fließen sie nicht ein. Am Match steht ein Hinweis „from summary“.

Bestätigt (19.10.2026): Die Werte werden pro Comp abgelesen, in eine Datei geschrieben (eine Zeile pro Spieler und Sub-Match) und per Import-Skript in Dev eingetragen. Abgeglichen wird auf der Match-Seite; jedes zusammengefasste Sub-Match verweist auf seinen Screenshot (Link zur Discord-Nachricht). Korrekturen meldet Felix, sie werden neu eingetragen. Eine dauerhafte Eingabemaske gibt es nicht.

Bestätigt (19.10.2026): Übernommen werden nur Einzelmatches. Gesamt-Tabellen dienen zur Kontrolle: Die Summe der abgelesenen Matches wird mit ihnen verglichen, jede Abweichung wird Felix gezeigt. Fehlende Matches bleiben Lücken und werden ihm genannt.

Bestätigt (19.10.2026), Ergänzung von Felix: In Dev gibt es eine Vergleichsseite, auf der Screenshots und importierte Werte nebeneinander stehen. Sie ist nur in Dev verfügbar (wie die Formatregeln über einen Schalter, in Production immer aus); die Screenshots werden aus dem lokalen Export-Ordner gelesen und nie in Production oder ins Repository übernommen.

Bestätigt (19.10.2026): Die Namen auf den Screenshots (oft Spitznamen wie „Toast“, „Ente“, „Reghi“) werden über eine Zuordnungsliste „Screenshot-Name → Spieler“ aufgelöst, die für alle Comps gilt. Sie enthält je Name einen Vorschlag und ein Beispielbild; Felix bestätigt sie einmal und korrigiert einzelne Einträge. Für Namen ohne passenden Spieler entscheidet er je Name, ob ein neuer Spieler angelegt wird oder das Ergebnis entfällt. Ist ein Spitzname zu verschiedenen Zeiten unterschiedlich belegt, wird gezielt nachgefragt.

Bestätigt (19.10.2026): Matches mit Rundenergebnissen haben Vorrang und bleiben unverändert. Ihr Screenshot dient zur Kontrolle: Abweichungen bei Runden, Platzsumme oder Ergebnis zeigt die Vergleichsseite, Felix entscheidet. Zusammengefasste Ergebnisse kommen nur in Matches, die es noch nicht gibt – vor allem für Academy, Rising und Horizon, die außer bei Vertigo S1 fehlen.

Bestätigt (19.10.2026): Für fehlende Comps werden Name, Zeitraum (aus den Daten der Posts), Format-Folge und Style (aus den Screenshots) vorgeschlagen und von Felix in einer Liste bestätigt oder korrigiert. Teams heißen wie in Vertigo S1 „B2 eSports“, „B2 Academy“, „B2 Rising“, „B2 Horizon“; ihre Besetzung ergibt sich aus den Screenshots.

Bestätigt (19.10.2026): Die bestehende Comp „SMS S1“ (2026) wird in „SMS S2“ umbenannt, wie sie im Discord heißt; die Comp von Feb./März 2025 wird als „SMS S1“ angelegt. Frühere Adressen leiten weiter. Erst in Dev, Production nach Freigabe.

Korrigiert (19.10.2026): Die bestehende „SMS S1“ enthält die Matches von 2025 (Molotov Gaming, Loading Black; Fahrer PASZS, Bodiis, Alexs, Uso), nur ihre Daten standen auf 2026. Sie bleibt „SMS S1“ und bekommt die Daten 16.02.–09.03.2025; die Comp von 2026 wird als „SMS S2“ neu angelegt. Ein Umbenennen und Weiterleiten entfällt.

Bestätigt (19.10.2026): FSM listet in 2v2 und 3v3 Punkte statt Plätzen. Solche Sub-Matches zählen nur zur Bilanz (Map-Bilanz, gewonnene und verlorene Runden), nicht zu gespielten Runden und Platzsumme; die Punkte werden pro Spieler gespeichert und am Match gezeigt. Gilt auch für ein 1v1 ohne Plätze.

Bestätigt (19.10.2026), aus den Entscheidungen abgeleitet:

- Ein zusammengefasstes Sub-Match speichert Format, Map (falls angegeben), das Rundenergebnis (falls angegeben), Map-Sieg/-Niederlage und den Link zur Discord-Nachricht; pro Spieler gespielte Runden und Platzsumme. Gegnerische Spieler stehen nicht auf den Screenshots und fehlen.
- Fehlt auf einem Screenshot das Rundenergebnis (z. B. beim Main-Team, das nur Mapwin/Maploss zeigt), zählen für dieses Sub-Match keine gewonnenen und verlorenen Runden, wohl aber Map-Bilanz, gespielte Runden und Platzsumme.
- Gewonnene und verlorene Runden eines Spielers werden nur gezählt, wenn er alle Runden des Sub-Matches gefahren ist; sonst ist die Aufteilung unbekannt.
- Seeding-Stats bleiben vorerst außen vor (Felix, 19.10.2026). Nach Abschluss der Übernahme bekommt Felix eine Liste aller Seeding-Screenshots, für das offene Todo zu den Seeding-Formaten.
- Umsetzung test-first auf einem Branch: Datenmodell und Statistik-Einbindung, Import-Skript, Vergleichsseite (nur Dev). Danach Comp für Comp ablesen und abgleichen, beginnend mit einer kleinen Comp als Probe.

## Erwogene Alternativen

- Nur Matches, Gegner, Ergebnisse und Lineups übernehmen (Variante A): ohne Durchschnittsplätze.
- Zusammengefasste Ergebnisse getrennt von den Rundendaten führen oder per Filter zuschaltbar machen: kein durchgehender Durchschnittsplatz bzw. mehr Oberfläche.
- Dauerhafte Eingabemaske für zusammengefasste Sub-Matches: viel Code für einen einmaligen Vorgang. Abgleich nur im Chat: Felix sähe die Daten nicht so, wie die App sie zeigt.
- Differenz zur Gesamt-Tabelle als Pseudo-Match: ein Match, das es nie gab. Gesamt-Tabellen ignorieren: Lesefehler blieben unentdeckt.
- Zuordnungsliste pro Comp bestätigen: mehr Runden für denselben Inhalt. Nur eindeutige Namen zuordnen, Rest im Abgleich: verstreut Rückfragen über alle Comps.
- Überschneidungen nicht vergleichen: Fehler in bestehenden Daten blieben unentdeckt. Screenshot und Runden beide am Match: doppelte Daten ohne Nutzen.
- Comps von Felix selbst anlegen lassen: mehr Handarbeit. Comps ohne Format-Folge und Style: Statistik-Filter griffen für alte Comps nicht.
- Bestehende Comp „SMS S1“ lassen und die von 2025 anders nennen: widerspräche der Benennung im Discord.
- Nichts übernehmen, Screenshots nur als Archiv (Variante C).

## Konsequenzen

Offen.

## Offene Fragen

- Übernahme der Seeding-Stats: später, siehe Todo „seeding formate für import/anlegen prüfen“.
