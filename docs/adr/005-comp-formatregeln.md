# Formatregeln pro Comp

Status: Akzeptiert – gemeinsames Verständnis vom Nutzer am 13.10.2026 bestätigt, einschließlich der abgeleiteten Punkte. Umsetzung in drei Schritten auf dem Branch `feat/comp-match-rules`: alle drei Schritte sind umgesetzt und in Dev, die Oberfläche noch nicht im Browser geprüft; die acht bestehenden Comps sind noch nicht eingetragen. Production ist unberührt. Begriffe: [Glossar](../comp-formatregeln-glossar.md).

## Kontext

Ein Turnier hat eine Format-Folge (`Tournament.formats`). Beim Anlegen eines Matches entstehen daraus die Sub-Matches, ohne `TIME_ATTACK_10`; ein Seeding-Match bekommt genau ein Time-Attack-Sub-Match. Mehr weiß die App über den Ablauf eines Matches nicht.

Wer ein Sub-Match gewonnen hat, entscheidet eine Faustregel: mehr gewonnene Runden, bei Gleichstand Draw (`lib/dashboard.ts`, `match-detail-view.tsx`). Das Ergebnis des Matches wird aus den Sub-Matches vorgeschlagen und beim Schließen von Hand bestätigt (`confirmedOutcome`). Punkte für Sieg, Unentschieden und Niederlage gibt es nicht.

Die Daten in Dev (Kopie von Production, 13.10.2026) zeigen, dass die Comps nach „wer zuerst X Runden gewinnt“ gespielt werden und X vom Format abhängt: meist 7; SMS S1 1v1 und 2v2 bis 5, 3v3 bis 3; EMC S7 und Vertigo S1 2v2 bis 5; Omnium S1 5v5 bis 10. Unentschiedene Runden zählen für keine Seite (bis zu 13 in einem 2v2). Daneben gibt es eine Obergrenze der Rundenzahl: Bei Vertigo S1 enden 14 Sub-Matches nach genau 13 Runden ohne 7 Siege (6:5, 5:5, 6:6), auch das 2v2 mit Ziel 5; bei MTS endet das 2v2 bei 13 Runden; ein 2v2 bei EMC S7 endet nach 11 (Einzelfall); SMS S1 hat keine (ein 2v2 über 21 Runden). Wenige Sub-Matches enden weder am Ziel noch an der Obergrenze (6:3 nach 9 Runden, 6:1 nach 7, 8:3) und sind vermutlich lückenhaft erfasst. Die Zahl der Sub-Matches weicht bei MTS und SMS von der Format-Folge ab (4 oder 5 von 5); bei SMS fehlt dann das 3v3.

## Entscheidung

Bestätigt: Die Konfiguration dient der Validierung und der Ergebnisberechnung. Sie erzeugt Hinweise, wenn eingetragene oder importierte Daten nicht zum Format passen, und sie bestimmt, wer ein Sub-Match und das Match gewonnen hat. Die Faustregel „mehr Runden gewonnen“ läuft nicht daneben weiter. Einen Punktestand pro Lineup und Turnier gibt es nicht.

Bestätigt: „Rounds to win“ ist ein Wert pro Format innerhalb der Comp (z. B. SMS: 1v1 bis 5, 2v2 bis 5, 3v3 bis 3, 4v4 bis 7). Steht ein Format mehrfach in der Format-Folge, gilt für alle derselbe Wert. Jedes Sub-Match findet seinen Wert über sein eigenes Format, unabhängig von seiner Position im Match.

Bestätigt: Wie ein Match entschieden wird, legt die Comp über einen Ablauf aus einer festen Liste fest: „alle Sub-Matches“ (Vertigo, EMC, Omnium, 7CC), „bis entschieden“ (Best-of, Blitz League) oder „letztes Sub-Match als Entscheider bei Gleichstand“ (MTS). In allen dreien gewinnt, wer mehr Sub-Matches gewonnen hat. Aus dem Ablauf folgt, wie viele Sub-Matches ein fertiges Match haben muss und ob ein Draw möglich ist: nur bei „alle Sub-Matches“ mit gerader Zahl; sonst ist ein Gleichstand ein unvollständiges Match.

