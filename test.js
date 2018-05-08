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
