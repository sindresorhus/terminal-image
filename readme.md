# terminal-image [![Build Status](https://travis-ci.org/sindresorhus/terminal-image.svg?branch=master)](https://travis-ci.org/sindresorhus/terminal-image)

> Display images in the terminal

Works in any terminal that supports colors.

<img src="screenshot.png" width="1082">

*In iTerm, the image will be [displayed in full resolution](screenshot-iterm.jpg),
since iTerm has [special image support](https://www.iterm2.com/documentation-images.html).*


## Install

```sh
npm install terminal-image
```


## Usage

```js
const terminalImage = require('terminal-image');

(async () => {
	console.log(await terminalImage('unicorn.jpg'));
})();
```

Optionally, you can specify the `height` and/or `width` to scale the image. To
maintain aspect ratio, define only one of them.

```js
const terminalImage = require('terminal-image');

(async () => {
	console.log(await terminalImage('unicorn.jpg', {width: 1024}));
})();
```


## API

Supports PNG and JPEG images.

### terminalImage(fileBuffer, [options])

Returns a `Promise<string>` with the ansi escape codes to display the image.

#### fileBuffer

Type: `Buffer`|`string`

Buffer with the image, or path to the image file.


## Related

- [terminal-image-cli](https://github.com/sindresorhus/terminal-image-cli) - CLI
	for this module
- [terminal-link](https://github.com/sindresorhus/terminal-link) - Create
	clickable links in the terminal
- [chalk](https://github.com/chalk/chalk) - Style and color text in the terminal


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