Bestätigt: Die Formatregeln (Format-Folge, Ablauf, „Rounds to win“) gelten für die ganze Comp. Das Playoff kann einen eigenen Regelsatz bekommen; ohne eigene Angabe gilt dort der Regelsatz der Comp.

Bestätigt: Neben „Rounds to win“ hat jedes Format einer Comp eine optionale Obergrenze „Max rounds“; leer heißt keine. Ist sie erreicht, endet das Sub-Match: Wer mehr Runden gewonnen hat, gewinnt, bei Gleichstand ist das Sub-Match ein Draw. Unentschiedene Runden zählen zur Obergrenze, aber für keine Seite als Sieg.

Bestätigt: Ein Sub-Match mit Runden, das nicht entschieden ist (weder „Rounds to win“ noch „Max rounds“ erreicht), zählt trotzdem: Der Führende gilt als Sieger, bei Gleichstand ist es ein Draw. Es ist als unvollständig markiert, und ein Hinweis nennt, was fehlt.

Bestätigt: Punkte gibt es für das Ergebnis des Matches: drei Zahlen pro Regelsatz für Sieg, Unentschieden und Niederlage. Sie stehen am Match und als Summe pro Lineup auf Lineup- und Turnierseite, ohne Tabelle und ohne Vergleich mit anderen Teams.

Bestätigt: Hinweise entstehen, wenn ein Sub-Match unvollständig ist, wenn es mehr Runden hat, als die Regeln zulassen (über „Max rounds“ oder nach erreichtem Ziel weitergespielt), wenn das Match nach seinem Ablauf zu wenige oder zu viele Sub-Matches hat und wenn es mit einem Gleichstand endet, der im Ablauf kein gültiges Ergebnis ist. Sie stehen auf der Match-Seite. Beim Schließen listet der Dialog die offenen Hinweise, und geschlossen wird erst nach ausdrücklichem Bestätigen; gesperrt wird nicht (Forfeit, Abbruch, Sonderregel der Liga).

Bestätigt: Dass ein Match trotz Hinweisen geschlossen wurde, wird nicht eigens gespeichert. Die Hinweise ergeben sich jederzeit neu aus Runden und Regeln und bleiben am geschlossenen Match gedämpft sichtbar, ohne Aussage darüber, ob sie beim Schließen bestätigt wurden (nach einer Regeländerung wäre sie nicht verlässlich). Wer wann geschlossen hat, steht in `MatchConfirmation`.

Bestätigt: Die Vorschauen von CSV- und eCM-Import zeigen die Hinweise schon vor dem Speichern, als Warnung pro Sub-Match neben den vorhandenen Warnungen zur Teamgröße: der Stand, der gespeichert würde, und was nicht passt. Die CSV-Vorschau rechnet beim An- und Abwählen von Runden mit. Bestätigt wird dort nichts; das geschieht beim Schließen.

Bestätigt: Eine Comp ohne Regelsatz zeigt keine Hinweise und keine Punkte. Die bestehenden Comps bekommen von der Migration nichts; sie werden von Hand eingetragen, erst in Dev, nach Freigabe in Production.

Festgestellt: Mit den Entscheidungen zu Ablauf und unvollständigen Sub-Matches liefern die Regeln in jedem Fall denselben Sieger wie die Faustregel (mehr Runden, mehr Sub-Matches, Gleichstand Draw). Kein bestehendes Ergebnis und keine Bilanz ändert sich, mit oder ohne Regelsatz. Neu sind Hinweise, Punkte und das Wissen, ob ein Stand fertig und gültig ist.

Bestätigt: Der Regelsatz wird in einem Abschnitt „Match rules“ unter der Format-Folge gepflegt, im Dialog zum Anlegen und im Dialog „Edit tournament“: Ablauf, eine Zeile pro Format der Folge mit „Rounds to win“ und „Max rounds“, die drei Punktzahlen. Der Playoff-Regelsatz ist ein zweiter, optionaler Abschnitt. Beim Anlegen einer Comp mit Format-Folge ist der Regelsatz Pflicht; ohne Regelsatz bleiben nur die bestehenden Comps, bis sie eingetragen sind, und Comps ohne Format-Folge (Endurance).

Nachgeschlagen: Den Regelsatz pflegen dieselben Rollen, die Turniere anlegen und bearbeiten (Admin und Manager, `canManage`).

