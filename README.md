# Vehicle Images API

Serves TVS vehicle images by **model → variant → colour**. The data lives in Firebase Cloud Firestore.

## Data (Firestore)

Collection `models` holds one document per model, with the model's slug as the document ID (e.g. `jupiter-125`):

```json
{
  "name": "JUPITER 125",
  "order": 1,
  "active": true,
  "image": "https://...",
  "variants": {
    "DISC DT SXC": {
      "active": true,
      "image": "https://...",
      "colors": {
        "Brown + White": { "active": true, "image": "https://..." }
      }
    }
  }
}
```

`order` sets the order models are listed in. Each colour's image is a photo of that colour where one was found. If there isn't one, the colour uses the variant image, and the variant uses the model image when it has none of its own.

The server listens to the collection, so edits made in Firestore appear in the API within seconds, with no redeploy.

## Setup

1. Firebase console → Project settings → Service accounts → **Generate new private key**. Save it as `service-account.json` in this folder (it's git-ignored and must never be committed).
2. Run locally (PowerShell):
   ```powershell
   npm install
   $env:FIREBASE_SERVICE_ACCOUNT = Get-Content service-account.json -Raw
   npm start          # http://localhost:3000
   ```
3. On Render → service → **Environment**, add `FIREBASE_SERVICE_ACCOUNT` and paste the whole contents of the JSON file as the value.

## Backup and restore

```bash
npm run export -- service-account.json backup.json   # Firestore -> file
npm run seed -- service-account.json backup.json     # file -> Firestore (overwrites same-named models)
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | API info, including `ready` (data loaded) and `models` count |
| GET | `/api/models` | Full catalogue. `?active=true` hides inactive models/variants/colours |
| GET | `/api/models/:model` | One model with variants and colours |
| GET | `/api/models/:model/variants/:variant` | One variant with colours |
| GET | `/api/image?model=&variant=&color=` | `{ model, variant, color, image, matched }`. `variant` and `color` are optional |
| GET | `/api/image/redirect?model=&variant=&color=` | 302 redirect to the image, usable in `<img src>` |

Name matching ignores case, spaces and punctuation, and a leading "TVS" on model names is optional. If a variant or colour isn't found, `/api/image` falls back to the next level up, and `matched` says which level was used (`model`, `variant` or `color`).

`/api/*` returns **503** for a second or two after startup while the data loads, or if `FIREBASE_SERVICE_ACCOUNT` is missing.

## Deploy to Render (free)

The repo includes `render.yaml`: on Render, choose **New → Blueprint**, select this repo, then **Apply**. Then add the `FIREBASE_SERVICE_ACCOUNT` environment variable.
