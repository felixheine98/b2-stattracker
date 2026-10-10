# Gegnerdatenbank: vereinbartes Konzept

Stand: 10. Oktober 2026. Im Designgespräch bestätigt; noch nicht implementiert.

## Ziel und Umfang

Die Priorität ist **einfache Match-Erfassung → Vorbereitung auf Gegner → Auswertungen**. Beim Anlegen eines Matches sollen bekannte Gegner schnell auswählbar sein. Feste Teams, temporäre Mixteams und wechselnde Besetzungen müssen dabei unterscheidbar bleiben.

Zur vereinbarten ersten Version gehören neben Auswahl und Logos auch Gegnerprofile, optionale Kader, Notizen, Spielerzuordnung, Gegnerstatistiken, bestätigte Matchabschlüsse und die manuell ausgelöste Übernahme einzelner Teams aus einem Google Spreadsheet. Dieses Dokument beschreibt das fachliche Verhalten, keine fertige Datenbankmigration oder technische Implementierung.

## Identität: Team, Competition-Lineup und Person

| Ebene | Bedeutung | Verhalten |
| --- | --- | --- |
| Festes Team | Dauerhafte Organisation bzw. Teamidentität | Global auffindbar; Name, Logo und optionaler aktueller Teamkader |
| Competition-Lineup | Konkreter Gegner-Eintrag innerhalb einer Competition | Gehört optional zu einem festen Team; eigener Name, optionale Besetzung, Notizen und optional eigenes Logo |
| Temporäres Mixteam | Competition-Lineup ohne festes Team | Zunächst nur in seiner Competition angeboten; später wiederverwendbar oder einem dauerhaften Team zuordenbar |
| Person | Ein Mensch mit bestätigter Trackmania-Account-ID | Eine gemeinsame Identität für eigene und gegnerische Einsätze |
| Tatsächlicher Einsatz | Person auf einer Seite einer erfassten Runde/eines Matches | Historischer Nachweis unabhängig von geplanten Kadern |

Ein festes Team kann mehrere Competition-Lineups haben, etwa Alpha und Bravo. Änderungen am aktuellen Teamkader verändern keine historische Matchbesetzung.

Wird ein bekanntes Lineup in einer neuen Competition übernommen, entsteht eine **neue Competition-Teilnahme mit Verbindung zur bisherigen**. Ergebnisse und Besetzungen der bisherigen Teilnahme bleiben erhalten. Das gilt auch für Mixteams. Der bisherige geplante Kader kann optional mitkopiert werden.

Reine Gegnerpersonen werden durch ihre Erfassung nicht automatisch zu eigenen Membern oder Gästen. Wenn ein vorhandener Member/Gast gegen uns fährt, bleiben dessen Identität und Vereinsstatus erhalten; seine Seite wird am jeweiligen Ergebnis unterschieden.

## Gegner auswählen und pflegen

Beim Matchanlegen gibt es ein gemeinsames Suchfeld:

1. Zuerst werden Lineups der aktuellen Competition angeboten.
2. Über die Suche sind feste Teams global auffindbar.
3. Neue Teams, Lineups oder Mixteams lassen sich direkt im Ablauf anlegen.
4. Hat ein ausgewähltes festes Team noch kein Lineup in dieser Competition, wird automatisch eines mit dem Teamnamen angelegt. Eine zusätzliche Namenseingabe ist im Standardfall nicht nötig.
5. Mehrere Lineups desselben Teams erhalten unterscheidbare Namen.

Ein Name reicht zum Anlegen. Logos und Kader sind optional. Beim Anlegen eines neuen Lineups wird ein vorhandener Teamkader vollständig vorbefüllt; Spieler lassen sich entfernen oder ergänzen, einschließlich externer Ersatzspieler. Beim Übernehmen einer früheren Teilnahme kann stattdessen deren geplanter Kader als Vorlage dienen.

Lineups erben das Logo ihres festen Teams, können es aber überschreiben. Mixteams dürfen ebenfalls ein eigenes Logo haben. Ohne Logo wird ein Kürzel angezeigt.

### Historie und Archiv

- Frühere Begegnungen zeigen den damaligen Competition-Lineup-Namen. Das feste Teamprofil zeigt den aktuellen Teamnamen; frühere Namen bleiben suchbar.
- Tippfehler können gezielt korrigiert werden. Eine echte spätere Umbenennung schreibt nicht pauschal die historische Anzeige um.
- Nicht mehr aktive Teams und Lineups werden archiviert und aus der normalen Auswahl ausgeblendet. Über eine explizite Archiv-Auswahl bleiben sie auffindbar und wiederverwendbar.
- Unbenutzte Fehleinträge dürfen gelöscht werden; Einträge mit Historie werden grundsätzlich erhalten.

