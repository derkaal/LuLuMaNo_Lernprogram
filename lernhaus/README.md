# Lernhaus

Lokales System für Übungstests, Auswertung, Lernstand und Familientopf.

**Wichtig:** Dieses Repository ist öffentlich. Private Daten der Kinder (Profile, Lernstände, Belege, Tests, Auswertungen, Topf) stehen in `.gitignore` und gehören nie hierher.

## Stand 01.11.2026
| Baustein | Stand |
|---|---|
| Ordnergerüst, `config/` | angelegt (privat, lokal) |
| Aufsatztraining (Tablet) Mo 02.11. bis Fr 06.11. und Mo 09.11. | fertig, im Browser getestet (`training/luis-aufsatz/dist/`) |
| Generalprobe Sa 07.11. | fertig (`training/luis-aufsatz/papier/`; Coach-Notiz liegt privat bei den Tests) |
| Info für Eltern | fertig (privat, `eltern/`) |
| Lernstände aus den Elternprofilen | angelegt (privat) |
| Übernahme bestehender Lernstände | offen: Zugriff auf die Originaldateien fehlt |
| Einstufung und Wochenendtests (Papier) | offen |
| /intake, /grade, /report, /status, /generate | offen |

## Aufsatztraining neu bauen
```
python3 tools/build_luis_training.py
node tools/html2pdf.js training/luis-aufsatz/papier/*.html
```
Inhalte: `training/luis-aufsatz/src/runden.py` (jede Runde genau 10 Punkte, die ersten zwei Aufgaben sicher, keine Rechtschreibwertung). Szenen sind selbst gezeichnete SVGs in `training/luis-aufsatz/szenen/`.

## Tablet-Seite: Ablauf
Startseite mit Bild, Timer (läuft weiter ins Plus, keine Strafe), Fortschrittsbalken, 2 Joker pro Runde (💡 Tipp oder ⏭️ Später, je ungenutzter Joker +1 für den Topf), sofortige Rückmeldung, Ergebnisseite mit Rekordlinie, Begründung je fehlendem Punkt, Elternfeld und Ergebnisdatei (`lernhaus-ergebnis-1`, JSON). Der Zwischenstand bleibt beim Neuladen erhalten.
