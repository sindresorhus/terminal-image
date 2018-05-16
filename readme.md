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
