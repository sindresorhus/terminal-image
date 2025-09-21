import terminalImage from './index.js';
import Table from 'cli-table3';

const table = new Table({head: ['Image', 'Description']});
table.push([await terminalImage.file('fixture.jpg', {width: '100%', isTable: true}), 'Cute Dog'])
console.log(table.toString());
