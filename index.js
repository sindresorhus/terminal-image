'use strict';

const Jimp = require('@sindresorhus/jimp');
const chalk = require('chalk');
const {string: termImg} = require('term-img');
const terminalCharWidth = require('terminal-char-width');

const CHAR_HEIGHT = 16;
const CHAR_WIDTH = CHAR_HEIGHT * terminalCharWidth;

/**
 * Check if two colors are equal
 *
 * Both has `alpha=0`, or `alpha>0` and equl all the other color values
 *
 * @returns {Boolean} colors are equal
 */
function equalColor({r, g, b, a}, {r: r2, g: g2, b: b2, a: a2}) {
	if (a === 0 && a2 === 0) {
		return true;
	}

	return a > 0 && a2 > 0 && r === r2 && g === g2 && b === b2;
}

function getBgColor({r, g, b, a}) {
	// Full transparent
	if (a === 0) {
		return chalk.reset;
	}

	return chalk.bgRgb(r, g, b);
}

function getFgColor({r, g, b}) {
	return chalk.rgb(r, g, b);
}

function getGlyph(upper, lower) {
	if (upper.a) {
		if (lower && equalColor(upper, lower)) {
			return '█';
		}

		return '▀';
	}

	if (lower && lower.a) {
		return '▄';
	}

	return ' ';
}

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

	height = Math.round(height);
	width = Math.round(width);

	if (height !== bitmap.height || width !== bitmap.width) {
		image.resize(width, height);
	}

	const ret = new Array(Math.ceil(bitmap.height / 2));
	for (let y = 0; y < bitmap.height - 1; y += 2) {
		let row = '';
		let prevFgColor = Jimp.intToRGBA(image.getPixelColor(0, y));
		let prevBgColor = Jimp.intToRGBA(image.getPixelColor(0, y + 1));
		let buffer = getGlyph(prevFgColor, prevBgColor);

		for (let x = 1; x < bitmap.width; x++) {
			let fgColor = Jimp.intToRGBA(image.getPixelColor(x, y));
			let bgColor = Jimp.intToRGBA(image.getPixelColor(x, y + 1));
			const glyph = getGlyph(fgColor, bgColor);

			// Special case where upper pixel is full transparent but lower one not,
			// set foreground color to the lower pixel one and set background as
			// transparent since we are drawing a lower half block
			if (fgColor.a === 0 && bgColor.a > 0) {
				fgColor = bgColor;
				bgColor = {a: 0};
			}

			// TODO optimization: check foreground and background independently and
			// also the case of upper block full transparent
			if (equalColor(prevFgColor, fgColor) && equalColor(prevBgColor, bgColor)) {
				buffer += glyph;
				continue;
			}

			row += getBgColor(prevBgColor)(getFgColor(prevFgColor)(buffer));

			prevFgColor = fgColor;
			prevBgColor = bgColor;
			buffer = glyph;
		}

		ret[y / 2] = row + getBgColor(prevBgColor)(getFgColor(prevFgColor)(buffer));
	}

	// Image has an odd number of rows
	if (height % 2) {
		const y = height - 1;

		let row = '';
		let prevFgColor = Jimp.intToRGBA(image.getPixelColor(0, y));
		let buffer = getGlyph(prevFgColor);

		for (let x = 1; x < bitmap.width; x++) {
			const fgColor = Jimp.intToRGBA(image.getPixelColor(x, y));
			const glyph = getGlyph(fgColor);

			if (equalColor(prevFgColor, fgColor)) {
				buffer += glyph;
				continue;
			}

			row += getFgColor(prevFgColor)(buffer);

			prevFgColor = fgColor;
			buffer = glyph;
		}

		ret[y / 2] = row + getFgColor(prevFgColor)(buffer);
	}

	return ret.join('\n');
}

module.exports = function (fileBuffer, {height, width} = {}) {
	function fallback() {
		return render(fileBuffer, {height, width});
	}

	return termImg(fileBuffer, {fallback, height, width});
};
