# TFH-Import und Langstreckenrennen

Status: Akzeptiert – gemeinsames Verständnis und Implementierung vom Nutzer bestätigt.

## Kontext

Der Stattracker soll Teilnahmen an Trackmania For Hours (TFH) abbilden. Die untersuchte 24h-Ausgabe und drei 12h-RPG-Ausgaben liefern öffentlich abrufbare JSON-Daten zu Teams, Spielern und Ergebnissen. Spieler enthalten Trackmania-Account-IDs. Das bestehende Datenmodell enthält Rundenformate und Time Attack, aber keine eigenen Felder für Langstrecken-Fahrzeit und Checkpoint-Ergebnisse.

Ausgangspunkt: https://trackmaniaforhours.com/event/24h/race/4/teams

## Entscheidung

Bestätigt: Die erste Version integriert abgeschlossene TFH-Rennen als historisches Archiv in den Stattracker, mit Teamplatzierungen und individuellen Spielerstatistiken.

Bestätigt: Das Archiv umfasst alle abgeschlossenen 24h- und 12h-RPG-Ausgaben mit B2-Beteiligung, jeweils mit sämtlichen B2-Teams.

Bestätigt: Für alle teilnehmenden Teams wird die Gesamtwertung mit Platzierung und Checkpoints gespeichert. Detaillierte Spielerstatistiken werden für die B2-Teams aufgenommen. Eine vollständige Speicherung gegnerischer Spielerstatistiken gehört nicht zum vereinbarten Umfang.

Bestätigt: TFH-Ausgaben erscheinen in der bestehenden Turnierübersicht und erhalten eigene Langstrecken-Detailseiten mit Gesamtwertung, B2-Teams und Fahrerstatistiken.

Bestätigt: Bestehende Spielerprofile erhalten einen eigenen Langstreckenabschnitt mit TFH-Teilnahmen, Teamplatzierungen, Fahrzeit und TFH-Kennzahlen. TFH-Ergebnisse werden nicht in die bisherigen Runden-Gesamtstatistiken eingerechnet.

Bestätigt: Ein Admin startet den Import durch Eingabe einer TFH-URL und prüft vor dem Speichern eine Vorschau mit erkannten B2-Teams und Spielerzuordnungen. Historische und spätere abgeschlossene Ausgaben werden einzeln über diesen Ablauf aufgenommen. Automatische Suche und unbeaufsichtigter Import gehören nicht zur ersten Version.

Bestätigt: Die Importvorschau schlägt B2-Teams anhand ihres Namens oder Tags vor. Der Admin kann beliebige Teams als B2 markieren oder vorgeschlagene Teams abwählen. Die bestätigte Auswahl bestimmt, für welche Teams detaillierte Spielerstatistiken importiert werden.

Bestätigt: Fahrer werden anhand ihrer Trackmania-Account-ID vorhandenen Profilen zugeordnet. Bei unbekannten IDs muss der Admin vor dem Speichern ein bestehendes Profil zuordnen oder einen neuen Spieler mit bewusst gewähltem Status anlegen. Namensähnlichkeit allein führt nicht zu einer automatischen Zuordnung.

Bestätigt: Für B2-Fahrer werden neben Gesamtwerten die verfügbaren einzelnen Rundenabschlüsse mit Zeit und Zeitstempel gespeichert und angezeigt. Die Bedeutung der Zeit-, Rang- und Typfelder muss vor der Implementierung anhand der Quelle geprüft werden. Aus den Abschlüssen dürfen keine unbelegten vollständigen Stints oder Checkpoint-Verläufe abgeleitet werden.

Bestätigt: Ein erneuter Import derselben TFH-Ausgabe aktualisiert das vorhandene Rennen statt eine Kopie anzulegen. Die Vorschau zeigt Änderungen, die vor dem Speichern bestätigt werden. Bestätigte Spielerzuordnungen und B2-Auswahl werden übernommen und bleiben korrigierbar. Ein wiederholter Import darf keine doppelten Rennen oder Leistungen erzeugen.

Bestätigt: Jedes B2-Team erhält pro TFH-Ausgabe ein eigenes Turnier-Lineup mit damaligem Teamnamen und damaliger Besetzung, verknüpft mit den bestehenden Spielerprofilen. Gleichnamige Teams verschiedener Ausgaben werden nicht zu einem dauerhaften Lineup zusammengeführt.

Bestätigt: Spielerprofile fassen die Anzahl der TFH-Teilnahmen und die gesamte Fahrzeit zusammen. CPM und Rundenzeiten werden je Rennen angezeigt und verglichen; es gibt keine gemeinsame Leistungsrangliste über unterschiedliche TFH-Ausgaben. Die bisherigen Rundenstatistiken bleiben davon getrennt.

