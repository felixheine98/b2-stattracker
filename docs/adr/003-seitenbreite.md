# Seitenbreite am Desktop

Status: Akzeptiert – gemeinsames Verständnis vom Nutzer bestätigt, umgesetzt auf dem Branch `feat/page-width`. Die Oberfläche ist noch nicht im Browser geprüft.

## Kontext

Auf breiten Bildschirmen bleibt rechts neben dem Inhalt viel Platz leer. Jede Seite setzt ihre eigene Höchstbreite und steht linksbündig; eine Begründung dafür ist weder im Code noch in der Doku festgehalten. Im Einsatz sind vier verschiedene Breiten: 672px (eCM-Import), 896px (Turnierliste, Turnierseite, Lineup-Seite, Planung), 1024px (Dashboard, Spieler, Profil, Match, Gegner, Accounts, TFH-Import) und 1152px (TFH-Rennen, TFH-Fahrersummen).

Unter 768px gilt das Handy-Layout; es ist von diesem Vorhaben nicht betroffen.

## Entscheidung

Bestätigt: Die App kennt am Desktop zwei feste Höchstbreiten. „Breit“ für Seiten mit Daten (Planung, Listen, Stats-Tabellen, Dashboard, Profile, Match), „Schmal“ für reine Formular- und Importseiten. „Breit“ ist 1536px, „Schmal“ 768px.

Bestätigt: „Schmal“ sind nur die beiden Importseiten (eCM-Import, TFH-Import). Alle anderen Seiten sind „Breit“: Dashboard, Spieler, Profil, Turnierliste, Turnierseite, Lineup-Seite, Planung, Match, Gegner und Gegnerprofile, Accounts, TFH-Rennen, TFH-Fahrersummen.

Bestätigt: Der Inhalt steht auf allen Seiten linksbündig neben der Sidebar, wie bisher.

Bestätigt: Auf den breiten Seiten bekommen Kartenraster ab etwa 1280px drei statt zwei Spalten (Turnierliste, Lineups der Turnierseite, Gegner, aktuelle Turniere im Dashboard). Die Planung behält ihre drei Spalten. Tabellen wachsen mit, ohne Strukturänderung. 

Bestätigt: Fünf Seiten werden zusätzlich zweispaltig: Turnierseite, Lineup-Seite, Spielerprofil, Planung und Dashboard. Listen- und Tabellenseiten (Spieler, Turnierliste, Gegner, Accounts, TFH-Fahrersummen) und die Match-Seite bleiben einspaltig. Zweispaltig wird es ab etwa 1536px Fensterbreite; darunter stehen die Abschnitte untereinander wie bisher. Der Kopfbereich einer Seite bleibt über die ganze Breite.

Bestätigt: Turnierseite und Lineup-Seite im Verhältnis 2:1. Auf der Lineup-Seite stehen links breit die Stats samt Filter und „Maps at a glance“ und darunter die Matches als einklappbarer, standardmäßig aufgeklappter Abschnitt, rechts schmal nur der Kader. Auf der Turnierseite stehen links die Stats und darunter die Matches als standardmäßig eingeklappter Abschnitt, rechts nur die Lineups untereinander (beide geändert am 13.10.2026: die lange Matchliste zog die rechte Spalte weit nach unten). Der Lineup-Filter der Turnierseite hat eine eigene Zeile, Abschnitts- und Format-Filter stehen darunter nebeneinander.

Bestätigt: Spielerprofil in zwei gleich breiten Spalten. Links „Overall“, „By style“ und der Langstreckenabschnitt, rechts die Turniere als aufklappbare Karten. Der Kopf mit Name, Status und Namenshistorie bleibt über die ganze Breite.

Bestätigt: Planung, Reiter Availability: links breit die eigene Antwort und die Gruppen, mit vier bis fünf Spalten nebeneinander statt drei; rechts schmal „Extra levels“ und „Add a guest“. Wer nicht verwalten darf, sieht keine Randspalte, die Liste läuft dann über die volle Breite. Der Reiter Variants bleibt einspaltig und bekommt mehr Lineup-Spalten.

Bestätigt: Dashboard im Verhältnis 2:1. Links breit die Karten für aktuelles und letztes Turnier, rechts schmal „Next Tournament“ und darunter „Overall“ mit den vier Kacheln in zwei mal zwei. Ohne anstehendes Turnier steht rechts nur „Overall“.

Bestätigt: Breite und Spaltenaufteilung stehen als benannte Klassen in `globals.css`: `page-wide` und `page-narrow` für die Breite, `page-columns` (2:1) und `page-columns-even` (1:1) für die Zweispalter. Jede Seite verwendet sie statt eigener Zahlen. `AGENTS.md` bekommt die Regel, dass neue Seiten eine der beiden Breiten nehmen.

## Erwogene Alternativen

- Volle Breite ohne Grenze: nutzt jeden Bildschirm ganz, zieht Tabellen und Text auf sehr breiten Monitoren aber auseinander. Nicht gewählt.
- Nur die vier heutigen Breiten anheben: kleinste Änderung, die Uneinheitlichkeit bliebe. Nicht gewählt.
- Inhalt zentriert, oder nur schmale Seiten zentriert: nicht gewählt; die feste linke Kante bleibt beim Seitenwechsel ruhig.
- TFH-Import „Breit“ lassen, oder nur eine einzige Breite für alle Seiten: nicht gewählt.
- Nur die Breite ändern ohne Raster, oder alle Seiten zweispaltig umbauen: nicht gewählt.
- Nur Turnierseite, Lineup-Seite und Profil zweispaltig, oder nur die ersten beiden: nicht gewählt.
- Variants-Board mit festem Topf als linke Spalte: nicht gewählt; der Ziehweg würde quer und der Umbau am Board heikel.
- Dashboard mit beiden Turnierkarten nebeneinander oder „Next Tournament“ als linke Spalte: nicht gewählt.
- Breite im gemeinsamen Layout setzen, oder weiter je Seite mit eigenen Zahlen: nicht gewählt.

## Offene Fragen

Keine.

## Konsequenzen

- 16 Seiten tauschen ihre eigene Höchstbreite gegen eine der beiden Klassen; der TFH-Import wird dabei schmaler (1024px auf 768px), alle anderen breiter.
- Fünf Seiten bekommen ab etwa 1536px Fensterbreite einen zweispaltigen Aufbau. Darunter und im Handy-Layout bleibt die Reihenfolge der Abschnitte wie bisher; die Reihenfolge im Code bestimmt sie.
- Auf Turnier- und Lineup-Seite stehen die Stats am Desktop links vor Lineups und Matches, untereinander aber weiter danach.
- Reine Layout-Änderung ohne Logik, also ohne automatische Tests; geprüft wird im Browser bei mehreren Fensterbreiten und in Handybreite.
- Ein zweispaltiges Variants-Board und zweispaltige Listen- und Match-Seiten sind nicht Teil des Vorhabens.
