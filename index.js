'use strict';
const util = require('util');
const fs = require('fs');
const chalk = require('chalk');
const Jimp = require('jimp');
const termImg = require('term-img');
const decodeGif = require('decode-gif');
const logUpdate = require('log-update');
const Cycled = require('cycled');
const delay = require('delay');
const debounceFunction = require('debounce-fn');

const PIXEL = '\u2584';
const readFile = util.promisify(fs.readFile);

function scale(width, height, originalWidth, originalHeight) {
	const originalRatio = originalWidth / originalHeight;
	const factor = (width / height > originalRatio ? height / originalHeight : width / originalWidth);
	width = factor * originalWidth;
	height = factor * originalHeight;
	return {width, height};
}

function checkAndGetDimensionValue(value, percentageBase) {
	if (typeof value === 'string' && value.endsWith('%')) {
		const percentageValue = Number.parseFloat(value);
		if (!Number.isNaN(percentageValue) && percentageValue > 0 && percentageValue <= 100) {
			return Math.floor(percentageValue / 100 * percentageBase);
		}
	}

	if (typeof value === 'number') {
		return value;
	}

	throw new Error(`${value} is not a valid dimension value`);
}

function calculateWidthHeight(imageWidth, imageHeight, inputWidth, inputHeight, preserveAspectRatio) {
	const terminalColumns = process.stdout.columns - 2 || 80;
	const terminalRows = process.stdout.rows - 2 || 24;

	let width;
	let height;

	if (inputHeight && inputWidth) {
		width = checkAndGetDimensionValue(inputWidth, terminalColumns);
		height = checkAndGetDimensionValue(inputHeight, terminalRows) * 2;

		if (preserveAspectRatio) {
			({width, height} = scale(width, height, imageWidth, imageHeight));
		}
	} else if (inputWidth) {
		width = checkAndGetDimensionValue(inputWidth, terminalColumns);
		height = imageHeight * width / imageWidth;
	} else if (inputHeight) {
		height = checkAndGetDimensionValue(inputHeight, terminalRows) * 2;
		width = imageWidth * height / imageHeight;
	} else {
		({width, height} = scale(terminalColumns, terminalRows * 2, imageWidth, imageHeight));
	}

	if (width > terminalColumns) {
		({width, height} = scale(terminalColumns, terminalRows * 2, width, height));
	}

	width = Math.round(width);
	height = Math.round(height);

	return {width, height};
}

async function render(buffer, {width: inputWidth, height: inputHeight, preserveAspectRatio}) {
	const image = await Jimp.read(buffer);
	const {bitmap} = image;

	const {width, height} = calculateWidthHeight(bitmap.width, bitmap.height, inputWidth, inputHeight, preserveAspectRatio);

	image.resize(width, height);

	let result = '';
	for (let y = 0; y < image.bitmap.height - 1; y += 2) {
		for (let x = 0; x < image.bitmap.width; x++) {
			const {r, g, b, a} = Jimp.intToRGBA(image.getPixelColor(x, y));
			const {r: r2, g: g2, b: b2} = Jimp.intToRGBA(image.getPixelColor(x, y + 1));

			if (a === 0) {
				result += chalk.reset(' ');
			} else {
				result += chalk.bgRgb(r, g, b).rgb(r2, g2, b2)(PIXEL);
			}
		}

		result += '\n';
	}

	return result;
}

function renderGif(buffer, options = {}) {
	const {width, height, frames: gifFrames} = decodeGif(buffer);

	let image;
	const renderGifFrame = async ({data, width, height}) => {
		if (!image) {
			image = await Jimp.create(width, height);
		}

		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				const dataIndex = (y * width * 4) + (x * 4);
				if (!(data[dataIndex] === 0 && data[dataIndex + 1] === 0 && data[dataIndex + 2] === 0 && data[dataIndex + 3] === 0)) {
					image.setPixelColour(Jimp.rgbaToInt(data[dataIndex], data[dataIndex + 1], data[dataIndex + 2], data[dataIndex + 3]), x, y);
				}
			}
		}

		return image.getBufferAsync(Jimp.MIME_PNG);
	};

	const frames = new Cycled(gifFrames);
	let continueAnimation = true;
	let animateFrame = async () => {
		options.updateLog(await exports.buffer(await renderGifFrame({data: frames.current().data, width, height}), options));
		await delay(frames.current().timeCode - frames.previous().timeCode);
		frames.step(2);
		if (continueAnimation) {
			await animateFrame();
		}
	};

	if (options.maximumFramerate) {
		animateFrame = debounceFunction(animateFrame, {wait: 1000 / options.maximumFramerate});
	}

	animateFrame();

	return () => {
		continueAnimation = false;
		if (options.updateLog.done) {
			options.updateLog.done();
		}
	};
}

exports.buffer = async (buffer, {width = '100%', height = '100%', preserveAspectRatio = true} = {}) => {
	return termImg.string(buffer, {
		width,
		height,
		fallback: () => render(buffer, {height, width, preserveAspectRatio})
	});
};

exports.file = async (filePath, options = {}) => exports.buffer(await readFile(filePath), options);

exports.gifBuffer = (buffer, options = {}) => {
	options = {
		updateLog: logUpdate,
		...options
	};

	const result = termImg.string(buffer, {
		width: options.width,
		height: options.height,
		fallback: () => false
	});

	if (result) {
		options.updateLog(result);
		return () => {};
	}

	return renderGif(buffer, options);
};

exports.gifFile = (filePath, options = {}) => exports.gifBuffer(fs.readFileSync(filePath), options);
