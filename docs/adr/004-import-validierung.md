# Importierte Matchdaten gegen das eingetragene Match prüfen

Status: Akzeptiert – gemeinsames Verständnis vom Nutzer am 13.10.2026 bestätigt; umgesetzt, in Dev. Die Oberfläche ist noch nicht im Browser geprüft. Begriffe: [Glossar](../import-validierung-glossar.md).

## Kontext

Ein Match wird von Hand angelegt: eigenes Lineup, Gegner (Freitext oder Gegner-Lineup aus der Gegner-DB), Datum, Abschnitt, Sub-Matches mit Format. Die Runden kommen danach meist über einen Import: als CSV eines Match-Dumpers oder von der eCircuitMania-Seite (eCM).

Der eCM-Import kennt beide Teamnamen und die Spielernamen und sucht das Match über den Gegnernamen; danach prüft er nichts mehr. Der CSV-Import kennt keine Teams, nur Account-IDs, Namen, Zeiten und die Uhrzeit der Runden. Wer zum eigenen Team gehört, ergibt sich aus der Auswahl in der Vorschau; alle anderen Fahrer werden ungeprüft dem am Match eingetragenen Gegner-Lineup zugeschrieben. Ein CSV vom falschen Match landet so ohne Hinweis im Match und hängt dem eingetragenen Gegner fremde Spieler an.

## Entscheidung

Bestätigt: Geprüft wird beim Import, in der Vorschau vor dem Speichern. Eine nachträgliche Prüfung bestehender Matches ist nicht Teil des Vorhabens.

Bestätigt: Geprüft werden drei Angaben des Matches. Gegner: die fremden Fahrer im Import gehören zum eingetragenen Gegner-Lineup. Eigenes Lineup: die eigenen Fahrer im Import stehen im Kader des Lineups, zu dem das Match gehört. Datum: die Runden wurden am Tag des Matches gefahren (nur CSV, eCM liefert kein Datum). Das Format wird nicht zusätzlich geprüft; beim CSV bleibt die vorhandene Prüfung auffälliger Runden.

Bestätigt: Eine Abweichung sperrt den Import nicht. Die Vorschau zeigt sie als Hinweis, und gespeichert wird erst nach ausdrücklichem Bestätigen. Abweichungen können legitim sein (Ersatzfahrer außerhalb des Kaders, Gast beim Gegner, Match über Mitternacht).

Bestätigt: Ob ein fremder Fahrer zum eingetragenen Gegner gehört, wird an den bekannten Fahrern gemessen, weil kaum ein Gegner-Lineup einen eingetragenen Kader hat (Production am 13.10.2026: 52 von 53 ohne Kader, 2 mit festem Team). Bekannt bei einem Gegner ist, wer im Kader des Gegner-Lineups oder seines festen Teams steht oder in einem früheren Match gegen dieses Gegner-Lineup gefahren ist. Daraus entstehen zwei Hinweise:

- Der Gegner hat bekannte Fahrer, aber keiner der fremden Fahrer im Import ist darunter.
- Ein fremder Fahrer ist bei einem anderen Gegner desselben Turniers bekannt; der Hinweis nennt diesen Gegner.

Ist über den Gegner nichts bekannt und kein Fahrer woanders bekannt, gibt es keinen Hinweis. Einzelne neue Fahrer bei einem bekannten Gegner lösen nichts aus.

Bei der Umsetzung festgestellt: Als bekannt zählen nur Fahrer mit echtem Trackmania-Account. Ergebnisse aus eCM-Importen und anonyme Platzierungen tragen Platzhalter statt Accounts (Production am 13.10.2026: 127 Namen aus eCM, 10 anonyme Plätze, nur 10 echte Accounts) und sagen nichts darüber, zu wem ein Account gehört. Die im Interview genannte Zahl „147 Fahrer mit echter Account-ID“ war falsch. Die Hinweise zum Gegner greifen deshalb erst bei Gegnern, gegen die schon per CSV importiert wurde oder deren Kader mit Accounts gepflegt ist.

Bestätigt: Beim eigenen Lineup gibt es drei Hinweise, jeweils pro Fahrer mit Namen:

- Ein als eigener markierter Fahrer steht nicht im Kader des Lineups, zu dem das Match gehört.
- Ein als eigener markierter Fahrer steht im Kader eines anderen B2-Lineups desselben Turniers; der Hinweis nennt dieses Lineup.
- Ein Fahrer aus dem Kader des Lineups ist im Import als Gegner eingeordnet.

Bestätigt: Das Datum weicht ab, wenn die erste Runde des Imports nicht am Tag des Matches gefahren wurde, gerechnet in deutscher Ortszeit. Maßgeblich ist der Start, ein Match über Mitternacht löst nichts aus. Der Hinweis nennt beide Tage, und die Vorschau bietet an, das Datum des Matches auf den Tag aus dem CSV zu setzen; damit ist die Abweichung behoben statt nur bestätigt. Der Import ändert das Datum nie von selbst.

Bestätigt: Hat das Match kein Datum, bietet die Vorschau ebenfalls an, den Tag aus dem CSV zu setzen. Das Angebot ist vorausgewählt und lässt sich abwählen; ein fehlendes Datum ist keine Abweichung und verlangt kein Bestätigen.

Bestätigt: Der eCM-Import prüft, was seine Daten hergeben (Teamnamen und Spielernamen, keine Account-IDs, kein Datum):

