# VOD-Archiv: Match-Ausschnitte aus Twitch-VODs sichern

Status: Akzeptiert – von Felix am 24.10.2026 bestätigt (Fragen 1–15 und offene Punkte). Umsetzung in Schritten (a Slider und Bereich, b vod-worker, c YouTube verbinden und Upload, d Player auf der Match-Seite). Begriffe: [Glossar](../vod-archiv-glossar.md)

## Kontext

Seit 24.10.2026 kann ein Match VOD-Links haben (`Match.vods`, `lib/vod.ts`), meist Twitch. VODs fremder Kanäle (Caster, Gegner, Spieler) können jederzeit verschwinden: Twitch löscht Past Broadcasts je nach Kanal nach 7 bis 60 Tagen, Highlights bleiben, bis der Kanal sie löscht. Felix (24.10.2026): Ein Tool soll den Ausschnitt eines Matches (Anfang bis Ende per Zeitstempel) aus einem Twitch-VOD holen und auf den YouTube-Kanal des Teams hochladen.

Stand (nachgeschaut, 24.10.2026):

- Auf dem Server (`reh`) sind weder `yt-dlp` noch `ffmpeg` installiert; beides ließe sich in ein Container-Image packen. 137 GB frei, 8 Kerne.
- `yt-dlp` kann von einem Twitch-VOD nur einen Abschnitt laden (`--download-sections`), braucht dafür `ffmpeg`. Abonnenten-only-VODs brauchen ein Login.
- YouTube-Upload per API (YouTube Data API v3) braucht OAuth mit einem Google-Konto, das den Kanal verwalten darf. Ein Upload kostet 1600 von standardmäßig 10.000 Quota-Einheiten pro Tag (rund 6 Uploads täglich). Uploads aus einem nicht geprüften API-Projekt sind auf „privat“ gesperrt, bis das Projekt den Audit von Google bestanden hat.
- Fremde Streams auf dem eigenen Kanal zu veröffentlichen berührt die Rechte der Streamer und Caster; YouTube kann Content-ID-Ansprüche oder Urheberrechtsbeschwerden auslösen.

## Entscheidung

Bestätigt (24.10.2026), Frage 1 – Zweck und Sichtbarkeit: Eine Sicherung ist ein Archiv, keine Veröffentlichung. Der Ausschnitt kommt als **„nicht gelistet“** auf den YouTube-Kanal des Teams; sehen kann ihn, wer den Link hat, vor allem über den Stattracker. Auf dem Kanal und in der Suche erscheint er nicht. Für Uploads per API muss das Google-API-Projekt den Audit bestehen (sonst sind Uploads auf „privat“ gesperrt).

Bestätigt (24.10.2026), Frage 2 – Rechte fremder Kanäle: **ohne Nachfrage**. Gesichert wird jedes VOD, auch von fremden Kanälen, ohne Freigabe oder Bestätigung. Beschwert sich ein Kanal oder kommt ein Content-ID-Anspruch, wird die Sicherung gelöscht. Felix nimmt das Risiko für den Team-Kanal in Kauf (empfohlen war eine Freigabeliste der Kanäle).

Bestätigt (24.10.2026), Frage 3 – Anfang und Ende: **von Hand am VOD**, über einen grafischen Bereichs-Slider über die Länge des VODs: zwei Schranken für Anfang und Ende, die man schiebt; den Bereich kann man verschieben, kleiner und größer ziehen. Ein Zeitstempel im Link (`?t=1h02m30s`) setzt den Anfang vor. Für den Slider braucht die App die Länge des VODs (Twitch-API oder `yt-dlp`-Metadaten).

Bestätigt (24.10.2026), Frage 4 – Orientierung beim Schieben: Über dem Slider läuft das VOD im **eingebetteten Twitch-Player** (Twitch Embed mit `parent` = Domain der Seite). Zieht man eine Schranke, springt der Player dorthin; „Anfang hier“ und „Ende hier“ übernehmen die aktuelle Abspielposition, dazu Feinjustierung um ±5 s.

