# TODOS

## Offen

- [ ] als member -> in tourney übersicht der eigenen stats, danach kann man sich durch die stats durchklicken
- [ ] kategorisierung der comps nach style? (tech mixed rpg ice fs etc)
- [ ] Design/UI/UX Verbesserungen
  - light theme + weitere themes (dark bleibt default)
- [ ] übersichts seite (dashboard) -> letzte comp anzeigen + paar overall stats / stat highlights, pro user evtl spezialisiert auf seine eigenen stats; aufbau so, dass er auch mit mehreren comps funktioniert (einträge untereinander)
- [ ] best performer pro match/week/tourney? -> den auf übersicht auch anzeigen?
- [ ] validierung von importierten daten zu eingegebenen daten (match) -> passt das gegner team etc
- [ ] tournaments seite bei mehreren comps: bleibt eine einfache liste der turniere, anordnung prüfen wenn es mehr werden
- [ ] lineup einteilung für einzelne matches bzw match days

## Teilweise erledigt

- [ ] spieler-profile: eigene seite pro spieler (idee boris; gibt dem spielertab mehr zweck als nur spieler/gäste anlegen)
  - [x] gespielte turniere (mit lineup, als member/gast)
  - [x] kumulierte stats über alle comps (lifetime): pace, durchschnittsplatz pro format, pbs auf comp-maps; pro comp aufklappbar mit stats, maps und matches
  - [x] erreichbar für alle über klick auf den namen (player page, stats-tabellen, lineup-kader)
  - [x] eigener menüpunkt für eingeloggte user, der direkt zum eigenen profil führt
  - [ ] seeding-bereich im profil (erst entscheiden, wie seeding-daten ins system kommen)
- [ ] per map statistiken
  - [x] pro spieler im profil (pb, Ø rückstand in s, rang im team)
  - [x] pro comp für 1 lineup, pro week für alle lineups (umschalter "nach map" im stats-bereich von lineup- und turnierseite, filter lineup/abschnitt/format)
  - [ ] team-sicht pro map in der lineup-übersicht: eine zeile pro map mit maps w/l, rounds w/l, beste und Ø zeit (ohne einzelne spieler)
- [ ] Lineup Builder
  - [x] gemeinsames erstellen für lineups, welches direkt in eine comp reingespeichert wird (Planung pro Comp: Verfügbarkeit, Varianten, Live-Session, Übernehmen)
  - [x] danach werden in dieser comp nur noch diese 4 lineups gezeigt bzw nur die spieler

## Erledigt

- [x] Match nachträglich bearbeiten (Datum, Gegner, Notizen)
- [x] Gegner-DB umgesetzt: [vereinbartes Konzept](docs/gegner-db-konzept.md) – feste Teams, Competition-Lineups/Mixes, Logos, Spielerzuordnung und Stats; gezielte manuelle Übernahme aus dem Team-Spreadsheet
- [x] suchfunktion: globale suche (Strg+K) über spieler, gegnerteams, gegner-lineups, gegnerische spieler, turniere und matches
- [x] csv import für gesamtes match (eine oder mehrere dateien, vorschau mit seiten, abgewählten fehlrunden und ergänzten dnfs) und runden nachträglich per mehrfachauswahl löschen
