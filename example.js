'use strict';
const terminalImage = require('.');

(async () => {
	console.log(await terminalImage.file('fixture.jpg'));
})();
