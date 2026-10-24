# Glossar: VOD-Archiv

Begriffe aus [ADR 011](adr/011-vod-archiv.md). Stand: bestätigt am 24.10.2026.

- **VOD**: die Aufzeichnung eines Streams, in der App ein Link an einem Match (`Match.vods`); meist Twitch.
- **Fremder Kanal**: ein Twitch-Kanal, der nicht dem Team gehört (Caster, Gegner, einzelne Spieler).
- **Ausschnitt**: der Teil eines VODs vom Anfang bis zum Ende eines Matches, bestimmt durch zwei Zeitstempel, die von Hand mit dem Bereichs-Slider gesetzt werden.
- **Sicherung**: ein Ausschnitt, der aus dem VOD geholt und dauerhaft abgelegt wurde: als nicht gelistetes Video auf dem Team-Kanal.
- **Team-Kanal**: der YouTube-Kanal des Teams B2. Es gibt ihn; ihn verwalten die Manager und ausgewählte Personen.
- **Nicht gelistet** (YouTube „unlisted“): ein Video, das nur über seinen Link erreichbar ist, nicht über Kanal oder Suche.
- **Audit**: die Prüfung eines Google-API-Projekts durch Google; erst danach dürfen per API hochgeladene Videos etwas anderes als privat sein.
- **Bereichs-Slider**: die Leiste über die ganze Länge eines VODs mit zwei Schranken (Anfang, Ende); der Bereich dazwischen ist der Ausschnitt.
- **Sicherungsstatus**: wartet (Bereich gespeichert, noch nicht dran, z. B. wegen der Tagesquote), lädt (Ausschnitt wird geholt oder hochgeladen), gesichert (YouTube-Link vorhanden), fehlgeschlagen (mit Grund).
- **vod-worker**: der Container neben App und Discord-Bot, der Sicherungen ausführt (Ausschnitt mit `yt-dlp`/`ffmpeg` holen, auf YouTube hochladen); er arbeitet eine Warteschlange in der Datenbank ab.
- **`VOD_ARCHIVE`**: Schalter für das automatische Sichern in Production; erst nach bestandenem Audit an.
