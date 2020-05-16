import {expectType} from 'tsd';
import terminalImage = require('.');

expectType<Promise<string>>(terminalImage.file('unicorn.jpg'));
expectType<Promise<string>>(terminalImage.buffer(Buffer.alloc(1)));
expectType<() => void>(terminalImage.gifFile('unicorn.gif'));
expectType<() => void>(terminalImage.gifBuffer(Buffer.alloc(1)));
