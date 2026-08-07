# Gemini Proxy Server

Node.js / Express proxy for Gemini + Nutritionix + USDA + FatSecret. Keeps API keys on the server.

## Setup

1. Install deps

```bash
cd gemini-proxy
npm install
```

2. Create env file

```bash
cp .env.example .env
```

3. Set required values in `.env`

```env
GEMINI_KEY=your_real_key
FIREBASE_PROJECT_ID=your-project-id
```

4. Run

```bash
npm start
```

Server runs on `http://localhost:8080` by default.

## API

All `/api/*` routes require:

- `Authorization: Bearer <firebase_id_token>`

### `POST /api/gemini`

Request JSON:

```json
{
  "prompt": "Give me a high-protein breakfast idea",
  "model": "gemini-2.5-flash"
}
```

- `prompt` is required.
- `model` is optional.

Response JSON:

```json
{
  "text": "...",
  "model": "gemini-2.5-flash"
}
```

### `GET /api/nutritionix/barcode?upc=<digits>`

Proxies Nutritionix `/v2/search/item` with server-side app id/key.

### `GET /api/nutritionix/instant?query=<text>&detailed=true&branded=true&common=false`

Proxies Nutritionix `/v2/search/instant`.

### `POST /api/usda/foods/search`

Proxies USDA FDC `/foods/search` with server-side USDA key.

### `GET /api/usda/food/:fdcId`

Proxies USDA FDC food detail endpoint.

### `GET /api/fatsecret/foods/search?q=<text>`

Proxies FatSecret food search (v2 when `FATSECRET_SCOPE` includes premier, else v1). Requires `FATSECRET_CLIENT_ID` / `FATSECRET_CLIENT_SECRET`.

### `GET /api/fatsecret/food/:foodId`

Proxies FatSecret `food.get.v2`.

### `GET /api/fatsecret/status`

Returns whether FatSecret credentials are configured (no secrets).

## Rate limiting

- Per-IP rate limit: **60 requests / 15 minutes**.
- Returns HTTP `429` when exceeded.