## Kader und tatsächliche Besetzungen

Geplanter Teamkader, geplanter Competition-Lineup-Kader und tatsächliche Einsätze werden getrennt geführt.

Imports ergänzen automatisch die **tatsächlich angetretenen Spieler**. Sie machen einen einmaligen Ersatzspieler nicht automatisch zum Mitglied des geplanten Kaders. Auf der Gegnerseite sind bisher eingesetzte Spieler auch ohne manuell gepflegten Kader sichtbar.

Wird der globale Teamkader aktualisiert, bleiben bestehende Competition-Lineups unverändert. Der neue Stand dient als Vorlage für neue Lineups. Bei bestehenden Lineups kann ausdrücklich „Teamkader abgleichen“ aufgerufen werden; Änderungen werden einzeln übernommen. Tatsächliche historische Einsätze bleiben dabei unverändert.

## Gegner- und Spielerzuordnung bei Imports

### Teams und Lineups

Eindeutige bekannte Namen und gespeicherte Alternativnamen werden automatisch zugeordnet. Bei unbekannten oder mehrdeutigen Gegnernamen wählt der Nutzer einen bestehenden Gegner oder legt einen neuen an. Die Zuordnung kann für die jeweilige Competition gespeichert werden.

Eine ähnliche oder identische Spielerbesetzung allein begründet keine automatische Teamzuordnung: Dieselben Personen können in mehreren Mixteams antreten.

### Personen und Trackmania.io

- Echte Trackmania-IDs ermöglichen automatische Wiedererkennung.
- Name-only-Auftritte bleiben bis zur bestätigten Zuordnung getrennt. Gleiche Namen sind kein Identitätsnachweis.
- Anonyme Gegnerplätze zählen nur für Teamstatistiken, nicht für persönliche Statistiken.
- Die bestehende Trackmania.io-Suche wird für die Zuordnung verwendet bzw. erweitert.
- Bei einer Zuordnung zeigt die App **gleichnamige Auftritte über alle Competitions**. Admins und Manager wählen ausdrücklich aus, welche Auftritte zur gefundenen Person gehören.
- Auch die Zuordnung zu einem bereits vorhandenen eigenen Spieler oder Gegnerprofil muss möglich sein. Bestätigte Zuordnungen zur gleichen Trackmania-ID ergeben eine gemeinsame Personenhistorie.

Die heutige Member-Funktion bietet Suche und ID-Korrektur, aber noch keine Zusammenführung mit einem bereits vorhandenen Profil. Dieser Teil ist neue Funktionalität. Bereits belegte Ergebnisse derselben Runde dürfen bei einer Zusammenführung nicht doppelt gezählt werden; die technische Konfliktbehandlung muss bei der Umsetzung berücksichtigt werden.

## Gegnerseite und Notizen

Die Gegnerseite bietet einen gemeinsamen Überblick statt einer reinen Verwaltungsliste:

- Name, Logo, Lineup-Notizen und bisherige Begegnungen stehen im Vordergrund.
- Darunter folgen optionaler Kader, tatsächlich eingesetzte Spieler und deren Statistiken.
- Bei festen Teams kann zwischen den Competition-Lineups gewechselt werden.
- Notizen werden am Competition-Lineup und am Match gepflegt; eine zusätzliche allgemeine Teamnotiz ist zunächst nicht vorgesehen.
- Bei übernommenen Lineups bleiben frühere Notizen erreichbar, werden aber nicht automatisch als aktuell übernommen.
- Auf dem Handy stehen die Bereiche untereinander; Auswahl, Bearbeitung und Statistikansichten müssen die mobilen Regeln aus `AGENTS.md` erfüllen.

## Statistiken

Die Statistiken beschreiben die **bei uns erfassten Begegnungen**, keine vollständige allgemeine Karriere- oder Teamhistorie.

### Teams und Lineups

Die Gegnerseite zeigt Begegnungen und die Bilanz abgeschlossener Matches. Beim festen Team können alle zugehörigen Lineups zusammen betrachtet werden. Beim Competition-Lineup steht die aktuelle Competition im Vordergrund; verbundene frühere Teilnahmen können dazugenommen werden.

### Einzelne gegnerische Spieler

Bereits die erste Version bietet sowohl die Ergebnisbilanz bei tatsächlichem Einsatz als auch individuelle Leistungen:

