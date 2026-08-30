/**
 * beweis.ts — Vanilla-TS-DOM-Komponente für Beweis-Rechtecke
 * KEIN Node-API-Zugriff, reine DOM-Manipulation
 */

export interface Rechteck {
  bbox: [number, number, number, number]; // [x, y, w, h] normalisiert 0..1
  art: 'beweis' | 'lese';
}

export interface BeweisOptions {
  bildUrl: string;
  seite: {
    width: number;
    height: number;
  };
  rechtecke: Rechteck[];
  quellzeile: string;
  // Canvas-Benennung (OsBeweis.dc.html): Stimmt / Original öffnen / Falsch zugeordnet
  onStimmt: () => void;
  onOriginal: () => void;
  onFalsch: () => void;
}

/**
 * Rendert einen Beweis mit Bild, Rechtecken und drei Buttons.
 * Vision-bbox kommt normalisiert 0..1 mit Ursprung UNTEN links → Y-Flip für CSS.
 */
export function renderBeweis(opts: BeweisOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'beweis-container';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    background: var(--os-grund);
  `;

  // Bild-Container mit absolut positionierten Rechtecken
  const bildWrapper = document.createElement('div');
  bildWrapper.style.cssText = `
    position: relative;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    border-radius: var(--os-radius-blatt);
    overflow: hidden;
    box-shadow: 0 18px 50px -18px rgba(70,58,38,.4);
  `;

  const img = document.createElement('img');
  img.src = opts.bildUrl;
  img.alt = 'Beleg';
  img.style.cssText = `
    display: block;
    width: 100%;
    height: auto;
  `;

  bildWrapper.appendChild(img);

  // Rechtecke über dem Bild (Prozentangaben + Y-Flip)
  opts.rechtecke.forEach(r => {
    const [x, y, w, h] = r.bbox;

    // Y-Flip: Vision-Ursprung unten links → CSS-Ursprung oben links
    const topPercent = (1 - y - h) * 100;
    const leftPercent = x * 100;
    const widthPercent = w * 100;
    const heightPercent = h * 100;

    const box = document.createElement('div');
    box.style.cssText = `
      position: absolute;
      left: ${leftPercent}%;
      top: ${topPercent}%;
      width: ${widthPercent}%;
      height: ${heightPercent}%;
      pointer-events: none;
      border-radius: 6px;
      animation: beweisEinblenden 300ms ease-out;
    `;

    if (r.art === 'beweis') {
      // Beweis-Rechteck: 2px Rosé + 8% Füllung
      box.style.border = '2px solid var(--os-rose)';
      box.style.background = 'rgba(217,166,160,.08)';
    } else {
      // Lese-Folie: 1.5px Salbei + 13% Füllung
      box.style.border = '1.5px solid rgba(143,169,143,.5)';
      box.style.background = 'rgba(143,169,143,.13)';
    }

    bildWrapper.appendChild(box);
  });

  container.appendChild(bildWrapper);

  // Quellzeile (Mono 11px)
  const quelle = document.createElement('div');
  quelle.className = 'quelle';
  quelle.textContent = opts.quellzeile;
  quelle.style.cssText = `
    font-family: var(--os-mono);
    font-size: 11px;
    color: rgba(42,37,32,.6);
    text-align: center;
  `;
  container.appendChild(quelle);

  // Drei Buttons — Reihenfolge und Benennung wie OsBeweis.dc.html
  container.appendChild(
    renderBeweisButtons('Original öffnen', opts.onStimmt, opts.onOriginal, opts.onFalsch)
  );

  // Einblend-Animation (CSS-Keyframes im Style-Attribut geht nicht → ins globale CSS)
  installBeweisAnimation();

  return container;
}

// ============================================================================
// Gemeinsame Bausteine
// ============================================================================

function installBeweisAnimation(): void {
  if (document.getElementById('beweis-animation-style')) return;
  const style = document.createElement('style');
  style.id = 'beweis-animation-style';
  style.textContent = `
    @keyframes beweisEinblenden {
      from {
        opacity: 0;
        transform: scale(0.98);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Button-Zeile nach Canvas (OsBeweis/OsAnrufBeweis.dc.html):
 * [Stimmt] Salbei · [<mittlerer>] Still · [Falsch zugeordnet] Rosé-Still
 */
function renderBeweisButtons(
  mittlererText: string,
  onStimmt: () => void,
  onMittlerer: () => void,
  onFalsch: () => void
): HTMLElement {
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: center;
  `;

  const basis = `
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: var(--os-radius-rund);
    font-size: 15px;
    border: none;
    cursor: pointer;
  `;

  const btnStimmt = document.createElement('button');
  btnStimmt.textContent = 'Stimmt';
  btnStimmt.className = 'pill-salbei';
  btnStimmt.style.cssText = basis + `
    padding: 0 26px;
    background: var(--os-salbei);
    color: #fff;
    font-weight: 600;
    box-shadow: 0 8px 22px -10px rgba(110,140,110,.7);
  `;
  btnStimmt.onclick = onStimmt;

  const btnMittlerer = document.createElement('button');
  btnMittlerer.textContent = mittlererText;
  btnMittlerer.className = 'pill-still';
  btnMittlerer.style.cssText = basis + `
    padding: 0 22px;
    background: rgba(143,169,143,.14);
    color: #5c705c;
    font-weight: 500;
  `;
  btnMittlerer.onclick = onMittlerer;

  const btnFalsch = document.createElement('button');
  btnFalsch.textContent = 'Falsch zugeordnet';
  btnFalsch.className = 'pill-still';
  btnFalsch.style.cssText = basis + `
    padding: 0 22px;
    background: rgba(217,166,160,.16);
    color: #9c6a63;
    font-weight: 500;
  `;
  btnFalsch.onclick = onFalsch;

  buttonRow.appendChild(btnStimmt);
  buttonRow.appendChild(btnMittlerer);
  buttonRow.appendChild(btnFalsch);
  return buttonRow;
}

// ============================================================================
// Anruf-Beweis: Transkript-Timeline (OsAnrufBeweis.dc.html)
// Der Beweis ist eine Zeitmarke, kein Rechteck.
// ============================================================================

export interface TranskriptAnzeigeZeile {
  zeit: string; // "04:12"
  sprecher: string;
  text: string;
  markiert?: boolean; // Fundstellen-Zeile: 2px Rosé + 8% Füllung
}

export interface AnrufBeweisOptions {
  header: string; // z. B. "ANRUF · REVIEW & PLANNING · DONNERSTAG · 42 MIN"
  zeilen: TranskriptAnzeigeZeile[];
  minute: string; // Fundstellen-Minute für den Anhören-Button
  quellzeile: string; // Fall · anruf-*.wav · Minute 04:12 · Commit · Signatur ✓
  onStimmt: () => void;
  onAnhoeren: () => void;
  onFalsch: () => void;
}

/** Maße nachgemessen in OsAnrufBeweis.dc.html — nicht raten. */
export function renderAnrufBeweis(opts: AnrufBeweisOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'beweis-container';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px;
    background: var(--os-grund);
  `;

  // Mitschrift-Karte: 640px, weiß, Radius 8, Schatten wie Artboard
  const karte = document.createElement('div');
  karte.style.cssText = `
    width: 640px;
    max-width: 100%;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 18px 50px -18px rgba(70,58,38,.4);
    padding: 30px 38px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
    animation: beweisEinblenden 300ms ease-out;
  `;

  // Header: "ANRUF · … · 42 MIN" + Play-Icon
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

  const headerText = document.createElement('div');
  headerText.textContent = opts.header;
  headerText.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: rgba(42,37,32,.65);
    letter-spacing: .02em;
    flex: 1;
  `;
  headerRow.appendChild(headerText);

  const play = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  play.setAttribute('width', '15');
  play.setAttribute('height', '15');
  play.setAttribute('viewBox', '0 0 24 24');
  play.setAttribute('fill', 'none');
  play.setAttribute('stroke', 'rgba(42,37,32,.4)');
  play.setAttribute('stroke-width', '1.8');
  play.setAttribute('stroke-linecap', 'round');
  play.setAttribute('stroke-linejoin', 'round');
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '6 3 20 12 6 21 6 3');
  play.appendChild(polygon);
  headerRow.appendChild(play);
  karte.appendChild(headerRow);

  // Trennlinie
  const linie = document.createElement('div');
  linie.style.cssText = 'height: 1px; background: rgba(42,37,32,.08);';
  karte.appendChild(linie);

  // Transkript-Zeilen: Zeit (Mono 11px, 42px breit) + Text (13px)
  for (const zeile of opts.zeilen) {
    const zeilenText = zeile.sprecher ? `${zeile.sprecher}: ${zeile.text}` : zeile.text;
    const row = document.createElement('div');

    const zeit = document.createElement('span');
    zeit.textContent = zeile.zeit;
    zeit.style.cssText = `
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 11px;
      flex: none;
      width: 42px;
      padding-top: 1px;
      ${zeile.markiert ? 'font-weight: 600;' : ''}
    `;

    const text = document.createElement('span');
    text.textContent = zeilenText;
    if (zeile.markiert) text.style.fontWeight = '500';

    if (zeile.markiert) {
      // Fundstellen-Zeile: 2px Rosé + 8% Füllung (wie Beweis-Rechteck)
      row.style.cssText = `
        position: relative;
        display: flex;
        gap: 14px;
        padding: 8px 10px;
        margin: 0 -10px;
        font-size: 13px;
      `;
      const rahmen = document.createElement('span');
      rahmen.style.cssText = `
        position: absolute;
        inset: 0;
        border: 2px solid var(--os-rose);
        border-radius: 6px;
        background: rgba(217,166,160,.08);
        pointer-events: none;
      `;
      row.appendChild(rahmen);
    } else {
      row.style.cssText = `
        display: flex;
        gap: 14px;
        font-size: 13px;
        color: rgba(42,37,32,.45);
      `;
    }

    row.appendChild(zeit);
    row.appendChild(text);
    karte.appendChild(row);
  }

  container.appendChild(karte);

  // Quellzeile (Mono 11px): Fall · anruf-*.wav · Minute · Commit · Signatur ✓
  const quelle = document.createElement('div');
  quelle.className = 'quelle';
  quelle.textContent = opts.quellzeile;
  quelle.style.cssText = `
    font-family: var(--os-mono);
    font-size: 11px;
    color: rgba(42,37,32,.6);
    text-align: center;
  `;
  container.appendChild(quelle);

  // Buttons: Stimmt / Anhören ab <minute> / Falsch zugeordnet
  container.appendChild(
    renderBeweisButtons(`Anhören ab ${opts.minute}`, opts.onStimmt, opts.onAnhoeren, opts.onFalsch)
  );

  installBeweisAnimation();

  return container;
}
