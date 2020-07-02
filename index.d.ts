/// <reference types="node"/>

declare const terminalImage: {
	/**
	Display images in the terminal.

	Optionally, you can specify the height and/or width to scale the image.
	That can be either the percentage of the terminal window or number of rows and/or columns.
	Please note that the image will always be scaled to fit the size of the terminal.
	If width and height are not defined, by default the image will take the width and height of the terminal.
	It is recommended to use the percentage option.
	You can set width and/or height as columns and/or rows of the terminal window as well.
	By default, aspect ratio is always maintained. If you don't want to maintain aspect ratio, set preserveAspectRatio to false.

	@param imageBuffer - Buffer with the image.
	@param options - Image rendering options.
	@param options.width - Optional: Custom image width. Can be set as percentage or number of columns of the terminal. It is recommended to use the percentage options.
	@param options.height - Optional: Custom image height. Can be set as percentage or number of rows of the terminal. It is recommended to use the percentage options.
	@param options.preserveAspectRatio - Optional: Whether to maintain image aspect ratio or not. Default: true.
	@returns The ansi escape codes to display the image.

	@example
	```
	import terminalImage = require('terminal-image');
	import got = require('got');

	(async () => {
		const body = await got('https://sindresorhus.com/unicorn').buffer();
		console.log(await terminalImage.buffer(body));
		console.log(await terminalImage.buffer(body, {width: '50%', height: '50%'}));
		console.log(await terminalImage.buffer(body, {width: 50 }));
		console.log(await terminalImage.buffer(body, {width: 70, height: 50, preserveAspectRatio: false}));
	})();
	```
	*/
	buffer: (imageBuffer: Readonly<Buffer>, options?: Readonly<{
		width?: string | number;
		height?: string | number;
		preserveAspectRatio?: boolean;
	}>) => Promise<string>;

	/**
	Display images in the terminal. Please note that the image will always be scaled to fit the size of the terminal.

	Optionally, you can specify the height and/or width to scale the image.
	That can be either the percentage of the terminal window or number of rows and/or columns.
	Please note that the image will always be scaled to fit the size of the terminal.
	If width and height are not defined, by default the image will take the width and height of the terminal.
	It is recommended to use the percentage option.
	You can set width and/or height as columns and/or rows of the terminal window as well.
	By default, aspect ratio is always maintained. If you don't want to maintain aspect ratio, set preserveAspectRatio to false.

	@param filePath - File path to the image.
	@param options - Image rendering options.
	@param options.width - Optional: Custom image width. Can be set as percentage or number of columns of the terminal. It is recommended to use the percentage options.
	@param options.height - Optional: Custom image height. Can be set as percentage or number of rows of the terminal. It is recommended to use the percentage options.
	@param options.preserveAspectRatio - Optional: Whether to maintain image aspect ratio or not. Default: true.
	@returns The ANSI escape codes to display the image.

	@example
	```
	const terminalImage = require('terminal-image');

	(async () => {
		console.log(await terminalImage.file('unicorn.jpg'));
		console.log(await terminalImage.file('unicorn.jpg', {width: '50%', height: '50%'}));
		console.log(await terminalImage.file('unicorn.jpg', {width: 50 }));
		console.log(await terminalImage.file('unicorn.jpg', {width: 70, height: 50, preserveAspectRatio: false}));
	})();
	```
	*/
	file: (
		filePath: string,
		options?: Readonly<{
			width?: string | number;
			height?: string | number;
			preserveAspectRatio?: boolean;
		}>
	) => Promise<string>;
};

export = terminalImage;
