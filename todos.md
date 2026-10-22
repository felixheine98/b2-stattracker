# TODOS

Ideen, die noch kein Todo sind: [ideen.md](ideen.md)

## Offen

- [ ] seeding formate für import/anlegen prüfen (Liste der alten Seeding-Screenshots aus Discord folgt nach der Übernahme, [ADR 007](docs/adr/007-zusammengefasste-ergebnisse.md))
- [ ] Alte Comp-Stats aus Discord-Screenshots übernehmen ([Entscheidung](docs/adr/007-zusammengefasste-ergebnisse.md), [Glossar](docs/zusammengefasste-ergebnisse-glossar.md)); Abgleich mit Felix pro Comp

- [ ] Lineup-Planung pro Match Day ([Entscheidung](docs/adr/008-matchday-planung.md), [Glossar](docs/matchday-planung-glossar.md)); hinter `MATCHDAY_PLANNING`, in Production aus
  - [ ] schritt 1: geplante Matches ohne Ergebnis in allen Auswertungen, upcoming auf Turnierseite und Dashboard
  - [ ] schritt 2: planung (verfügbarkeit von hand, teilweise/ausnahmen, varianten, tagesbesetzung, abweichungen, hinweise, finalisieren)
  - [ ] schritt 3: vorbelegung der sub-matches, planabweichung im import, „geplant“ am match
  - [ ] schritt 4: discord (lineup-channel, bot erkennt markierten ping, abruf durch lineup-manager)

## Teilweise erledigt

- [ ] Design/UI/UX Verbesserungen ([Rennleitstand-Entwurf](docs/redesign-rennleitstand.md))
  - [x] In Dev: B2-Farben, Typografie, Navigation, gemeinsame Felder/Buttons/Dialoge, Listen und Stats auf allen Seiten
  - [x] Ergebnisleiste auf Match und Dashboard, Turnierliste als Zeilen, ruhigere Kennzahlen, Planungsansicht
  - [ ] Felix prüft den Entwurf in Dev; Details und verbleibende Abläufe gemeinsam abstimmen
  - [ ] Nach Freigabe Production übernehmen

- [ ] Discord-Reaktionen in der Comp-Planung ([Anbindung](docs/discord-planning.md))
  - [x] Abruf, Emoji-Zuordnung, Account-Verknüpfung und Übernahme mit Vorschau
  - [x] In der laufenden Dev-App eingebunden, separater lesender Discord-Prozess
  - [ ] Mit einem Comp-Announcement im Alltag prüfen
  - [x] Letzter Abruf neben dem Link, Zeitpunkt der Reaktionen (der Bot schreibt den Eingang mit, Discord liefert keine Zeit; der Ankündigungs-Channel wird ab dem Posten erfasst), in der Vorschau und als `answeredAt` in der Liste, Liste der erfassten Nachrichten mit Löschen und Zuweisen zu einer Comp, automatisches Vergessen nach einer Woche ohne Zuweisung, in Production seit 19.10.2026 ([Beschreibung](docs/discord-planning.md))
  - [ ] Erfasste Nachrichten mit Text anzeigen: braucht das Message Content Intent im Developer Portal (Felix entscheidet) und einen Schalter im Bot
  - [x] Discord-Konten zentral hinterlegen und Import kompakter, in Production seit 19.10.2026 ([Entscheidung](docs/adr/006-discord-konten.md), [Glossar](docs/discord-konten-glossar.md))

