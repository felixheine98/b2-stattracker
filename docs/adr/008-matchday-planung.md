# Lineup-Planung pro Match Day

Status: Akzeptiert – von Felix am 22.10.2026 bestätigt. Umsetzung in Arbeit (Branch `feat/matchday-planung`). Begriffe: [Glossar](../matchday-planung-glossar.md).

## Kontext

Die Comp-Planung (`/tournaments/[id]/planning`) klärt einmal pro Comp die Verfügbarkeit (FIX/MAYBE/OUT und eigene Stufen) und verteilt die Spieler in Varianten auf Lineups. Die übernommene Variante wird zu den `TournamentLineup`s der Comp, danach ist die Planung geschlossen.

Ein Turnier ist in Stages unterteilt: Seeding, Match Day 1..n und Playoffs (`lib/stages.ts`). Jedes Match gehört zu einem Lineup und einer Stage. Pro Sub-Match (ein Format, z. B. 2v2) wird festgehalten, wer gefahren ist (`Lineup`/`LineupSlot`). Matches werden bisher erst angelegt, wenn sie gespielt sind; in den Dev-Daten hat jedes Match Sub-Matches.

Was fehlt: wer an einem Match Day in welchem Match welches Format fährt, vorab geplant. Dabei kann es mehrere Varianten geben, weil Spieler z. B. nur für einen Teil der Matches eines Abends verfügbar sind. Die Idee steht seit Längerem in `ideen.md` („lineup einteilung für einzelne matches bzw match days“).

## Entscheidung

Bestätigt (22.10.2026): Geplant wird pro Match Day und Lineup, wer aus dem Kader antritt, und für jedes Match des Match Days, wer welches Format fährt (Variante B). Spieler wechseln dabei nicht zwischen den Lineups; der Kader aus der Comp-Planung bleibt fest.

Bestätigt (22.10.2026): Geplant wird an echten Matches, die vorab angelegt werden (Gegner, Nummer, Datum, noch ohne Sub-Matches). Die Ergebnisse werden später in genau dieses Match eingetragen bzw. importiert. Alle Seiten, die bisher von gespielten Matches ausgehen (Dashboard, Ergebnisleisten, Stats, Bilanzen, Best Performer, Formatregel-Punkte), müssen ein geplantes Match ohne Ergebnis erkennen.

Bestätigt (22.10.2026): Geplante Matches erscheinen überall als „upcoming“: auf der Turnierseite in der Match-Liste ihres Lineups und Match Days (markiert, mit Datum und Gegner statt Ergebnis) und auf dem Dashboard in einem Bereich „Nächste Matches“. In Stats, Bilanzen, Best Performer und Formatregel-Punkte zählen sie nicht.

Bestätigt (22.10.2026), Vorgabe von Felix: Die Verfügbarkeit pro Match Day wird wie in der Comp-Planung erfasst. Der Discord-Bot beobachtet ein Announcement für den Match Day, die Reaktionen werden einer Verfügbarkeit zugeordnet und übernommen. Bei der Planung stehen nur die Anwesenden zur Auswahl. Im Normalfall entsteht eine einzige Besetzung für den ganzen Tag, die für alle Matches des Match Days gilt; nur wenn nötig, weicht die Besetzung einzelner Matches davon ab.

Bestätigt (22.10.2026): Teilweise Verfügbarkeit kommt über ein eigenes Emoji „teilweise“ im Announcement. Was es im Einzelfall heißt, klärt der Planer mit dem Spieler und trägt es von Hand ein: als Notiz und als Ausnahme pro Spieler und Match (z. B. bei Match 3 nicht da). Eine Reaktion pro Match gibt es nicht.

Bestätigt (22.10.2026): Pro Lineup und Match Day lassen sich mehrere Varianten anlegen, jede ein vollständiger Plan (Tagesbesetzung plus abweichende Besetzungen). Im Normalfall gibt es nur eine, mit der auch gefahren wird; weitere sind die Ausnahme.

Bestätigt (22.10.2026), Vorgabe von Felix: Die Matchday-Planung sehen nur die Lineup-Manager des Lineups (und wie überall Admins und Manager, siehe `canEditLineup` in `lib/lineup-access.ts`). Ein Lineup-Manager finalisiert eine Variante mit einem Button; erst dann ist die Besetzung an den Matches (Match-Seite, upcoming Matches) für alle sichtbar. Vorher zeigen die Matches keine Besetzung. Eine Abstimmung gibt es nicht.

Bestätigt (22.10.2026): Finalisieren veröffentlicht einen Stand. Änderungen in der Planung danach bleiben Entwurf, bis ein Lineup-Manager erneut finalisiert; bis dahin sehen die Spieler den zuletzt veröffentlichten Stand. Die Planung zeigt „unveröffentlichte Änderungen“. Erneut finalisiert werden kann auch eine andere Variante.