- Im Vordergrund steht die **Rundenbilanz aus tatsächlich gefahrenen Runden**. Eine einzelne Teilnahme schreibt dem Spieler nicht das Ergebnis des gesamten Matches zu.
- Die ganzen Matches bleiben als Begegnungshistorie erreichbar.
- Individuelle Werte umfassen Platzierungen, abgeleitete Punkte und verfügbare Zeiten, mapbezogen aufgeschlüsselt.
- Platz-, Punkte- und Rundenstatistiken werden nach Format getrennt, etwa 2v2 und 3v3. Es gibt zunächst keinen normalisierten formatübergreifenden Leistungswert. Übergreifende Einsatzsummen sind möglich.
- Map-Zeitvergleiche erfolgen zunächst nur innerhalb derselben Competition, gruppiert nach Mapname. Ergebnisse ohne Mapnamen werden keinem gemeinsamen Map-Zeitvergleich zugeschlagen.
- Eine competitionübergreifende Mapidentität oder Versionsverwaltung gehört nicht zu diesem Entwurf.

Bei der Umsetzung sind vorhandene Rundenauswertungen wiederzuverwenden: DNF und fehlende Zeit sind unterschiedliche Sachverhalte; fehlende Zeitwerte dürfen keine erfundenen Zeiten erzeugen. Die Datenbasis und Messabdeckung müssen bei Zeitstatistiken nachvollziehbar bleiben.

## Matchabschluss und verlässliche Team-Matchbilanz

Ein Match wird ausdrücklich als abgeschlossen bestätigt. Nur abgeschlossene Matches zählen zur Team-Matchbilanz; laufende oder unvollständige Matches bleiben in der Historie sichtbar.

Beim Abschließen schlägt die App das Ergebnis anhand der erfassten Submatches vor. Der Nutzer bestätigt oder korrigiert es, beispielsweise wegen unvollständiger Imports, Sonderregeln oder eines kampflosen Sieges. Eine Korrektur des bestätigten Endergebnisses verändert keine gefahrenen Runden oder individuellen Leistungsdaten.

Ändern sich nach dem Abschluss die Ergebnisdaten, etwa durch einen Import oder eine Rundenkorrektur, wird das Match wieder geöffnet. Bis zur erneuten Bestätigung fällt es aus der Team-Matchbilanz heraus. Die bisherige Bestätigung bleibt nachvollziehbar.

Änderungen nur an Notizen, Logos oder Gegnerzuordnungen öffnen ein Match nicht erneut.

## Berechtigungen

| Aktion | Berechtigte |
| --- | --- |
| Gegner anlegen; Namen, Logos, Kader und Notizen bearbeiten | Admins, Manager und jeweilige Lineup-Verantwortliche, die Matches verwalten dürfen |
| Globale Teams zusammenführen oder löschen | Nur Admins |
| Trackmania.io-Zuordnungen und Zusammenführungen von Spieleridentitäten bestätigen | Admins und Manager, auch competitionübergreifend |

## Bestehende Gegnerdaten übernehmen

Bestehende `Match.opponent`-Freitexte werden zunächst **pro Competition** übernommen. Gleiche Namen innerhalb einer Competition werden zu einem Gegner-Lineup zusammengefasst.

Die Verbindung zu einem festen Team oder zu früheren Competition-Teilnahmen wird anschließend bei Bedarf hergestellt. Gleiche Namen über verschiedene Competitions werden nicht automatisch als dieselbe Teamidentität behandelt.

## Google Spreadsheet als manuell genutzte Teamquelle

