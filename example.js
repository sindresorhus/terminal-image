#!/usr/bin/env node

'use strict';
const terminalImage = require('.');

(async () => {
	console.log(await terminalImage('fixture.jpg'));
})();