Bestätigt: Beim Anlegen ist nichts vorbelegt. Ablauf, „Rounds to win“ je Format und die drei Punktzahlen werden bewusst eingetragen, sonst lässt sich nicht speichern. „Max rounds“ bleibt optional; leer heißt keine Obergrenze. Damit nicht jede Comp von Grund auf eingetippt wird, lassen sich Regelsätze als Vorlagen wiederverwenden.

Bestätigt: Eine Vorlage ist ein eigener, benannter Datensatz (z. B. „MTS-Standard“), gespeichert aus einem ausgefüllten Regelsatz und beim Anlegen auswählbar. Ihre Werte werden in die Comp kopiert und lassen sich dort frei ändern; eine spätere Änderung der Vorlage berührt keine Comp.

Bestätigt: Eine Vorlage umfasst Format-Folge und Regeln zusammen: die Folge, den Ablauf, „Rounds to win“ und „Max rounds“ je Format, die Punkte und, falls vorhanden, den Playoff-Regelsatz. Wer sie wählt, bekommt Format-Folge und „Match rules“ in einem Schritt gefüllt. Name, Style und Daten der Comp gehören nicht dazu.

Bestätigt: Vorlagen entstehen und werden gewählt in den beiden Comp-Dialogen: eine Auswahl „Template“ über der Format-Folge, die Folge und Regeln füllt, und „Save as template“ unter den „Match rules“, das den ausgefüllten Stand unter einem Namen speichert. Zusätzlich gibt es eine eigene Seite, auf der Vorlagen verwaltet werden (ansehen, bearbeiten, umbenennen, löschen).

Bestätigt: Punkte gibt es nur für Gruppen-Matches. Der Playoff-Regelsatz hat keine Punktfelder, Seeding-Matches bekommen keine. Die Summe pro Lineup zählt damit die Gruppenphase und lässt sich mit der Tabelle der Liga abgleichen.

Bestätigt: Der Regelsatz lässt sich auch ändern, wenn Matches der Comp schon geschlossen sind. Hinweise und Punkte aller Matches folgen sofort den neuen Regeln; bestätigte Ergebnisse und der geschlossene Zustand bleiben. Vor dem Speichern fragt der Dialog nach und nennt, wie viele geschlossene Matches betroffen sind und wie viele davon neue Hinweise bekämen.

Bestätigt: Ein offenes Match zeigt die Hinweise zu einem Sub-Match, sobald dieses Runden hat (Stand gegen das Ziel). Die Hinweise zum ganzen Match (Zahl der Sub-Matches, ungültiger Gleichstand) erscheinen erst im Schließen-Dialog und danach am geschlossenen Match. Leere Sub-Matches zählen als nicht gespielt.

Bestätigt: Gebaut wird in drei Schritten auf einem Branch von `main`, jeder für sich in Dev prüfbar: (1) Datenmodell, Abschnitt „Match rules“ mit Playoff-Regelsatz und Rückfrage beim Ändern, Berechnung in `lib/`, Hinweise auf der Match-Seite und beim Schließen; danach werden die acht Comps eingetragen. (2) Hinweise in den Import-Vorschauen, Punkte am Match und als Summe pro Lineup. (3) Vorlagen in den Dialogen und die Verwaltungsseite.

Bei der Umsetzung festgestellt: Im Ablauf „alle Sub-Matches“ ist ein Gleichstand immer ein gültiges Ergebnis, sobald alle Sub-Matches gespielt sind, auch bei ungerader Zahl. Durch unentschiedene Sub-Matches (Obergrenze erreicht) kann auch ein Match über drei Sub-Matches 1:1 enden. Ob Runden nach der Entscheidung gespielt wurden, erkennt die Berechnung an der Reihenfolge der Runden, nicht an der Summe.

## Erwogene Alternativen