Bestätigt (24.10.2026), Frage 5 – Zeitpunkt: **automatisch**, sobald für einen VOD ein Bereich gespeichert ist. Die App holt den Ausschnitt im Hintergrund, lädt ihn hoch und hängt den YouTube-Link an den VOD. Sichtbarer Status: wartet, lädt, gesichert, fehlgeschlagen. Ändert sich der Bereich, wird neu gesichert und das alte Video ersetzt. Reicht die Tagesquote von YouTube nicht (rund 6 Uploads), warten die übrigen bis zum nächsten Tag.

Bestätigt (24.10.2026), Frage 6 – Zugang zum Kanal: **„YouTube verbinden“ in den Admin-Einstellungen.** Ein Admin meldet sich einmal per OAuth mit einem Konto an, das den Team-Kanal verwalten darf; die App speichert den Refresh-Token. Ist er abgelaufen oder widerrufen, zeigt die App das an und man verbindet neu. Google-Cloud-Projekt und Audit übernimmt Felix oder wer den Kanal besitzt. Den Team-Kanal gibt es (siehe Abschluss).

Bestätigt (24.10.2026), Frage 7 – Wer sichert: Den Bereich setzen (und damit eine Sicherung auslösen) dürfen nur Konten mit der **globalen Rolle ADMIN oder MANAGER** (`canManage` in `lib/roles.ts`). Lineup-Manager ohne diese Rolle tragen weiterhin VOD-Links ein, setzen aber keinen Bereich.

Bestätigt (24.10.2026), Frage 8 – Anzeige: Ist eine Sicherung da, zeigt die Match-Seite einen **eingebetteten YouTube-Player, der erst beim Klick lädt**: zuerst nur das Vorschaubild mit Play-Knopf (rund 20–50 KB), der Player selbst (rund 0,5–1 MB von Google) erst nach dem Klick, über `youtube-nocookie.com`. Der Twitch-Link bleibt als kleiner Knopf daneben. Auf dem Handy volle Breite im Format 16:9.

Bestätigt (24.10.2026), Frage 9 – Titel und Beschreibung: **aus den Match-Daten**, z. B. `EMC S8 · Group Stage · B2 Academy vs Molotov Gaming · 08.11.2026`, mit dem Namen des VODs in Klammern, falls gesetzt (`(Cast)`). Beschreibung: Original-Twitch-Link mit Kanalname (Quellenangabe), Link zur Match-Seite im Stattracker, „Ausschnitt 1:02:30–1:48:10“.

Bestätigt (24.10.2026), Frage 10 – Qualität: **beste verfügbare Qualität bis 1080p, ohne Neukodieren** aus dem VOD geschnitten (Stream-Copy); Schnitte an den Segmentgrenzen, also auf 1–2 Sekunden genau. Rund 2–3 GB je 45 Minuten; die Datei liegt nur bis zum Upload auf dem Server und wird danach gelöscht.

Bestätigt (24.10.2026), Frage 11 – Dev: In dev wird **nicht automatisch** gesichert. Ein Admin kann eine Sicherung per Knopf auslösen; sie landet als **privates** Video auf dem Team-Kanal (geht ohne Audit, Testvideos danach löschen). Den Zugang zum Kanal verbinden dev und Production jeweils für sich.

Bestätigt (24.10.2026), Frage 12 – Abonnenten-VODs: werden **übersprungen**, Status „fehlgeschlagen: nur für Abonnenten – bitte selbst sichern oder den Kanal fragen“. Auf dem Server liegt keine Twitch-Anmeldung.

Bestätigt (24.10.2026), Frage 13 – Entfernen: Die Sicherung **bleibt immer** auf YouTube, ohne Nachfrage, auch wenn der VOD-Link entfernt oder das Match gelöscht wird. Felix nimmt verwaiste Videos auf dem Kanal in Kauf. (Frage 5 bleibt davon unberührt: Ändert sich der Bereich eines VODs, ersetzt die neue Sicherung die alte.)

