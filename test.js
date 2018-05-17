import fs from 'fs';
import test from 'ava';
import terminalImage from '.';

test('.buffer()', async t => {
	const result = await terminalImage.buffer(fs.readFileSync('fixture.jpg'));
	t.is(typeof result, 'string');
});

test('.file()', async t => {
	const result = await terminalImage.file('fixture.jpg');
	t.is(typeof result, 'string');
});

test('.imageData()', t => {
	const height = 4;
	const width = 4;
	const black = [0, 0, 0, 255];
	const white = [255, 255, 255, 255];
	const pink = [255, 0, 255, 255];
	const data = new Uint8ClampedArray([
		...black, ...white, ...black, ...pink,
		...black, ...white, ...black, ...pink,
		...black, ...white, ...black, ...pink,
		...black, ...white, ...black, ...pink
	]);
	const result = terminalImage.imageData({
		width,
		height,
		data
	});
	t.is(typeof result, 'string');
});
