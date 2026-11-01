#!/usr/bin/env python3
"""Baut aus engine.js, engine.css, den Szenen und runden.py je Tag eine
selbst enthaltene HTML-Seite (offline lauffähig) plus eine Übersichtsseite."""
import json, pathlib, re, sys

BASIS = pathlib.Path(__file__).resolve().parent.parent / "training" / "luis-aufsatz"
sys.path.insert(0, str(BASIS / "src"))
from runden import RUNDEN, SZENEN_TEXT  # noqa: E402

SZENEN_DATEI = {"bolzplatz": "szene1_bolzplatz.svg", "buch": "szene2_buch.svg", "dachboden": "szene3_dachboden.svg"}
WOCHENTAG = {"2026-11-02": "Mo 02.11.", "2026-11-03": "Di 03.11.", "2026-11-04": "Mi 04.11.",
             "2026-11-05": "Do 05.11.", "2026-11-06": "Fr 06.11.", "2026-11-09": "Mo 09.11."}


def svg(name):
    t = (BASIS / "szenen" / SZENEN_DATEI[name]).read_text(encoding="utf-8")
    return t.replace("<svg ", '<svg class="szene" ', 1)


def pruefe_stil(text, wo):
    if "—" in text or " – " in text:
        raise SystemExit(f"Gedankenstrich gefunden in {wo}")


def main():
    css = (BASIS / "src" / "engine.css").read_text(encoding="utf-8")
    js = (BASIS / "src" / "engine.js").read_text(encoding="utf-8")
    ziel = BASIS / "dist"
    ziel.mkdir(exist_ok=True)
    links = []
    for datum, r in sorted(RUNDEN.items()):
        genutzt = {a.get("szene") for a in r["aufgaben"]} | {r.get("startSzene")}
        r = dict(r, szenen={n: {"svg": svg(n), "text": SZENEN_TEXT[n]} for n in genutzt if n})
        daten = json.dumps(r, ensure_ascii=False)
        pruefe_stil(daten, r["id"])
        html = f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{r['titel'].split(':')[0]}: Schreibwerkstatt</title>
<style>{css}</style></head>
<body><div class="wrap" id="app"><noscript>Bitte JavaScript erlauben.</noscript></div>
<script>window.RUNDE = {daten};</script>
<script>{js}</script>
</body></html>"""
        name = f"{datum}_{r['id']}.html"
        (ziel / name).write_text(html, encoding="utf-8")
        links.append((WOCHENTAG.get(datum, datum), r["titel"], name))
    liste = "".join(f'<a class="btn" href="{n}"><b>{t}</b><br><span class="klein">{titel}</span></a>' for t, titel, n in links)
    index = f"""<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Schreibwerkstatt</title>
<style>{css} a.btn{{text-decoration:none}}</style></head><body><div class="wrap">
<h1>Schreibwerkstatt ✍️</h1><p>Jeden Tag eine Runde, 10 bis 15 Minuten. Tippe auf den heutigen Tag.</p>{liste}
<p class="klein">Samstag ist Generalprobe auf Papier. Sonntag gibt es die Rückmeldung.</p></div></body></html>"""
    (ziel / "index.html").write_text(index, encoding="utf-8")
    print("\n".join(n for _, _, n in links))


if __name__ == "__main__":
    main()
