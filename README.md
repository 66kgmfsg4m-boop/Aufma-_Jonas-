# Aufmaß

Lokale App für Stück- und Meterpreise aus Großhandelsrechnungen und Preiskatalogen. Dateien werden auf dem eigenen Rechner gelesen, die Positionen prüfst du vor dem Speichern, und danach kannst du Bauteile suchen und Preise desselben Artikels vergleichen.

Die Daten liegen in `data/aufmass.db` (SQLite). Es gibt kein Konto und keine Cloud.

## Starten

```bash
npm install
npm run dev
```

Die App läuft dann unter [http://127.0.0.1:47291](http://127.0.0.1:47291).

Produktion auf demselben Rechner:

```bash
npm run build
npm start
```

Tests:

```bash
npm test
```

## Dateien

- PDF mit Textlayer (digitale Rechnung oder Katalog)
- Excel `.xlsx`
- CSV oder TSV, auch mit Semikolon und Komma als Dezimalzeichen, UTF-8 oder Windows-1252

Ältere `.xls`-Dateien vorher als `.xlsx` speichern. Gescannte PDFs ohne Text werden nicht gelesen.

Erkannt werden Artikelnummer, Bezeichnung, Einheit (Stück, Meter, m², m³ und weitere), Einzelpreis und, wenn vorhanden, Menge und Gesamtpreis. Steht ein Preis je 100 oder je 1000, wird er auf eine Einheit umgerechnet und in der Prüfung gekennzeichnet. Packungszeilen wie „100 Stück“ und Meterware wie „1x100 Meter“ werden auf den Stück- bzw. Meterpreis umgerechnet. Folgetext bleibt an der Position. Liegen EK und VK nebeneinander, wird der Einkaufspreis genommen. Die Spaltenzuordnung lässt sich vor dem Speichern ändern.

Unter `examples/` liegen zwei Rechnungen (Pollin, Elektrohandel Wandelt). „Beispielbestand laden“ auf der Suche und „Beispielrechnungen laden“ beim Import lesen sie mit demselben Parser und legen die Preise in die Bibliothek.

## Weitergeben

Mit Docker, die Bibliothek bleibt im Volume:

```bash
docker compose up --build
```

Die Oberfläche ist dann unter Port `47291` erreichbar. Die App hat keine Anmeldung. Sie nur im eigenen Netz betreiben oder davor einen Zugriffsschutz setzen.

Zeiten in der Oberfläche sind Europe/Berlin.
