# Technische Spezifikation v0.1 — gitchain OS Runtime

*Status: Entwurf · Siebte Spec im Verbund · Umsetzungsbezug: Spec-Verbund (Daten, Agenten, Ingress, Interaktion, Desktop-App), OS-Manifest v1*

---

## 0. Der eine Satz

**gitchain OS ist eine föderierte Container-Runtime auf Git-Objektbasis mit lokaler KI-Inferenz, Capability-basierter Zugriffskontrolle und beweisbarer Interaktionshistorie — OS-gastgebend, niemals OS-ersetzend.**

---

## 1. Systemübersicht

```
┌──────────────────────────────────────────────────────────────────┐
│  HOST (macOS / Linux / iOS / GrapheneOS)                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  gitchain-runtime                                           │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐     │  │
│  │  │ INGRESS  │→ │ DEUTUNG  │→ │ DECISION (R0–R3)     │     │  │
│  │  │ Hub      │  │ Agent    │  │ auto | vorschlag |    │     │  │
│  │  │          │  │ (lokal)  │  │ zweifel              │     │  │
│  │  └──────────┘  └──────────┘  └──────────────────────┘     │  │
│  │        ↓             ↓                    ↓                 │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  VAULT (verschlüsselt)                               │   │  │
│  │  │  ├─ supercontainer (brain: refs + tq-index)          │   │  │
│  │  │  ├─ fall-container (docs/ + atoms + sig)             │   │  │
│  │  │  ├─ agenten-container (memories, skills, policy)     │   │  │
│  │  │  └─ blob-store (hash-adressiert)                     │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │        ↕ sync (pull-on-push)      ↕ gateway (:7906)         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         ↕ TAILSCALE-KLASSE NUTZERZUGANG        ↕ REDIGIERTER SLICE
   PHONE (Klon: Tresor+Zeuge)            SOUVERÄNE CLOUD (Chiffre-Spiegel)
```

## 2. Komponenten-Spezifikation

### 2.1 Ingress-Hub

| Aspekt | Spezifikation |
|---|---|
| Konnektoren | IMAP/SMTP-Pull (Mail), Web-Bridge (Messenger), Kamera/Photo-Library-Import, Folder-Watcher (Finder-Zulauf), Speech-Pipeline (Anrufe, on-device) |
| OCR | ocr.0711.io-Pipeline (lokal): Layout-Erkennung, Text + Koordinaten (für Rechteck-Fundstellen) |
| FIFO | eingehende Nutzlast → sofortiger Original-Commit (`docs/eingang/<datum>/<id>`), **vor** jeder Deutung |
| Dedup | Content-Hash vor Commit; Duplette → Vorschlag (nie still verwerfen) |
| Formate | EML/MBOX, PDF, JPG/HEIC (+EXIF), PST-Import (Takeout), ICS, JSON-Nachrichten |
| Garantie | kein Eingangsverlust: Hub-Queue ist selbst persistente Log-Datei im Vault |

### 2.2 Deutungs-Agent

| Aspekt | Spezifikation |
|---|---|
| Modell | lokal: 2–4B (NPU/Phone) · 8–14B quantisiert (Mac); embed: 768-d, modell-id + hash in brain.json |
| Pipeline | OCR-Text → Atoms (datei, seite, rect) → Embedding → TurboQuant (PolarQuant b=3 + QJL) → Brain-Index |
| Retrieval | SEARCH im Brain (top-k, ~µs, resident GEMM) → RESOLVE im Fall (Capability-Check) → Kontext |
| Fristen | Regeln + Modell: Frist-Extraktion erzeugt Frist-Atom mit Quellen-Fundstelle; Fälligkeits-Berechnung deterministisch (kein LLM-Beschluss) |
| Schreiben | **branch-only** — jede Deutung ist Branch-Vorschlag im Ziel-Fall (never main) |
| Memory | Episoden + verdichtete Memories mit `learned_from`; Änderungen = Commits im Agenten-Container |
| Netzwerk | Default-deny (OS-Firewall-Regel); einziger Ausgang: Gateway (§2.6) |

### 2.3 Decision-Engine

| Aspekt | Spezifikation |
|---|---|
| Eingang | Deutungsergebnis: `(aktion, konfidenz K, risikoklasse R)` |
| Matrix | R0–R3 × K-Schwellen (Ingress-Spec §7); Schwellen = Preference im Agenten-Container |
| Auto-Lane | Ausführung + Audit-Commit (Fundstelle + Skill-Version + K) |
| Vorschlag-Lane | proposals/-Eintrag im Brain (Ref) + Branch im Fall + Karten-Queue (max. 3/Tag sichtbar) |
| Zweifel-Lane | fail closed; ≥10 Ungeklärt → Meta-Rückfrage-Ereignis |
| R3 | immer Vorschlag + Geräte-Entsperre; kein Auto, unabhängig von K |