Bestätigt (24.10.2026), Frage 14 – Ort: ein **eigener Container `vod-worker`** (wie der Discord-Bot) in Production und dev, mit `yt-dlp` und `ffmpeg` im Image; er arbeitet eine Warteschlange in der Datenbank ab. Die App legt nur Aufträge an und zeigt deren Status. Ein `yt-dlp`-Update braucht nur den Neubau dieses Containers.

Bestätigt (24.10.2026), Frage 15 – Quellen: **nur Twitch.** Bereichs-Slider und Sicherung gibt es nur für Twitch-VODs (VODs und Highlights). Die Länge des VODs liefert der eingebettete Twitch-Player; ein Twitch-API-Schlüssel ist nicht nötig. Jeder Twitch-VOD eines Matches hat seinen eigenen Bereich und seine eigene Sicherung.

Bestätigt (24.10.2026), Abschluss:

- Den YouTube-Kanal des Teams gibt es; ihn verwalten die Manager und ausgewählte Personen.
- Fehler: Vorübergehende Fehler (Twitch nicht erreichbar, Upload abgebrochen) werden automatisch wiederholt, dreimal mit wachsendem Abstand; bei erschöpfter Quote am nächsten Tag. Danach „fehlgeschlagen“ mit Grund und Knopf „Erneut versuchen“. Ist das VOD schon gelöscht, sofort „fehlgeschlagen: VOD nicht mehr verfügbar“.
- Production vor dem Audit: Das automatische Sichern in Production hängt an einem Schalter (`VOD_ARCHIVE`) und wird erst nach bestandenem Audit eingeschaltet. Slider und Bereiche dürfen vorher live gehen; Aufträge warten dann, bis der Schalter an ist.
- Google-Cloud-Projekt mit YouTube-API und Antrag auf den Audit (mit Datenschutzerklärung) übernimmt Felix.

## Erwogene Alternativen

- Frage 1: öffentlich auf dem Team-Kanal (am meisten Reichweite, rechtlich am heikelsten); privat auf YouTube (ohne Audit möglich, aber im Stattracker nicht abspielbar); eigener Server (ohne Google, aber 1–3 GB je Match bei 137 GB frei).
- Frage 2: Freigabeliste der Kanäle (empfohlen; einmal pro Caster fragen); Bestätigung bei jeder Sicherung; nur eigene Kanäle (rechtlich sauber, verfehlt aber das Ziel).
- Frage 3: automatisch aus der Match-Zeit (die App kennt keine Uhrzeiten, Vorlauf und Pausen im Cast machen es ungenau); das ganze VOD (riesig bei mehrstündigen Casts, das Match muss man selbst suchen).
- Frage 4: Vorschaubilder unter dem Slider (Server müsste das VOD vorab laden); nur Slider mit Zeitanzeige, VOD im zweiten Tab (umständlich).
- Frage 5: Knopf „Sichern“ (wird vergessen); automatisch nur bei fremden Kanälen (App müsste die Team-Kanäle kennen).
- Frage 6: Zugang per Kommandozeile holen und als Umgebungsvariable eintragen (weniger Code, Wechsel nur über den Server).
- Frage 7: wer das Match bearbeiten darf, also auch Lineup-Manager (empfohlen); alle Spieler (viele Fehlversuche, die Quote kosten).
- Frage 8: beide Links nebeneinander (zuerst empfohlen, Absprung zur Plattform); die Sicherung ersetzt den Twitch-Link (Original versteckt); Player sofort eingebettet (lädt Google-Skripte auch ohne Klick).
- Frage 9: Titel beim Bereichsetzen eintippen (ein Feld mehr); schlichter Titel ohne Match-Details (im Studio nicht zuzuordnen).
- Frage 10: auf 720p verkleinert (Neukodieren, schlechteres Bild); sekundengenau mit Neukodieren in 1080p (Rechenzeit etwa Match-Länge).
- Frage 11: dev schneidet nur und simuliert den Upload (Upload erst in Production erstmals echt); eigener Test-Kanal (zweiter Kanal und Zugang nötig).
- Frage 12: Twitch-Anmeldung als Cookie hinterlegen (nur für abonnierte Kanäle, läuft ab, sensible Anmeldung auf dem Server).
- Frage 13: bleibt, aber mit Nachfrage beim Entfernen und Links in der Lösch-Bestätigung (empfohlen); immer mitlöschen (Versehen endgültig).
- Frage 14: im App-Container (größeres Image, App-Updates unterbrechen Sicherungen, Downloads bremsen den Seitenaufbau).
- Frage 15: Twitch und YouTube (zweiter Player, Content-ID erkennt kopierte YouTube-Videos); alles, was `yt-dlp` kann (ein Player je Seite).