Bestätigt (22.10.2026): Die finalisierte Besetzung belegt beim Anlegen der Sub-Matches die Fahrer vor. Der CSV- und eCM-Import zeigt pro Format, wo anders gefahren wurde als geplant („2v2: geplant Toast, gefahren Ente“); er sperrt nicht. Die Match-Seite zeigt nach dem Spielen weiterhin, was geplant war. Der Hinweis verlangt kein Bestätigen (bestätigt 22.10.2026), weil Abweichungen vom Plan meist gewollt sind; die Bestätigungspflicht anderer Hinweise bleibt unberührt.

Bestätigt (22.10.2026): Geplant werden Match Days und Playoffs, beide auf dieselbe Weise (eine Playoff-Stage zählt hier wie ein Match Day). Playoff-Matches, deren Gegner noch nicht feststeht, werden angelegt, sobald sie bekannt sind; bis dahin gilt die Tagesbesetzung. Das Seeding kommt dazu, sobald es korrekt in der App umgesetzt ist (siehe Low-Prio-Todo zu Seeding-Daten).

Bestätigt (22.10.2026): Zur Auswahl steht nur der Kader, abgestuft nach Antwort: FIX und „teilweise“ oben, MAYBE und „keine Antwort“ sichtbar abgesetzt darunter und trotzdem einteilbar; OUT ist nicht einteilbar. Ersatzfahrer von außerhalb des Kaders gibt es in der Planung nicht.

Bestätigt (22.10.2026): Ein Matchday-Announcement gehört zu genau einem Lineup und Match Day. Jedes Lineup hat einen eigenen Discord-Channel, in dem pro Woche ein Ping die Verfügbarkeit abfragt; dieser Ping ist das Announcement. Reaktionen von Konten außerhalb des Kaders werden nicht übernommen (folgt aus der Auswahl nur aus dem Kader).

Bestätigt (22.10.2026), Ergänzung von Felix: Pro Turnier-Lineup wird einmal sein Lineup-Channel hinterlegt. Wer den wöchentlichen Ping postet, markiert darin den Bot; daran erkennt der Bot das Announcement und erfasst ab dem Posten die Reaktionszeiten. Die Planung eines Match Days schlägt das passende markierte Announcement des Lineup-Channels vor; der Lineup-Manager bestätigt es mit einem Klick oder wählt ein anderes. Übernommen werden die Reaktionen wie in der Comp-Planung erst nach Abruf und Vorschau, ohne Hintergrund-Synchronisation.

Bestätigt (22.10.2026): Lineup-Manager rufen die Reaktionen ihres Lineups selbst ab und übernehmen sie. Discord-Konten mit Spielern verknüpfen dürfen sie nicht; Reaktionen nicht verknüpfter Konten erscheinen als Hinweis („ein Admin muss das Konto zuordnen“) und werden nicht übernommen. Das Verknüpfen bleibt bei Admins und Managern (ADR 006).

Bestätigt (22.10.2026): Die Zuordnung Emoji → Verfügbarkeit gilt pro Match Day, d. h. pro Announcement; für jeden Ping wird sie neu festgelegt.

Bestätigt (22.10.2026): Die Verfügbarkeit eines neuen Match Days startet leer („keine Antwort“), ohne Vorbelegung aus der Comp-Planung oder dem vorigen Match Day. Der Lineup-Manager kann jede Antwort jederzeit von Hand setzen oder ändern; wie in der Comp-Planung löscht eine Hand-Antwort die Discord-Zeit.

Bestätigt (22.10.2026): Geplante Matches werden mit dem bestehenden Dialog „Match anlegen“ angelegt (Stage, Gegner, Datum, Nummer; Gegner darf offen bleiben). Die Matchday-Planung zeigt die Matches des Lineups in dieser Stage und öffnet den Dialog mit vorausgewählter Stage; auf der Turnierseite angelegte Matches erscheinen dort ebenso. Anlegen darf, wer heute Matches anlegen darf.

Bestätigt (22.10.2026): Jedes Format eines Matches hat so viele Plätze, wie es Fahrer braucht (2v2 = 2). Ein Spieler darf in mehreren Formaten desselben Matches stehen. Die Planung zeigt Hinweise bei leeren Plätzen, bei Spielern mit OUT und bei Spielern, die per Ausnahme beim Match fehlen; Finalisieren ist trotzdem möglich. Comp-abhängige Regeln (z. B. nur ein Format pro Spieler) kommen später, wenn es dafür in der Oberfläche einen sinnvollen Weg gibt (siehe `ideen.md`).

Bestätigt (22.10.2026): Die Matchday-Planung kommt hinter einen Schalter wie die Formatregeln (`lib/features.ts`): `MATCHDAY_PLANNING=on` nur in `docker-compose.dev.yml`, in Production immer aus, bis Felix die Aktivierung ausdrücklich freigibt. Eine allgemeine Freigabe zum Ausrollen anderer Änderungen deckt das nicht ab.

Bestätigt (22.10.2026): Umsetzung in vier Schritten, jeder für sich in Dev prüfbar:

