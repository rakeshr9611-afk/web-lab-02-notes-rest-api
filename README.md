# Web Lab 02 — Notes REST API

A RESTful JSON API for notes, built with **Node.js core modules only** (`node:http`, `node:crypto`, `node:test`): zero dependencies.

## Objectives

- Design resource-oriented REST endpoints with correct **HTTP methods and status codes**
- Write a small **router** and JSON body parser by hand to understand what frameworks do
- **Validate input** and return consistent, structured error responses
- Support **filtering, search and pagination**
- Write **integration tests** that start a real server on a random port

## Run it

Requires Node 18+.

```bash
npm start            # http://localhost:3000
PORT=4000 npm start  # custom port
npm run dev          # restart on file changes
npm test             # run the test suite
```

## Endpoints

| Method | Path | Description | Success |
|---|---|---|---|
| GET | `/health` | Health check | 200 |
| GET | `/api/notes` | List notes (`?q=`, `?tag=`, `?limit=`, `?offset=`) | 200 |
| POST | `/api/notes` | Create a note | 201 |
| GET | `/api/notes/:id` | Get one note | 200 |
| PUT | `/api/notes/:id` | Replace a note (omitted fields reset) | 200 |
| PATCH | `/api/notes/:id` | Partially update a note | 200 |
| DELETE | `/api/notes/:id` | Delete a note | 204 |

### Note shape

```json
{
  "id": "2f1c…",
  "title": "Groceries",
  "body": "Milk, eggs",
  "tags": ["home"],
  "createdAt": "2026-11-08T10:00:00.000Z",
  "updatedAt": "2026-11-08T10:00:00.000Z"
}
```

Validation rules: `title` is required (1–200 chars), `body` up to 10,000 chars, `tags` up to 10 strings (lower-cased, de-duplicated). Unknown fields are rejected.

### Errors

Every error uses the same shape:

```json
{ "error": { "status": 422, "message": "Validation failed.", "details": ["\"title\" is required and must be a non-empty string."] } }
```

| Status | When |
|---|---|
| 400 | Malformed JSON |
| 404 | Unknown route or note id |
| 405 | Method not allowed (with `Allow` header) |
| 413 | Body larger than 64 KB |
| 415 | `Content-Type` is not `application/json` |
| 422 | Validation failed |
| 500 | Unexpected error (details hidden from client) |

## Try it with curl

```bash
curl -s -X POST localhost:3000/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"First note","body":"Hello","tags":["work"]}'

curl -s 'localhost:3000/api/notes?tag=work&limit=5'

curl -s -X PATCH localhost:3000/api/notes/<id> \
  -H 'Content-Type: application/json' -d '{"body":"Updated"}'

curl -s -X DELETE localhost:3000/api/notes/<id> -i
```

## Project structure

```
src/server.js     Entry point, graceful shutdown
src/app.js        HTTP server, router, JSON parsing, error handling, CORS
src/validate.js   Payload validation (full and partial)
src/store.js      In-memory data store (swappable for a database)
tests/api.test.js Integration tests using fetch against a live server
```

## What I learned

- What Express-style frameworks do under the hood: routing, body parsing, error middleware.
- The difference between **PUT** (replace) and **PATCH** (partial update).
- Using the right status codes (201, 204, 404 vs 405, 415, 422) makes an API easier to use.
- Starting the server on port `0` gives each test run a free port, so tests never collide.