### 2.4 Vault & Container-Engine

| Aspekt | Spezifikation |
|---|---|
| Objektbasis | Git (SHA-256); Klone = voller Besitz |
| Fall-Container | Repo: `docs/` (originale, byte-identisch, LFS-artig per Blob-Store), `atoms.jsonl` (deutungen mit fundstelle), eigene Historie |
| Brain | Repo: `refs/`, `.brain/` (vectors_tq.npz, bm25.npz, map.json), `brain.json` (modell-hash, quant-params, rebuild-script-hash) |
| Blob-Store | hash-adressiert, dedupliziert, verschlüsselt at rest; Git hält nur Pointer |
| Verschlüsselung | Vault: file-level (age/SOPS-Klasse); Keys in OS-Keychain/Secure-Enclave — **niemals im Container** |
| Rebuild | deterministisch: gleiche Fälle + Modellversion ⇒ byte-identischer Brain (Layer-3-Audit) |
| Signatur | Commit-Signatur (SSH/gpg) optional laufend; **erzwungen** an Fall-Grenzen (Abschluss, Übergabe) + Anchor-Zeitpunkten (Ed25519) |

### 2.5 Capabilities & Schlüssel

| Aspekt | Spezifikation |
|---|---|
| Identität | did:key (Ed25519) pro Teilnehmer (Nutzer, Agent, Partner) |
| Capability | signiertes JSON: container-ref, grantee-did, scope (atoms/operations/route/redact), expires, revocation_check |
| Prüfung | vor **jedem** Zugriff: Signatur + Ablauf + Revocation-Commit im Baum (fail closed) |
| Revocation | Commit im Container; Verteilung über pull-on-push-Sync |
| Voice | STT on-device (Whisper-Klasse); Wake konfigurierbar (push-to-talk default) |

### 2.6 Gateway (:7906)

| Aspekt | Spezifikation |
|---|---|
| Rolle | die einzige kontrollierte Grenze nach draußen |
| Route local (:11435) | volle Capability-Sicht, kostenlose lokale Inferenz |
| Route external | nur redigierter, abgerufener Slice (redact-Filter, z. B. IBAN/E-Mail); jedes Crossing = Metering-Ereignis in `serve/audit.jsonl` im Container |
| OpenAI-kompatibel | `base_url`-Tausch; keine App-Änderung |
| MCP | search / get-atom / cite als Tools; Operationen durch Capability beschnitten |
| Abrechnung | Euro-Konto beim Betreiber; Metering aus audit.jsonl — Rechnung auditierbar aus dem Baum |

**Entwicklung vs. Betrieb (Cloud-Klarheit):** Build-Werkzeuge (Spec-Autoren, Code-Generatoren, CI) dürfen in der Cloud sein — sie sehen Artefakte, keine Nutzdaten. Die **Runtime niemals**: Deutung, Inferenz, Speicherung laufen beim Nutzer; Cloud-KI ist nur der bewusst gewählte, redigierte, auditierte Ausnahmeweg über den Gateway — nie Standardpfad, nie im Verborgenen.

### 2.7 Sync (Tresor-Verbund)

| Aspekt | Spezifikation |
|---|---|
| Transport | WireGuard/Tailscale-Klasse zwischen eigenen Geräten; Cloud-Spiegel erhält nur Chiffre |
| Mechanismus | pull-on-push: Schreibende Gerät pushed, andere pullen; Konflikte = Merge (Git) bzw. zweiter Blick (four-eyes) |
| Rollen | Mac = Denker (baut neu, schwere Deutung), Phone = Tresor+Zeuge (verify, µs-Suche), Cloud = Verfügbarkeit (nur Chiffre) |
| Mindestausstattung | ≥ 2 Klone an 2 Orten; Ausfall = `git clone` von anderswo |

### 2.8 Anchor-Service

| Aspekt | Spezifikation |
|---|---|
| `container.json` → `anchors[]` | Array aus `{system, receipt}` — nicht mehr Einzelanker |
| Priorität | 1. RFC3161-QTSP (eIDAS Art. 41, Bundesdruckerei-Klasse) · 2. EBSI · 3. OpenTimestamps · 4. Base (optional) |
| Verifikation | lokal Signatur + Rebuild; Anker gegen mindestens einen unabhängigen Nachweis prüfen (fail closed) |
| Wann | Fall-Abschluss, Übergaben (ERP/Abgabe), nicht jeder Blob |

## 3. Schnittstellen-Verzeichnis

| Schnittstelle | Richtung | Zweck |
|---|---|---|
| `search(container, q) → [(fall, atom, fundstelle)]` | jede App → Brain | top-k Adressen |
| `resolve(fall, atom) → text + original-ausschnitt` | App → Fall | beweisbare Antwort (mit Capability-Check) |
| `propose(fall, aktion, fundstellen) → branch` | Agent → Fall | Vorschlag (nie main) |
| `confirm(branch, faktor) → merge + audit` | Nutzer (Tap/Voice) → Fall | four-eyes-Commit |
| `issue_capability(...) / revoke(...)` | Nutzer → Baum | Berechtigungen |
| `anchor(fall, systeme[]) → anchors[]` | Abschluss → Ketten | Beweis-Zeitpunkt |

