import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import test from 'ava';
import {GifWriter} from 'omggif';
import {Jimp} from 'jimp';
import {playGif} from './gif.js';
import terminalImage from './index.js';

const TIMEOUT = 1000;
const SMALL_BUFFER_SIZE = 4096;
const RED_BLUE_PALETTE = [0x00_00_00, 0xFF_00_00, 0x00_00_FF, 0xFF_FF_FF];
const BLACK_WHITE_PALETTE = [0x00_00_00, 0xFF_FF_FF];

function createGif({width = 1, height = 1, loop, palette, background, frames}) {
	const buffer = Buffer.alloc(SMALL_BUFFER_SIZE);
	const writer = new GifWriter(buffer, width, height, {
		...(palette ? {palette} : {}),
		...(background === undefined ? {} : {background}),
		...(loop === undefined ? {} : {loop}),
	});

	for (const frame of frames) {
		writer.addFrame(frame.x ?? 0, frame.y ?? 0, frame.width ?? width, frame.height ?? height, Buffer.from(frame.pixels), {
			palette: frame.palette,
			delay: frame.delay,
			disposal: frame.disposal,
			transparent: frame.transparent,
		});
	}

	return buffer.subarray(0, writer.end());
}

function withBitmapBuffers(onBitmap) {
	const originalFromBitmap = Jimp.fromBitmap;

	Jimp.fromBitmap = bitmap => onBitmap(Buffer.from(bitmap.data));

	return () => {
		Jimp.fromBitmap = originalFromBitmap;
	};
}

async function waitForGifCompletion(gifData, {onFrame = async () => {}, ...options} = {}) {
	return new Promise((resolve, reject) => {
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
	});
}

async function captureFrames(gifData, {frameCount, ...options} = {}) {
	const frames = [];
	let animation;
	let finish;
	let shouldStopImmediately = false;

	const restoreBitmap = withBitmapBuffers(data => {
		frames.push(data);
		if (frameCount && frames.length === frameCount) {
			if (animation) {
				animation.isPlaying = false;
			} else {
				shouldStopImmediately = true;
			}

			finish?.();
		}

		return {
			async getBuffer() {
				return Buffer.alloc(0);
			},
		};
	});

	try {
		await new Promise((resolve, reject) => {
			finish = () => {
				clearTimeout(timeout);
				resolve();
			};

			const timeout = setTimeout(() => {
				reject(new Error('Timed out waiting for GIF frames'));
			}, TIMEOUT);

			animation = playGif(gifData, async () => {}, {
				...options,
				onDone() {
					finish();
				},
			});

			if (shouldStopImmediately) {
				animation.isPlaying = false;
			}
		});
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

async function execInlineModule(script) {
	return new Promise((resolve, reject) => {
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
	});
}

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
		renderFrame(text) {
			result += text;
		},
	});
	await delay(500);
	stopAnimation();
	t.is(typeof result, 'string');
});

test('.gifFile()', async t => {
	let result = '';
	const stopAnimation = terminalImage.gifFile('fixture.gif', {
		renderFrame(text) {
			result += text;
		},
	});
	await delay(500);
	stopAnimation();
	t.is(typeof result, 'string');
});

test.serial('.gifBuffer() does not render a late frame after stopAnimation()', async t => {
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
	const originalTermProgram = process.env.TERM_PROGRAM;
	const originalTermProgramVersion = process.env.TERM_PROGRAM_VERSION;
	const originalKonsoleVersion = process.env.KONSOLE_VERSION;

	terminalImage.buffer = async () => {
		await delay(100);
		return 'late-frame';
	};

	delete process.env.TERM_PROGRAM;
	delete process.env.TERM_PROGRAM_VERSION;
	delete process.env.KONSOLE_VERSION;

	const renderFrame = text => {
		renderedFrames.push(text);
	};

	renderFrame.done = () => {
		doneCount++;
	};

	try {
		const stopAnimation = terminalImage.gifBuffer(gifData, {
			maximumFrameRate: Number.POSITIVE_INFINITY,
			renderFrame,
		});

		await delay(20);
		stopAnimation();
		await delay(120);
	} finally {
		terminalImage.buffer = originalBuffer;
		process.env.TERM_PROGRAM = originalTermProgram;
		process.env.TERM_PROGRAM_VERSION = originalTermProgramVersion;
		process.env.KONSOLE_VERSION = originalKonsoleVersion;
	}

	t.deepEqual(renderedFrames, []);
	t.is(doneCount, 1);
});

