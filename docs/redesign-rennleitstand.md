# B2 Stats: Rennleitstand

Entwurf vom 22.10.2026 auf `redesign/rennleitstand`, zunächst ausschließlich in der laufenden Dev-Umgebung. Kein Production-Deployment.

## Gestaltung

B2-Blau `#002484` trägt die Navigation und die Ergebnisleisten. Deren gelbe Unterkante `#FBD00D` ist das gemeinsame Match-Motiv. Die vorhandenen Theme-Paletten bleiben unverändert: unter anderem das bisherige B2 Dark, B2 Light, Warm Light, Midnight, OLED Black und B2 Blue. Das neue Layout verwendet deren bestehende Farben weiter; die gespeicherte Theme-Auswahl bleibt erhalten. Die helle Variante des Entwurfs lässt sich unter **Appearance → B2 Light** ansehen.

IBM Plex Sans ist die Leseschrift, Barlow Semi Condensed setzt Seitentitel und Ergebnisse. Vergleichbare Zahlen nutzen tabellarische Ziffern. Technische Kennungen und Zeit-Eingaben dürfen weiter Monospace verwenden. Abschnittstitel sind nicht mehr durchgehend großgeschrieben.

## Umgesetzt

- Gemeinsame Palette, Typografie, Navigation, Formularfelder, Buttons, Badges und Dialoggestaltung für alle Unterseiten, einschließlich Imports, Gegnern, TFH, Discord, Konten und Dev-Werkzeugen.
- B2-Navigation mit gelber Markierung der aktiven Seite; mobile Kopf- und Fußnavigation. Die Kontofunktionen und Style-Unterpunkte bleiben erreichbar.
- Match-Ergebnis als eigene Leiste mit Comp, Lineup, Gegner, Zählweise und offenem/geschlossenem Zustand. Seeding bleibt davon ausgenommen.
- Dashboard: Antworten und Comp-Ergebnisse vor den Gesamtkennzahlen. Bei einer Comp mit genau einem Lineup lässt sich dessen letztes Ergebnis eindeutig als Leiste darstellen; bei mehreren bleiben die Ergebnisse in ihren Lineup-Zeilen.
- Kennzahlen auf Dashboard und Profil als gemeinsame ruhige Leiste; statistische Tabellen mit Leseschrift und ausgerichteten Ziffern.
- Turnierübersicht als nach Jahren gruppierte Zeilen mit Style, Formaten, Zeitraum und Match-/Teamzahl.
- Planung mit klaren Bereichs-Tabs, Verfügbarkeit vor den Verwaltungsfeldern auf dem Handy, abgegrenzten Arbeitsflächen und Spielerpool je Option; Ziehen/Antippen und bestehendes Speichern bleiben erhalten.
- B2-Anmeldung mit gemeinsamer Markenfläche; orange Logo/Favicon weiterhin nur bei `next dev`.

## Grenzen und weitere Abstimmung

Dies ist die erste Umsetzung der Designrichtung auf den bestehenden Abläufen. Die im Vorschlag beschriebenen zusätzlichen Import-Schritte, eine neue Kontostruktur und umfassend neue Bearbeitungsabläufe sind damit noch nicht eingeführt. Bestehende Berechnungen, Rechte, Imports, Datenmodelle und Feature-Schalter bleiben unverändert.

`page-wide`, `page-narrow` und die vorhandenen Seitenraster gelten weiterhin. Unter 768 px bleiben Dialoge im Vollbild, Eingaben mindestens 16 px groß und Statistik-Tabellen seitlich scrollbar mit fixierten Namen. Buttons bekommen auf dem Handy mindestens 44 px Höhe. Reduzierte Bewegung wird respektiert.

Formatregeln und Screenshot-Abgleich bleiben durch ihre vorhandenen Feature-Schalter auf Dev begrenzt. Ein späteres Production-Deployment braucht eine eigene Freigabe.

## Prüfung dieses Stands

- 482 reguläre Tests erfolgreich; 70 opt-in-Datenbanktests wie vorgesehen übersprungen.
- Typecheck und ESLint erfolgreich im Dev-Container.
- 18 geschützte Seiten mit den bestehenden Dev-Daten serverseitig abgerufen: jeweils HTTP 200 ohne Next-Renderfehler; Planungs- und Lineup-Tab zusätzlich separat geprüft. Die kurzlebige lokale Prüfsession wurde ausschließlich im Prüfprozess verwendet.
- Gerenderte Ansichten bei 360 px auf seitlichen Seiten-/Main-Überlauf geprüft; Desktop- und Handyansichten von Match und Planung sowie helle/dunkle Varianten visuell geprüft. Für die umfangreichen Spieler-/Gegnerlisten wurden in den isolierten Layout-Snapshots nur Icons bzw. Logo-Bilddaten verkürzt.
- Der Login wurde direkt im Dev-Browser geprüft. Geschützte Client-Dialoge und Schreibaktionen sind nicht durch einen vollständigen Browser-Durchlauf abgedeckt; die Überprüfung schreibt keine Anwendungsdaten.
