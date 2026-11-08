const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

let server;
let base;

before(async () => {
  server = createApp({ logger: { error() {}, log() {} } });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

const json = (method, path, body) =>
  fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("GET /health returns ok", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "ok");
});

test("full CRUD lifecycle", async () => {
  // Create
  let res = await json("POST", "/api/notes", { title: "  First note ", body: "Hello", tags: ["Work", "work", "ideas"] });
  assert.equal(res.status, 201);
  const { data: created } = await res.json();
  assert.equal(created.title, "First note");
  assert.deepEqual(created.tags, ["work", "ideas"]);
  assert.ok(created.id);

  // Read
  res = await fetch(`${base}/api/notes/${created.id}`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.body, "Hello");

  // Patch
  res = await json("PATCH", `/api/notes/${created.id}`, { body: "Updated" });
  assert.equal(res.status, 200);
  const { data: patched } = await res.json();
  assert.equal(patched.body, "Updated");
  assert.equal(patched.title, "First note");
  assert.equal(patched.createdAt, created.createdAt);

  // Put (full replace: omitted fields reset)
  res = await json("PUT", `/api/notes/${created.id}`, { title: "Replaced" });
  const { data: replaced } = await res.json();
  assert.equal(replaced.title, "Replaced");
  assert.equal(replaced.body, "");
  assert.deepEqual(replaced.tags, []);

  // Delete
  res = await fetch(`${base}/api/notes/${created.id}`, { method: "DELETE" });
  assert.equal(res.status, 204);
  res = await fetch(`${base}/api/notes/${created.id}`);
  assert.equal(res.status, 404);
});

test("list supports tag filter, search and pagination", async () => {
  for (let i = 1; i <= 5; i++) {
    await json("POST", "/api/notes", { title: `List ${i}`, body: i % 2 ? "odd one" : "even one", tags: i <= 2 ? ["pin"] : [] });
  }
  let body = await (await fetch(`${base}/api/notes?tag=pin`)).json();
  assert.equal(body.data.length, 2);

  body = await (await fetch(`${base}/api/notes?q=EVEN`)).json();
  assert.equal(body.data.length, 2);

  body = await (await fetch(`${base}/api/notes?limit=2&offset=1`)).json();
  assert.equal(body.data.length, 2);
  assert.equal(body.meta.limit, 2);
  assert.equal(body.meta.offset, 1);
  assert.ok(body.meta.total >= 5);
});

test("validation errors return 422 with details", async () => {
  let res = await json("POST", "/api/notes", { body: "no title", color: "red" });
  assert.equal(res.status, 422);
  const { error } = await res.json();
  assert.equal(error.details.length, 2);

  res = await json("POST", "/api/notes", { title: "ok", tags: "not-an-array" });
  assert.equal(res.status, 422);

  const { data } = await (await json("POST", "/api/notes", { title: "x" })).json();
  res = await json("PATCH", `/api/notes/${data.id}`, {});
  assert.equal(res.status, 422);
});

test("bad requests: malformed JSON, wrong content type, unknown route/method", async () => {
  let res = await fetch(`${base}/api/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{oops" });
  assert.equal(res.status, 400);

  res = await fetch(`${base}/api/notes`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hi" });
  assert.equal(res.status, 415);

  res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);

  res = await fetch(`${base}/api/notes`, { method: "DELETE" });
  assert.equal(res.status, 405);
  assert.match(res.headers.get("allow"), /GET/);

  res = await json("PATCH", "/api/notes/does-not-exist", { title: "x" });
  assert.equal(res.status, 404);
});

test("oversized body is rejected with 413", async () => {
  const res = await json("POST", "/api/notes", { title: "big", body: "x".repeat(70 * 1024) }).catch((e) => e);
  // Server may reset the socket after rejecting; accept either a 413 or a connection error.
  if (res instanceof Error) assert.ok(res);
  else assert.equal(res.status, 413);
});
