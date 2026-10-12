# TODOS

## Offen

- [ ] als member -> in tourney übersicht der eigenen stats, danach kann man sich durch die stats durchklicken
- [ ] kategorisierung der comps nach style? (tech mixed rpg ice fs etc)
- [ ] validierung von importierten daten zu eingegebenen daten (match) -> passt das gegner team etc
- [ ] tournaments seite bei mehreren comps: bleibt eine einfache liste der turniere, anordnung prüfen wenn es mehr werden
- [ ] lineup einteilung für einzelne matches bzw match days

## Teilweise erledigt

- [ ] Design/UI/UX Verbesserungen
  - [x] light theme in den b2 farben, umschalter im account-menü (dark bleibt default); farben sind jetzt theme-variablen statt fester hex-werte
  - [ ] weitere themes

- [ ] best performer pro match/week/tourney
  - [x] pro tourney und pro abschnitt (week) auf dem dashboard, nach Ø platz
  - [ ] pro match

- [ ] spieler-profile: eigene seite pro spieler (idee boris; gibt dem spielertab mehr zweck als nur spieler/gäste anlegen)
  - [x] gespielte turniere (mit lineup, als member/gast)
  - [x] kumulierte stats über alle comps (lifetime): pace, durchschnittsplatz pro format, pbs auf comp-maps; pro comp aufklappbar mit stats, maps und matches
  - [x] erreichbar für alle über klick auf den namen (player page, stats-tabellen, lineup-kader)
  - [x] eigener menüpunkt für eingeloggte user, der direkt zum eigenen profil führt
  - [ ] seeding-bereich im profil (erst entscheiden, wie seeding-daten ins system kommen)
- [ ] Lineup Builder
  - [x] gemeinsames erstellen für lineups, welches direkt in eine comp reingespeichert wird (Planung pro Comp: Verfügbarkeit, Varianten, Live-Session, Übernehmen)
  - [x] danach werden in dieser comp nur noch diese 4 lineups gezeigt bzw nur die spieler

## Erledigt

- [x] TFH-Langstreckenarchiv: Admin-Import mit Vorschau für abgeschlossene 24h-/12h-RPG-Ausgaben, Gesamtwertung, historische B2-Lineups, Fahrerstatistiken und separater Profilabschnitt; [Bedienung](docs/tfh-import.md) und [Entscheidung](docs/adr/001-tfh-import.md)
- [x] Match nachträglich bearbeiten (Datum, Gegner, Notizen)
- [x] Gegner-DB umgesetzt: [vereinbartes Konzept](docs/gegner-db-konzept.md) – feste Teams, Competition-Lineups/Mixes, Logos, Spielerzuordnung und Stats; gezielte manuelle Übernahme aus dem Team-Spreadsheet
- [x] suchfunktion: globale suche (Strg+K) über spieler, gegnerteams, gegner-lineups, gegnerische spieler, turniere und matches
- [x] csv import für gesamtes match (eine oder mehrere dateien, vorschau mit seiten, abgewählten fehlrunden und ergänzten dnfs) und runden nachträglich per mehrfachauswahl löschen
- [x] per map statistiken
  - [x] pro spieler im profil (pb, Ø rückstand in s, rang im team)
  - [x] pro comp für 1 lineup, pro week für alle lineups (umschalter "nach map" im stats-bereich von lineup- und turnierseite, filter lineup/abschnitt/format)
  - [x] team-sicht pro map in der lineup-übersicht: eine zeile pro map mit maps w/l, rounds w/l, beste und Ø zeit (ohne einzelne spieler)
- [x] übersichts seite (dashboard): overall-kacheln, aktuelle turniere und letztes turnier mit bilanz pro lineup, best performer und eigenen stats; app komplett auf englisch
- [x] two-factor sign-in mit authenticator-app (TOTP): pflicht für admins, freiwillig für alle anderen; recovery-codes, sperre nach 5 falschen codes, reset durch admin/manager
- [x] passkeys (WebAuthn): login ohne passwort, mehrere pro account, zählen für admins als zweiter faktor (TOTP oder passkey)
- [x] TFH: B2-Fahrerranking pro Rennen (alle B2-Teams in einer Tabelle, standardmäßig nach CPM) und Übersicht über alle Ausgaben mit addierbaren Werten (`/tfh`)