Bestätigt (ergänzt am 12.10.2026): Jede Rennseite hat ein B2-Fahrerranking, das alle Fahrer aller B2-Teams dieser Ausgabe in einer Tabelle vergleicht, standardmäßig nach CPM. Zusätzlich gibt es eine Übersicht über alle Ausgaben. Sie vergleicht nur, was sich über verschiedene Rennen addieren lässt: gefahrene Ausgaben, Fahrzeit und Checkpoints. CPM und Rundenzeiten bleiben auf das einzelne Rennen beschränkt; die Regel „keine gemeinsame Leistungsrangliste über unterschiedliche Ausgaben" gilt für sie weiter.

Bestätigt: TFH ist die maßgebliche Quelle für Platzierungen, Checkpoints, Fahrzeiten und Rundenabschlüsse. Ergebniswerte werden nicht manuell überschrieben; Korrekturen erfolgen durch erneuten Import. B2-Auswahl und Spielerzuordnungen bleiben im Stattracker korrigierbar.

Bestätigt: Der Import lädt die Gesamtwertung und die Detaildaten aller ausgewählten B2-Teams vollständig und speichert sie gemeinsam. Bei Ladefehlern wird das Speichern blockiert; vorhandene Daten bleiben unverändert. Kennzahlen, welche die Quelle selbst nicht bereitstellt, werden als fehlend angezeigt, nicht als Zahlenwert null oder unbelegter Ersatzwert.

Die fachlichen Entscheidungen sind geklärt und die Implementierung ist freigegeben.

## Erwogene Alternativen

- Historisches Archiv abgeschlossener Rennen mit Team- und Spielerstatistiken.
- Zusätzlich Begleitung laufender Rennen mit regelmäßiger Aktualisierung.
- Zunächst einmaliger Datenexport ohne Integration in die Anwendung.

## Konsequenzen

Die erste Version benötigt keine Live-Aktualisierung laufender Rennen. Import und Anzeige konzentrieren sich auf historische Ergebnisse. Ergebniskorrekturen werden durch einen erneut geprüften Import übernommen.

Die Gesamtwertung ermöglicht Vergleiche von Platzierungen und Checkpoint-Abständen im gesamten Teilnehmerfeld. Individuelle Auswertungen konzentrieren sich auf B2-Fahrer.

Die gemeinsame Turnierübersicht muss Langstreckenrennen unterstützen. Deren Detailansicht stellt die spezifischen Kennzahlen dar. B2-Teamteilnahmen werden als ausgabenspezifische Turnier-Lineups mit verknüpften Spielern abgebildet; die technischen Tabellen und Beziehungen werden bei der Implementierung festgelegt.

## Geprüfte technische Fakten und Umsetzung

- Sechs historische Ausgaben mit B2-Beteiligung sind über die öffentliche Schnittstelle ladbar: 24h Race #2, #3, #4 und 12h RPG #1, #2, #3. Vertragsprüfungen für diese Ausgaben sind als optionale Live-Tests vorhanden.
- Die interne Event-ID wird aus der Eventseite gelesen; sie ist nicht generell identisch mit der Nummer der Ausgabe.
- `CalculatedTotalPlayTime` wird wie auf der TFH-Seite als Fahrzeit in Sekunden übernommen. `LastCPTime`, Rundenzeiten und Checkpoint-Splits werden in Millisekunden geliefert. Für beste und durchschnittliche Runde verwendet TFH den letzten Split der jeweiligen Zeitreihe. Die vollständigen Split-Reihen bleiben gespeichert.
- TFH zeigt CPM-Werte kleiner oder gleich null als fehlend an; der Import übernimmt diese Konvention. Fahrzeit und Rundenwerte werden nicht aus den Finishes neu errechnet.
- Finishes enthalten Zeitstempel, Zeit, Rang und Typ. Der Typ wird unverändert gespeichert; seine fachliche Bedeutung wird nicht angenommen und er wird nicht als Leistungskennzahl dargestellt. Vollständige Stints, Fahrerwechsel und Pausenzeiten lassen sich aus diesen Daten nicht zuverlässig rekonstruieren.
- Account-IDs stimmen bei bekannten Fahrern mit den UUIDs im bestehenden Spielerbestand überein. Neue Profile benötigen einen expliziten Status; dieser gilt zunächst von Anfang an und kann über die bestehende Statushistorie weiter gepflegt werden.
- Die Speicherung verwendet eigene `TfhRace`, `TfhTeam`, `TfhDriver` und `TfhFinish`-Tabellen neben den bestehenden Turnieren und Lineups. `TfhIdentity` hält bestätigte Zuordnungen auch bei abgewählten Teams fest.
- Eine serverseitige, an den Admin gebundene Vorschau gilt 30 Minuten. Die Bestätigung speichert ihren vollständigen Datenstand in einer Transaktion. Eine Revisionsprüfung schützt vor Bestätigung veralteter Vorschauen und parallelen Imports.
- Bestehende Bearbeitungsrouten für Turniere und Lineups verweisen bei TFH auf den Importablauf. Round-Statistiken und eCM-Importauswahl schließen TFH-Ausgaben aus.

Bedienung und Prüfbefehle: [TFH-Import](../tfh-import.md).
