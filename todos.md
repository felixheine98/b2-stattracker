# TODOS

## Offen

- [ ] csv import für gesamtes match -> danach UI wo man einzelne runden (multi select) rauslöschen kann, falls match dumper nicht 100% korrekt ist
- [ ] spieler-profile: eigene seite pro spieler (idee boris; gibt dem spielertab mehr zweck als nur spieler/gäste anlegen)
  - gespielte turniere (mit lineup, als member/gast)
  - kumulierte stats über alle comps (lifetime): pace, durchschnittsplatz in comps, pbs auf comp-maps; dazu letzte comp
  - erreichbar für alle über klick auf den namen auf der player page
  - eigener menüpunkt für eingeloggte user, der direkt zum eigenen profil führt
- [ ] als member -> in tourney übersicht der eigenen stats, danach kann man sich durch die stats durchklicken
- [ ] kategorisierung der comps nach style? (tech mixed rpg ice fs etc)
- [ ] Design/UI/UX Verbesserungen
  - light theme + weitere themes (dark bleibt default)
- [ ] übersichts seite (dashboard) -> letzte comp anzeigen + paar overall stats / stat highlights, pro user evtl spezialisiert auf seine eigenen stats; aufbau so, dass er auch mit mehreren comps funktioniert (einträge untereinander)
- [ ] best performer pro match/week/tourney? -> den auf übersicht auch anzeigen?
- [ ] validierung von importierten daten zu eingegebenen daten (match) -> passt das gegner team etc
- [ ] per map statistiken (pro comp für 1 lineup, pro week für alle lineups)
- [ ] suchfunktion bei den spielern (spielertab)
- [ ] tournaments seite bei mehreren comps: bleibt eine einfache liste der turniere, anordnung prüfen wenn es mehr werden
- [ ] feedback einholen: tra (vom fach), 1-2 weitere, dazu von manager seite

## Teilweise erledigt

- [ ] Lineup Builder
  - [x] gemeinsames erstellen für lineups, welches direkt in eine comp reingespeichert wird (Planung pro Comp: Verfügbarkeit, Varianten, Live-Session, Übernehmen)
  - [ ] danach werden in dieser comp nur noch diese 4 lineups gezeigt bzw nur die spieler

## Erledigt

- [x] Match nachträglich bearbeiten (Datum, Gegner, Notizen)
- [x] Gegner-DB umgesetzt: [vereinbartes Konzept](docs/gegner-db-konzept.md) – feste Teams, Competition-Lineups/Mixes, Logos, Spielerzuordnung und Stats; gezielte manuelle Übernahme aus dem Team-Spreadsheet