- Nur Validierung, Ergebnisberechnung wie heute: nicht gewählt; Regeln und Faustregel könnten sich widersprechen.
- Zusätzlich ein Punktestand pro Lineup und Turnier: nicht gewählt; die Spiele der Gegner untereinander sind nicht in der App.
- Ein „Rounds to win“ für die ganze Comp: nicht gewählt; bildet fünf der acht bestehenden Comps nicht ab.
- Ein Wert pro Eintrag der Format-Folge: nicht gewählt; braucht eine feste Zuordnung von Sub-Match zu Eintrag, die bei fehlenden Sub-Matches bricht (SMS ohne 3v3).
- Match-Entscheidung ohne Regel (mehr Sub-Matches, Gleichstand Draw, Zahl ungeprüft): nicht gewählt.
- Freie Zahlen (Sub-Matches to win, Mindest- und Höchstzahl): nicht gewählt; leichter widersprüchlich einzustellen, der Entscheider bei MTS lässt sich nur ungenau ausdrücken.
- Ein einziger Regelsatz pro Comp, abweichende Playoffs nur als bestätigte Hinweise: nicht gewählt.
- Ein Regelsatz pro Stage (jeder Spieltag, jede Playoff-Runde): nicht gewählt; viel Pflege, bisher spielt keine Comp einzelne Playoff-Runden unterschiedlich.
- Keine Obergrenze, Sub-Matches unter dem Ziel als unvollständig: nicht gewählt; träfe bei Vertigo 14 regulär beendete Sub-Matches.
- Eine Obergrenze pro Regelsatz statt pro Format: nicht gewählt; das 2v2 bei EMC deutet auf eine eigene Grenze je Format.
- Unentschiedenes Sub-Match ohne Sieger, Match ohne Vorschlag: nicht gewählt; ein 6:3 verschwände aus allen Bilanzen.
- Führender als Sieger, unentschiedener Gleichstand zählt nicht: nicht gewählt.
- Punkte pro gewonnenem Sub-Match: nicht gewählt.
- Punkte vorerst weglassen: nicht gewählt.
- Hinweise ohne Wirkung beim Schließen: nicht gewählt; leicht zu übersehen.
- Schließen gesperrt, bis die Daten zu den Regeln passen: nicht gewählt; scheitert an Forfeits und Abbrüchen und verleitet dazu, Runden zu erfinden.
- Hinweise erst nach dem Speichern: nicht gewählt; eine abgewählte Siegrunde fiele erst hinterher auf.
- Bestätigen und Notizzeile schon in der Vorschau: nicht gewählt; derselbe Hinweis würde zweimal bestätigt, und die Notizzeile veraltet, sobald Runden nachgetragen werden.
- Migration setzt die aus den Runden abgelesenen Werte: nicht gewählt; schreibt geratene Werte fest (SMS-Playoff, EMC 2v2).
- Regelsatz als Pflicht mit Vorbelegung für alle Comps: nicht gewählt; für fünf der acht Comps falsch, bis jemand korrigiert.
- Regelsatz beim Anlegen optional (eingeklappter Abschnitt): nicht gewählt.
- Eigene Seite oder eigener Dialog für die Regeln: nicht gewählt; die Regeln hängen an der Format-Folge.
- Regelsatz ganz oder teilweise vorbelegt (alle Sub-Matches, 7 Runden, 3/1/0): nicht gewählt; wer die Felder nicht ansieht, speichert Geratenes als Regel. Die anfangs vereinbarte Vorbelegung von „Rounds to win“ mit 7 ist damit zurückgenommen.
- Punkte auch im Playoff, oder pro Regelsatz abschaltbar: nicht gewählt; im K.-o.-Modus gibt es keine Punkte, und die Summe passte zu keiner Tabelle mehr.
- Übernahme aus einer bestehenden Comp ohne eigene Vorlagen: nicht gewählt; eine Kombination stünde erst zur Auswahl, wenn eine Comp sie hat.
- Vorlage verknüpft statt kopiert: nicht gewählt; eine Änderung der Vorlage änderte nachträglich die Hinweise geschlossener Matches.
- Vorlage ohne Format-Folge: nicht gewählt; der Ablauf mit Entscheider ergibt nur mit der Folge Sinn.
- Vorlage ohne Punkte: nicht gewählt; nach der Auswahl soll nichts mehr offen sein.
- Vorlagen nur in den Comp-Dialogen oder nur auf einer eigenen Seite: nicht gewählt.
- Bestätigte Hinweise an der Bestätigung speichern, oder als Notizzeile wie in ADR 004: nicht gewählt; eine gespeicherte Kopie kann der Live-Berechnung widersprechen.
- Regeländerung ohne Rückfrage: nicht gewählt.
- Regeln gesperrt, sobald ein Match geschlossen ist: nicht gewählt; ein Tippfehler ließe sich nur über das Wiederöffnen von Matches beheben.
- Zusatz „beim Schließen bestätigt“ über einen Zeitvergleich mit der letzten Regeländerung: nicht gewählt.
- Alle Hinweise immer: nicht gewählt; ein offenes Match stünde fast immer mit Hinweisen da.
- Alle Hinweise erst beim Schließen: nicht gewählt; ein 6:3 fiele später auf, als es sich beheben ließe.
- Alles in einem Zug, oder Vorlagen direkt nach den Regeln: nicht gewählt.

