'use strict';
const util = require('util');
const fs = require('fs');
const chalk = require('chalk');
const Jimp = require('@sindresorhus/jimp');
const termImg = require('term-img');

const PIXEL = '\u2584';
const readFile = util.promisify(fs.readFile);

function calculateHeightWidth(bitmap, height, width, preserveAspectRatio) {
	if (height === undefined && width === undefined) {
		height = bitmap.height;
		width = bitmap.width;
	} else if (height === undefined) {
		height = preserveAspectRatio ? bitmap.height * width / bitmap.width : bitmap.height;
	} else if (width === undefined) {
		width = preserveAspectRatio ? bitmap.width * height / bitmap.height : bitmap.width;
	}

	height = Math.round(height);
	width = Math.round(width);

	return {height, width};
}

async function render(buffer, {height: inputHeight, width: inputWidth, preserveAspectRatio}) {
	const image = await Jimp.read(buffer);
	const {bitmap} = image;

	const {height, width} = calculateHeightWidth(bitmap, inputHeight, inputWidth, preserveAspectRatio);

	if (height !== bitmap.height || width !== bitmap.width) {
		image.resize(width, height);
	}

	const columns = process.stdout.columns || 80;
	const rows = process.stdout.rows || 24;

	if (width > columns || (height / 2) > rows) {
		image.scaleToFit(columns, rows * 2);
	}

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

exports.buffer = async (buffer, {height, width, preserveAspectRatio = true} = {}) => {
	return termImg.string(buffer, {
		width: width || '100%',
		height: height || '100%',
		fallback: () => render(buffer, {height, width, preserveAspectRatio})
	});
};

exports.file = async (filePath, options = {}) =>
	exports.buffer(await readFile(filePath), options);