Quelle: [TrackMania Team List – 2026, Blatt Team List](https://docs.google.com/spreadsheets/d/1VRB3b8dS38T8CadWAu-SZj8A5BK7eEwA3jFb-O0Aufo/edit#gid=492976099).

### Geprüfte Eigenschaften der Quelle

Die Quelle wurde am 10. Oktober 2026 read-only geprüft:

- Öffentlich ohne Anmeldung abrufbar.
- Gestaltete Teamblöcke mit zusammengeführten Zellen, nicht eine einheitliche Tabelle mit festen Datensatzspalten.
- Teamnamen, Spielernamen und Länder sind vorhanden. Eindeutige Spieler-UUIDs oder Trackmania.io-Profillinks wurden nicht gefunden.
- Enthält auch Academy-, Inactive- und andere Untergruppen sowie teilweise Staff/Rollen. Räumlich benachbarte Blöcke gehören nicht zwangsläufig zur selben Organisation.
- Teamlogos sind eingebettete Bilder. Im HTML sind abrufbare Bild-URLs vorhanden, im XLSX eingebettete Bilddateien mit Zellankern. Die Logoübernahme ist damit grundsätzlich möglich.
- CSV allein reicht nicht: Logos und relevante Layoutinformationen fehlen darin.
- Es wurden keine fachlich stabilen Team-IDs gefunden. Zellpositionen können sich bei Bearbeitungen verschieben.
- Die dauerhafte Gültigkeit der von Google erzeugten Bild-URLs ist nicht belegt; bestätigte Logos sollen als eigene Kopie gespeichert werden.

### Übernahme eines Teams

1. Der Nutzer startet ausdrücklich „Team aus Spreadsheet übernehmen“.
2. Die App liest die Quelle für die Suche; dadurch werden noch keine Teams in die Gegnerdatenbank importiert.
3. Der Nutzer sucht ein Team und wählt einen konkreten Teamblock.
4. Eine Vorschau zeigt Name, Logo und erkannte Mitglieder/Länder. Personen können abgewählt werden; weitere zugehörige Blöcke können ausdrücklich hinzugefügt werden.
5. Nach Bestätigung wird nur das gewählte Team samt ausgewählten Daten übernommen. Das Logo wird als eigene Kopie gespeichert.
6. Die Personen bilden zunächst einen aktuellen Teamkader; ohne bestätigte Account-ID wird keine sichere Personenidentität unterstellt.

Es gibt **keinen initialen Gesamtimport und keinen automatischen regelmäßigen Abgleich**. Das Lesen der Quelle zur Suche ist vom Speichern ausgewählter Teams zu unterscheiden.

### Manuell aktualisieren

Bei einem verknüpften Team kann „Änderungen prüfen“ ausgelöst werden. Unterschiede zum zuletzt übernommenen Quellstand werden zur selektiven Bestätigung angezeigt. Die Quelle überschreibt keine lokalen Daten ungefragt.

Die Quellenverknüpfung muss das Wiederfinden des Teamblocks unterstützen. Blatt, ursprünglicher Name und Zellbereich sind mögliche Suchhinweise; eine Zelladresse allein darf keine dauerhafte Teamidentität darstellen. Wird der Block nicht eindeutig wiedergefunden, ist eine neue Auswahl nötig.

Der übernommene Mitgliederstand ist ein **aktueller Teamkader**, kein historischer Competition-Kader. Aktualisierungen dienen als Vorlage für neue Lineups. Bestehende Competition-Lineups werden nur über ihren ausdrücklich aufgerufenen Teamkader-Abgleich geändert; historische Matchbesetzungen werden niemals aus dem Spreadsheet ersetzt.

## Technische Ausgangslage und Umsetzungshinweise

Zum Zeitpunkt der Recherche:

- Gegner werden bislang als optionaler Freitext `Match.opponent` gespeichert; eigene Team-/Gegnerentitäten fehlen.
- Eigene `TournamentLineup`-Einträge sind bereits competitiongebunden, tatsächliche eigene Aufstellungen zusätzlich SubMatch-bezogen.
- CSV-Ergebnisse enthalten echte Gegner-IDs; eCM-Ergebnisse können synthetische IDs aus Namen enthalten, manuelle Ergebnisse anonyme Platzhalter. Diese Werte dürfen nicht pauschal als globale Personen-IDs übernommen werden.
- Die bestehende Spielerstruktur behandelt Member/Gäste. Personenidentität und Zugehörigkeit zum eigenen Pool müssen für reine Gegner sauber getrennt werden.
- Maps haben bisher nur einen optionalen Namen, keine stabile ID.
- Ein expliziter bestätigter Matchabschluss fehlt bisher.
- Bestehende eCM-Zuordnung nutzt Gegnernamen und muss die neuen Identitäten/Alternativnamen berücksichtigen.

Umgesetzt auf dem Branch `opponent-database`. Bedienung, Datenmodell, Migrationen und Prüfungen stehen in [gegner-db.md](gegner-db.md). Der Parser unterstützt die geprüften Teamblöcke mit zusammengeführten Zellen; bei unbekanntem Layout oder mehrdeutiger Quellenverknüpfung ist eine erneute Auswahl erforderlich.

Für die Umsetzung gelten die Repository-Regeln: Logik test-first in reinen `.ts`-Modulen, Tests und Typecheck im App-Container, aktuelle lokale Next.js-Dokumentation beachten und mobile Bedienung durchgehend berücksichtigen.
