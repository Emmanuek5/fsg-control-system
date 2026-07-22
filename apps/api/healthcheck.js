/** Docker HEALTHCHECK — exit 0 when the API is accepting HTTP. */
const port = process.env.PORT || 4000;
const req = require('http').get(`http://127.0.0.1:${port}/api/health`, (res) => {
  res.resume();
  process.exit(res.statusCode && res.statusCode < 500 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.setTimeout(4000, () => {
  req.destroy();
  process.exit(1);
});