1. Geplante Matches: Matches ohne Ergebnis werden in allen Auswertungen korrekt behandelt; upcoming auf Turnierseite und Dashboard.
2. Matchday-Planung: Verfügbarkeit von Hand mit „teilweise“ und Ausnahmen, Varianten, Tagesbesetzung und abweichende Besetzungen, Hinweise, Finalisieren und veröffentlichter Stand.
3. Übergang zum Ergebnis: Vorbelegung der Sub-Matches, Planabweichung im Import, „geplant“ am Match.
4. Discord: Lineup-Channel, Bot erkennt den markierten Ping, Abruf und Übernahme durch Lineup-Manager.

Später (Todo): Der Discord-Bot postet die finalisierte Besetzung in den passenden Channel.

Bestätigt (22.10.2026): Die Planung liegt auf der Lineup-Seite, pro Stage: Lineup-Manager (und Admins/Manager) sehen bei jeder Stage einen Knopf „Plan“, der zur Seite `/tournaments/[comp]/[lineup]/plan/[stage]` führt (Verfügbarkeit, Varianten, Tagesbesetzung, Matches der Stage).

## Erwogene Alternativen

- A: nur festlegen, wer aus dem Kader am Match Day spielt; die Zuteilung zu Formaten bleibt beim Match. Bildet Verfügbarkeiten zwischen den Matches eines Abends nicht ab.
- C: Spieler wechseln pro Match Day zwischen den Lineups. Verworfen, solange Wechsel zwischen den Lineups nicht vorkommen bzw. von den Comp-Regeln nicht gedeckt sind.
- D: B und C zusammen.
- Eigene geplante Matches nur innerhalb der Planung, die beim Anlegen des echten Matches verknüpft werden. Hält die Ergebnisdaten frei von ungespielten Matches, verdoppelt aber das Match-Konzept.
- Geplante Matches nur in der Planung und auf ihrer Match-Seite zeigen. Verschenkt den Nutzen für die Spieler, die sehen wollen, was ansteht.
- Ein Emoji pro Match im Announcement („nur Match 1“). Genauer, aber das Announcement müsste die Matches des Abends schon kennen; verworfen zugunsten von „teilweise“ mit Nachklärung.
- Keine Varianten, nur abweichende Besetzungen pro Match. Lässt keine echten Alternativen zu.
- Ein Plan mit Ersatzfahrern pro Format.
- Die erste Variante gilt automatisch, bis eine andere markiert wird; oder Abstimmung wie in der Comp-Planung. Verworfen: die Planung bleibt beim Lineup-Manager, öffentlich wird erst das Finalisierte.
- Nach dem Finalisieren direkt bearbeitbar (Spieler sähen Zwischenstände) oder nur nach Aufheben der Finalisierung (Spieler sähen zwischendurch nichts).
- Besetzung nur vorbelegen oder nur anzeigen, ohne Abgleich und ohne Rückblick am Match.
- Nur FIX und „teilweise“ zeigen (versteckt die, die man kurzfristig anschreibt); zusätzlich Ersatz von außerhalb des Kaders hinzufügen.
- Ein gemeinsames Announcement für alle Lineups, oder beides zulassen. Passt nicht zum Ablauf mit einem Ping pro Lineup-Channel.
- Link zum Announcement jede Woche von Hand eintragen; oder die jüngste Nachricht des Channels ohne Bestätigung automatisch übernehmen.
- Lineup-Manager dürfen beim Abruf auch Konten verknüpfen; oder Abruf nur durch Admins und Manager.
- Emoji-Zuordnung einmal pro Lineup oder global für alle Lineups und Comps.
- Verfügbarkeit aus der Comp-Planung oder vom vorigen Match Day vorbelegen. Würde Spieler als FIX zeigen, die für diese Woche nie geantwortet haben.
- Matches nur über die Turnierseite anlegen; oder eine Anzahl pro Match Day vorgeben und die Matches als Stapel anlegen.
- Nur ein Format pro Spieler und Match; oder Finalisieren erst bei vollständiger, hinweisfreier Besetzung.
- Discord zuerst oder alles in einem Zug.
- Ausrollen ohne Schalter; oder Schalter nur für den Discord-Teil.
- Planung als Tab der Comp-Planung (die nach der Übernahme geschlossen ist und anderen Regeln folgt) oder eigene Seite pro Comp mit Auswahl von Lineup und Stage.
- Keine einzelnen Matches, Besetzung pro Format für den ganzen Match Day. Widerspricht der Planung pro Match.

## Offene Fragen

Keine.

## Konsequenzen

- Der Bot braucht zusätzlich das Gateway-Intent für Guild-Nachrichten, um Pings mit Erwähnung zu sehen. Das privilegierte Message Content Intent ist dafür nicht nötig: Nachrichten, die den Bot erwähnen, liefert Discord auch ohne es mit Inhalt.
- Turnier-Lineups bekommen einen hinterlegten Discord-Channel.
- Matches können ohne Sub-Matches und Ergebnis existieren; alle auswertenden Abfragen müssen das berücksichtigen.
