'use strict';
const { setAdmin } = require('../server');

setAdmin(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD)
  .then(() => console.log('Admin account updated. Existing sessions were signed out.'))
  .catch((error) => { console.error(`Admin account was not updated: ${error.message}`); process.exitCode = 1; });
