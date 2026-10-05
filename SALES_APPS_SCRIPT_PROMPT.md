I want to add a **Vehicle Catalogue** screen to this Sales Apps Script project. Admins should be able to manage the vehicle catalogue (models → variants → colours, each with a photo) from inside the Sales app, through my Vehicle Images API. Below is everything about that API. Read my existing code first (Code.js, page.html, script.html, style.html) and follow its patterns, naming and styling.

## 1. How the system works

```
Sales app (browser)
  │ google.script.run
  ▼
Sales Code.js (server) ──UrlFetchApp + x-admin-secret──▶ Vehicle Images API (Render, Node/Express)
                                                          │ firebase-admin (service account)
                                                          ▼
                                                     Firestore "models" collection
                                                          ▲
Catalogue Manager website (React, Google sign-in) ────────┘ writes directly (Firestore rules: admins only)
```

- **Firestore** (project `models-api-73e56`, collection `models`) is the single source of truth. There is one document per model, and the document id is the model's slug (e.g. `jupiter-125`).
- **The Vehicle Images API** (`https://models-api-y0px.onrender.com`) listens to Firestore live, so any change appears in its read endpoints within seconds.
- **The Catalogue Manager website** (`https://globalautocraft.github.io/Models-Front-End/`) edits the same data. The two UIs share the same Firestore data, so an edit in one shows up in the other.
- **The existing "VEHICLE PHOTO IN FILE DETAILS" code in script.html** (`MI_API`, `miBuildIndex_`, `miFindForRecord_`, `fmShowModelImage_`) already reads `GET /api/models` to show the photo in the file popup. Don't break it. After a successful edit, clear its cache so the new photo shows: `localStorage.removeItem('sfModelImagesV3')`, `miIndex = null`, `miApiTried = false`.
- **Render free plan:** the API sleeps after 15 minutes idle, and the first request after that can take 30–60 seconds. Show a clear "Waking up the catalogue server…" loading state, and set the UrlFetchApp deadline high enough. A 10-minute keep-alive ping (`pingModelsApi`) may already exist in Code.js; reuse it if so.
- **The existing Mapping Master is separate.** The Sales app's own "Mapping Master" catalogue (`getMappingMasterCatalog` / `saveMappingMasterCatalog`, stored in a sheet) is a different catalogue from this API. Don't change, merge or replace it unless I ask. This new screen is only for the Vehicle Images API.

## 2. Data shape (one model)

```json
{
  "id": "iqube",
  "name": "IQUBE",
  "order": 7,
  "active": true,
  "image": "https://...model.jpg",
  "variants": {
    "S 15 Beige (4.7 kWh)": {
      "active": true,
      "image": "https://...variant.jpg",
      "colors": {
        "BLUE":   { "active": true, "image": "https://...blue.jpg" },
        "PURPLE": { "active": true, "image": "" }
      }
    }
  }
}
```

- **Empty images inherit:** an empty `image` means "use the parent's image" (colour → variant → model). The admin endpoint returns raw data, so empty stays empty. Show it as "Uses variant image" / "Uses model image", the way the Catalogue Manager does.
- **Names:** variant and colour names are map keys and can contain `.`, `/`, `(`, `)` and spaces (e.g. `T.GREY`, `W/O`, `S 15 (4.7 kWh)`). Always `encodeURIComponent` them in URLs.
- **Visibility:** `active: false` hides the entry from the public API's `?active=true` and from the file-photo lookup.
- **Order:** `order` sets the model list order.

## 3. Write API (server side only)

Base URL: `https://models-api-y0px.onrender.com/api/admin`

Every request needs:
- the header `x-admin-secret: <secret>`
- `Content-Type: application/json` for bodies

`:model`, `:variant` and `:color` match names case-insensitively, ignoring spaces and punctuation (`:model` also accepts the document `id`). URL-encode them.

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/models` | none | 200 `{ models: [ model, ... ] }` sorted by `order` (raw, with `id`) |
| POST | `/models` | `{ name, image?, active? }` | 201 the new model |
| PATCH | `/models/:model` | any of `{ name, image, active, order }` | 200 the model |
| DELETE | `/models/:model` | none | 200 `{ deleted: true, id, name }` |
| POST | `/models/:model/variants` | `{ name, image?, active? }` | 201 the model |
| PATCH | `/models/:model/variants/:variant` | any of `{ name, image, active }` | 200 the model |
| DELETE | `/models/:model/variants/:variant` | none | 200 the model |
| POST | `/models/:model/variants/:variant/colors` | `{ name, image?, active? }` | 201 the model |
| PATCH | `/models/:model/variants/:variant/colors/:color` | any of `{ name, image, active }` | 200 the model |
| DELETE | `/models/:model/variants/:variant/colors/:color` | none | 200 the model |

- **Request bodies:**
  - `name` is required for creates, at most 100 characters.
  - `image` is an `http(s)://` URL, or `""` to inherit the parent's image.
  - `active` is a boolean.
  - Defaults: `active: true` and `image: ""`.
