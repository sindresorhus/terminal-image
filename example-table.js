import Table from 'cli-table3';
import terminalImage from './index.js';

const table = new Table({head: ['Image', 'Description']});
table.push([await terminalImage.file('fixture.jpg', {width: '100%', disableNativeRender: true}), 'Cute Dog']);
console.log(table.toString());