- Gegner: Der Name des anderen Teams auf der eCM-Seite passt zum eingetragenen Gegner, über Name oder Alias, ohne Groß- und Kleinschreibung, Leerzeichen und Satzzeichen.
- Eigenes Team: Der Name des eigenen Teams auf der eCM-Seite passt zum Namen des Lineups.
- Eigene Fahrer: dieselben drei Hinweise wie beim CSV, über die zugeordneten Profile.

Gegnerische Fahrer prüft der eCM-Import nicht, weil nur Namen vorliegen.

Bestätigt: Der Server berechnet die Hinweise in einem eigenen Prüfaufruf zur Vorschau; die Vorschau zeigt sie und sperrt das Speichern bis zum Bestätigen. Beim Speichern prüft der Server nicht erneut. Die Regeln liegen als reine Funktion in `lib/` und werden dort getestet.

Bestätigt: Wird trotz Hinweisen importiert, hält der Import das als angehängte Zeile in den Notizen des Matches fest. Ein eigenes Feld oder eine eigene Anzeige gibt es nicht.

Bestätigt: Die Zeile nennt Datum, Namen des Importierenden und die bestätigten Hinweise in Kurzform und beginnt immer gleich, damit der nächste Import sie wiederfindet. Ein erneuter Import ersetzt die Zeile des vorherigen; läuft er ohne Hinweise, verschwindet sie. Handgeschriebene Notizen bleiben unberührt. Ein per Angebot übernommenes Datum ist kein bestätigter Hinweis und steht nicht in der Zeile.

## Erwogene Alternativen

- Nur der Gegner, oder Gegner und eigenes Lineup ohne Datum: nicht gewählt; das Datum unterscheidet Hin- und Rückspiel derselben Teams.
- Zusätzlich das Format für beide Importe: nicht gewählt; kaputte Runden sind ein anderes Problem als ein falsches Match.
- Reiner Hinweis ohne Bestätigen: nicht gewählt; leicht zu übersehen.
- Sperre bis zur Korrektur des Matches, auch abgestuft nur bei völliger Abweichung: nicht gewählt; jeder Ersatzfahrer erzwänge den Umweg über die Stammdaten, und eine Schwelle löst bei Mixes und unvollständigen Gegner-Kadern falsch aus.
- Gegner nur am eingetragenen Kader messen: nicht gewählt; greift heute bei einem von 53 Gegner-Lineups.
- Nur der Hinweis auf einen anderen Gegner: nicht gewählt; sagt nichts beim Rückspiel gegen einen bekannten Gegner mit völlig anderen Fahrern.
- Bekannte Fahrer über alle Turniere hinweg: nicht gewählt; Fahrer wechseln zwischen Turnieren das Team oder fahren in Mixes.
- Eigenes Lineup ohne den Hinweis auf Fahrer außerhalb des Kaders, oder dieser erst, wenn kein eigener Fahrer im Kader steht: nicht gewählt.
- Datum mit einem Tag Spielraum: nicht gewählt; erkennt ein Rückspiel am Folgetag nicht.
- Jede Runde muss am Match-Tag liegen: nicht gewählt; löst bei jedem Match über Mitternacht aus.
- Datum nur melden, ohne Angebot zur Übernahme: nicht gewählt.
- Fehlendes Datum stillschweigend setzen oder leer lassen: nicht gewählt.
- eCM nur mit Teamnamen, oder gar nicht geprüft: nicht gewählt.
- Gegnerische Fahrer bei eCM über den Namen prüfen: nicht gewählt; Namen ändern sich und sind nicht eindeutig.
- Erneute Prüfung beim Speichern mit Ablehnung: nicht gewählt; es geht um Versehen, nicht um Missbrauch.
- Alles im Browser mit mitgelieferten Daten: nicht gewählt; jede Match-Seite lüde die Fahrer aller Gegner des Turniers.
- Bestätigte Hinweise nicht festhalten, oder als eigener Vermerk am Match mit Abhaken: nicht gewählt.
- Notizzeilen sammeln, Vermerk ohne Einzelheiten oder ohne Namen: nicht gewählt; nur die letzte Zeile beschreibt den gespeicherten Stand.
- Nachträgliche Prüfung über bestehende Matches, allein oder zusätzlich: nicht gewählt; sie verhindert nichts und braucht eine eigene Ansicht.

## Offene Fragen

Keine. Aus dem Bestehenden abgeleitet und mit dem Vorhaben bestätigt:

- Hinweise und Notizzeile sind englisch wie die übrige App.
- Ein Seeding-Match hat keinen Gegner; dort entfallen die Hinweise zum Gegner.
- Von Hand eingetragene Runden werden nicht geprüft.
- Das Angebot zum Datum sieht, wer importieren darf.

## Konsequenzen

- Die Regeln entstehen test-first als reine Funktion in `lib/`; dazu kommen ein Prüfaufruf am Server, die Anzeige in beiden Import-Dialogen und das Schreiben der Notizzeile beim Speichern.
- Der Import ändert erstmals Stammdaten des Matches: das Datum (nur auf Angebot) und die Notizen.
- Die Hinweise zum Gegner werden besser, je mehr Matches gegen einen Gegner gespeichert und je mehr Kader gepflegt sind; beim ersten Match gegen einen neuen Gegner bleiben sie still.
- Das Datenmodell bleibt unverändert.
- Regeln: `lib/import-check.ts`; Daten des Matches und Notizzeile: `lib/import-check-db.ts`; Prüfaufruf: `POST …/matches/[matchId]/import/check`; Anzeige: `components/import-check-panel.tsx` in beiden Import-Dialogen. Der eCM-Import speichert seine Runden je Sub-Match und schreibt die Notizzeile danach über `POST …/import/note`.
