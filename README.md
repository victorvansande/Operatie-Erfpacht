# Geheim Spel Portaal (GitHub Pages)

Een kant-en-klare website in **De Mol / Geheime Missie** stijl voor het spel met de jeugdbeweging.

## 📁 Mappenstructuur

- `index.html` — Het hoofdportaal waar alle 26 namen op staan (met zoekbalk en pincode-venster).
- `js/config.js` — **Centrale lijst met alle namen en hun pincodes/wachtwoorden.**
- `spelers/` — Mapje met voor elke speler een eigen HTML-pagina (`daan.html`, `dominique.html`, ..., `vicce.html`).
- `css/style.css` — Het donkere "geheim dossier" thema (werkt op zowel gsm als computer).

## 🔑 Pincodes / Wachtwoorden aanpassen

Open [`js/config.js`](js/config.js). Daar zie je alle 26 spelers onder elkaar met elk een standaard 4-cijferige code (en een `masterCode` voor de leiding: `leiding2026`). Je kan hier elk cijfer of woord invullen dat je wil.

## 📝 Persoonlijke opdrachten invullen

Open in het mapje `spelers/` het bestand van de persoon die je wil aanpassen (bijvoorbeeld `spelers/daan.html`). Zoek naar het blok:

```html
<!-- ===================================================================== -->
<!-- GEHEIME INHOUD VAN DAAN (PAS HIERONDER DE TEKST AAN) -->
<!-- ===================================================================== -->
```

Daar kan je de tekst, geheime rol, team of foto's voor die specifieke speler plaatsen.

## 🚀 Online zetten via GitHub Pages

1. Maak een nieuwe repository aan op [GitHub](https://github.com/new).
2. Upload alle bestanden en mappen (`index.html`, `css/`, `js/`, `spelers/`) naar de repository.
3. Ga in je GitHub repository naar **Settings** → **Pages**.
4. Kies bij **Branch** voor `main` (en `/ (root)`) en klik op **Save**.
5. Na ongeveer 1 minuut staat je link live en kan je deze doorsturen (of in een QR-code zetten) voor de leden!
