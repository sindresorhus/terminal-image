'use strict';

const Jimp = require('@sindresorhus/jimp');
const chalk = require('chalk');
const {string: termImg} = require('term-img');
const terminalCharWidth = require('terminal-char-width');

const CHAR_HEIGHT = 16;
const CHAR_WIDTH = CHAR_HEIGHT * terminalCharWidth;

async function render(fileBuffer, {height, width}) {
	const image = await Jimp.read(fileBuffer);
	const {bitmap} = image;

	if (height === undefined && width === undefined) {
		height = bitmap.height / CHAR_HEIGHT;
		width = bitmap.width / CHAR_WIDTH;
	} else if (height === undefined) {
		height = bitmap.height * terminalCharWidth * width / bitmap.width;
	} else {
		width = bitmap.width / terminalCharWidth * height / bitmap.height;
	}

	// Each character has two vertical blocks, so we double the number of rows
	height *= 2;

	if (height !== bitmap.height || width !== bitmap.width) {
		image.resize(width, height);
	}

	let ret = '';
	let y = 0;
	while (y < bitmap.height - 1) {
		for (let x = 0; x < bitmap.width; x++) {
			const {r, g, b, a} = Jimp.intToRGBA(image.getPixelColor(x, y));
			const {r: r2, g: g2, b: b2, a: a2} = Jimp.intToRGBA(image.getPixelColor(x, y + 1));

			if (a === 0 && a2 === 0) {
				// Both pixels are full transparent
				ret += chalk.reset(' ');
			} else if (r === r2 && g === g2 && b === b2) {
				// Both pixels has the same color
				ret += chalk.rgb(r, g, b)('█');
			} else {
				// Pixels has different colors
				ret += chalk.rgb(r, g, b).bgRgb(r2, g2, b2)('▀');
			}
		}

		ret += '\n';
		y += 2;
	}

	// Image has an odd number of rows
	if (y === bitmap.height - 1) {
		for (let x = 0; x < bitmap.width; x++) {
			const {r, g, b} = Jimp.intToRGBA(image.getPixelColor(x, y));

			ret += chalk.rgb(r, g, b)('▀');
		}
	}

	return ret;
}

module.exports = function (fileBuffer, {height, width} = {}) {
	function fallback() {
		return render(fileBuffer, {height, width});
	}

	return termImg(fileBuffer, {fallback, height, width});
};
