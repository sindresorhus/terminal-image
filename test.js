import fs from 'fs';
import test from 'ava';
import terminalImage from '.';

test('.buffer()', async t => {
	const result = await terminalImage(fs.readFileSync('fixture.jpg'));
	t.is(typeof result, 'string');
	t.is(result.length, 339459);
});

test('.file()', async t => {
	const result = await terminalImage('fixture.jpg');
	t.is(typeof result, 'string');
	t.is(result.length, 339459);
});
