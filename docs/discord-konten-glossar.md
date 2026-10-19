# Glossar: Discord-Konten und Reaktionsimport

Begriffe aus [ADR 006](adr/006-discord-konten.md) und der [Discord-Anbindung](discord-planning.md).

- **Discord-Konto**: ein Discord-Account, eindeutig über seine Discord-ID (Snowflake). Anzeigename und Nutzername können sich ändern, die ID nicht.
- **Verknüpfung**: die Zuordnung eines Discord-Kontos zu genau einem Spieler (`Player.discordUserId`). Ein Spieler hat höchstens ein Konto, ein Konto gehört höchstens einem Spieler. Ein neues Konto ersetzt nach Bestätigung das bisherige. Gepflegt auf der Seite „Discord accounts“ oder im Reaktionsimport.
- **Member-Verzeichnis**: die Daten des Member-Bots (`b2-member`), Discord-ID → Anzeigename und Land, für die Teamliste im Discord. Kein Teil des Stattrackers.
- **Reaktionsimport**: das Übernehmen von Emoji-Reaktionen einer Discord-Nachricht als Antworten in eine Comp-Planung.
- **Emoji-Zuordnung**: die Bedeutung eines Emojis für die Planung (Status, Planungsstufe oder Ignorieren), pro Comp gespeichert.
- **Unbekanntes Konto**: ein Discord-Konto mit Reaktion, das mit keinem Spieler verknüpft ist. Der Import zeigt nur diese Konten zur Zuordnung oder zum Ignorieren. Bleibt es offen, werden seine Reaktionen für diesen Abruf nicht übernommen.
- **Vorschlag**: ein Spieler, den die Seite „Discord accounts“ für ein unverknüpftes Konto über gleichen Namen (Discord, Member-Verzeichnis, Namensverlauf) vorauswählt. Wird erst durch Bestätigen zur Verknüpfung.
- **Not a player**: dauerhafte Markierung eines Discord-Kontos, das nie importiert wird (z. B. Supporter). Auf der Seite „Discord accounts“ umkehrbar.
- **Seite „Discord accounts“**: `/players/discord`, für Admins und Manager; listet Server-Mitglieder (standardmäßig Manager, Racing Team, Trial) mit Verknüpfung, Vorschlag oder „Not a player“.
- **Announcement**: die Discord-Nachricht einer Comp, auf deren Reaktionen der Import beruht; ihr Link wird pro Comp gespeichert.
