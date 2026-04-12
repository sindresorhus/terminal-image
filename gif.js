import {Buffer} from 'node:buffer';
import {setTimeout as delay} from 'node:timers/promises';
import {Jimp} from 'jimp';
import {GifReader} from 'omggif';

const MINIMUM_FRAME_DURATION = 10;

function effectiveFrameDuration(frameMs) {
	if (frameMs === 0) {
		return MINIMUM_FRAME_DURATION;
	}

	return frameMs;
}

function getBackgroundColor(data) {
	const packedFields = data[10];
	const hasGlobalPalette = packedFields >= 128;
	const backgroundIndex = data[11];

	if (!hasGlobalPalette) {
		return [0, 0, 0, 0];
	}

	const paletteOffset = 13 + (backgroundIndex * 3);
	return [
		data[paletteOffset],
		data[paletteOffset + 1],
		data[paletteOffset + 2],
		255,
	];
}

export function playGif(data, onFrame, {maximumFrameRate = Infinity, onDone} = {}) {
	const reader = new GifReader(data);
	const {width, height} = reader;
	const frameCount = reader.numFrames();
	const loopCount = reader.loopCount();
	const minInterval = 1000 / maximumFrameRate;
	const totalLoops = loopCount === 0 ? Number.POSITIVE_INFINITY : (loopCount ?? 0) + 1;
	const backgroundColor = getBackgroundColor(data);
	const fullFrame = {
		x: 0,
		y: 0,
		width,
		height,
	};

	let playing = true;
	let delayAbortController;
	let loopPromise;

	const fillFrame = (canvas, frameInfo, color) => {
		const {x, y, width: frameWidth, height: frameHeight} = frameInfo;
		const [red, green, blue, alpha] = color;

		for (let row = y; row < y + frameHeight; row++) {
			for (let column = x; column < x + frameWidth; column++) {
				const offset = ((row * width) + column) * 4;
				canvas[offset] = red;
				canvas[offset + 1] = green;
				canvas[offset + 2] = blue;
				canvas[offset + 3] = alpha;
			}
		}
	};

	const restoreBackground = (canvas, frameInfo) => {
		fillFrame(canvas, frameInfo, backgroundColor);
	};

	const disposePreviousFrame = (canvas, previousFrameInfo, previousCanvas) => {
		if (!previousFrameInfo) {
			return;
		}

		if (previousFrameInfo.disposal === 2) {
			restoreBackground(canvas, previousFrameInfo);
		} else if (previousFrameInfo.disposal === 3 && previousCanvas) {
			previousCanvas.copy(canvas);
		}
	};

	const renderFrame = async canvas => {
		const image = Jimp.fromBitmap({data: Buffer.from(canvas), width, height});
		const png = await image.getBuffer('image/png');

		if (!playing) {
			return false;
		}

		await onFrame(png);
		return playing;
	};

	const waitForDelay = async milliseconds => {
		try {
			await delay(milliseconds, undefined, {signal: delayAbortController.signal});
			return true;
		} catch (error) {
			if (!delayAbortController.signal.aborted) {
				throw error;
			}

			return false;
		}
	};

	const waitForFrameRateLimit = async lastRenderTime => {
		if (lastRenderTime === undefined || minInterval === 0) {
			return true;
		}

		const remainingFrameTime = minInterval - (Date.now() - lastRenderTime);
		if (remainingFrameTime <= 0) {
			return true;
		}

		return waitForDelay(remainingFrameTime);
	};

	const updateElapsedSinceRender = ({elapsedSinceRender, needsInitialRender, renderedFrame, throttledFrameMs}) => {
		if (minInterval === 0) {
			return {
				elapsedSinceRender: 0,
				needsInitialRender: false,
			};
		}

		if (needsInitialRender) {
			return {
				elapsedSinceRender: throttledFrameMs,
				needsInitialRender: false,
			};
		}

		if (renderedFrame) {
			return {
				elapsedSinceRender: (elapsedSinceRender + throttledFrameMs) % minInterval,
				needsInitialRender: false,
			};
		}

		return {
			elapsedSinceRender: elapsedSinceRender + throttledFrameMs,
			needsInitialRender: false,
		};
	};

	const loop = async () => {
		// Persistent canvas so transparent pixels in later frames reveal previous frame content.
		const canvas = Buffer.alloc(width * height * 4);
		restoreBackground(canvas, fullFrame);
		let completedLoops = 0;
		let elapsedSinceRender = 0;
		let lastRenderTime;
		let needsInitialRender = true;
		let previousFrameInfo;
		let previousCanvas;

		for (let frameIndex = 0; playing;) {
			disposePreviousFrame(canvas, previousFrameInfo, previousCanvas);
			previousFrameInfo = reader.frameInfo(frameIndex);
			previousCanvas = previousFrameInfo.disposal === 3 ? Buffer.from(canvas) : undefined;

			// Always blit to keep compositing state correct, even for skipped frames.
			reader.decodeAndBlitFrameRGBA(frameIndex, canvas);
			delayAbortController = new AbortController();

			const frameMs = previousFrameInfo.delay * 10;
			const throttledFrameMs = effectiveFrameDuration(frameMs);
			let renderedFrame = false;
			const shouldRenderFrame = minInterval === 0
				|| needsInitialRender
				|| elapsedSinceRender + throttledFrameMs >= minInterval;

			try {
				if (shouldRenderFrame) {
					if (!await waitForFrameRateLimit(lastRenderTime)) { // eslint-disable-line no-await-in-loop
						break;
					}

					renderedFrame = await renderFrame(canvas); // eslint-disable-line no-await-in-loop
					if (!playing) {
						break;
					}

					lastRenderTime = Date.now();
				}

				if (!await waitForDelay(Math.max(0, frameMs))) { // eslint-disable-line no-await-in-loop
					break;
				}
			} finally {
				delayAbortController = undefined;
			}

			({elapsedSinceRender, needsInitialRender} = updateElapsedSinceRender({
				elapsedSinceRender,
				needsInitialRender,
				renderedFrame,
				throttledFrameMs,
			}));

			frameIndex++;
			if (frameIndex < frameCount) {
				continue;
			}

			completedLoops++;
			if (completedLoops >= totalLoops) {
				if (!renderedFrame) {
					await renderFrame(canvas); // eslint-disable-line no-await-in-loop
				}

				playing = false;
				await onDone?.(); // eslint-disable-line no-await-in-loop
				break;
			}

			frameIndex = 0;
		}
	};

	const start = () => {
		loopPromise = (async () => {
			try {
				await loop();
			} catch (error) {
				playing = false;
				throw error;
			} finally {
				loopPromise = undefined;
			}
		})();
	};

	start();

	return {
		get isPlaying() {
			return playing;
		},
		set isPlaying(value) {
			const wasPlaying = playing;
			playing = value;
			if (!value) {
				delayAbortController?.abort();
			} else if (!wasPlaying && !loopPromise) {
				start();
			}
		},
	};
}
