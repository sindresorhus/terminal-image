import {Buffer} from 'node:buffer';
import {setTimeout as delay} from 'node:timers/promises';
import {Jimp} from 'jimp';
import {decodeGIF, renderGIFFrameSequence} from '@sindresorhus/gifkit';

const MINIMUM_FRAME_DURATION = 10;

function effectiveFrameDuration(frameMs) {
	if (frameMs === 0) {
		return MINIMUM_FRAME_DURATION;
	}

	return frameMs;
}

export function playGif(data, onFrame, {maximumFrameRate = Infinity, onDone} = {}) {
	const gif = decodeGIF(data, {strict: false});
	const {
		width: canvasWidth,
		height: canvasHeight,
	} = gif;
	const minInterval = 1000 / maximumFrameRate;

	let isPlaying = true;
	let delayAbortController;
	let loopPromise;

	const renderFrame = async frame => {
		const image = Jimp.fromBitmap({
			data: Buffer.from(frame.pixels),
			width: canvasWidth,
			height: canvasHeight,
		});
		const png = await image.getBuffer('image/png');

		if (!isPlaying) {
			return false;
		}

		await onFrame(png);
		return isPlaying;
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
		await Promise.resolve();
		if (!isPlaying) {
			return;
		}

		const frameIterator = renderGIFFrameSequence(gif, {
			background: 'gif',
			strict: false,
		});
		const firstFrameResult = frameIterator.next();

		if (firstFrameResult.done) {
			isPlaying = false;
			await onDone?.();
			return;
		}

		let elapsedSinceRender = 0;
		let lastRenderTime;
		let isNeedsInitialRender = true;
		let frame = firstFrameResult.value;

		while (isPlaying) {
			delayAbortController = new AbortController();

			const frameMs = frame.delay * 1000;
			const throttledFrameMs = effectiveFrameDuration(frameMs);
			let isRenderedFrame = false;
			const shouldRenderFrame = minInterval === 0
				|| isNeedsInitialRender
				|| elapsedSinceRender + throttledFrameMs >= minInterval;

			try {
				if (shouldRenderFrame) {
					if (!await waitForFrameRateLimit(lastRenderTime)) { // eslint-disable-line no-await-in-loop
						break;
					}

					isRenderedFrame = await renderFrame(frame); // eslint-disable-line no-await-in-loop
					if (!isPlaying) {
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

			({elapsedSinceRender, needsInitialRender: isNeedsInitialRender} = updateElapsedSinceRender({
				elapsedSinceRender,
				needsInitialRender: isNeedsInitialRender,
				renderedFrame: isRenderedFrame,
				throttledFrameMs,
			}));

			const nextFrameResult = frameIterator.next();
			if (!nextFrameResult.done) {
				frame = nextFrameResult.value;
				continue;
			}

			if (!isRenderedFrame) {
				await renderFrame(frame); // eslint-disable-line no-await-in-loop
			}

			isPlaying = false;
			await onDone?.(); // eslint-disable-line no-await-in-loop
			break;
		}
	};

	const start = () => {
		loopPromise = (async () => {
			try {
				await loop();
			} catch (error) {
				isPlaying = false;
				throw error;
			} finally {
				loopPromise = undefined;
			}
		})();
	};

	start();

	return {
		get isPlaying() {
			return isPlaying;
		},
		set isPlaying(value) {
			const wasPlaying = isPlaying;
			isPlaying = value;
			if (!value) {
				delayAbortController?.abort();
			} else if (!wasPlaying && !loopPromise) {
				start();
			}
		},
	};
}