## 4. Technische Daten & Grenzen (messbar)

| Metrik | Ziel |
|---|---|
| Brain-Index-Größe | ~384 B/Vektor (TurboQuant); 3 MB bei ~9k Atoms (gemessen, gl.0711.io) |
| Suche | ~µs resident; 456 µs über 1M Container (H200-Referenz) |
| Phone-Budget | 8 GB RAM Minimum (2–3B-Modell + Brain + App); 12 GB empfohlen |
| Offline-Fähigkeit | alles außer Anchor + externem LLM voll funktionsfähig im Flugmodus |
| Netzwerk-Kern | tcpdump: zero outbound für Deutungs-Agent (Default-deny) |
| Boot/Onboarding | ≤ 2 Minuten bis nutzbarer Tresor |

## 5. Nicht-funktionale Anforderungen

| NFR | Anforderung |
|---|---|
| Sicherheit | Keys niemals im Container; Vault at rest verschlüsselt; Recovery = 12-Worte + Papier-Zeremonie; Voice nie alleinige Auth |
| Souveränität | lokale Inferenz als Bedingung; Cloud sieht nur Chiffre (Tresor-Konvention); Betreiber austauschbar |
| Rechtstreue | eIDAS-Art.-41-Anker für Rechtsvermutung; DSGVO: Löschen = Rebuild-Ereignis (dokumentiert); KI-Akte: Skill-Version je Deutung referenziert |
| Auditierbarkeit | Layer-1/2/3: Signatur lokal, Bundle-Byte-Audit, deterministischer Full-Rebuild |
| Performanz | Alltags-Deutung < 5 s on-device; Frag-mich-Antwort < 2 s (Suche) + Modellzeit |
| Update-Fähigkeit | Skills/Funktionen als Container austauschbar; Kern-Runtime versionsgebunden an Manifest |

## 6. Implementierungs-Stack (Referenz)

| Ebene | Technologie |
|---|---|
| Runtime-Shell | Electron/Tauri (Desktop), native App (iOS), gemeinsame Logik in Rust/TypeScript |
| Objektlayer | libgit2 / Git CLI (SHA-256), Blob-Store content-addressed |
| KI | llama.cpp-artige lokale Inferenz (Gemma-Klasse), Embeddings 768-d, TurboQuant/PolarQuant (packages/qjl) |
| STT | Whisper-Klasse on-device |
| Verschlüsselung | age/SOPS-Klasse Vault, OS-Keychain/Secure Enclave |
| Netz | WireGuard/Tailscale-Klasse, Gateway als OpenAI-kompatibler Proxy + MCP |
| Anchor | QTSP-Client (RFC 3161), EBSI-API, OpenTimestamps, Base-Contract |

## 7. Negativ-Katalog (technisch)

| Verbot | Grund |
|---|---|
| Zustand außerhalb des Vault (in-memory DB, Cloud-Memory) | kein Zustand außerhalb von Bäumen |
| Cloud-STT/Cloud-OCR im Standardpfad | Souveränitäts-Bedingung verletzt |
| API ohne Capability-Check | Filter-in-geteilte-Tabelle-Syndrom |
| Schreibzugriff von Agent/Plugin auf main | four-eyes bricht |
| Einzelnkopie irgendwo | Klone sind Besitz; alles ≥ 2 Orte |
| Anchor nur auf Base | Narrativ-Konflikt; Multi-Anker ist Pflicht |

## 8. Offene technische Punkte

- [ ] Recovery/Erbschaft: Schlüssel-Erbschaftsprotokoll (Notar-Pfad, Social Recovery)
- [ ] Konflikt-Semantik Merge vs. four-eyes bei gleichzeitigem Schreiben zweier Geräte
- [ ] PST/MBOX-Importer-Detailtiefe (Takeout-Volumen, Fortschritts-Etappen)
- [ ] Anchor-Kostenmodell (QTSP/Tx-Gebühren, Durchleitung + Marge)
- [ ] iOS-Sandbox-Grenzen: Hintergrund-Sync, STT-Latenz, Vault-Größe

---

## 9. Abgrenzung

Diese Spec beschreibt die **Runtime** — Verhalten, Schnittstellen, Grenzen. Die *Bedeutung* der Container (Datenmodell, Föderation) steht in `supercontainer-v0.1.md` und `agent-containers-v0.1.md`; das *Erlebnis* in `interaction-voice-screen`, `boot-and-desktop`, `desktop-app`. Das **OS-Manifest v1** (`os-manifest-v1.json`) ist die kanonische, signierbare Zusammenfassung aller.
