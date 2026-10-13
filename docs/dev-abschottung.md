# Dev-Umgebung abschotten

Status: Vorhaben – noch nicht umgesetzt, drei Fragen offen (siehe unten). Stand 13.10.2026.

## Ziel

Die Dev-Umgebung (`/stats-dev`) soll nur für Felix erreichbar sein. Die Spieler-, Turnier- und Matchdaten sollen dem Stand der Production folgen.

## Stand heute

- Dev ist öffentlich unter `https://b2-esports.com/stats-dev` erreichbar; nginx reicht den Pfad ohne Einschränkung an den Dev-Server (127.0.0.1:3052) durch.
- Die Dev-Datenbank enthält alle 44 Accounts der Production mit denselben Passwörtern (1 Admin, 2 Manager, 41 Spieler). Wer sich in Production anmelden kann, kommt auch in Dev hinein.
- Einen Abgleich der Daten gibt es nicht. Dev ist eine einmalige Kopie vom 12.10.2026 und läuft seither auseinander.

## Vorschlag

### 1. Sperre vor der App (empfohlen)

Eine Passwortabfrage in nginx vor `/stats-dev`. Der Browser fragt einmal nach Benutzer und Passwort, bevor etwas von Dev ausgeliefert wird. Das schützt auch den Dev-Server selbst (`next dev` ist nicht für das offene Netz gebaut) und greift auch, wenn jemand Cloudflare umgeht. App-Anmeldung und Passkeys funktionieren dahinter unverändert.

Einrichtung, von Felix mit sudo:

```
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-stats-dev shoffy
```

Im Block `location /stats-dev` in `/etc/nginx/sites-available/b2-esports.com` ergänzen:

```
auth_basic "B2 Stats dev";
auth_basic_user_file /etc/nginx/.htpasswd-stats-dev;
```

```
sudo nginx -t && sudo systemctl reload nginx
```

Alternative: Cloudflare Access auf dem Pfad (Anmeldung per Mail-Code). Genauso dicht, solange niemand den Server an Cloudflare vorbei erreicht; Einrichtung im Cloudflare-Dashboard.

### 2. Logins

- Mit der Sperre davor können die 44 Logins in Dev bleiben.
- Zusätzlich zwei Test-Accounts (ein Manager, ein Spieler), um die Rollen zu prüfen, ohne sich als echtes Mitglied anzumelden.
- Ohne die Sperre: in Dev alle Accounts bis auf den Admin „Shoffy“ löschen und nur die zwei Test-Accounts dazulegen. Das geht ohne sudo, lässt den Dev-Server aber offen im Netz stehen.

### 3. Daten synchron halten

Ein Skript kopiert die Production-Daten nach Dev und legt danach die Test-Accounts wieder an. Dev wird dabei jedes Mal überschrieben; was nur in Dev existiert, ist danach weg.

## Offene Fragen

1. Richtet Felix die nginx-Sperre ein (oder Cloudflare Access)?
2. Ist der Test-Spieler mit einem eigenen Dummy-Spielerprofil verknüpft (sieht dann „My profile“ und kann in der Planung antworten) oder ohne Profil?
3. Läuft der Abgleich von Hand per Skript oder automatisch, etwa jede Nacht?
