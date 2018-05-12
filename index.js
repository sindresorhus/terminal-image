'use strict';

const Jimp = require('@sindresorhus/jimp');
const chalk = require('chalk');
const {string: termImg} = require('term-img');

function asPercent(value) {
	return `${Math.round(value * 100)}%`;
}

async function render(fileBuffer, {factor}) {
	const image = await Jimp.read(fileBuffer);
	const columns = process.stdout.columns || 80;
	const rows = process.stdout.rows || 24;

	if (image.bitmap.width > columns || (image.bitmap.height / 2) > rows) {
		image.scaleToFit(columns * factor, rows * 2 * factor);
	}

	let ret = '';
	let y = 0;
	while (y < bitmap.height - 1) {
		for (let x = 0; x < bitmap.width; x++) {
			const {r, g, b, a} = Jimp.intToRGBA(image.getPixelColor(x, y));
			const {r: r2, g: g2, b: b2, a: a2} = Jimp.intToRGBA(image.getPixelColor(x, y + 1));

			// Both pixels are full transparent
			if (a === 0 && a2 === 0)
				ret += chalk.reset(' ');

			// Both pixels has the same color
			else if (r === r2 && g === g2 && b === b2)
				ret += chalk.rgb(r, g, b)('█');

			// Pixels has different colors
			else
				ret += chalk.rgb(r, g, b).bgRgb(r2, g2, b2)('▀');
		}

		ret += '\n';
		y += 2;
	}

	// Image has an odd number of rows
	if (y === bitmap.height - 1) {
		for (let x = 0; x < bitmap.width; x++) {
			const {r, g, b, a} = Jimp.intToRGBA(image.getPixelColor(x, y));

			ret += chalk.rgb(r, g, b)('▀');
		}
	}

	return ret;
}

module.exports = (fileBuffer, {factor=1}={}) => {
	return termImg(fileBuffer, {
		width: asPercent(factor),
		height: asPercent(factor),
		fallback: () => render(fileBuffer, {factor})
	});
};
