# Vehicle Images API

Serves vehicle model names and image URLs from the "Model Images" Google Sheet.

## Run locally

```bash
npm install
npm start          # http://localhost:3000
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/models` | All models. Optional `?search=jupiter`, `?hasImage=true` |
| GET | `/api/models/:slugOrName` | One model, e.g. `/api/models/tvs-raider-disc` |
| GET | `/api/image?model=TVS RAIDER DISC` | `{ name, image }` for a model name (case-insensitive) |
| GET | `/api/models/:slugOrName/image` | 302 redirect to the image, usable in `<img src>` |

## Updating the data

Edit the Google Sheet, then:

```bash
npm run sync       # regenerates models.js from the sheet
git commit -am "Update models" && git push   # Render redeploys automatically
```

Models with an empty Image cell in the sheet get a fallback URL from `image-overrides.js`. A URL in the sheet always takes priority over the fallback.

## Deploy to Render (free)

1. Push this folder to a GitHub repo.
2. On https://render.com: **New → Web Service** → connect the repo.
3. Runtime: Node · Build command: `npm install` · Start command: `npm start` · Instance type: **Free**.
4. Deploy. The URL looks like `https://vehicle-images-api.onrender.com`.

Free instances sleep after 15 minutes of no traffic, so the first request after that takes about 30–50 seconds.
