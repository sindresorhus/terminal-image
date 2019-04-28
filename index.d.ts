/// <reference types="node"/>

declare const terminalImage: {
	/**
	Display images in the terminal.

	@param imageBuffer - Buffer with the image.
	@returns The ansi escape codes to display the image.

	@example
	```
	import terminalImage = require('terminal-image');
	import got = require('got');

	(async () => {
		const {body} = await got('sindresorhus.com/unicorn', {encoding: null});
		console.log(await terminalImage.buffer(body));
	})();
	```
	*/
	buffer(imageBuffer: Buffer): Promise<string>;

	/**
	Display images in the terminal.

	@param filePath - File path to the image.
	@returns The ansi escape codes to display the image.

	@example
	```
	import terminalImage = require('terminal-image');

	(async () => {
		console.log(await terminalImage.file('unicorn.jpg'));
	})();
	```
	*/
	file(filePath: string): Promise<string>;
}

export = terminalImage;