- **Responses:** every variant/colour write returns the **whole updated model**, so replace that model in your local copy with the response.
- **Renames:** renaming a variant keeps its colours, and renaming a colour keeps its image.
- **Concurrent edits:** writes are Firestore transactions, so two people editing the same model can't overwrite each other.
- **Errors** are always JSON `{ "error": "..." }`:
  - 400: invalid input
  - 401: wrong or missing secret
  - 404: model, variant or colour not found
  - 409: a model, variant or colour with that name already exists
  - 503: server not configured or still starting

## 4. Public read API (no secret, safe in the browser)

- `GET https://models-api-y0px.onrender.com/api/models`: the full catalogue with image fallbacks already applied (`?active=true` hides inactive entries).
- `GET /api/image?model=&variant=&color=` returns `{ model, variant, color, image, matched }`, where `matched` is `model`, `variant` or `color`.
- `GET /api/image/redirect?model=&variant=&color=` is a 302 redirect to the image, usable directly in `<img src>`.

## 5. Rules for the implementation

1. **The secret never reaches the browser.**
   - Store it in Script Properties as `MODELS_API_SECRET`. I set it myself; never write it into code, and never create a function that sets it.
   - Only server-side `.gs` code calls `/api/admin/...`, using `UrlFetchApp`.
   - The browser calls those `.gs` functions through `google.script.run`.
2. **Admins only.**
   - Every server function takes `sessionToken` first and calls `requireSession_(sessionToken)`.
   - Writes are allowed only when `ADMIN_ROLES.indexOf(auth.user.role) !== -1`, the same as `saveMappingMasterCatalog`.
   - Return `{ success: false, message }` on failure and `{ success: true, ... }` on success, the same as the rest of Code.js.
3. **One server helper for all calls.** For example, `modelsAdminFetch_(method, path, body)`:
   - builds the URL from `MODELS_API_URL` (Script Property, default `https://models-api-y0px.onrender.com`) + `/api/admin` + path
   - sends `x-admin-secret`, with `muteHttpExceptions: true`
   - parses the JSON, and turns non-2xx responses into `{ success: false, message: body.error }`
   - retries once after a 503 or a timeout (cold start)
4. **Server functions** (names can follow my conventions):
   - `getVehicleCatalogue(sessionToken)`
   - `addVehicleModel(sessionToken, data)`, `updateVehicleModel(sessionToken, model, changes)`, `deleteVehicleModel(sessionToken, model)`
   - `addVehicleVariant(...)`, `updateVehicleVariant(...)`, `deleteVehicleVariant(...)`
   - `addVehicleColour(...)`, `updateVehicleColour(...)`, `deleteVehicleColour(...)`
5. **Optional audit log:** append who changed what (user email, action, model/variant/colour, time) to a "Catalogue Log" sheet.
6. **The UI**, in my existing design system:
   - **Layout:** a model list on the left with search and All / Active / Inactive filters. On the right, the selected model's variants as cards, each with its colours. It should be usable on mobile.
   - **Each item** shows its image thumbnail (or an "inherited" badge), its name, an Active toggle, Edit and Delete.
   - **Add/Edit forms:** fields for name, image URL with a live preview (falls back to the inherited image when empty), and active.
   - **Delete:** always confirm first, and warn that deleting a variant deletes its colours.
   - **Feedback:** disable buttons while saving, show success/error toasts using the API's error text, and show a loading state for cold starts.
   - **Escaping:** render all names and URLs with escaping (use the existing `escHtml`). Never inject raw HTML from the API.
7. Add the new screen to the sidebar/menu only for `ADMIN_ROLES` users.
8. Don't break or remove anything unrelated.

## 6. When you're done, tell me

1. Which files and functions you added or changed.
2. To add the Script Properties `MODELS_API_URL` and `MODELS_API_SECRET` (the same value as `ADMIN_API_SECRET` on Render).
3. To deploy a new version of the web app.
