# terminal-image [![Build Status](https://travis-ci.org/sindresorhus/terminal-image.svg?branch=master)](https://travis-ci.org/sindresorhus/terminal-image)

> Display images in the terminal

Works in any terminal that supports colors.

<img src="screenshot.png" width="1082">

*In iTerm, the image will be [displayed in full resolution](screenshot-iterm.jpg), since iTerm has [special image support](https://www.iterm2.com/documentation-images.html).*


## Install

```
$ npm install terminal-image
```


## Usage

```js
const terminalImage = require('terminal-image');

(async () => {
	console.log(await terminalImage.file('unicorn.jpg'));
})();
```

Optionally, you can specify the `height` and/or `width` to scale the image. That can be either the percentage of the terminal window or number of rows and/or columns. Please note that the image will always be scaled to fit the size of the terminal. If width and height are not defined, by default the image will take the width and height of the terminal.

It is recommended to use the percentage option.

```js
const terminalImage = require('terminal-image');

(async () => {
	console.log(await terminalImage.file('unicorn.jpg', {width: '50%', height: '50%'}));
})();
```

You can set width and/or height as columns and/or rows of the terminal window as well.
```js
const terminalImage = require('terminal-image');

(async () => {
	console.log(await terminalImage.file('unicorn.jpg', {width: 50 }));
})();
```

By default, aspect ratio is always maintained. If you don't want to maintain aspect ratio, set `preserveAspectRatio` to false. However, your image will be scaled to fit the size of the terminal.

```js
const terminalImage = require('terminal-image');

(async () => {
	console.log(await terminalImage.file('unicorn.jpg', {width: 70, height: 50, preserveAspectRatio: false}));
})();
```

## API

Supports PNG and JPEG images.

### terminalImage.buffer(imageBuffer)

Returns a `Promise<string>` with the ansi escape codes to display the image.

#### imageBuffer

Type: `Buffer`

Buffer with the image.

### terminalImage.file(filePath)

Returns a `Promise<string>` with the ansi escape codes to display the image.

#### filePath

Type: `string`

File path to the image.


## Tip

### Display a remote image

```js
const terminalImage = require('terminal-image');
const got = require('got');

(async () => {
	const {body} = await got('sindresorhus.com/unicorn', {encoding: null});
	console.log(await terminalImage.buffer(body));
})();
```


## Related

- [terminal-image-cli](https://github.com/sindresorhus/terminal-image-cli) - CLI for this module
- [terminal-link](https://github.com/sindresorhus/terminal-link) - Create clickable links in the terminal
- [chalk](https://github.com/chalk/chalk) - Style and color text in the terminal


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
