# Vehicle Images API

Serves TVS vehicle images by **model → variant → colour**.

## Run locally

```bash
npm install
npm start          # http://localhost:3000
```

## Data format (`models.js`)

```json
{
  "JUPITER 125": {
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
}
```

Each colour's image is a photo of that colour where one was found. If there isn't one, the colour uses the variant image, and the variant uses the model image when it has none of its own.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/models` | Full catalogue. `?active=true` hides inactive models/variants/colours |
| GET | `/api/models/:model` | One model with variants and colours |
| GET | `/api/models/:model/variants/:variant` | One variant with colours |
| GET | `/api/image?model=&variant=&color=` | `{ model, variant, color, image, matched }`. `variant` and `color` are optional |
| GET | `/api/image/redirect?model=&variant=&color=` | 302 redirect to the image, usable in `<img src>` |

Name matching ignores case, spaces and punctuation, and a leading "TVS" on model names is optional. If a variant or colour isn't found, `/api/image` falls back to the next level up, and `matched` says which level was used (`model`, `variant` or `color`).

## Updating the data

Edit `models.js`, then:

```bash
npm run build:json   # refresh models.json for the static copy
git commit -am "Update models" && git push   # Render redeploys automatically
```

## Static copy (no server)

`https://cdn.jsdelivr.net/gh/globalAutocraft/Models-API@main/models.json` has the same catalogue.

## Deploy to Render (free)

The repo includes `render.yaml`: on Render, choose **New → Blueprint**, select this repo, then **Apply**.
