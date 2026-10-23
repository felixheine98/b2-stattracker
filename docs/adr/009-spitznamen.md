# Spitznamen

Status: Akzeptiert – von Felix am 23.10.2026 bestätigt.

## Kontext

Manche Spieler kennt das Team unter einem anderen Namen als ihrem Gamertag: DMR_GameBros ist „Dennis“, Existenzminimum oft nur „Philip“. Bisher kennt die App je Spieler nur den Gamertag mit seiner Namenshistorie (`initialName` plus `PlayerNameChange`); innerhalb einer Comp gilt der Gamertag vom Starttag. Die Zuordnung „Screenshot-Name → Spieler“ aus ADR 007 dient nur dem Import alter Ergebnisse, nicht der Anzeige.

## Entscheidung

Bestätigt (23.10.2026): Jeder Spieler kann einen Spitznamen haben (`Player.nickname`, einer pro Spieler, undatiert). Admins und Manager setzen ihn im Namensdialog am Profil bzw. in der Spielerliste; ein leeres Feld entfernt ihn.

Bestätigt (23.10.2026): Der Spitzname steht überall in der App statt des Gamertags, auch in alten Comps. Beim Hover stehen der Gamertag (in einer Comp der vom Starttag) und die übrigen Namen. Ohne Spitznamen bleibt es beim bisherigen Verhalten: der damalige Gamertag, beim Hover der heutige.

Suche, Spielerauswahl und die Vorschläge der Aufstellung finden einen Spieler über Spitzname, Gamertag und frühere Namen. Imports (CSV, eCM, TFH) ordnen weiter über TM-ID und Gamertag zu; Konten, Gegner und Import-Zuordnungen zeigen weiter Gamertags.

## Umsetzung

`shownName` und `nameHint` in `lib/player-names.ts` legen fest, was angezeigt wird und was beim Hover steht; `components/player-name.tsx` zeigt es an. `applyCompNames` gibt den Spitznamen in den Daten einer Comp mit, die Stats-Module reichen ihn über `nameFieldsOf` weiter.
