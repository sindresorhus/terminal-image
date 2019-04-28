import {expectType} from 'tsd';
import terminalImage = require('.');

expectType<Promise<string>>(terminalImage.file('unicorn.jpg'));
expectType<Promise<string>>(terminalImage.buffer(Buffer.alloc(1)));
