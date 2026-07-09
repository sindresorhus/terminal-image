import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Buffer} from 'node:buffer';
import {performance} from 'node:perf_hooks';
import process from 'node:process';
import test, {describe, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {encodeGIF} from '@sindresorhus/gifkit';
import {Jimp} from 'jimp';
import {playGif} from './gif.js';
import terminalImage from './index.js';

const TIMEOUT = 1000;
const isMacOS = process.platform === 'darwin';
const RED_BLUE_PALETTE = [[0, 0, 0], [255, 0, 0], [0, 0, 255], [255, 255, 255]];
const BLACK_WHITE_PALETTE = [[0, 0, 0], [255, 255, 255]];
const GIF_WITH_OUT_OF_RANGE_BACKGROUND_INDEX = Uint8Array.from([
	0x47,
	0x49,
	0x46,
	0x38,
	0x39,
	0x61,
	0x01,
	0x00,
	0x01,
	0x00,
	0x80,
	0x02,
	0x00,
	0x00,
	0x00,
	0x00,
	0xFF,
	0xFF,
	0xFF,
	0x2C,
	0x00,
	0x00,
	0x00,
	0x00,
	0x01,
	0x00,
	0x01,
	0x00,
	0x00,
	0x02,
	0x02,
	0x4C,
	0x01,
	0x00,
	0x3B,
]);
const GIF_WITH_OUT_OF_RANGE_TRANSPARENT_INDEX = Uint8Array.from([
	0x47,
	0x49,
	0x46,
	0x38,
	0x39,
	0x61,
	0x01,
	0x00,
	0x01,
	0x00,
	0x80,
	0x00,
	0x00,
	0x00,
	0x00,
	0x00,
	0xFF,
	0xFF,
	0xFF,
	0x21,
	0xF9,
	0x04,
	0x01,
	0x00,
	0x00,
	0x02,
	0x00,
	0x2C,
	0x00,
	0x00,
	0x00,
	0x00,
	0x01,
	0x00,
	0x01,
	0x00,
	0x00,
	0x02,
	0x02,
	0x44,
	0x01,
	0x00,
	0x3B,
]);

const DISPOSAL_METHODS = ['unspecified', 'keep', 'restoreBackground', 'restorePrevious'];

function createGif({width = 1, height = 1, loop, palette, background, frames}) {
	return Buffer.from(encodeGIF({
		width,
		height,
		...(palette && {globalColorTable: palette}),
		...(background !== undefined && {backgroundColorIndex: background}),
		// The legacy `loop` counts extra plays after the first (`0` means forever); gifkit counts total plays.
		...(loop !== undefined && {playCount: loop === 0 ? 'forever' : loop + 1}),
		blocks: frames.map(frame => ({
			type: 'image',
			left: frame.x ?? 0,
			top: frame.y ?? 0,
			width: frame.width ?? width,
			height: frame.height ?? height,
			pixels: frame.pixels,
			...(frame.palette && {colorTable: frame.palette}),
			graphicControlExtension: {
				// The legacy `delay` is in hundredths of a second; gifkit uses seconds.
				...(frame.delay !== undefined && {delay: frame.delay / 100}),
				...(frame.disposal !== undefined && {disposalMethod: DISPOSAL_METHODS[frame.disposal]}),
				...(frame.transparent !== undefined && {transparentColorIndex: frame.transparent}),
			},
		})),
	}));
}

function withBitmapBuffers(onBitmap) {
	const originalFromBitmap = Jimp.fromBitmap;

	Jimp.fromBitmap = bitmap => onBitmap(Buffer.from(bitmap.data));

	return () => {
		Jimp.fromBitmap = originalFromBitmap;
	};
}

async function waitForGifCompletion(gifData, {onFrame = async () => {}, ...options} = {}) {
	const {promise, resolve, reject} = Promise.withResolvers();
	const timeout = setTimeout(() => {
		reject(new Error('Timed out waiting for GIF completion'));
	}, TIMEOUT);

	playGif(gifData, onFrame, {
		...options,
		onDone() {
			clearTimeout(timeout);
			resolve();
		},
	});

	return promise;
}

async function captureFrames(gifData, {frameCount, ...options} = {}) {
	const frames = [];
	let animation;
	let shouldStopImmediately = false;

	const {promise, resolve, reject} = Promise.withResolvers();
	const timeout = setTimeout(() => {
		reject(new Error('Timed out waiting for GIF frames'));
	}, TIMEOUT);

	const finish = () => {
		clearTimeout(timeout);
		resolve();
	};

	const restoreBitmap = withBitmapBuffers(data => {
		frames.push(data);
		if (frameCount && frames.length === frameCount) {
			if (animation) {
				animation.isPlaying = false;
			} else {
				shouldStopImmediately = true;
			}

			finish();
		}

		return {
			async getBuffer() {
				return Buffer.alloc(0);
			},
		};
	});

	try {
		animation = playGif(gifData, async () => {}, {
			...options,
			onDone() {
				finish();
			},
		});

		if (shouldStopImmediately) {
			animation.isPlaying = false;
		}

		await promise;
	} finally {
		if (animation) {
			animation.isPlaying = false;
		}

		restoreBitmap();
	}

	return frames;
}

function firstRow(frame) {
	return [
		{
			r: frame[0],
			g: frame[1],
			b: frame[2],
			a: frame[3],
		},
		{
			r: frame[4],
			g: frame[5],
			b: frame[6],
			a: frame[7],
		},
		{
			r: frame[8],
			g: frame[9],
			b: frame[10],
			a: frame[11],
		},
	];
}

function firstPixel(frame) {
	return {
		r: frame[0],
		g: frame[1],
		b: frame[2],
		a: frame[3],
	};
}

function firstTwoPixels(frame) {
	return [
		firstPixel(frame),
		{
			r: frame[4],
			g: frame[5],
			b: frame[6],
			a: frame[7],
		},
	];
}

async function execInlineModule(script) {
	const {promise, resolve, reject} = Promise.withResolvers();
	const childProcess = execFile(process.execPath, ['--input-type=module', '-e', script], {
		cwd: process.cwd(),
	}, (error, stdout) => {
		if (error) {
			reject(error);
			return;
		}

		resolve(stdout);
	});

	childProcess.once('error', reject);

	return promise;
}

test('.buffer()', async () => {
	const result = await terminalImage.buffer(fs.readFileSync('fixture.jpg'));
	assert.strictEqual(typeof result, 'string');
});

test('.file()', async () => {
	const result = await terminalImage.file('fixture.jpg');
	assert.strictEqual(typeof result, 'string');
});

test('.gifBuffer()', async () => {
	let result = '';
	const stopAnimation = terminalImage.gifBuffer(fs.readFileSync('fixture.gif'), {
		renderFrame(text) {
			result += text;
		},
	});
	await delay(500);
	stopAnimation();
	assert.strictEqual(typeof result, 'string');
});

test('.gifFile()', async () => {
	let result = '';
	const stopAnimation = terminalImage.gifFile('fixture.gif', {
		renderFrame(text) {
			result += text;
		},
	});
	await delay(500);
	stopAnimation();
	assert.strictEqual(typeof result, 'string');
});

test('.buffer() suppresses the Kitty graphics protocol acknowledgement', async () => {
	// When rendering via the Kitty graphics protocol, every chunk of the control data must
	// include `q=2` so the terminal suppresses its `OK`/error responses. The terminal sends its
	// acknowledgement only after the final chunk, so a missing `q=2` on any chunk leaks replies
	// like `Gi=0;OK` onto the shell as visible text after the program exits.
	const script = `
		process.stdout.isTTY = true;
		process.env.KITTY_WINDOW_ID = '1';
		// Clear any inherited iTerm2 markers so the Kitty path is taken rather than the native iTerm2 one.
		delete process.env.TERM_PROGRAM;
		delete process.env.LC_TERMINAL;
		const fs = await import('node:fs');
		const {default: terminalImage} = await import('./index.js');

		// Capture the emitted escape codes instead of dumping the whole image payload to stdout.
		let captured = '';
		const originalWrite = process.stdout.write.bind(process.stdout);
		process.stdout.write = (chunk, encoding, callback) => {
			captured += chunk;
			(typeof encoding === 'function' ? encoding : callback)?.();
			return true;
		};

		await terminalImage.buffer(fs.readFileSync('fixture.jpg'));

		process.stdout.write = originalWrite;
		// Report each chunk's control data (between '_G' and its first ';'); base64 payloads never contain '_G'.
		const controlSegments = [...captured.matchAll(/_G([^;]*);/g)].map(match => match[1]);
		process.stdout.write(JSON.stringify(controlSegments));
	`;

	const segments = JSON.parse(await execInlineModule(script));

	// The image is sent in multiple chunks; every chunk (including the last, which triggers the
	// terminal's response) must carry `q=2`.
	assert.ok(segments.length > 1);
	const chunksMissingQuiet = segments.filter(segment => !/(?:^|,)q=2(?:,|$)/v.test(segment));
	assert.deepEqual(chunksMissingQuiet, []);
});

test('.buffer() uses the native iTerm2 protocol instead of Kitty in iTerm2 on macOS', async () => {
	// Although iTerm2 reports Kitty support (3.6.1+), it does not render terminal-image's Kitty
	// output, so iTerm2 must use its own native inline-image protocol (OSC 1337) via term-img instead.
	const script = `
		process.stdout.isTTY = true;
		process.env.TERM_PROGRAM = 'iTerm.app';
		process.env.TERM_PROGRAM_VERSION = '3.6.9';
		process.env.KITTY_WINDOW_ID = '1';
		const fs = await import('node:fs');
		const {default: terminalImage} = await import('./index.js');

		let captured = '';
		const originalWrite = process.stdout.write.bind(process.stdout);
		process.stdout.write = (chunk, encoding, callback) => {
			captured += chunk;
			(typeof encoding === 'function' ? encoding : callback)?.();
			return true;
		};

		const result = await terminalImage.buffer(fs.readFileSync('fixture.jpg'));
		process.stdout.write = originalWrite;
		process.stdout.write(captured.includes('_G') ? 'kitty' : result.includes(']1337;File=') ? 'iterm-native' : 'ansi-fallback');
	`;

	assert.equal(await execInlineModule(script), isMacOS ? 'iterm-native' : 'ansi-fallback');
});

describe('.gifBuffer() does not render a late frame after stopAnimation()', () => {
	let originalTermProgram;
	let originalTermProgramVersion;
	let originalKonsoleVersion;

	before(() => {
		originalTermProgram = process.env.TERM_PROGRAM;
		originalTermProgramVersion = process.env.TERM_PROGRAM_VERSION;
		originalKonsoleVersion = process.env.KONSOLE_VERSION;
		delete process.env.TERM_PROGRAM;
		delete process.env.TERM_PROGRAM_VERSION;
		delete process.env.KONSOLE_VERSION;
	});

	after(() => {
		process.env.TERM_PROGRAM = originalTermProgram;
		process.env.TERM_PROGRAM_VERSION = originalTermProgramVersion;
		process.env.KONSOLE_VERSION = originalKonsoleVersion;
	});

	test('does not render a late frame', async () => {
		const gifData = createGif({
			width: 2,
			height: 2,
			loop: 0,
			frames: [
				{
					palette: BLACK_WHITE_PALETTE,
					delay: 10,
					pixels: [1, 1, 1, 1],
				},
			],
		});
		const renderedFrames = [];
		let doneCount = 0;
		const originalBuffer = terminalImage.buffer;

		terminalImage.buffer = async () => {
			await delay(100);
			return 'late-frame';
		};

		const renderFrame = text => {
			renderedFrames.push(text);
		};

		renderFrame.done = () => {
			doneCount++;
		};

		try {
			const stopAnimation = terminalImage.gifBuffer(gifData, {
				maximumFrameRate: Infinity,
				renderFrame,
			});

			await delay(20);
			stopAnimation();
			await delay(120);
		} finally {
			terminalImage.buffer = originalBuffer;
		}

		assert.deepStrictEqual(renderedFrames, []);
		assert.strictEqual(doneCount, 1);
	});
});

test('playGif() honors disposal method 2', async () => {
	const gifData = createGif({
		width: 3,
		height: 2,
		loop: 0,
		frames: [
			{
				palette: RED_BLUE_PALETTE,
				delay: 1,
				pixels: [1, 1, 1, 1, 1, 1],
			},
			{
				width: 1,
				height: 1,
				palette: RED_BLUE_PALETTE,
				delay: 1,
				disposal: 2,
				pixels: [2],
			},
			{
				x: 1,
				width: 1,
				height: 1,
				palette: RED_BLUE_PALETTE,
				delay: 1,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 3,
		maximumFrameRate: Infinity,
	});

	assert.deepStrictEqual(
		firstRow(frames[2]),
		[
			{
				r: 0, g: 0, b: 0, a: 0,
			},
			{
				r: 0, g: 0, b: 255, a: 255,
			},
			{
				r: 255, g: 0, b: 0, a: 255,
			},
		],
	);
});

test('playGif() honors disposal method 3', async () => {
	const gifData = createGif({
		width: 3,
		height: 2,
		loop: 0,
		frames: [
			{
				palette: RED_BLUE_PALETTE,
				delay: 1,
				pixels: [1, 1, 1, 1, 1, 1],
			},
			{
				width: 1,
				height: 1,
				palette: RED_BLUE_PALETTE,
				delay: 1,
				disposal: 3,
				pixels: [2],
			},
			{
				x: 1,
				width: 1,
				height: 1,
				palette: RED_BLUE_PALETTE,
				delay: 1,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 3,
		maximumFrameRate: Infinity,
	});

	assert.deepStrictEqual(
		firstRow(frames[2]),
		[
			{
				r: 255, g: 0, b: 0, a: 255,
			},
			{
				r: 0, g: 0, b: 255, a: 255,
			},
			{
				r: 255, g: 0, b: 0, a: 255,
			},
		],
	);
});

test('playGif() respects finite loop counts', async () => {
	const gifData = createGif({
		loop: 1,
		frames: [
			{
				palette: BLACK_WHITE_PALETTE,
				delay: 1,
				pixels: [0],
			},
			{
				palette: BLACK_WHITE_PALETTE,
				delay: 1,
				pixels: [1],
			},
		],
	});
	let frameCount = 0;

	await waitForGifCompletion(gifData, {
		maximumFrameRate: Infinity,
		async onFrame() {
			frameCount++;
		},
	});

	assert.strictEqual(frameCount, 4);
});

test('playGif() decodes malformed GIFs loosely', async () => {
	let frameCount = 0;

	await waitForGifCompletion(GIF_WITH_OUT_OF_RANGE_BACKGROUND_INDEX, {
		maximumFrameRate: Infinity,
		async onFrame() {
			frameCount++;
		},
	});

	assert.strictEqual(frameCount, 1);
});

test('playGif() renders GIFs with invalid transparent indexes loosely', async () => {
	let frameCount = 0;

	await waitForGifCompletion(GIF_WITH_OUT_OF_RANGE_TRANSPARENT_INDEX, {
		maximumFrameRate: Infinity,
		async onFrame() {
			frameCount++;
		},
	});

	assert.strictEqual(frameCount, 1);
});

test('playGif() resets composited pixels across loop boundaries', async () => {
	const gifData = createGif({
		width: 2,
		height: 1,
		loop: 0,
		frames: [
			{
				width: 1,
				height: 1,
				palette: RED_BLUE_PALETTE,
				delay: 1,
				pixels: [1],
			},
			{
				x: 1,
				width: 1,
				height: 1,
				palette: RED_BLUE_PALETTE,
				delay: 1,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 3,
		maximumFrameRate: Infinity,
	});

	assert.deepStrictEqual(firstTwoPixels(frames[2]), [
		{
			r: 255,
			g: 0,
			b: 0,
			a: 255,
		},
		{
			r: 0,
			g: 0,
			b: 0,
			a: 0,
		},
	]);
});

test('playGif() treats missing loop metadata as a single play', async () => {
	const gifData = createGif({
		frames: [
			{
				palette: BLACK_WHITE_PALETTE,
				delay: 1,
				pixels: [0],
			},
			{
				palette: BLACK_WHITE_PALETTE,
				delay: 1,
				pixels: [1],
			},
		],
	});
	let frameCount = 0;

	await waitForGifCompletion(gifData, {
		maximumFrameRate: Infinity,
		async onFrame() {
			frameCount++;
		},
	});

	assert.strictEqual(frameCount, 2);
});

test('playGif() cancels the in-flight frame timer when stopped', async () => {
	const script = `
		import {Buffer} from 'node:buffer';
		import {encodeGIF} from '@sindresorhus/gifkit';
		import {playGif} from './gif.js';

		const gifData = Buffer.from(encodeGIF({
			width: 1,
			height: 1,
			playCount: 'forever',
			globalColorTable: [[0, 0, 0], [255, 255, 255]],
			blocks: [{
				type: 'image',
				width: 1,
				height: 1,
				pixels: [1],
				graphicControlExtension: {delay: 1},
			}],
		}));

		const startupTimer = setTimeout(() => {}, 10_000);
		let animation;
		let isStopScheduled = false;
		animation = playGif(gifData, async () => {
			clearTimeout(startupTimer);

			if (isStopScheduled) {
				return;
			}

			isStopScheduled = true;
			setTimeout(() => {
				process.stdout.write('stopped' + String.fromCharCode(10));
				animation.isPlaying = false;
			}, 20);
		});
	`;

	const {promise, resolve, reject} = Promise.withResolvers();
	let stopTime;
	const childProcess = execFile(process.execPath, ['--input-type=module', '-e', script], {
		cwd: process.cwd(),
	}, error => {
		if (error) {
			reject(error);
			return;
		}

		if (stopTime === undefined) {
			reject(new Error('The child process exited before stopping the animation.'));
			return;
		}

		resolve(performance.now() - stopTime);
	});

	childProcess.once('error', reject);
	childProcess.stdout.setEncoding('utf8');
	childProcess.stdout.on('data', data => {
		if (stopTime === undefined && data.includes('stopped')) {
			stopTime = performance.now();
		}
	});

	const elapsed = await promise;

	assert.ok(elapsed < 500);
});

test('playGif() does not emit a frame after cancellation during encoding', async () => {
	const gifData = createGif({
		loop: 0,
		frames: [
			{
				palette: BLACK_WHITE_PALETTE,
				delay: 100,
				pixels: [1],
			},
		],
	});
	let frameCount = 0;
	let animation;

	const restoreBitmap = withBitmapBuffers(() => ({
		async getBuffer() {
			await delay(100);
			return Buffer.alloc(0);
		},
	}));

	try {
		animation = playGif(gifData, async () => {
			frameCount++;
		}, {
			maximumFrameRate: Infinity,
		});

		await delay(20);
		animation.isPlaying = false;
		await delay(150);
	} finally {
		if (animation) {
			animation.isPlaying = false;
		}

		restoreBitmap();
	}

	assert.strictEqual(frameCount, 0);
});

test('playGif() does not restart after a frame rendering error', async () => {
	const script = `
		import {Buffer} from 'node:buffer';
		import {encodeGIF} from '@sindresorhus/gifkit';
		import {playGif} from './gif.js';

		const gifData = Buffer.from(encodeGIF({
			width: 1,
			height: 1,
			playCount: 'forever',
			globalColorTable: [[0, 0, 0], [255, 255, 255]],
			blocks: [{
				type: 'image',
				width: 1,
				height: 1,
				pixels: [0],
				graphicControlExtension: {delay: 0.01},
			}],
		}));
		let frameCount = 0;

		process.once('unhandledRejection', error => {
			setTimeout(() => {
				console.log(JSON.stringify({message: error.message, frameCount}));
				process.exit(0);
			}, 50);
		});

		playGif(gifData, async () => {
			frameCount++;
			throw new Error('render failure');
		}, {
			maximumFrameRate: Number.POSITIVE_INFINITY,
		});
	`;

	const stdout = await execInlineModule(script);

	const {message, frameCount} = JSON.parse(stdout.trim());
	assert.strictEqual(message, 'render failure');
	assert.strictEqual(frameCount, 1);
});

test('playGif() does not lock throttled looping playback to one frame', async () => {
	const gifData = createGif({
		loop: 0,
		frames: [
			{
				palette: RED_BLUE_PALETTE,
				delay: 2,
				pixels: [1],
			},
			{
				palette: RED_BLUE_PALETTE,
				delay: 2,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 4,
		maximumFrameRate: 30,
	});
	const colors = new Set(frames.map(frame => JSON.stringify(firstPixel(frame))));
	const expectedColors = new Set([
		JSON.stringify({
			r: 255, g: 0, b: 0, a: 255,
		}),
		JSON.stringify({
			r: 0, g: 0, b: 255, a: 255,
		}),
	]);

	assert.ok(colors.isSupersetOf(expectedColors));
});

test('playGif() does not stall throttled looping playback for 0-delay frames', async () => {
	const gifData = createGif({
		loop: 0,
		frames: [
			{
				palette: RED_BLUE_PALETTE,
				delay: 0,
				pixels: [1],
			},
			{
				palette: RED_BLUE_PALETTE,
				delay: 0,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 4,
		maximumFrameRate: 30,
	});
	const colors = new Set(frames.map(frame => JSON.stringify(firstPixel(frame))));
	const expectedColors = new Set([
		JSON.stringify({
			r: 255, g: 0, b: 0, a: 255,
		}),
		JSON.stringify({
			r: 0, g: 0, b: 255, a: 255,
		}),
	]);

	assert.ok(colors.isSupersetOf(expectedColors));
});

test('playGif() enforces maximumFrameRate before emitting throttled frames', async () => {
	const gifData = createGif({
		loop: 0,
		frames: [
			{
				palette: RED_BLUE_PALETTE,
				delay: 2,
				pixels: [1],
			},
			{
				palette: RED_BLUE_PALETTE,
				delay: 2,
				pixels: [2],
			},
		],
	});
	const frameTimes = [];
	let animation;

	const {promise, resolve, reject} = Promise.withResolvers();
	const timeout = setTimeout(() => {
		reject(new Error('Timed out waiting for GIF frames'));
	}, TIMEOUT);

	try {
		animation = playGif(gifData, async () => {
			frameTimes.push(Date.now());
			if (frameTimes.length !== 4) {
				return;
			}

			animation.isPlaying = false;
			clearTimeout(timeout);
			resolve();
		}, {
			maximumFrameRate: 30,
		});

		await promise;
	} finally {
		if (animation) {
			animation.isPlaying = false;
		}
	}

	assert.ok(frameTimes[3] - frameTimes[0] >= 90);
});

test('playGif() flushes the final frame before completion when throttled', async () => {
	const gifData = createGif({
		frames: [
			{
				palette: RED_BLUE_PALETTE,
				delay: 2,
				pixels: [1],
			},
			{
				palette: RED_BLUE_PALETTE,
				delay: 2,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		maximumFrameRate: 30,
	});

	assert.strictEqual(frames.length, 2);
	assert.deepStrictEqual(firstPixel(frames[1]), {
		r: 0,
		g: 0,
		b: 255,
		a: 255,
	});
});

test('playGif() restores disposal method 2 regions to the GIF background color', async () => {
	const gifData = createGif({
		width: 3,
		palette: RED_BLUE_PALETTE,
		background: 1,
		frames: [
			{
				delay: 1,
				pixels: [1, 1, 1],
			},
			{
				width: 1,
				height: 1,
				delay: 1,
				disposal: 2,
				transparent: 0,
				pixels: [2],
			},
			{
				x: 1,
				width: 1,
				height: 1,
				delay: 1,
				transparent: 0,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 3,
		maximumFrameRate: Infinity,
	});

	assert.deepStrictEqual(firstRow(frames[2]), [
		{
			r: 255,
			g: 0,
			b: 0,
			a: 255,
		},
		{
			r: 0,
			g: 0,
			b: 255,
			a: 255,
		},
		{
			r: 255,
			g: 0,
			b: 0,
			a: 255,
		},
	]);
});

test('playGif() initializes the first frame against the GIF background color', async () => {
	const gifData = createGif({
		width: 3,
		palette: RED_BLUE_PALETTE,
		background: 1,
		frames: [
			{
				x: 1,
				width: 1,
				height: 1,
				delay: 1,
				transparent: 0,
				pixels: [2],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 1,
		maximumFrameRate: Infinity,
	});

	assert.deepStrictEqual(firstRow(frames[0]), [
		{
			r: 255,
			g: 0,
			b: 0,
			a: 255,
		},
		{
			r: 0,
			g: 0,
			b: 255,
			a: 255,
		},
		{
			r: 255,
			g: 0,
			b: 0,
			a: 255,
		},
	]);
});

test('playGif() respects background color from global palette index 0', async () => {
	const palette = [[0, 255, 0], [0, 0, 255], [255, 255, 255], [0, 0, 0]];
	const gifData = createGif({
		width: 3,
		palette,
		frames: [
			{
				x: 1,
				width: 1,
				height: 1,
				delay: 1,
				transparent: 3,
				pixels: [1],
			},
		],
	});
	const frames = await captureFrames(gifData, {
		frameCount: 1,
		maximumFrameRate: Infinity,
	});

	assert.deepStrictEqual(firstRow(frames[0]), [
		{
			r: 0,
			g: 255,
			b: 0,
			a: 255,
		},
		{
			r: 0,
			g: 0,
			b: 255,
			a: 255,
		},
		{
			r: 0,
			g: 255,
			b: 0,
			a: 255,
		},
	]);
});
