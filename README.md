# Lunchrundan

En statisk sida som samlar lunchmenyer från Restaurang Tybble, Restaurang 29, Restaurang Parken och Kötthandlarn i Örebro.

Sidan består endast av HTML, CSS och vanlig JavaScript. Ingen byggprocess eller serverkod behövs på webbhotellet.

## Lokal körning

```sh
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000`.

## Publicering

Ladda upp `index.html`, `styles.css` och `app.js` till samma katalog på webbhotellet.

## Hämtning och CORS

Tybble hämtas direkt från restaurangens WordPress-API. Restaurang 29, Parken och Kötthandlarn tillåter inte direkt läsning från en annan webbplats och hämtas därför via AllOrigins.

Proxyadressen finns högst upp i `app.js`:

```js
const PROXY_BASE_URL = "https://api.allorigins.win/raw?url=";
```

AllOrigins är en kostnadsfri tredjepartstjänst och kan vara långsam eller tillfälligt ligga nere. Byt konfigurationsvärdet om du använder en annan proxy med samma `?url=`-format. Lägg aldrig en hemlig API-nyckel i klientkoden.

Varje restaurang laddas oberoende. Vid fel visas senast sparade meny från `localStorage`, om en sådan finns, samt en direktlänk till restaurangens originalmeny.

Restaurang 29 publicerar för närvarande val för hela veckan, så samma alternativ visas måndag till fredag.

Kötthandlarn publicerar en rätt per vardag och en veckospecial. Veckospecialen visas tillsammans med dagens rätt.

Fjärrinnehåll renderas aldrig som HTML. Parsern extraherar text och gränssnittet infogar den med `textContent`.