## Offene Fragen

- Wie lief das Playoff von SMS S1 tatsächlich (vier Sub-Matches ohne 3v3, einmal 2:2)? Nur für das Eintragen von Hand wichtig, nicht für den Bau.
- Endet das 2v2 bei EMC S7 wirklich nach 11 Runden? Ebenso.

Aus dem Bestehenden abgeleitet und mit dem Vorhaben bestätigt:

- `TIME_ATTACK_10` in der Format-Folge bekommt keine Zeile im Regelsatz; Seeding-Matches haben weder Regeln noch Hinweise noch Punkte.
- Ein Match entsteht wie heute mit allen Sub-Matches der Format-Folge, auch dem Entscheider; im Playoff aus der Folge des Playoff-Regelsatzes, falls es einen gibt. Leere Sub-Matches zählen als nicht gespielt.
- Entfällt ein Format aus der Folge, entfällt seine Zeile im Regelsatz; ein bestehendes Sub-Match in einem Format ohne Zeile bekommt keinen Sub-Match-Hinweis.
- Vorlagen verwalten Admins und Manager (`canManage`); die Seite ist über die Turnierliste erreichbar.
- Hinweise und alle neuen Texte sind englisch wie die übrige App.
- Von Hand eingetragene Runden zeigen dieselben Sub-Match-Hinweise wie importierte.

## Konsequenzen

- Die Berechnung von Sub-Match- und Match-Ergebnis zieht aus `lib/opponents.ts`, `lib/dashboard.ts` und `match-detail-view.tsx` in ein Modul in `lib/`, das auch Zustand (entschieden, unvollständig), Hinweise und Punkte liefert; test-first.
- Das Datenmodell wächst um den Regelsatz einer Comp (Ablauf, Werte je Format, Punkte), den optionalen Playoff-Regelsatz mit eigener Format-Folge und die Vorlagen. Die Migration legt nur die Struktur an und setzt keine Werte.
- Der Anlegen-Dialog verlangt bei Comps mit Format-Folge mehr Angaben als heute; die Vorlagen fangen das ab.
- Solange die acht bestehenden Comps keinen Regelsatz haben, bleibt dort alles wie bisher.
- ADR 004 bleibt gültig: Die Import-Prüfung gegen das eingetragene Match ist davon unabhängig; die Format-Prüfung, die dort ausgeklammert wurde, kommt hier als Warnung ohne Bestätigen.
- Schritt 1: Regeln und Berechnung in `lib/match-rules.ts`, Lesen und Schreiben in `lib/match-rules-db.ts`, Felder in `lib/match-rules-form.ts` und `components/match-rules-fields.tsx`; Tabellen `MatchRules` und `FormatRule`; Rückfrage über `POST …/tournaments/[id]/rules/impact`; Hinweise in `match-detail-view.tsx`, Bestätigen in `components/opponents/match-opponent-panel.tsx`. Die Stats nach Format und nach Map (`lib/format-stats.ts`, `lib/map-stats.ts`) zählen ihre Maps weiter selbst.
- Schritt 2: Punkte am Match (`match-detail-view.tsx`) und als Summe pro Lineup (`lineup-matches-view.tsx`, `tournament-detail-view.tsx`) über `lineupPoints`; Hinweise in den Vorschauen von `match-csv-import-dialog.tsx` und `ecm-import-dialog.tsx`.
- Schritt 3: Tabelle `RuleTemplate` (Name eindeutig, Inhalt als JSON, geprüft wie der Regelsatz einer neuen Comp); `lib/rule-templates.ts`, Routen unter `app/api/rule-templates`; Auswahl und „Save as template“ in `components/rule-template-controls.tsx`; Verwaltungsseite `/rule-templates`, von der Turnierliste aus erreichbar. Alles nur für Admin und Manager.
