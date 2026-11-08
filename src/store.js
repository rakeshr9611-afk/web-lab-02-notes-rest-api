const { randomUUID } = require("node:crypto");

/** In-memory notes store. Swappable for a DB later — the API only uses these methods. */
class NotesStore {
  constructor() {
    this.notes = new Map();
  }

  list({ tag, q } = {}) {
    let items = [...this.notes.values()];
    if (tag) items = items.filter((n) => n.tags.includes(tag.toLowerCase()));
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((n) => n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle));
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }

  get(id) {
    return this.notes.get(id) ?? null;
  }

  create({ title, body = "", tags = [] }) {
    const now = new Date().toISOString();
    const note = { id: randomUUID(), title, body, tags, createdAt: now, updatedAt: now };
    this.notes.set(note.id, note);
    return note;
  }

  update(id, changes) {
    const existing = this.notes.get(id);
    if (!existing) return null;
    const note = { ...existing, ...changes, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    this.notes.set(id, note);
    return note;
  }

  delete(id) {
    return this.notes.delete(id);
  }
}

module.exports = { NotesStore };