test.serial('playGif() honors disposal method 2', async t => {
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
		maximumFrameRate: Number.POSITIVE_INFINITY,
	});

	t.deepEqual(
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

test.serial('playGif() honors disposal method 3', async t => {
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
		maximumFrameRate: Number.POSITIVE_INFINITY,
	});

	t.deepEqual(
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

test.serial('playGif() respects finite loop counts', async t => {
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
		maximumFrameRate: Number.POSITIVE_INFINITY,
		async onFrame() {
			frameCount++;
		},
	});

	t.is(frameCount, 4);
});

test.serial('playGif() treats missing loop metadata as a single play', async t => {
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
		maximumFrameRate: Number.POSITIVE_INFINITY,
		async onFrame() {
			frameCount++;
		},
	});

	t.is(frameCount, 2);
});

test.serial('playGif() cancels the in-flight frame timer when stopped', async t => {
	const script = `
		import {Buffer} from 'node:buffer';
		import {setTimeout as delay} from 'node:timers/promises';
		import {GifWriter} from 'omggif';
		import {playGif} from './gif.js';

		const buffer = Buffer.alloc(4096);
		const writer = new GifWriter(buffer, 1, 1, {loop: 0});
		const palette = [0x000000, 0xFFFFFF];
		writer.addFrame(0, 0, 1, 1, Buffer.from([1]), {palette, delay: 100});
		const gifData = buffer.subarray(0, writer.end());
		const animation = playGif(gifData, async () => {});

		await delay(20);
		animation.isPlaying = false;
	`;

	const start = Date.now();

	await execInlineModule(script);

	t.true(Date.now() - start < 500);
});

test.serial('playGif() does not emit a frame after cancellation during encoding', async t => {
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
			maximumFrameRate: Number.POSITIVE_INFINITY,
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

	t.is(frameCount, 0);
});

test.serial('playGif() does not restart after a frame rendering error', async t => {
	const script = `
		import {Buffer} from 'node:buffer';
		import {GifWriter} from 'omggif';
		import {playGif} from './gif.js';

		const buffer = Buffer.alloc(4096);
		const writer = new GifWriter(buffer, 1, 1, {loop: 0});
		const palette = [0x000000, 0xFFFFFF];
		writer.addFrame(0, 0, 1, 1, Buffer.from([0]), {palette, delay: 1});

		const gifData = buffer.subarray(0, writer.end());
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
	t.is(message, 'render failure');
	t.is(frameCount, 1);
});

test.serial('playGif() does not lock throttled looping playback to one frame', async t => {
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

	t.true(colors.has(JSON.stringify({
		r: 255,
		g: 0,
		b: 0,
		a: 255,
	})));
	t.true(colors.has(JSON.stringify({
		r: 0,
		g: 0,
		b: 255,
		a: 255,
	})));
});

test.serial('playGif() does not stall throttled looping playback for 0-delay frames', async t => {
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

	t.true(colors.has(JSON.stringify({
		r: 255,
		g: 0,
		b: 0,
		a: 255,
	})));
	t.true(colors.has(JSON.stringify({
		r: 0,
		g: 0,
		b: 255,
		a: 255,
	})));
});

test.serial('playGif() enforces maximumFrameRate before emitting throttled frames', async t => {
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

	try {
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Timed out waiting for GIF frames'));
			}, TIMEOUT);

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
		});
	} finally {
		if (animation) {
			animation.isPlaying = false;
		}
	}

	t.true(frameTimes[3] - frameTimes[0] >= 90);
});

test.serial('playGif() flushes the final frame before completion when throttled', async t => {
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

	t.is(frames.length, 2);
	t.deepEqual(firstPixel(frames[1]), {
		r: 0,
		g: 0,
		b: 255,
		a: 255,
	});
});

test.serial('playGif() restores disposal method 2 regions to the GIF background color', async t => {
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
		maximumFrameRate: Number.POSITIVE_INFINITY,
	});

	t.deepEqual(firstRow(frames[2]), [
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

test.serial('playGif() initializes the first frame against the GIF background color', async t => {
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
		maximumFrameRate: Number.POSITIVE_INFINITY,
	});

	t.deepEqual(firstRow(frames[0]), [
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

test.serial('playGif() respects background color from global palette index 0', async t => {
	const palette = [0x00_FF_00, 0x00_00_FF, 0xFF_FF_FF, 0x00_00_00];
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
		maximumFrameRate: Number.POSITIVE_INFINITY,
	});

	t.deepEqual(firstRow(frames[0]), [
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
