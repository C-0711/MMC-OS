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
  onPasst: () => void;
  onAnders: () => void;
  onQuelle: () => void;
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

  // Drei Buttons
  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: center;
  `;

  // [Passt] — Salbei, Zustimmung
  const btnPasst = document.createElement('button');
  btnPasst.textContent = 'Passt';
  btnPasst.className = 'pill-salbei';
  btnPasst.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 26px;
    border-radius: var(--os-radius-rund);
    background: var(--os-salbei);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    box-shadow: 0 8px 22px -10px rgba(110,140,110,.7);
  `;
  btnPasst.onclick = opts.onPasst;

  // [Anders] — Still, keine Farbalarm
  const btnAnders = document.createElement('button');
  btnAnders.textContent = 'Anders';
  btnAnders.className = 'pill-still';
  btnAnders.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 22px;
    border-radius: var(--os-radius-rund);
    background: rgba(143,169,143,.14);
    color: #5c705c;
    font-size: 15px;
    font-weight: 500;
    border: none;
    cursor: pointer;
  `;
  btnAnders.onclick = opts.onAnders;

  // [Quelle] — Still
  const btnQuelle = document.createElement('button');
  btnQuelle.textContent = 'Quelle';
  btnQuelle.className = 'pill-still';
  btnQuelle.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 22px;
    border-radius: var(--os-radius-rund);
    background: rgba(143,169,143,.14);
    color: #5c705c;
    font-size: 15px;
    font-weight: 500;
    border: none;
    cursor: pointer;
  `;
  btnQuelle.onclick = opts.onQuelle;

  buttonRow.appendChild(btnPasst);
  buttonRow.appendChild(btnAnders);
  buttonRow.appendChild(btnQuelle);
  container.appendChild(buttonRow);

  // Einblend-Animation (CSS-Keyframes im Style-Attribut geht nicht → ins globale CSS)
  if (!document.getElementById('beweis-animation-style')) {
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

  return container;
}
