# Kategorisierung der Comps nach Style

Status: Akzeptiert – gemeinsames Verständnis vom Nutzer bestätigt, Umsetzung läuft.

## Kontext

Comps unterscheiden sich im Fahrstil ihrer Maps (Tech, Mixed, RPG, Ice, Fullspeed usw.). Im Stattracker hat ein Turnier bisher Name, Formate, Beschreibung und Daten, aber kein Feld für den Style. Maps sind keine eigenen Datensätze: Der Map-Name steht als freier Text an jeder Runde (`Round.track`). Das TFH-Archiv trennt 24h und 12h RPG fest im Code als verschiedene Fahrstile.

## Entscheidung

Bestätigt: Der Style hängt an der Comp, nicht an der einzelnen Map. Ein Turnier wird als Ganzes einem Style zugeordnet.

Bestätigt: Die Styles sind eine feste Liste im Code. Ein neuer Style ist eine Code-Änderung.

Bestätigt: Die Liste enthält Tech, Fullspeed, Dirt, Ice, RPG, Endurance und Mixed.

Bestätigt: Jede Comp hat genau einen Style, nie mehrere. Eine Comp ohne Schwerpunkt im Mappool ist Mixed.

Bestätigt: Alle TFH-Rennen, auch die 12h-RPG-Ausgaben, werden als Endurance geführt. RPG bleibt als Style für andere Comps in der Liste.

Bestätigt: Die erste Version zeigt den Style an, filtert die Turnierliste nach Style und schlüsselt die Stats im Spielerprofil nach Style auf.

Bestätigt: Der Filter sitzt an zwei Stellen, die dieselbe Adresse steuern (`/tournaments?style=…`): als Untermenü unter „Tournaments“ in der Sidebar (All, Tech, Mixed, Ice …) und als Buttonreihe oben auf der Turnierseite. Die Buttonreihe ist der Filter für Handy und eingeklappte Sidebar.

Bestätigt: Das Spielerprofil bekommt unter den Lifetime-Stats einen Block „By style“ mit einer Zeile pro Style und denselben Kennzahlen wie die Format-Zeilen (Runden, Ø Platz, DNFs, Runden W/L, Pace mit Rang im Team). Es erscheinen nur Styles, in denen der Spieler Runden gefahren ist. Endurance erscheint dort nicht, weil TFH-Ergebnisse im Langstreckenabschnitt bleiben.

Bestätigt: Beim Anlegen eines Turniers ist der Style Pflicht. Die bestehenden TFH-Rennen setzt die Migration auf Endurance, der TFH-Import vergibt Endurance künftig selbst. Die bestehenden Runden-Comps setzt die Migration ebenfalls: MTS S1 und MTS Fall 2024 Tech; EMC S7, EMC S8, Omnium S1, 7CC S1, SMS S1 und Vertigo S1 Mixed; Blitz League S1 RPG.

Bestätigt: Der Style ist auch in der Datenbank Pflicht. Die Migration bricht ab, wenn ein Turnier keinen Style bekäme; ein Turnier ohne Style und den Hinweis „Style fehlt“ gibt es nicht.

Bestätigt: Die TFH-Fahrersummen (`/tfh`) sind nur noch unter dem Filter Endurance erreichbar und stehen dort präsenter als bisher: Bei `/tournaments?style=endurance` steht über den Turnierkarten eine anklickbare Karte „TFH driver totals“ mit kurzer Beschreibung und Zahl der Ausgaben. Der bisherige Button oben rechts entfällt; unter „All“ und den anderen Styles erscheint die Karte nicht. „Import TFH race“ bleibt als Admin-Button unabhängig vom Filter.

Bestätigt: Untermenü und Buttonreihe zeigen „All“ und nur die Styles, zu denen es mindestens ein Turnier gibt.

Nachgeschlagen: Den Style setzen dieselben Rollen, die Turniere anlegen und bearbeiten (Admin und Manager, `canManage`).

## Erwogene Alternativen

- Style an der Map, Style der Comp daraus abgeleitet: bei Mixed-Comps genauer, setzt aber einen eigenen Map-Katalog und die Pflege jeder Map voraus. Nicht gewählt.
- Frei pflegbare Style-Liste in der App oder Freitext am Turnier: nicht gewählt; die Styles sind ein kleiner, stabiler Satz, und Freitext macht Auswertungen unzuverlässig.
- Nur die Styles aus dem Todo (ohne Dirt und Endurance) oder eine breite Liste mit seltenen Styles: nicht gewählt.
- Mehrere Styles pro Comp (etwa Endurance und RPG für die 12h-Rennen): nicht gewählt.
- Filter nur in der Sidebar (fehlt auf dem Handy) oder nur auf der Turnierseite: nicht gewählt.
- Style als Umschalter über dem ganzen Profil oder Format je Style aufklappbar: nicht gewählt.
- Style optional, leer erlaubt als Auffangnetz für die Migration oder Platzhalter-Style für unbekannte Turniere: nicht gewählt.
- Immer alle sieben Styles im Filter, auch leere oder ausgegraut: nicht gewählt.
- Fahrersummen-Tabelle direkt auf der Endurance-Seite oder als dritte Menüebene in der Sidebar: nicht gewählt.
- Beides (Comp jetzt, Map später): nicht beschlossen; die Entscheidung für die Comp verbaut den Weg nicht.

## Offene Fragen

Keine.

## Konsequenzen

- `Tournament` bekommt ein Style-Feld (Enum, Pflicht) samt Migration, die TFH-Rennen auf Endurance und die neun Runden-Comps über ihren Namen setzt. Sie läuft zuerst in Dev, in Production erst beim Rebuild. Trifft sie dort ein Turnier nicht, etwa ein neues oder umbenanntes, bricht sie ab und blockiert den Rollout, bis sie angepasst ist; vor dem Rebuild ist die Turnierliste der Production deshalb zu prüfen.
- „Tournaments“ ist der erste Navigationseintrag mit Unterpunkten; bei eingeklappter Sidebar und in der Bottom Bar gibt es sie nicht, dort filtert die Buttonreihe.
- Die Profilberechnung (`lib/player-profile.ts`) bekommt eine Gruppierung nach Style neben der nach Format.
- Die Trennung von 24h und 12h in den TFH-Fahrersummen bleibt unberührt, obwohl beide Endurance sind.
- Stats pro Map-Style sind damit nicht möglich; sie bräuchten einen Map-Katalog.
