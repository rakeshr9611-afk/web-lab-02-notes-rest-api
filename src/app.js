const http = require("node:http");
const { NotesStore } = require("./store");
const { validateNote } = require("./validate");

const MAX_BODY_BYTES = 64 * 1024;

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function send(res, status, data) {
  if (status === 204) {
    res.writeHead(204);
    return res.end();
  }
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const type = req.headers["content-type"] || "";
    if (!type.includes("application/json")) {
      return reject(new HttpError(415, "Content-Type must be application/json."));
    }
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "Request body too large."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        reject(new HttpError(400, "Malformed JSON."));
      }
    });
    req.on("error", reject);
  });
}

function validOrThrow(payload, opts) {
  const { value, errors } = validateNote(payload, opts);
  if (errors) throw new HttpError(422, "Validation failed.", errors);
  return value;
}

/** Route table: [method, regex, handler(ctx)] */
function buildRoutes(store) {
  const findOr404 = (id) => {
    const note = store.get(id);
    if (!note) throw new HttpError(404, `Note ${id} not found.`);
    return note;
  };

  return [
    ["GET", /^\/health$/, () => [200, { status: "ok", uptime: process.uptime() }]],

    ["GET", /^\/api\/notes$/, ({ url }) => {
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
      const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
      const all = store.list({ tag: url.searchParams.get("tag"), q: url.searchParams.get("q") });
      return [200, { data: all.slice(offset, offset + limit), meta: { total: all.length, limit, offset } }];
    }],

    ["POST", /^\/api\/notes$/, async ({ req }) => {
      const value = validOrThrow(await readJson(req));
      return [201, { data: store.create(value) }];
    }],

    ["GET", /^\/api\/notes\/([\w-]+)$/, ({ params }) => [200, { data: findOr404(params[0]) }]],

    ["PUT", /^\/api\/notes\/([\w-]+)$/, async ({ req, params }) => {
      findOr404(params[0]);
      const value = validOrThrow(await readJson(req));
      return [200, { data: store.update(params[0], { body: "", tags: [], ...value }) }];
    }],

    ["PATCH", /^\/api\/notes\/([\w-]+)$/, async ({ req, params }) => {
      findOr404(params[0]);
      const value = validOrThrow(await readJson(req), { partial: true });
      return [200, { data: store.update(params[0], value) }];
    }],

    ["DELETE", /^\/api\/notes\/([\w-]+)$/, ({ params }) => {
      findOr404(params[0]);
      store.delete(params[0]);
      return [204];
    }],
  ];
}

function createApp({ store = new NotesStore(), logger = console } = {}) {
  const routes = buildRoutes(store);

  return http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return send(res, 204);
      }

      const pathMatches = routes.filter(([, re]) => re.test(url.pathname));
      if (!pathMatches.length) throw new HttpError(404, `Route ${url.pathname} not found.`);
      const route = pathMatches.find(([method]) => method === req.method);
      if (!route) {
        res.setHeader("Allow", pathMatches.map(([m]) => m).join(", "));
        throw new HttpError(405, `Method ${req.method} not allowed.`);
      }

      const params = url.pathname.match(route[1]).slice(1);
      const [status, data] = await route[2]({ req, url, params });
      send(res, status, data);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) logger.error(err);
      send(res, status, {
        error: { status, message: status === 500 ? "Internal server error." : err.message, ...(err.details && { details: err.details }) },
      });
    } finally {
      logger.log?.(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
}

module.exports = { createApp, HttpError };
