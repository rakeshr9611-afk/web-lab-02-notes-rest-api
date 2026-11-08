/**
 * Validates a note payload. `partial` = true for PATCH (all fields optional).
 * Returns { value } on success or { errors: [...] } on failure.
 */
function validateNote(input, { partial = false } = {}) {
  const errors = [];
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { errors: ["Body must be a JSON object."] };
  }

  const allowed = ["title", "body", "tags"];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) errors.push(`Unknown field "${key}".`);
  }

  const value = {};

  if (input.title !== undefined || !partial) {
    if (typeof input.title !== "string" || !input.title.trim()) errors.push('"title" is required and must be a non-empty string.');
    else if (input.title.trim().length > 200) errors.push('"title" must be 200 characters or fewer.');
    else value.title = input.title.trim();
  }

  if (input.body !== undefined) {
    if (typeof input.body !== "string") errors.push('"body" must be a string.');
    else if (input.body.length > 10_000) errors.push('"body" must be 10,000 characters or fewer.');
    else value.body = input.body;
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || !input.tags.every((t) => typeof t === "string" && t.trim())) {
      errors.push('"tags" must be an array of non-empty strings.');
    } else if (input.tags.length > 10) {
      errors.push('"tags" can contain at most 10 items.');
    } else {
      value.tags = [...new Set(input.tags.map((t) => t.trim().toLowerCase()))];
    }
  }

  if (partial && Object.keys(input).length === 0) errors.push("Provide at least one field to update.");

  return errors.length ? { errors } : { value };
}

module.exports = { validateNote };