- [ ] konfiguration pro comp, wie matches ablaufen (hilfreich für validierung): submatches pro match, rounds to win, punkte für sieg/unentschieden/niederlage, weitere formatregeln; [entscheidung](docs/adr/005-comp-formatregeln.md), [glossar](docs/comp-formatregeln-glossar.md)
  - [x] schritt 1: regelsatz pro comp und playoff (ablauf, rounds to win, max rounds, punkte) im anlegen- und bearbeiten-dialog, hinweise auf der match-seite und beim schließen
  - [x] schritt 2: hinweise in den import-vorschauen (csv, ecm), punkte am match und als summe pro lineup
  - [x] schritt 3: vorlagen (auswahl, save as template, verwaltungsseite)
  - [ ] die acht bestehenden comps von hand eintragen
  - [x] schalter `MATCH_RULES` in dev, in production immer aus
  - [ ] entscheiden, ob die formatregeln in production aktiviert werden sollen (code seit 18.10. auf main, in production weiterhin ausgeschaltet)

## Unter Beobachtung

- [ ] best performer pro match/week/tourney
  - [x] pro tourney und pro abschnitt (week) auf dem dashboard, nach Ø platz
  - [x] pro match: zeile im kopf der match-seite; zählt nur, wer mindestens halb so viele runden wie der fahrer mit den meisten gefahren ist, bei gleichstand entscheidet die rundenzahl
- [ ] validierung von importierten daten zu eingegebenen daten (match): csv- und ecm-import prüfen gegner, eigenes lineup und datum gegen das eingetragene match, hinweise in der vorschau mit bestätigen, notizzeile am match; [entscheidung](docs/adr/004-import-validierung.md), [glossar](docs/import-validierung-glossar.md)
- [ ] Lineup Builder
  - [x] gemeinsames erstellen für lineups, welches direkt in eine comp reingespeichert wird (Planung pro Comp: Verfügbarkeit, Varianten, Live-Session, Übernehmen)
  - [x] danach werden in dieser comp nur noch diese 4 lineups gezeigt bzw nur die spieler

## Low Prio

- [ ] Discord-Bot postet die finalisierte Matchday-Besetzung in den passenden Channel ([Matchday-Planung](docs/adr/008-matchday-planung.md))
- [ ] spieler-profil: seeding-bereich mit seeding-stats (erst entscheiden, wie seeding-daten ins system kommen)

## Erledigt

- [x] tournaments seite bei mehreren comps: bleibt eine einfache liste der turniere, anordnung geprüft

- [x] Themes und Theme-Auswahl
  - [x] light theme in den b2 farben (dark bleibt default); farben als theme-variablen
  - [x] Midnight und OLED Black; kompakte Auswahl mit runden Farbvorschauen unter „Appearance“ (Kacheln auf Desktop, schmale Zeilen auf Handy)
  - [x] Warm Light mit Cremefarben und B2 Blue mit sattem Teamblau und gelben Highlights
  - [x] „Follow system“: B2 Light/Dark nach Geräteeinstellung, auch bei Änderungen und beim Neuladen

- [x] spieler-profile: eigene seite pro spieler (idee boris; gibt dem spielertab mehr zweck als nur spieler/gäste anlegen); der seeding-bereich steht unter Low Prio
  - [x] gespielte turniere (mit lineup, als member/gast)
  - [x] kumulierte stats über alle comps (lifetime): pace, durchschnittsplatz pro format, pbs auf comp-maps; pro comp aufklappbar mit stats, maps und matches
  - [x] erreichbar für alle über klick auf den namen (player page, stats-tabellen, lineup-kader)
  - [x] eigener menüpunkt für eingeloggte user, der direkt zum eigenen profil führt
- [x] Dev-Umgebung durch orangefarbenes Favicon und Logo auf Desktop, Handy und Login-Seite erkennbar machen.

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
- [x] lineup-planung: status „Inactive" (violett) für mitglieder, die standardmäßig keine comps fahren – ohne eigene antwort nicht mehr offen; schalter im spielerprofil; extra-stufen sind jetzt bronze
- [x] kategorisierung der comps nach style (tech, fullspeed, dirt, ice, rpg, endurance, mixed): ein style pro turnier, filter in sidebar und turnierliste, tfh driver totals unter endurance, stats pro style im profil; [entscheidung](docs/adr/002-comp-styles.md), [glossar](docs/comp-styles-glossar.md)
