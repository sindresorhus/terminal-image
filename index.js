'use strict';
const util = require('util');
const fs = require('fs');
const chalk = require('chalk');
const Jimp = require('@sindresorhus/jimp');
const termImg = require('term-img');

const PIXEL = '\u2584';
const readFile = util.promisify(fs.readFile);
const toArray = require('stream-to-array');
const request = require('request');

async function render(buffer) {
	const image = await Jimp.read(buffer);
	const columns = process.stdout.columns || 80;
	const rows = process.stdout.rows || 24;

	if (image.bitmap.width > columns || (image.bitmap.height / 2) > rows) {
		image.scaleToFit(columns, rows * 2);
	}

	let ret = '';
	for (let y = 0; y < image.bitmap.height - 1; y += 2) {
		for (let x = 0; x < image.bitmap.width; x++) {
			const {r, g, b, a} = Jimp.intToRGBA(image.getPixelColor(x, y));
			const {r: r2, g: g2, b: b2} = Jimp.intToRGBA(image.getPixelColor(x, y + 1));

			if (a === 0) {
				ret += chalk.reset(' ');
			} else {
				ret += chalk.bgRgb(r, g, b).rgb(r2, g2, b2)(PIXEL);
			}
		}

		ret += '\n';
	}

	return ret;
}

exports.buffer = async buffer => {
	return termImg.string(buffer, {
		width: '100%',
		height: '100%',
		fallback: () => render(buffer)
	});
};

const getImgFromUrl = async url => {
	const imgBuffParts = await toArray(request.get(url));
	const buffers = imgBuffParts.map(part => Buffer.isBuffer(part) ? part : Buffer.from(part));
	return Buffer.concat(buffers);
};

exports.file = async filePath => exports.buffer(await readFile(filePath));
exports.url = async url => exports.buffer(await getImgFromUrl(url));