## Konsequenzen

- Abhängigkeit von Google: Ohne bestandenen Audit sind nur private Uploads möglich; Projekt und Antrag (mit Datenschutzerklärung) liegen bei Felix oder dem Besitzer des Kanals.
- Quote: rund 6 Uploads pro Tag; mehr Sicherungen warten auf den nächsten Tag.
- Wartung: Twitch ändert gelegentlich etwas, dann braucht `yt-dlp` im `vod-worker` ein Update.
- Verwaiste Videos: Sicherungen entfernter VODs oder gelöschter Matches bleiben auf dem Kanal (Frage 13).
- Strikes: Drei Urheberrechtsbeschwerden können den Team-Kanal sperren. Wer den Kanal verwaltet, muss Beschwerden mitbekommen und die betroffene Sicherung entfernen; die App sollte dann auf den ursprünglichen VOD-Link zurückfallen.

## Technische Umsetzung

- Schritt a: Bereiche liegen in einer eigenen Tabelle `VodClip` (ein Eintrag je Match und VOD-Link, Sekunden `start`/`end`), getrennt von `Match.vods`, damit das Bearbeiten der Links im Dialog „Edit match“ keine Bereiche überschreibt. Route `PUT /api/tournaments/[id]/matches/[matchId]/vod-clip` (nur `canManage`). Zeitstempel, Twitch-Video-ID und Bereichsprüfung in `lib/vod.ts`; Dialog mit Twitch-Player und Slider in `components/vod-range-dialog.tsx`.
- Schritt b: Die Warteschlange steht an `VodClip` (`status` WAITING/LOADING/DONE/FAILED, `attempts`, `nextAttemptAt`, `requestedAt`, `startedAt`, `error`, `youtubeId`, `replacesYoutubeId`). Ein neuer oder geänderter Bereich stellt die Sicherung neu an; die alte bleibt sichtbar, bis die neue sie ersetzt. `POST …/vod-clip` fordert eine Sicherung von Hand an (dev, „Erneut versuchen“). Was als Nächstes dran ist, Wiederholungen (nach 10 min, 1 h, 4 h, dann fehlgeschlagen), Quote (bis Mitternacht Pacific Time) und das Einordnen der `yt-dlp`-Meldungen entscheidet `lib/vod-queue.ts` (ohne Imports, damit Node sie direkt lädt). Der Worker `worker/vod-worker.ts` läuft mit Node 24 ohne Build (Typen werden entfernt), Image `Dockerfile.vod-worker` mit `yt-dlp` (pip) und `ffmpeg`; Modus über `VOD_ARCHIVE` (`auto`, `manual`, `off`): dev `manual`, Production `off` bis nach dem Audit. Arbeitsverzeichnis ist das Volume `vod_work`; jede Datei wird nach dem Versuch gelöscht. Gemessen am 24.10.2026: 60 s aus einem Twitch-VOD in 1080p60 in rund 3 s geschnitten, 48 MB, Länge 60,05 s.

