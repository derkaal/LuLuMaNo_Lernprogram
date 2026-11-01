/* Lernhaus Tablet-Runde. Erwartet ein globales Objekt RUNDE (siehe runde_*.js).
   Aufgabentypen: wahl, reihe, zuordnen, tippen. Läuft offline, ohne Server. */
(function () {
  "use strict";
  var R = window.RUNDE;
  var SPEICHER = "lernhaus." + R.kind + "." + R.id;
  var VERLAUF = "lernhaus." + R.kind + "." + (R.reihe || "runden") + ".verlauf";
  var JOKER_START = 2;
  var JUBEL = ["Richtig! 🎉", "Volltreffer! ⚽", "Genau so! 💪", "Stark! ⭐", "Sitzt! ✅", "Klasse! 🙌", "Super gemacht! 🎯"];
  var LEER_WOERTER = ["gut", "schön", "schoen", "toll", "nett", "groß", "gross", "klein", "normal", "okay", "ok", "cool", "sehr", "viel"];

  function ls(get, key, val) {
    try {
      if (get) { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function $(sel) { return document.querySelector(sel); }
  function el(tag, attrs, kinder) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kinder || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function mischen(arr, seed) {
    var a = arr.slice(), s = seed || 7;
    for (var i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; var j = Math.floor(s / 233280 * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function woerter(t) { return (t || "").trim().split(/\s+/).filter(function (w) { return w.replace(/[^\wäöüÄÖÜß]/g, "").length > 0; }); }
  function mmss(sek) { var neg = sek < 0; sek = Math.abs(Math.round(sek)); var m = Math.floor(sek / 60), s = sek % 60; return (neg ? "+" : "") + m + ":" + (s < 10 ? "0" : "") + s; }

  var aufgabenNachId = {};
  R.aufgaben.forEach(function (a, i) { a.id = a.id || ("a" + (i + 1)); aufgabenNachId[a.id] = a; });
  var MAX = R.aufgaben.reduce(function (s, a) { return s + a.punkte; }, 0);

  var S = ls(true, SPEICHER);
  function neuerStand() {
    return { phase: "start", reihenfolge: R.aufgaben.map(function (a) { return a.id; }), pos: 0, erg: {}, joker: JOKER_START,
      jokerLog: [], spaeter: {}, tipps: {}, startTs: null, endeTs: null, marker: {}, eltern: {}, fertig: false };
  }
  if (!S || S.version !== R.version) { S = neuerStand(); S.version = R.version; }
  function sichern() { ls(false, SPEICHER, S); }

  var app = $("#app");
  var timerHandle = null;

  /* ---------- Kopfleiste ---------- */
  function leiste() {
    var punkte = Object.keys(S.erg).reduce(function (s, k) { return s + S.erg[k].punkte; }, 0);
    var anteil = Object.keys(S.erg).length / R.aufgaben.length * 100;
    var a = aktuelleAufgabe();
    var h = el("header", { class: "leiste" }, [
      el("div", { class: "leiste-oben" }, [
        el("div", { class: "uhr", id: "uhr", text: "0:00" }),
        el("div", { class: "punkte-anzeige", text: "⭐ " + punkte + " / " + MAX }),
        el("div", { class: "joker-leiste" }, [
          el("button", { class: "joker", id: "jTipp", title: "Tipp-Joker", "aria-label": "Tipp-Joker",
            onclick: tippJoker }, ["💡 ", el("span", { text: String(S.joker) })]),
          el("button", { class: "joker", id: "jSpaeter", title: "Später-Joker", "aria-label": "Später-Joker",
            onclick: spaeterJoker }, ["⏭️ ", el("span", { text: String(S.joker) })])
        ])
      ]),
      el("div", { class: "fortschritt", "aria-label": "Fortschritt" }, [el("div", { style: "width:" + anteil + "%" })]),
      el("div", { id: "zeitUm", class: "zeit-um versteckt", text: "Die Zeit ist um. Kein Problem: mach in Ruhe fertig!" })
    ]);
    setTimeout(function () {
      var offen = !a || S.erg[a.id] || $("#rueck");
      if (S.joker <= 0 || offen) { $("#jTipp").disabled = true; $("#jSpaeter").disabled = true; }
      if (a && (!a.tipp || S.tipps[a.id])) $("#jTipp").disabled = true;
      if (a && (restOffen() <= 1 || S.spaeter[a.id])) $("#jSpaeter").disabled = true;
    }, 0);
    return h;
  }
  function tick() {
    var u = $("#uhr"); if (!u || !S.startTs) return;
    var lauf = (Date.now() - S.startTs) / 1000;
    var rest = R.minuten * 60 - lauf;
    u.textContent = mmss(rest);
    u.classList.toggle("knapp", rest < 120);
    var z = $("#zeitUm"); if (z) z.classList.toggle("versteckt", rest > 0);
  }
  function startTimer() { if (timerHandle) clearInterval(timerHandle); timerHandle = setInterval(tick, 1000); tick(); }

  function restOffen() { return S.reihenfolge.slice(S.pos).filter(function (id) { return !S.erg[id]; }).length; }
  function aktuelleAufgabe() { return aufgabenNachId[S.reihenfolge[S.pos]]; }

  /* ---------- Joker ---------- */
  function tippJoker() {
    var a = aktuelleAufgabe(); if (!a || S.joker <= 0 || !a.tipp || S.tipps[a.id]) return;
    S.joker--; S.tipps[a.id] = true; S.jokerLog.push({ typ: "tipp", aufgabe: a.id }); sichern();
    var box = $("#tippBox"); if (box) { box.textContent = "💡 " + a.tipp; box.classList.remove("versteckt"); }
    aktualisiereJoker();
  }
  function spaeterJoker() {
    var a = aktuelleAufgabe(); if (!a || S.joker <= 0 || restOffen() <= 1 || S.spaeter[a.id]) return;
    S.joker--; S.spaeter[a.id] = true; S.jokerLog.push({ typ: "spaeter", aufgabe: a.id });
    S.reihenfolge.splice(S.pos, 1); S.reihenfolge.push(a.id); sichern(); zeigen();
  }
  function aktualisiereJoker() {
    ["#jTipp", "#jSpaeter"].forEach(function (s) { var b = $(s); if (b) b.querySelector("span").textContent = String(S.joker); });
    if (S.joker <= 0) { $("#jTipp").disabled = true; $("#jSpaeter").disabled = true; }
    var a = aktuelleAufgabe(); if (a && S.tipps[a.id]) $("#jTipp").disabled = true;
  }

  /* ---------- Szene ---------- */
  function szeneBlock(name, offen) {
    var sz = R.szenen && R.szenen[name]; if (!sz) return null;
    var inhalt = el("div", { class: offen ? "" : "versteckt" }, [
      el("div", { html: sz.svg }), el("p", { class: "szene-text", text: sz.text })
    ]);
    var knopf = el("button", { class: "bildknopf", text: offen ? "Bild ausblenden" : "🖼️ Bild ansehen", onclick: function () {
      inhalt.classList.toggle("versteckt"); knopf.textContent = inhalt.classList.contains("versteckt") ? "🖼️ Bild ansehen" : "Bild ausblenden";
    } });
    return el("div", { style: "margin:0 0 12px" }, [knopf, inhalt]);
  }

  /* ---------- Bewertung und Rückmeldung ---------- */
  function abschliessen(a, punkte, antwort, richtigText, grund) {
    S.erg[a.id] = { punkte: punkte, max: a.punkte, antwort: antwort, tipp: !!S.tipps[a.id], grund: punkte < a.punkte ? grund : null };
    if (a.marker) S.marker[a.marker] = Math.round((Date.now() - S.startTs) / 1000);
    sichern();
    var voll = punkte === a.punkte;
    var box = el("div", { id: "rueck", class: "rueck " + (voll ? "gut" : "naja") });
    if (voll) {
      box.appendChild(el("div", { class: "jubel", text: a.typ === "tippen" ? "Stark geschrieben! ✍️" : JUBEL[Math.floor(Math.random() * JUBEL.length)] }));
      if (a.lob) box.appendChild(el("p", { text: a.lob }));
    } else {
      box.appendChild(el("div", { class: "jubel", text: punkte > 0 ? "Fast! 👍 " + punkte + " von " + a.punkte + " Punkten" : "Nicht schlimm! 🙂" }));
      if (a.gefragt) box.appendChild(el("p", { text: "Gefragt war: " + a.gefragt }));
      if (grund) box.appendChild(el("p", { text: grund }));
    }
    if (richtigText) box.appendChild(el("p", { html: "<b>" + (a.typ === "tippen" ? "Ein Beispiel" : "Lösung") + ":</b> " + richtigText }));
    box.appendChild(el("button", { class: "btn gross", text: S.pos + 1 >= S.reihenfolge.length ? "Zum Ergebnis ➜" : "Weiter ➜", onclick: weiter }));
    $("#aufgabe").appendChild(box);
    aktualisiereJoker(); $("#jTipp").disabled = true; $("#jSpaeter").disabled = true;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    var pa = document.querySelector(".punkte-anzeige");
    if (pa) pa.textContent = "⭐ " + Object.keys(S.erg).reduce(function (s, k) { return s + S.erg[k].punkte; }, 0) + " / " + MAX;
    var fb = document.querySelector(".fortschritt>div"); if (fb) fb.style.width = (Object.keys(S.erg).length / R.aufgaben.length * 100) + "%";
  }
  function weiter() { S.pos++; if (S.pos >= S.reihenfolge.length) { S.phase = "ende"; S.endeTs = Date.now(); } sichern(); zeigen(); }

  /* ---------- Aufgabentypen ---------- */
  function wahl(a, box) {
    var reihenfolge = a.mischen === false ? a.optionen.map(function (_, i) { return i; }) : mischen(a.optionen.map(function (_, i) { return i; }), a.id.length * 31 + a.optionen.length);
    reihenfolge.forEach(function (i) {
      box.appendChild(el("button", { class: "btn", "data-i": i, text: a.optionen[i], onclick: function () {
        box.querySelectorAll(".btn").forEach(function (b) { b.disabled = true; if (+b.getAttribute("data-i") === a.richtig) b.classList.add("richtig"); });
        var ok = i === a.richtig;
        if (!ok) this.classList.add("falsch");
        abschliessen(a, ok ? a.punkte : 0, a.optionen[i], ok ? null : a.optionen[a.richtig], ok ? null : (a.warum || null));
      } }));
    });
  }

  function reihe(a, box) {
    var gewaehlt = [];
    var ziel = el("div", { class: "reihe-ziel" });
    var pool = el("div");
    var fertig = el("button", { class: "btn gross versteckt", text: "Fertig ✔", onclick: pruefen });
    box.appendChild(el("p", { class: "klein", text: "Tippe die Karten der Reihe nach an. Nochmal antippen nimmt sie zurück." }));
    box.appendChild(ziel); box.appendChild(pool); box.appendChild(fertig);
    var ordnung = mischen(a.karten.map(function (_, i) { return i; }), a.karten.length * 13 + 5);
    if (ordnung.every(function (v, i) { return v === i; })) ordnung.reverse();
    function malen() {
      ziel.innerHTML = ""; pool.innerHTML = "";
      gewaehlt.forEach(function (i, n) {
        ziel.appendChild(el("button", { class: "btn", onclick: function () { gewaehlt.splice(n, 1); malen(); } }, [el("span", { class: "nr", text: (n + 1) + "." }), a.karten[i]]));
      });
      ordnung.forEach(function (i) {
        if (gewaehlt.indexOf(i) >= 0) return;
        pool.appendChild(el("button", { class: "btn", text: a.karten[i], onclick: function () { gewaehlt.push(i); malen(); } }));
      });
      fertig.classList.toggle("versteckt", gewaehlt.length !== a.karten.length);
    }
    function pruefen() {
      var richtig = gewaehlt.filter(function (v, n) { return v === n; }).length, n = a.karten.length;
      var p = richtig === n ? a.punkte : (a.punkte > 1 && richtig >= n - 2 ? a.punkte - 1 : 0);
      ziel.querySelectorAll(".btn").forEach(function (b, k) { b.disabled = true; b.classList.add(gewaehlt[k] === k ? "richtig" : "falsch"); });
      fertig.remove();
      var loesung = "<ol>" + a.karten.map(function (k) { return "<li>" + k + "</li>"; }).join("") + "</ol>";
      abschliessen(a, p, gewaehlt.map(function (i) { return a.karten[i]; }), p === a.punkte ? null : loesung,
        p === a.punkte ? null : (n - richtig) + " Karten standen an einer anderen Stelle als im Plan.");
    }
    malen();
  }

  function zuordnen(a, box) {
    var wahlen = {};
    var fertig = el("button", { class: "btn gross versteckt", text: "Fertig ✔", onclick: pruefen });
    var zeilen = a.items.map(function (it, n) {
      var z = el("div", { class: "zuord" }, [el("div", { class: "t", text: it.text })]);
      var w = el("div", { class: "wahl" });
      a.kategorien.forEach(function (k, ki) {
        w.appendChild(el("button", { text: k, onclick: function () {
          wahlen[n] = ki; w.querySelectorAll("button").forEach(function (b, bi) { b.classList.toggle("an", bi === ki); });
          fertig.classList.toggle("versteckt", Object.keys(wahlen).length !== a.items.length);
        } }));
      });
      z.appendChild(w); box.appendChild(z); return z;
    });
    box.appendChild(fertig);
    function pruefen() {
      var falsch = 0;
      a.items.forEach(function (it, n) { var ok = wahlen[n] === it.kat; if (!ok) falsch++; zeilen[n].classList.add(ok ? "ok" : "nok");
        zeilen[n].querySelectorAll("button").forEach(function (b) { b.disabled = true; });
        if (!ok) zeilen[n].appendChild(el("div", { class: "klein", text: "Richtig wäre: " + a.kategorien[it.kat] + (it.warum ? ". " + it.warum : "") })); });
      fertig.remove();
      var p = falsch === 0 ? a.punkte : (falsch === 1 && a.punkte > 1 ? a.punkte - 1 : 0);
      abschliessen(a, p, a.items.map(function (it, n) { return it.text + " → " + a.kategorien[wahlen[n]]; }), null,
        falsch ? falsch + (falsch === 1 ? " Satz war" : " Sätze waren") + " in der anderen Gruppe richtig (siehe oben)." : null);
    }
  }

  function tippen(a, box) {
    var feld = a.lang ? el("textarea", { placeholder: a.platzhalter || "Hier tippen ...", autocapitalize: "sentences", spellcheck: "false" })
                      : el("input", { type: "text", placeholder: a.platzhalter || "Hier tippen ...", autocapitalize: "off", spellcheck: "false" });
    var info = el("p", { class: "klein", text: a.hinweis || "Rechtschreibung zählt hier nicht. Es geht nur um deine Idee." });
    var los = el("button", { class: "btn gross", text: "Fertig ✔", onclick: pruefen });
    box.appendChild(feld); box.appendChild(info); box.appendChild(los);
    setTimeout(function () { try { feld.focus(); } catch (e) {} }, 50);
    function pruefen() {
      var t = feld.value.trim();
      if (!t) { info.textContent = "Tippe zuerst etwas ein. Ein Wort reicht schon für den Anfang!"; return; }
      var w = woerter(t), n = w.length, p = 0, grund = null;
      if (a.vorher) n = n - woerter(a.vorher).length;
      var verboten = (a.verboten || []).concat(a.leerWoerter ? LEER_WOERTER : []);
      var leer = w.filter(function (x) { return verboten.indexOf(x.toLowerCase().replace(/[^a-zäöüß]/g, "")) >= 0; });
      (a.stufen || [{ min: 1, p: a.punkte }]).some(function (s) { if (n >= s.min) { p = s.p; return true; } return false; });
      if (a.einWort && w.length === 1 && leer.length) { p = Math.max(0, p - 1); grund = "„" + leer[0] + "“ sagt wenig. Ein genaueres Wort zeigt dem Leser mehr."; }
      else if (p < a.punkte) grund = a.grundKurz || ("Für alle Punkte brauchst du " + (a.stufen ? a.stufen[0].min : 1) + (a.vorher ? " neue" : "") + " Wörter.");
      feld.disabled = true; los.remove();
      abschliessen(a, p, t, a.beispiel || null, grund);
    }
  }

  /* ---------- Bildschirme ---------- */
  function startBildschirm() {
    app.innerHTML = "";
    var alt = Object.keys(S.erg).length > 0 && S.phase === "aufgabe";
    var k = el("div", { class: "karte" }, [
      el("div", { class: "klein", text: R.untertitel || "" }),
      el("h1", { text: R.titel }),
      R.startSzene ? szeneBlock(R.startSzene, true) : null,
      el("p", { html: R.einleitung }),
      el("ul", { html: "<li>" + MAX + " Punkte für den Familientopf</li><li>2 Joker: 💡 Tipp oder ⏭️ Später. Nicht gebraucht? Dann +1 Bonuspunkt pro Joker.</li><li>Ungefähr " + R.minuten + " Minuten. Die Uhr läuft oben mit.</li>" }),
      el("button", { class: "btn gross", text: alt ? "Weitermachen ➜" : "Los geht's ➜", onclick: function () {
        if (!S.startTs) S.startTs = Date.now(); S.phase = "aufgabe"; sichern(); zeigen();
      } }),
      alt ? el("button", { class: "btn zweit", text: "Ganz von vorn beginnen", onclick: function () { if (confirm("Wirklich neu anfangen?")) { S = neuerStand(); S.version = R.version; sichern(); zeigen(); } } }) : null
    ]);
    app.appendChild(k);
  }

  function aufgabeBildschirm() {
    var a = aktuelleAufgabe();
    if (!a) { S.phase = "ende"; sichern(); return zeigen(); }
    if (S.erg[a.id]) { S.pos++; sichern(); return zeigen(); }
    app.innerHTML = "";
    app.appendChild(leiste());
    var nr = Object.keys(S.erg).length + 1;
    var box = el("div", { class: "karte", id: "aufgabe" }, [
      el("div", { class: "klein", text: "Aufgabe " + nr + " von " + R.aufgaben.length + " · " + a.punkte + (a.punkte === 1 ? " Punkt" : " Punkte") + (S.spaeter[a.id] ? " · später-Aufgabe" : "") }),
      a.szene ? szeneBlock(a.szene, false) : null,
      el("p", { class: "frage", text: a.frage }),
      a.satz ? el("div", { class: "satz", html: a.satz }) : null,
      el("div", { id: "tippBox", class: "tipp " + (S.tipps[a.id] ? "" : "versteckt"), text: S.tipps[a.id] ? "💡 " + a.tipp : "" })
    ]);
    app.appendChild(box);
    ({ wahl: wahl, reihe: reihe, zuordnen: zuordnen, tippen: tippen })[a.typ](a, box);
    startTimer();
  }

  function ergebnisDaten() {
    var punkte = Object.keys(S.erg).reduce(function (s, k) { return s + S.erg[k].punkte; }, 0);
    return {
      format: "lernhaus-ergebnis-1", kind: R.kind, test: R.id, titel: R.titel, datumGeplant: R.datum,
      abgeschlossen: new Date(S.endeTs || Date.now()).toISOString(),
      punkte: punkte, max: MAX, jokerUebrig: S.joker, bonusTopf: S.joker, topfGesamt: punkte + S.joker,
      dauerSek: S.startTs ? Math.round(((S.endeTs || Date.now()) - S.startTs) / 1000) : null,
      zeitzielMin: R.minuten, marker: S.marker, joker: S.jokerLog,
      aufgaben: R.aufgaben.map(function (a) { var e = S.erg[a.id] || {}; return { id: a.id, typ: a.typ, schwerpunkt: a.schwerpunkt || null, punkte: e.punkte || 0, max: a.punkte, antwort: e.antwort === undefined ? null : e.antwort, tippJoker: !!e.tipp, spaeterJoker: !!S.spaeter[a.id], grund: e.grund || null }; }),
      eltern: S.eltern
    };
  }

  function endeBildschirm() {
    if (timerHandle) clearInterval(timerHandle);
    app.innerHTML = "";
    var d = ergebnisDaten();
    if (!S.fertig) {
      var v = ls(true, VERLAUF) || [];
      v = v.filter(function (x) { return x.test !== R.id; });
      v.push({ test: R.id, punkte: d.punkte, max: d.max, datum: d.abgeschlossen });
      ls(false, VERLAUF, v); S.fertig = true; sichern();
    }
    var verlauf = (ls(true, VERLAUF) || []).filter(function (x) { return x.test !== R.id; });
    var letztes = verlauf.length ? verlauf[verlauf.length - 1].punkte : (R.vorher ? R.vorher.letztes : null);
    var bestes = verlauf.reduce(function (m, x) { return Math.max(m, x.punkte); }, R.vorher && R.vorher.rekord != null ? R.vorher.rekord : -1);
    var rek;
    if (letztes == null) rek = "Deine erste Runde: <b>" + d.punkte + " Punkte</b>. Das ist ab jetzt deine Rekordlinie!";
    else rek = "Letztes Mal " + letztes + ", heute " + d.punkte + (d.punkte > bestes ? ". <b>Neuer Rekord! 🏆</b>"
      : d.punkte > letztes ? ". <b>Besser als letztes Mal! 📈</b> Dein Rekord: " + bestes + "."
      : d.punkte === letztes ? ". <b>Gehalten! 💪</b> Dein Rekord: " + bestes + "."
      : ". Dein Rekord bleibt " + bestes + ". Nächstes Mal holst du dir die Punkte zurück.");
    var fehlend = R.aufgaben.filter(function (a) { var e = S.erg[a.id]; return e && e.punkte < a.punkte; });

    var karte = el("div", { class: "karte" }, [
      el("h1", { text: "Geschafft! 🎉" }),
      el("div", { class: "ergebnis-zahl", text: d.punkte + " / " + d.max }),
      el("div", { class: "rekord", html: rek }),
      el("p", { html: "Joker übrig: <b>" + d.jokerUebrig + "</b> → +" + d.bonusTopf + " Bonus. Für den Familientopf: <b>" + d.topfGesamt + " Punkte</b>." }),
      d.dauerSek ? el("p", { class: "klein", text: "Gebraucht: " + mmss(d.dauerSek) + " Minuten." }) : null,
      fehlend.length ? el("div", {}, [el("h2", { text: "Wo Punkte fehlen" }),
        el("ul", { class: "liste-fehler", html: fehlend.map(function (a) { var e = S.erg[a.id];
          return "<li><b>" + (a.kurz || a.frage) + "</b> (" + e.punkte + "/" + a.punkte + "): " + (e.grund || (a.gefragt ? "Gefragt war: " + a.gefragt : "Hier war eine andere Antwort gemeint.")) + "</li>"; }).join("") })])
        : el("p", { text: "Alle Punkte geholt. Stark! ⭐" })
    ]);
    app.appendChild(karte);

    var stimm = S.eltern.stimmung || "", hilfe = S.eltern.hilfe || "";
    var notiz = el("textarea", { placeholder: "Was ist Ihnen aufgefallen? (freiwillig, ein bis zwei Sätze)", style: "min-height:90px" });
    notiz.value = S.eltern.notiz || "";
    function knopfReihe(werte, aktuell, setzen) {
      var z = el("div", { class: "zeile" });
      werte.forEach(function (w) { z.appendChild(el("button", { text: w, class: w === aktuell ? "an" : "", onclick: function () {
        z.querySelectorAll("button").forEach(function (b) { b.classList.toggle("an", b.textContent === w); }); setzen(w); } })); });
      return z;
    }
    var eltern = el("div", { class: "karte" }, [
      el("h2", { text: "Für Mama oder Papa" }),
      el("p", { class: "klein", text: "Kurz ausfüllen, dann speichern und die Datei in den Ordner „rein“ legen." }),
      el("p", { text: "Stimmung" }), knopfReihe(["🙂", "😐", "🙁"], stimm, function (w) { S.eltern.stimmung = w; sichern(); }),
      el("p", { text: "Hilfe gebraucht?" }), knopfReihe(["keine", "ein wenig", "viel"], hilfe, function (w) { S.eltern.hilfe = w; sichern(); }),
      el("p", { text: "Notiz" }), notiz,
      el("button", { class: "btn gross", text: "💾 Ergebnis speichern", onclick: function () { S.eltern.notiz = notiz.value; sichern(); herunterladen(); } }),
      el("button", { class: "btn zweit", text: "📋 Ergebnis als Text kopieren", onclick: function () { S.eltern.notiz = notiz.value; sichern(); kopieren(); } }),
      R.mailAn ? el("button", { class: "btn zweit", text: "✉️ Per Mail schicken", onclick: function () { S.eltern.notiz = notiz.value; sichern(); mailen(); } }) : null,
      el("p", { id: "speicherInfo", class: "klein" }),
      el("pre", { id: "jsonBox", class: "json versteckt" })
    ]);
    notiz.addEventListener("input", function () { S.eltern.notiz = notiz.value; sichern(); });
    app.appendChild(eltern);
  }

  function dateiname() { return R.datum + "_" + R.kind + "_" + R.id + "_ergebnis.json"; }
  function herunterladen() {
    var text = JSON.stringify(ergebnisDaten(), null, 2);
    try {
      var blob = new Blob([text], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = dateiname();
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      $("#speicherInfo").textContent = "Gespeichert als „" + dateiname() + "“ (Ordner Downloads). Bitte in „rein“ verschieben. Klappt das nicht: Bildschirmfoto von dieser Seite reicht auch.";
    } catch (e) { $("#speicherInfo").textContent = "Speichern ging nicht. Bitte „Als Text kopieren“ nutzen oder ein Bildschirmfoto machen."; }
    var jb = $("#jsonBox"); jb.textContent = text; jb.classList.remove("versteckt");
  }
  function kopieren() {
    var text = JSON.stringify(ergebnisDaten());
    var ok = function () { $("#speicherInfo").textContent = "Kopiert. Jetzt in eine Notiz oder Nachricht einfügen und in „rein“ ablegen."; };
    var jb = $("#jsonBox"); jb.textContent = text; jb.classList.remove("versteckt");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { $("#speicherInfo").textContent = "Bitte den Text unten markieren und kopieren."; });
    else $("#speicherInfo").textContent = "Bitte den Text unten markieren und kopieren.";
  }
  function mailen() {
    var text = JSON.stringify(ergebnisDaten());
    location.href = "mailto:" + R.mailAn + "?subject=" + encodeURIComponent("Lernhaus Ergebnis " + R.kind + " " + R.id) + "&body=" + encodeURIComponent(text);
  }

  function zeigen() {
    window.scrollTo(0, 0);
    if (S.phase === "start") startBildschirm();
    else if (S.phase === "aufgabe") aufgabeBildschirm();
    else endeBildschirm();
  }
  window.LERNHAUS_TEST = { stand: function () { return S; }, daten: ergebnisDaten };
  zeigen();
})();
