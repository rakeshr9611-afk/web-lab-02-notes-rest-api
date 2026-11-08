const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const server = createApp();

server.listen(PORT, () => {
  console.log(`Notes API listening on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
