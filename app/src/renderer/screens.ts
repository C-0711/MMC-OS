/**
 * screens.ts — Flächen der OS-Sprache (Etappe 4, Arbeit B4–B7)
 * Vanilla-TS-DOM wie beweis.ts: KEIN Node-API-Zugriff, reine DOM-Manipulation.
 * Alle Maße sind in den .dc.html-Artboards nachgemessen — nicht raten.
 */

// ============================================================================
// OsVereinbarung.dc.html — signierte Fassung zwischen zwei Seiten
// ============================================================================

export interface VereinbarungPosition {
  feld: string;
  wert: string;
  fundstelle: string; // "aus Kostenvoranschlag.pdf · S. 1" | "aus dem Anruf · Minute 02:41"
}

export interface VereinbarungPartei {
  name: string;
  signiert: boolean;
  hinweis: string; // "signiert · heute 13:52" | "deine Signatur fehlt noch"
}

export interface VereinbarungOptions {
  fallId: string;
  fassung: number;
  commitSha: string;
  positionen: VereinbarungPosition[];
  parteien: VereinbarungPartei[];
  onSignieren: () => void;
  onAendern: () => void;
}

/** Maße nachgemessen in OsVereinbarung.dc.html. */
export function renderVereinbarung(opts: VereinbarungOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'vereinbarung-container';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 26px;
  `;

  // Titel: Serif 30
  const titel = document.createElement('div');
  titel.className = 'serif';
  titel.style.fontSize = '30px';
  titel.textContent = 'Seid ihr euch einig?';
  container.appendChild(titel);

  const sub = document.createElement('div');
  sub.className = 't13 sub';
  sub.style.marginTop = '-14px';
  sub.textContent = 'Aus dem Verlauf zusammengeführt — jede Zeile zeigt auf ihre Stelle.';
  container.appendChild(sub);

  // Die Fassung: 600px, weiß, Radius 8, Schatten wie Artboard, padding 32px 40px, gap 13
  const karte = document.createElement('div');
  karte.style.cssText = `
    width: 600px;
    max-width: 100%;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 18px 50px -18px rgba(70,58,38,.4);
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    gap: 13px;
    box-sizing: border-box;
  `;

  const kopf = document.createElement('div');
  kopf.style.cssText = 'font-size: 12px; font-weight: 600; color: rgba(42,37,32,.65); letter-spacing: .02em;';
  kopf.textContent = `VEREINBARUNG · ${opts.fallId.toUpperCase()} · FASSUNG ${opts.fassung}`;
  karte.appendChild(kopf);

  const abstand = document.createElement('div');
  abstand.style.height = '4px';
  karte.appendChild(abstand);

  // Positionen: t13 mit fettem Wert rechts + t11-sub-Fundstelle (margin-top -8)
  for (const pos of opts.positionen) {
    const zeile = document.createElement('div');
    zeile.className = 't13';
    zeile.style.cssText = 'display: flex; justify-content: space-between;';
    const feld = document.createElement('span');
    feld.textContent = pos.feld;
    const wert = document.createElement('span');
    wert.style.fontWeight = '600';
    wert.textContent = pos.wert;
    zeile.appendChild(feld);
    zeile.appendChild(wert);
    karte.appendChild(zeile);

    const quelle = document.createElement('div');
    quelle.className = 't11 sub';
    quelle.style.marginTop = '-8px';
    quelle.textContent = pos.fundstelle;
    karte.appendChild(quelle);
  }

  // Trennlinie
  const linie = document.createElement('div');
  linie.style.cssText = 'height: 1px; background: rgba(42,37,32,.1); margin: 4px 0;';
  karte.appendChild(linie);

  // Parteien: Häkchen (signiert) oder leerer Olivgold-Kreis (offen) — beide Siegel
  for (const partei of opts.parteien) {
    const zeile = document.createElement('div');
    zeile.className = 't13';
    zeile.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    if (partei.signiert) {
      zeile.appendChild(haken(14));
    } else {
      const kreis = document.createElement('span');
      kreis.style.cssText =
        'width: 14px; height: 14px; border: 1.5px solid rgba(184,163,105,.6); border-radius: 999px; flex: none; box-sizing: border-box;';
      zeile.appendChild(kreis);
    }

    const name = document.createElement('span');
    name.style.flex = '1';
    if (!partei.signiert) name.style.fontWeight = '500';
    name.textContent = partei.name;
    zeile.appendChild(name);

    const hinweis = document.createElement('span');
    hinweis.className = 't11';
    if (partei.signiert) {
      hinweis.classList.add('sub');
    } else {
      hinweis.style.color = '#96824c';
    }
    hinweis.textContent = partei.hinweis;
    zeile.appendChild(hinweis);

    karte.appendChild(zeile);
  }

  container.appendChild(karte);

  // Quellzeile (Mono 11px): Fall · Fassung · Commit · Anker
  const quellzeile = document.createElement('div');
  quellzeile.className = 'quelle';
  quellzeile.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;';
  quellzeile.textContent =
    `Fall ${opts.fallId} · Fassung ${opts.fassung} · Commit ${opts.commitSha} · Anker danach: Zeitstempel Bundesdruckerei`;
  container.appendChild(quellzeile);

  // Buttons: Mit Face ID signieren (Salbei) / Fassung ändern (still)
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display: flex; gap: 10px;';

  const btnSignieren = document.createElement('button');
  btnSignieren.className = 'pill-salbei';
  btnSignieren.textContent = 'Mit Face ID signieren';
  btnSignieren.onclick = opts.onSignieren;
  buttons.appendChild(btnSignieren);

  const btnAendern = document.createElement('button');
  btnAendern.className = 'pill-still';
  btnAendern.textContent = 'Fassung ändern';
  btnAendern.onclick = opts.onAendern;
  buttons.appendChild(btnAendern);

  container.appendChild(buttons);

  const fussnote = document.createElement('div');
  fussnote.className = 't11 sub';
  fussnote.style.marginTop = '-14px';
  fussnote.textContent = 'Danach ist der Stand unterschrieben — ein Zeitpunkt, den ein Gericht anerkennt.';
  container.appendChild(fussnote);

  return container;
}

// ============================================================================
// OsTisch.dc.html — Nebeneinander: zwei Originale, die Gegenprobe dazwischen
// Vollfenster-Szene (Artboard 1180×780) → wird ins Overlay gerendert.
// Inhalt ist v0.1-Statik im Artboard-Duktus (kein Tisch-Backend).
// ============================================================================

export function renderTisch(onZurueck: () => void): HTMLElement {
  const flaeche = document.createElement('div');
  flaeche.className = 'tisch-flaeche';
  flaeche.style.cssText = `
    position: absolute;
    inset: 0;
    background: #FAF7F2;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 4px 40px 0;
    gap: 14px;
    overflow: hidden;
  `;

  // Kopfzeile 52px: Titel links, Zurück rechts
  const kopf = document.createElement('div');
  kopf.style.cssText = 'flex: none; height: 52px; display: flex; align-items: center; gap: 12px;';
  const kopfTitel = document.createElement('span');
  kopfTitel.className = 't13';
  kopfTitel.style.marginLeft = '8px';
  kopfTitel.textContent = 'Nebeneinander · Unfall Passat';
  kopf.appendChild(kopfTitel);
  const spacer = document.createElement('span');
  spacer.style.flex = '1';
  kopf.appendChild(spacer);
  const btnZu = document.createElement('button');
  btnZu.className = 'pill-still';
  btnZu.textContent = 'Zurück';
  btnZu.onclick = onZurueck;
  kopf.appendChild(btnZu);
  flaeche.appendChild(kopf);

  // Bühne: zwei Blätter 356×470 + Gegenprobe-Pille absolut mittig
  const buehne = document.createElement('div');
  buehne.style.cssText =
    'flex: 1; display: flex; align-items: center; justify-content: center; gap: 44px; position: relative; min-height: 0;';

  buehne.appendChild(
    tischBlatt('KOSTENVORANSCHLAG', 'Werkstatt Weber · 28.08.2026 · Seite 1', [
      { text: 'Stoßstange hinten erneuern, Halterungen, Kleinteile — Arbeitszeit 6,5 Std.' },
      { text: 'Gesamtbetrag inkl. Lackierung: ', fett: '2.480,00 €', markiert: true },
      { text: 'Termin nach Freigabe, voraussichtlich KW 10.' }
    ])
  );

  // Die Gegenprobe: der Faden zwischen den Stellen
  const probe = document.createElement('div');
  probe.style.cssText =
    'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 6px; z-index: 3;';
  const fadenOben = document.createElement('div');
  fadenOben.style.cssText = 'width: 88px; height: 1.5px; background: #8FA98F;';
  probe.appendChild(fadenOben);
  const pille = document.createElement('div');
  pille.style.cssText = `
    background: #FAF7F2; border: 1px solid rgba(143,169,143,.5); border-radius: 999px;
    padding: 6px 14px; display: flex; align-items: center; gap: 7px;
    box-shadow: 0 6px 18px -8px rgba(90,75,50,.3);
  `;
  const probeHaken = haken(13);
  probeHaken.setAttribute('stroke-width', '2.6');
  pille.appendChild(probeHaken);
  const probeText = document.createElement('span');
  probeText.className = 't11';
  probeText.style.cssText = 'color: #5c705c; font-weight: 600;';
  probeText.textContent = 'derselbe Betrag — Gegenprobe stimmt';
  pille.appendChild(probeText);
  probe.appendChild(pille);
  const fadenUnten = document.createElement('div');
  fadenUnten.style.cssText = 'width: 88px; height: 1.5px; background: #8FA98F;';
  probe.appendChild(fadenUnten);
  buehne.appendChild(probe);

  buehne.appendChild(
    tischBlatt('FREIGABE', 'AllianzHilfe · 29.08.2026 · Seite 1', [
      { text: 'Zum Schaden HV-88231-K teilen wir mit: die Reparatur wird übernommen.' },
      { text: 'Freigegeben bis ', fett: '2.480,00 €', nachFett: ', abzüglich Selbstbeteiligung 150,00 €.', markiert: true },
      { text: 'Bitte reichen Sie die Rechnung nach Abschluss ein.' }
    ])
  );

  flaeche.appendChild(buehne);

  // Der Rest des Falls, zum Danebenlegen: Thumbnails 44×58
  const reihe = document.createElement('div');
  reihe.style.cssText =
    'flex: none; display: flex; align-items: center; justify-content: center; gap: 10px; padding-bottom: 16px;';
  const thumbs: Array<{ aktiv: boolean; blau?: boolean }> = [
    { aktiv: true }, { aktiv: true }, { aktiv: false }, { aktiv: false, blau: true }, { aktiv: false }
  ];
  for (const t of thumbs) {
    const thumb = document.createElement('div');
    thumb.style.cssText = `
      width: 44px; height: 58px; border-radius: 3px;
      background: ${t.blau ? 'linear-gradient(160deg,#c9d6e4,#9fb3c8)' : '#fff'};
      box-shadow: 0 2px 8px rgba(70,58,38,.2);
      ${t.aktiv ? 'outline: 2px solid #B8A369; outline-offset: 2px;' : 'opacity: .6;'}
    `;
    reihe.appendChild(thumb);
  }
  const reiheText = document.createElement('span');
  reiheText.className = 't11 sub';
  reiheText.style.marginLeft = '8px';
  reiheText.textContent = '5 Originale im Fall — zieh eines auf den Tisch';
  reihe.appendChild(reiheText);
  flaeche.appendChild(reihe);

  // Quellzeile
  const quellRow = document.createElement('div');
  quellRow.style.cssText = 'flex: none; display: flex; justify-content: center; padding-bottom: 18px;';
  const quelle = document.createElement('div');
  quelle.className = 'quelle';
  quelle.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';
  const q1 = document.createElement('span');
  q1.textContent = 'Kostenvoranschlag.pdf · S. 1';
  const p1 = document.createElement('span');
  p1.textContent = '·';
  const q2 = document.createElement('span');
  q2.textContent = 'Freigabe.pdf · S. 1';
  const p2 = document.createElement('span');
  p2.textContent = '·';
  const q3 = document.createElement('span');
  q3.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; color: #5c705c;';
  q3.appendChild(document.createTextNode('beide unverändert seit Aufnahme '));
  const q3Haken = haken(12);
  q3Haken.setAttribute('stroke-width', '2.6');
  q3.appendChild(q3Haken);
  quelle.appendChild(q1); quelle.appendChild(p1);
  quelle.appendChild(q2); quelle.appendChild(p2);
  quelle.appendChild(q3);
  quellRow.appendChild(quelle);
  flaeche.appendChild(quellRow);

  return flaeche;
}

interface TischZeile {
  text: string;
  fett?: string;
  nachFett?: string;
  markiert?: boolean;
}

/** Blatt 356×470, radius 4, padding 34px 36px — Maße aus OsTisch.dc.html */
function tischBlatt(kopf: string, sub: string, zeilen: TischZeile[]): HTMLElement {
  const blatt = document.createElement('div');
  blatt.style.cssText = `
    width: 356px; height: 470px; background: #fff; border-radius: 4px;
    box-shadow: 0 18px 50px -18px rgba(70,58,38,.5);
    padding: 34px 36px; display: flex; flex-direction: column; gap: 10px;
    box-sizing: border-box;
  `;

  const kopfEl = document.createElement('div');
  kopfEl.style.cssText = 'font-size: 11px; font-weight: 600; color: rgba(42,37,32,.65); letter-spacing: .02em;';
  kopfEl.textContent = kopf;
  blatt.appendChild(kopfEl);

  const subEl = document.createElement('div');
  subEl.className = 't11 sub';
  subEl.textContent = sub;
  blatt.appendChild(subEl);

  const abstand = document.createElement('div');
  abstand.style.height = '10px';
  blatt.appendChild(abstand);

  for (const z of zeilen) {
    const inhalt = document.createElement('div');
    inhalt.className = 't11';
    inhalt.style.cssText = `line-height: 1.7; color: rgba(42,37,32,${z.markiert ? '.85' : '.75'});`;
    inhalt.appendChild(document.createTextNode(z.text));
    if (z.fett) {
      const b = document.createElement('b');
      b.textContent = z.fett;
      inhalt.appendChild(b);
    }
    if (z.nachFett) inhalt.appendChild(document.createTextNode(z.nachFett));

    if (z.markiert) {
      // Lese-Folie: Salbei 13 % + 1.5px-Rand (wie Artboard)
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position: relative; margin: 0 -8px; padding: 6px 8px;';
      const folie = document.createElement('span');
      folie.style.cssText =
        'position: absolute; inset: 0; border-radius: 5px; background: rgba(143,169,143,.13); border: 1.5px solid rgba(143,169,143,.55);';
      wrap.appendChild(folie);
      inhalt.style.position = 'relative';
      wrap.appendChild(inhalt);
      blatt.appendChild(wrap);
    } else {
      blatt.appendChild(inhalt);
    }
  }

  return blatt;
}

// ============================================================================
// OsGruppe.dc.html — vier Klone, ein Baum (Mobil-Blatt 390px)
// v0.1-Statik im Artboard-Duktus (kein Gruppen-Backend).
// ============================================================================

export function renderGruppe(): HTMLElement {
  const spalte = document.createElement('div');
  spalte.className = 'gruppe-spalte';
  spalte.style.cssText = `
    width: 390px;
    max-width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `;

  // Titelzeile mit Avatar-Stapel (32px, überlappend −7px, 2px Grund-Rand)
  const kopf = document.createElement('div');
  kopf.style.cssText = 'display: flex; align-items: center; gap: 12px;';
  const kopfText = document.createElement('div');
  kopfText.style.cssText = 'flex: 1; min-width: 0;';
  const titel = document.createElement('div');
  titel.className = 'serif';
  titel.style.fontSize = '28px';
  titel.textContent = 'Hüttenwochenende';
  kopfText.appendChild(titel);
  const untertitel = document.createElement('div');
  untertitel.className = 't13 sub';
  untertitel.style.marginTop = '2px';
  untertitel.textContent = 'vier Klone, ein Baum';
  kopfText.appendChild(untertitel);
  kopf.appendChild(kopfText);

  const avatare = document.createElement('div');
  avatare.style.display = 'flex';
  const koepfe: Array<[string, string]> = [
    ['An', '#D9A6A0'], ['Ma', '#8FA98F'], ['Li', '#B8A369'], ['Du', '#2a2520']
  ];
  for (const [kuerzel, farbe] of koepfe) {
    const av = document.createElement('span');
    av.className = 'serif';
    av.style.cssText = `
      width: 32px; height: 32px; border-radius: 999px; font-size: 11px;
      background: ${farbe}; color: #fff; margin-left: -7px; border: 2px solid #FAF7F2;
      display: flex; align-items: center; justify-content: center; flex: none;
      box-sizing: content-box;
    `;
    av.textContent = kuerzel;
    avatare.appendChild(av);
  }
  kopf.appendChild(avatare);
  spalte.appendChild(kopf);

  // Frage-Karte: Serif 21 + Passt/Kann nicht (48px hoch)
  const karte = document.createElement('div');
  karte.className = 'karte';
  karte.style.cssText = 'padding: 22px; display: flex; flex-direction: column; gap: 16px;';
  const frageWrap = document.createElement('div');
  frageWrap.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
  const frage = document.createElement('div');
  frage.className = 'serif';
  frage.style.fontSize = '21px';
  frage.textContent = '6.–8. März: Anna ✓ Max ✓ Lisa ✓ — du fehlst noch.';
  frageWrap.appendChild(frage);
  const folge = document.createElement('div');
  folge.className = 't13 sub';
  folge.textContent = 'danach bucht Max die Hütte';
  frageWrap.appendChild(folge);
  karte.appendChild(frageWrap);

  const btns = document.createElement('div');
  btns.style.cssText = 'display: flex; gap: 8px;';
  const btnPasst = document.createElement('button');
  btnPasst.className = 'pill-salbei';
  btnPasst.style.cssText = 'flex: 1; height: 48px;';
  btnPasst.textContent = 'Passt';
  btns.appendChild(btnPasst);
  const btnNicht = document.createElement('button');
  btnNicht.className = 'pill-still';
  btnNicht.style.height = '48px';
  btnNicht.textContent = 'Kann nicht';
  btns.appendChild(btnNicht);
  karte.appendChild(btns);
  spalte.appendChild(karte);

  // Still im Baum
  const stillWrap = document.createElement('div');
  stillWrap.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
  const label = document.createElement('div');
  label.className = 't11';
  label.style.cssText =
    'font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(42,37,32,.42);';
  label.textContent = 'Still im Baum';
  stillWrap.appendChild(label);

  const eintraege: Array<[string, string]> = [
    [
      'Hütten-Angebot gelesen: 240,00 € · 6 Betten · Sauna',
      'aus dem Link, den Lisa geteilt hat — Seite gelesen, nicht nur verlinkt'
    ],
    [
      'Anzahlung: Max hat 240,00 € ausgelegt — 60,00 € je',
      'steht im Baum, vergisst keiner — Beleg: seine Überweisung'
    ]
  ];
  for (const [haupt, sub] of eintraege) {
    const eintrag = document.createElement('div');
    eintrag.className = 'karte';
    eintrag.style.cssText =
      'padding: 14px 16px; display: flex; align-items: center; gap: 12px; box-shadow: none; background: rgba(255,255,255,.65);';
    eintrag.appendChild(haken(15));
    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'flex: 1; min-width: 0;';
    const hauptEl = document.createElement('div');
    hauptEl.className = 't13';
    hauptEl.textContent = haupt;
    textWrap.appendChild(hauptEl);
    const subEl = document.createElement('div');
    subEl.className = 't11 sub';
    subEl.style.marginTop = '1px';
    subEl.textContent = sub;
    textWrap.appendChild(subEl);
    eintrag.appendChild(textWrap);
    stillWrap.appendChild(eintrag);
  }
  spalte.appendChild(stillWrap);

  const fussnote = document.createElement('div');
  fussnote.className = 't11 sub';
  fussnote.style.textAlign = 'center';
  fussnote.textContent = 'Jeder fragt seine eigene KI — alle vier bekommen dieselbe Antwort.';
  spalte.appendChild(fussnote);

  return spalte;
}

// ============================================================================
// OsEinladen — Capability-Ausstellung als Flow (Scope, Dauer), kein Konto
// Maße aus OsEinladen.dc.html: Titel Serif 34, Karte 620px padding 24px 28px
// gap 18, Person-Zeile 1.5px #8FA98F radius 12, Scope-Kacheln, Sicht-Box.
// v0.1: Inhalt statisch aus dem Artboard (kein Teilen-Backend) — nur die
// Scope-Wahl ist klickbar, Einladen/Abbrechen gehen an die Callbacks.
// ============================================================================

export function renderEinladen(opts: {
  onEinladen: () => void;
  onAbbrechen: () => void;
}): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display: flex; flex-direction: column; align-items: center; gap: 28px;';

  // Titel + Untertitel
  const kopfWrap = document.createElement('div');
  kopfWrap.style.cssText =
    'display: flex; flex-direction: column; align-items: center; gap: 8px;';
  const titel = document.createElement('div');
  titel.className = 'serif';
  titel.style.fontSize = '34px';
  titel.textContent = 'Wen holst du dazu?';
  kopfWrap.appendChild(titel);
  const sub = document.createElement('div');
  sub.className = 't13 sub';
  sub.textContent =
    'Unfall Passat · du bleibst der Eigentümer — geteilt wird eine Erlaubnis, nie der Besitz';
  kopfWrap.appendChild(sub);
  wrap.appendChild(kopfWrap);

  // Karte 620px
  const karte = document.createElement('div');
  karte.className = 'karte';
  karte.style.cssText =
    'width: 620px; max-width: 100%; box-sizing: border-box; padding: 24px 28px; display: flex; flex-direction: column; gap: 18px;';

  // Person-Zeile
  const person = document.createElement('div');
  person.style.cssText =
    'display: flex; align-items: center; gap: 12px; background: rgba(143,169,143,.1); border: 1.5px solid #8FA98F; border-radius: 12px; padding: 12px 16px;';
  const siegel = document.createElement('div');
  siegel.className = 'siegel serif';
  siegel.style.cssText =
    'width: 38px; height: 38px; font-size: 12px; background: radial-gradient(circle at 34% 30%, #a3bba3, #8FA98F 58%, #6f8a6f);';
  siegel.textContent = 'LW';
  person.appendChild(siegel);
  const personText = document.createElement('div');
  personText.style.cssText = 'flex: 1; min-width: 0;';
  const personName = document.createElement('div');
  personName.className = 't13';
  personName.style.fontWeight = '600';
  personName.textContent = 'Lena Weber';
  personText.appendChild(personName);
  const personSub = document.createElement('div');
  personSub.className = 't11 sub';
  personSub.style.marginTop = '1px';
  personSub.textContent =
    'aus eurem Baum · hat gitchain — bekommt den Fall Klon zu Klon';
  personText.appendChild(personSub);
  person.appendChild(personText);
  person.appendChild(haken(17));
  karte.appendChild(person);

  // Scope-Wahl: zwei Kacheln, klickbar (v0.1: reine Auswahl-Optik)
  const scopeRow = document.createElement('div');
  scopeRow.style.cssText = 'display: flex; gap: 10px;';
  const scopeAktivStil =
    'flex: 1; border: 1.5px solid #8FA98F; border-radius: 12px; padding: 13px 16px; background: rgba(143,169,143,.06); cursor: pointer;';
  const scopeStillStil =
    'flex: 1; border: 1px solid rgba(184,163,105,.25); border-radius: 12px; padding: 13px 16px; cursor: pointer;';
  const scopeDaten: Array<[string, string]> = [
    ['Mitsehen und vorschlagen', 'Sie liest und macht Vorschläge — festhalten kannst nur du.'],
    ['Mitführen', 'Sie legt selbst ab und hält fest — wie du.']
  ];
  const scopeKacheln: Array<{ box: HTMLElement; titelEl: HTMLElement }> = [];
  scopeDaten.forEach(([kachelTitel, kachelSub], i) => {
    const box = document.createElement('div');
    box.style.cssText = i === 0 ? scopeAktivStil : scopeStillStil;
    const t = document.createElement('div');
    t.className = 't13';
    t.style.fontWeight = '600';
    t.style.color = i === 0 ? '#5c705c' : 'rgba(42,37,32,.55)';
    t.textContent = kachelTitel;
    box.appendChild(t);
    const s = document.createElement('div');
    s.className = 't11 sub';
    s.style.cssText = 'margin-top: 3px; line-height: 1.45;';
    s.textContent = kachelSub;
    box.appendChild(s);
    box.onclick = () => {
      scopeKacheln.forEach((k, j) => {
        const aktiv = k.box === box;
        k.box.style.cssText = aktiv ? scopeAktivStil : scopeStillStil;
        k.titelEl.style.color = aktiv ? '#5c705c' : 'rgba(42,37,32,.55)';
        void j;
      });
    };
    scopeKacheln.push({ box, titelEl: t });
    scopeRow.appendChild(box);
  });
  karte.appendChild(scopeRow);

  // „Was sie sieht" — die Kapsel endet am Fall
  const sichtBox = document.createElement('div');
  sichtBox.style.cssText =
    'display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,.025); border-radius: 12px; padding: 14px 16px;';
  const sichtLabel = document.createElement('div');
  sichtLabel.className = 't11';
  sichtLabel.style.cssText =
    'font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(42,37,32,.42);';
  sichtLabel.textContent = 'Was sie sieht';
  sichtBox.appendChild(sichtLabel);

  const sichtJa = document.createElement('div');
  sichtJa.className = 't13';
  sichtJa.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  sichtJa.appendChild(haken(13));
  sichtJa.appendChild(
    document.createTextNode('Diesen Fall: 5 Unterlagen, der Verlauf, die Eckdaten')
  );
  sichtBox.appendChild(sichtJa);

  const sichtNein = document.createElement('div');
  sichtNein.className = 't13';
  sichtNein.style.cssText =
    'display: flex; align-items: center; gap: 8px; color: rgba(42,37,32,.6);';
  sichtNein.appendChild(kreuz(13));
  sichtNein.appendChild(
    document.createTextNode(
      'Sonst nichts — die Kapsel endet am Fall. Keine anderen Fälle, kein Tresor.'
    )
  );
  sichtBox.appendChild(sichtNein);
  karte.appendChild(sichtBox);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 10px;';
  const btnEinladen = document.createElement('button');
  btnEinladen.className = 'pill-salbei';
  btnEinladen.style.flex = '1';
  btnEinladen.textContent = 'Einladen';
  btnEinladen.onclick = opts.onEinladen;
  btnRow.appendChild(btnEinladen);
  const btnAbbrechen = document.createElement('button');
  btnAbbrechen.className = 'pill-still';
  btnAbbrechen.textContent = 'Abbrechen';
  btnAbbrechen.onclick = opts.onAbbrechen;
  btnRow.appendChild(btnAbbrechen);
  karte.appendChild(btnRow);

  // Fußnote in der Karte
  const fussnote = document.createElement('div');
  fussnote.className = 't11 sub';
  fussnote.style.lineHeight = '1.55';
  fussnote.textContent =
    'Zurückziehen geht jederzeit — ein Wort, und ihre Erlaubnis endet. Was sie bis dahin gesehen hat, hat sie gesehen; so ehrlich muss man sein.';
  karte.appendChild(fussnote);

  wrap.appendChild(karte);

  // Hinweis unter der Karte
  const hinweis = document.createElement('div');
  hinweis.className = 't11 sub';
  hinweis.textContent =
    'Ohne gitchain? Dann bekommt sie einen Beitritts-Weg — ein Bildschirm, kein Konto, dreißig Sekunden.';
  wrap.appendChild(hinweis);

  return wrap;
}

// ============================================================================
// OsRueckruf — Rückruf einer Erlaubnis (communication-v0.1.md §2)
// Maße aus OsRueckruf.dc.html: Mobil-Blatt 390px, Titel Serif 28 lh 1.3,
// Karte padding 24px 22px gap 18, Rosé-Pille 48px „Ja, entziehen".
// v0.1: Inhalt statisch aus dem Artboard (kein Capability-Backend).
// ============================================================================

export function renderRueckruf(opts: {
  onEntziehen: () => void;
  onBehalten: () => void;
}): HTMLElement {
  const spalte = document.createElement('div');
  spalte.style.cssText =
    'width: 390px; max-width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; padding: 0 20px; box-sizing: border-box;';

  const titel = document.createElement('div');
  titel.className = 'serif';
  titel.style.cssText = 'font-size: 28px; line-height: 1.3;';
  titel.innerHTML = 'AllianzHilfe<br>den Zugriff entziehen?';
  spalte.appendChild(titel);

  const sub = document.createElement('div');
  sub.className = 't13 sub';
  sub.style.marginTop = '-10px';
  sub.textContent = 'Unfall Passat · die Reparatur ist abgeschlossen';
  spalte.appendChild(sub);

  const karte = document.createElement('div');
  karte.className = 'karte';
  karte.style.cssText =
    'padding: 24px 22px; display: flex; flex-direction: column; gap: 18px;';

  // Drei Folgen-Zeilen
  const zeilenWrap = document.createElement('div');
  zeilenWrap.style.cssText = 'display: flex; flex-direction: column; gap: 11px;';
  const folgen: Array<[SVGSVGElement, string, boolean]> = [
    [haken(13), 'Ihre Erlaubnis endet sofort — der nächste Abruf läuft ins Leere', false],
    [haken(13), 'Der Rückruf steht im Fall — Lena sieht ihn auch', false],
    [
      infoKreis(13),
      'Was sie bis heute gesehen hat, hat sie gesehen — das nimmt kein System zurück',
      true
    ]
  ];
  for (const [icon, text, gedimmt] of folgen) {
    const zeile = document.createElement('div');
    zeile.className = 't13';
    zeile.style.cssText =
      'display: flex; align-items: flex-start; gap: 8px;' +
      (gedimmt ? ' color: rgba(42,37,32,.6);' : '');
    icon.style.marginTop = '2px';
    zeile.appendChild(icon);
    const span = document.createElement('span');
    span.style.lineHeight = '1.5';
    span.textContent = text;
    zeile.appendChild(span);
    zeilenWrap.appendChild(zeile);
  }
  karte.appendChild(zeilenWrap);

  // Buttons: Rosé-Pille „Ja, entziehen" + pill-still „Behalten"
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 8px;';
  const btnEntziehen = document.createElement('button');
  btnEntziehen.textContent = 'Ja, entziehen';
  btnEntziehen.style.cssText =
    'flex: 1; display: flex; align-items: center; justify-content: center; height: 48px; border-radius: 999px; background: #D9A6A0; color: #fff; font-size: 15px; font-weight: 600; box-shadow: 0 8px 22px -10px rgba(190,130,120,.7); border: none; cursor: pointer; font-family: inherit;';
  btnEntziehen.onclick = opts.onEntziehen;
  btnRow.appendChild(btnEntziehen);
  const btnBehalten = document.createElement('button');
  btnBehalten.className = 'pill-still';
  btnBehalten.style.height = '48px';
  btnBehalten.textContent = 'Behalten';
  btnBehalten.onclick = opts.onBehalten;
  btnRow.appendChild(btnBehalten);
  karte.appendChild(btnRow);

  // Sprach-Hinweis mit Olivgold-Schild
  const sprachHinweis = document.createElement('div');
  sprachHinweis.className = 't11 sub';
  sprachHinweis.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  sprachHinweis.appendChild(schild(11));
  sprachHinweis.appendChild(
    document.createTextNode(
      'Du kannst es auch einfach sagen: „Zieh der Allianz den Zugriff zurück."'
    )
  );
  karte.appendChild(sprachHinweis);
  spalte.appendChild(karte);

  // Fußnote unter der Karte
  const fussnote = document.createElement('div');
  fussnote.className = 't11 sub';
  fussnote.style.cssText = 'text-align: center; line-height: 1.6;';
  fussnote.innerHTML =
    'Danach gehört der Fall wieder nur dir und Lena.<br>Wieder einladen geht jederzeit — eine neue Erlaubnis, ein neuer Eintrag.';
  spalte.appendChild(fussnote);

  return spalte;
}

// ============================================================================
// Null-Fragen-Onboarding (Etappe 4 C): ObSiegel → ObRettung → ObErfolg
// Maße aus ObSiegel.dc.html / ObRettung.dc.html / ObErfolg.dc.html.
// Vollflächen für das Overlay (#beweis-overlay). Kein Formular, keine Fragen —
// der Name ist vorbefüllt, der Abschluss ist der erste Drop (v0.1: Klick).
// ============================================================================

/** ObSiegel — Siegel 92px, Titel Serif 34, Namensfeld 520px, Rosé-Warnkarte 560px. */
export function renderObSiegel(onPraegen: () => void): HTMLElement {
  const flaeche = document.createElement('div');
  flaeche.style.cssText =
    'position: absolute; inset: 0; background: #FAF7F2; display: flex; flex-direction: column;';

  const buehne = document.createElement('div');
  buehne.style.cssText =
    'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 36px; padding: 0 80px;';

  const siegel = document.createElement('div');
  siegel.className = 'siegel serif';
  siegel.style.cssText = 'width: 92px; height: 92px; font-size: 28px;';
  siegel.textContent = 'Du';
  buehne.appendChild(siegel);

  const kopf = document.createElement('div');
  kopf.style.cssText =
    'display: flex; flex-direction: column; align-items: center; gap: 10px;';
  const titel = document.createElement('div');
  titel.className = 'serif';
  titel.style.fontSize = '34px';
  titel.textContent = 'Das ist deine Unterschrift.';
  kopf.appendChild(titel);
  const sub = document.createElement('div');
  sub.className = 't13 sub';
  sub.style.cssText = 'max-width: 52ch; text-align: center; line-height: 1.6;';
  sub.textContent =
    'Es entsteht jetzt, auf diesem Gerät, und verlässt es nie. Alles, was du ablegst oder zusagst, trägt ab heute deine Unterschrift — deshalb glaubt man dir.';
  kopf.appendChild(sub);
  buehne.appendChild(kopf);

  // Namensfeld — vorbefüllt, keine Frage (Null-Fragen-Onboarding)
  const namensfeld = document.createElement('div');
  namensfeld.style.cssText =
    'width: 520px; display: flex; align-items: center; gap: 12px; height: 52px; background: #fff; border: 1px solid rgba(184,163,105,.3); border-radius: 999px; padding: 0 22px; box-sizing: content-box;';
  const nfLabel = document.createElement('span');
  nfLabel.className = 't13 sub';
  nfLabel.style.flex = 'none';
  nfLabel.textContent = 'Andere sehen dich als';
  namensfeld.appendChild(nfLabel);
  const nfName = document.createElement('span');
  nfName.style.cssText = 'font-size: 15px; font-weight: 600; flex: 1;';
  nfName.textContent = 'Christoph';
  namensfeld.appendChild(nfName);
  const nfCursor = document.createElement('span');
  nfCursor.style.cssText = 'width: 2px; height: 18px; background: #B8A369;';
  namensfeld.appendChild(nfCursor);
  buehne.appendChild(namensfeld);

  // Rosé-Warnkarte: Recovery-Ehrlichkeit
  const warnung = document.createElement('div');
  warnung.className = 'karte';
  warnung.style.cssText =
    'width: 560px; box-sizing: border-box; padding: 16px 20px; display: flex; align-items: flex-start; gap: 14px; box-shadow: none; background: rgba(217,166,160,.10); border-color: rgba(217,166,160,.4);';
  const warnIcon = infoKreis(18);
  warnIcon.setAttribute('stroke', '#9c6a63');
  warnIcon.setAttribute('stroke-width', '1.9');
  warnIcon.style.marginTop = '2px';
  warnung.appendChild(warnIcon);
  const warnText = document.createElement('span');
  warnText.className = 't13';
  warnText.style.cssText = 'line-height: 1.55; color: #6b4540;';
  warnText.textContent =
    'Ehrlich gesagt: Verlierst du alle Geräte, kann dir niemand deine Unterschrift zurückgeben — auch wir nicht. Morgen zeige ich dir zwei Wege, es zu sichern. Fünf Minuten, versprochen.';
  warnung.appendChild(warnText);
  buehne.appendChild(warnung);

  const btn = document.createElement('button');
  btn.className = 'pill-salbei';
  btn.style.padding = '0 40px';
  btn.textContent = 'Unterschrift anlegen';
  btn.onclick = onPraegen;
  buehne.appendChild(btn);
  flaeche.appendChild(buehne);

  flaeche.appendChild(punkteZeile(2));
  return flaeche;
}

/** ObRettung — Mobil-Blatt 390px: zwei Wege, das Siegel zu sichern. */
export function renderObRettung(opts: {
  onJetzt: () => void;
  onSpaeter: () => void;
}): HTMLElement {
  const flaeche = document.createElement('div');
  flaeche.style.cssText =
    'position: absolute; inset: 0; background: #FAF7F2; display: flex; align-items: center; justify-content: center;';

  const spalte = document.createElement('div');
  spalte.style.cssText =
    'width: 390px; max-width: 100%; display: flex; flex-direction: column; gap: 24px; padding: 0 20px; box-sizing: border-box;';

  const titel = document.createElement('div');
  titel.className = 'serif';
  titel.style.cssText = 'font-size: 28px; line-height: 1.3;';
  titel.innerHTML = 'Guten Morgen.<br>Wie versprochen: deine Unterschrift sichern.';
  spalte.appendChild(titel);

  const karte = document.createElement('div');
  karte.className = 'karte';
  karte.style.cssText =
    'padding: 24px 22px; display: flex; flex-direction: column; gap: 18px;';

  const intro = document.createElement('div');
  intro.className = 't13';
  intro.style.lineHeight = '1.55';
  intro.textContent =
    'Im Moment trägt nur dieses Gerät deine Unterschrift. Zwei Wege, das zu ändern — such dir einen aus, fünf Minuten:';
  karte.appendChild(intro);

  const wege = document.createElement('div');
  wege.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
  const wegDaten: Array<[string, string, string]> = [
    [
      'M8 21h8M12 17v4',
      'Dein Mac wird zweiter Träger',
      'Geht eines der Geräte verloren, trägt das andere weiter.'
    ],
    [
      'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
      'Zwölf Wörter auf Papier',
      'Aufschreiben, in die Schublade — der älteste Tresor der Welt.'
    ]
  ];
  wegDaten.forEach(([iconPfad, wegTitel, wegSub], i) => {
    const box = document.createElement('div');
    box.style.cssText =
      'display: flex; align-items: flex-start; gap: 12px; background: rgba(143,169,143,.08); border-radius: 12px; padding: 14px 16px;';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#8FA98F');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.cssText = 'flex-shrink: 0; margin-top: 1px;';
    if (i === 0) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '4');
      rect.setAttribute('width', '20');
      rect.setAttribute('height', '13');
      rect.setAttribute('rx', '2');
      svg.appendChild(rect);
    }
    const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pfad.setAttribute('d', iconPfad);
    svg.appendChild(pfad);
    box.appendChild(svg);
    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';
    const t = document.createElement('div');
    t.className = 't13';
    t.style.fontWeight = '600';
    t.textContent = wegTitel;
    textWrap.appendChild(t);
    const s = document.createElement('div');
    s.className = 't11 sub';
    s.style.cssText = 'margin-top: 2px; line-height: 1.45;';
    s.textContent = wegSub;
    textWrap.appendChild(s);
    box.appendChild(textWrap);
    wege.appendChild(box);
  });
  karte.appendChild(wege);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 8px;';
  const btnJetzt = document.createElement('button');
  btnJetzt.className = 'pill-salbei';
  btnJetzt.style.cssText = 'flex: 1; height: 48px;';
  btnJetzt.textContent = 'Ja, jetzt';
  btnJetzt.onclick = opts.onJetzt;
  btnRow.appendChild(btnJetzt);
  const btnSpaeter = document.createElement('button');
  btnSpaeter.className = 'pill-still';
  btnSpaeter.style.height = '48px';
  btnSpaeter.textContent = 'Am Wochenende';
  btnSpaeter.onclick = opts.onSpaeter;
  btnRow.appendChild(btnSpaeter);
  karte.appendChild(btnRow);
  spalte.appendChild(karte);

  const fussnote = document.createElement('div');
  fussnote.className = 't11 sub';
  fussnote.style.cssText = 'text-align: center; line-height: 1.6;';
  fussnote.innerHTML =
    'Ich erinnere dich, bis es erledigt ist —<br>das ist die eine Sache, bei der ich hartnäckig bin.';
  spalte.appendChild(fussnote);

  flaeche.appendChild(spalte);
  return flaeche;
}

/** ObErfolg — „Wirf mir irgendetwas hin." Der erste Drop ist der Abschluss. */
export function renderObErfolg(onFertig: () => void): HTMLElement {
  const flaeche = document.createElement('div');
  flaeche.style.cssText =
    'position: absolute; inset: 0; background: #FAF7F2; display: flex; flex-direction: column;';

  const buehne = document.createElement('div');
  buehne.style.cssText =
    'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 36px; padding: 0 80px;';

  const titel = document.createElement('div');
  titel.className = 'serif';
  titel.style.fontSize = '34px';
  titel.textContent = 'Wirf mir irgendetwas hin.';
  buehne.appendChild(titel);

  // Zustand direkt nach dem ersten Drop (Artboard-kanonisches Beispiel)
  const karte = document.createElement('div');
  karte.className = 'karte';
  karte.style.cssText =
    'width: 560px; box-sizing: border-box; padding: 26px 30px; display: flex; flex-direction: column; gap: 18px;';

  const docZeile = document.createElement('div');
  docZeile.style.cssText = 'display: flex; align-items: center; gap: 14px;';
  const thumb = document.createElement('div');
  thumb.style.cssText =
    'width: 44px; height: 56px; flex: none; border-radius: 6px; background: #fff; border: 1px solid rgba(184,163,105,.25); box-shadow: 0 2px 8px rgba(90,75,50,.15); display: flex; align-items: center; justify-content: center;';
  const docSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  docSvg.setAttribute('width', '17');
  docSvg.setAttribute('height', '17');
  docSvg.setAttribute('viewBox', '0 0 24 24');
  docSvg.setAttribute('fill', 'none');
  docSvg.setAttribute('stroke', 'rgba(42,37,32,.32)');
  docSvg.setAttribute('stroke-width', '1.5');
  docSvg.setAttribute('stroke-linecap', 'round');
  docSvg.setAttribute('stroke-linejoin', 'round');
  const dp1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  dp1.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
  docSvg.appendChild(dp1);
  const dp2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  dp2.setAttribute('d', 'M14 2v6h6');
  docSvg.appendChild(dp2);
  thumb.appendChild(docSvg);
  docZeile.appendChild(thumb);
  const docText = document.createElement('div');
  docText.style.cssText = 'flex: 1; min-width: 0;';
  const docName = document.createElement('div');
  docName.style.cssText = 'font-size: 15px; font-weight: 600;';
  docName.textContent = 'Kfz-Police 2026.pdf';
  docText.appendChild(docName);
  const docStatus = document.createElement('div');
  docStatus.className = 't13';
  docStatus.style.cssText =
    'color: #5c705c; margin-top: 3px; display: flex; align-items: center; gap: 6px;';
  docStatus.appendChild(haken(13));
  docStatus.appendChild(
    document.createTextNode('Gelesen — in 0,6 Sekunden, hier auf dem Gerät.')
  );
  docText.appendChild(docStatus);
  docZeile.appendChild(docText);
  karte.appendChild(docZeile);

  const linie = document.createElement('div');
  linie.style.cssText = 'height: 1px; background: rgba(42,37,32,.08);';
  karte.appendChild(linie);

  const fragHinweis = document.createElement('div');
  fragHinweis.className = 't13 sub';
  fragHinweis.textContent = 'Jetzt frag mich etwas. Zum Beispiel:';
  karte.appendChild(fragHinweis);

  const chips = document.createElement('div');
  chips.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
  for (const frage of ['Wann läuft die Police aus?', 'Wie hoch ist die Selbstbeteiligung?']) {
    const chip = document.createElement('span');
    chip.className = 't13';
    chip.style.cssText =
      'color: #5c705c; background: rgba(143,169,143,.14); border-radius: 999px; padding: 9px 16px; cursor: pointer;';
    chip.textContent = frage;
    chip.onclick = onFertig;
    chips.appendChild(chip);
  }
  karte.appendChild(chips);
  buehne.appendChild(karte);

  const fussnote = document.createElement('div');
  fussnote.className = 't11 sub';
  fussnote.style.cssText = 'max-width: 56ch; text-align: center; line-height: 1.6;';
  fussnote.textContent =
    'Wenn du die erste Antwort siehst — mit der Stelle, aus der sie kommt — bist du fertig. Das war das ganze Onboarding.';
  buehne.appendChild(fussnote);

  const btnFertig = document.createElement('button');
  btnFertig.className = 'pill-still';
  btnFertig.textContent = 'Los geht’s';
  btnFertig.onclick = onFertig;
  buehne.appendChild(btnFertig);

  flaeche.appendChild(buehne);
  return flaeche;
}

/** Punkte-Indikator wie in ObSiegel: 3 Punkte 8px, gap 8, padding-bottom 30. */
function punkteZeile(aktivIndex: number): HTMLElement {
  const zeile = document.createElement('div');
  zeile.style.cssText =
    'flex: none; display: flex; justify-content: center; gap: 8px; padding-bottom: 30px;';
  for (let i = 0; i < 3; i++) {
    const punkt = document.createElement('span');
    punkt.style.cssText =
      'width: 8px; height: 8px; border-radius: 999px; background: ' +
      (i === aktivIndex ? '#B8A369' : 'rgba(184,163,105,.25)') +
      ';';
    zeile.appendChild(punkt);
  }
  return zeile;
}

// ============================================================================
// Gemeinsame Bausteine
// ============================================================================

/** Rosé-Info-Kreis (OsRueckruf): circle r9 + i-Punkt, stroke #D9A6A0, width 2.4 */
function infoKreis(groesse: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(groesse));
  svg.setAttribute('height', String(groesse));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#D9A6A0');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.flexShrink = '0';
  const kreis = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  kreis.setAttribute('cx', '12');
  kreis.setAttribute('cy', '12');
  kreis.setAttribute('r', '9');
  svg.appendChild(kreis);
  const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pfad.setAttribute('d', 'M12 8v5M12 16h.01');
  svg.appendChild(pfad);
  return svg;
}

/** Olivgold-Schild (OsRueckruf Sprach-Hinweis): stroke #B8A369, width 2 */
function schild(groesse: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(groesse));
  svg.setAttribute('height', String(groesse));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#B8A369');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.flexShrink = '0';
  const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pfad.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
  svg.appendChild(pfad);
  return svg;
}

/** Rosé-Kreuz (OsEinladen „Sonst nichts"): stroke #D9A6A0, width 2.4, Pfad M18 6 6 18M6 6l12 12 */
function kreuz(groesse: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(groesse));
  svg.setAttribute('height', String(groesse));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#D9A6A0');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.flexShrink = '0';
  const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pfad.setAttribute('d', 'M18 6 6 18M6 6l12 12');
  svg.appendChild(pfad);
  return svg;
}

/** Salbei-Häkchen wie in allen Artboards: stroke #8FA98F, width 2.4, Pfad M20 6 9 17l-5-5 */
function haken(groesse: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(groesse));
  svg.setAttribute('height', String(groesse));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#8FA98F');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.flexShrink = '0';
  const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pfad.setAttribute('d', 'M20 6 9 17l-5-5');
  svg.appendChild(pfad);
  return svg;
}
