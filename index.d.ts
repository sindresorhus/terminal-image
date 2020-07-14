/// <reference types="node"/>

declare namespace terminalImage {
	export type RenderFrame = {
		/** Custom handler which is run when the animation playback is stopped. */
		done?: () => void;

		/**
		Custom handler which is run for each frame of the GIF.
		@param text The frame which should be rendered.
		*/
		(text: string): void;
	};
}

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
		width?: number;
		height?: number;
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
			width?: number;
			height?: number;
			preserveAspectRatio?: boolean;
		}>
	) => Promise<string>;

	/**
	Display GIFs in the terminal.

	Optionally, you can specify the height and/or width to scale the image.
	That can be either the percentage of the terminal window or number of rows and/or columns.
	Please note that the image will always be scaled to fit the size of the terminal.
	If width and height are not defined, by default the image will take the width and height of the terminal.
	It is recommended to use the percentage option.
	You can set width and/or height as columns and/or rows of the terminal window as well.
	By default, aspect ratio is always maintained. If you don't want to maintain aspect ratio, set preserveAspectRatio to false.
	Each frame of the GIF is by default printed to the terminal, overwriting the previous one. To change this behavior, set `renderFrame` to a different function. To change the code run when the animation playback is stopped, set `renderFrame.done` to a different function.

	@param imageBuffer - Buffer with the image.
	@param options - Image rendering options.
	@param options.width - Optional: Custom image width. Can be set as percentage or number of columns of the terminal. It is recommended to use the percentage options.
	@param options.height - Optional: Custom image height. Can be set as percentage or number of rows of the terminal. It is recommended to use the percentage options.
	@param options.maximumFrameRate - Optional: Maximum framerate to render the GIF. This option is ignored when using iTerm.
	@param options.renderFrame - Optional: Custom handler which is run for each frame of the GIF.
	@param options.renderFrame.done - Optional: Custom handler which is run when the animation playback is stopped.
	@returns A function that can be called to stop the GIF animation.

	@example
	```
	import terminalImage = require('terminal-image');
	import delay = require('delay');
	const {promises: fs} = require('fs');

	(async () => {
		const gifData = await fs.readFile('unicorn.gif');
		const stopAnimation = terminalImage.gifBuffer(gifData);

		await delay(5000);
		stopAnimation();
	})();
	```
	*/
	gifBuffer: (imageBuffer: Readonly<Buffer>, options?: Readonly<{
		width?: number;
		height?: number;
		maximumFrameRate?: number;
		renderFrame?: terminalImage.RenderFrame;
	}>) => () => void;

	/**
	Display gifs in the terminal.

	Optionally, you can specify the height and/or width to scale the image.
	That can be either the percentage of the terminal window or number of rows and/or columns.
	Please note that the image will always be scaled to fit the size of the terminal.
	If width and height are not defined, by default the image will take the width and height of the terminal.
	It is recommended to use the percentage option.
	You can set width and/or height as columns and/or rows of the terminal window as well.
	By default, aspect ratio is always maintained. If you don't want to maintain aspect ratio, set preserveAspectRatio to false.
	Each frame of the gif is by default logged to the terminal, overwriting the previous one. To change this behaviour, set renderFrame to a different function. To change the code run when the animation playback is stopped, set renderFrame.done to a different function.

	@param imageBuffer - Buffer with the image.
	@param options - Image rendering options.
	@param options.width - Optional: Custom image width. Can be set as percentage or number of columns of the terminal. It is recommended to use the percentage options.
	@param options.height - Optional: Custom image height. Can be set as percentage or number of rows of the terminal. It is recommended to use the percentage options.
	@param options.maximumFrameRate - Optional: Maximum framerate to render the GIF. This option is ignored by iTerm.
	@param options.renderFrame - Optional: Custom handler which is run for each frame of the gif.
	@param options.renderFrame.done - Optional: Custom handler which is run when the animation playback is stopped.
	@returns A function that can be called to stop the gif animation.

	@example
	```
	import terminalImage = require('terminal-image');
	import delay = require('delay');

	(async () => {
		const stopAnimation = terminalImage.gifFile('unicorn.gif');

		await delay(5000);
		stopAnimation();
	})();
	```
	*/
	gifFile: (
		filePath: string,
		options?: Readonly<{
			width?: number;
			height?: number;
			maximumFrameRate?: number;
			renderFrame?: terminalImage.RenderFrame;
		}>
	) => () => void;
};

export = terminalImage;
