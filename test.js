import fs from 'fs';
import delay from 'delay';
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

test('.gifBuffer()', async t => {
	let result = '';
	const stopAnimation = terminalImage.gifBuffer(fs.readFileSync('fixture.gif'), {
		updateLog: text => {
			result += text;
		}
	});
	await delay(500);
	stopAnimation();
	t.is(typeof result, 'string');
});

test('.gifFile()', async t => {
	let result = '';
	const stopAnimation = terminalImage.gifFile('fixture.gif', {
		updateLog: text => {
			result += text;
		}
	});
	await delay(500);
	stopAnimation();
	t.is(typeof result, 'string');
});
