'use strict';
const terminalImage = require('.');

(async () => {
	console.log(await terminalImage.file('fixture.jpg'));
	console.log(await terminalImage.url('https://upload.wikimedia.org/wikipedia/commons/a/a4/Google_garage.JPG'));
})();
