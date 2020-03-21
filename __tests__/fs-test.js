// eslint-disable-next-line no-undef
jest.mock('fs');

const fs = require('fs');

describe('writeFileSync and readFileSync', () => {
  test('Write string to a file then read', () => {
    fs.writeFileSync('test', 'Hello World');
    expect(fs.readFileSync('test')).toEqual('Hello World');
  });
  test('Writing string to a different file doesn\'t overwrite prior test but is still stored', () => {
    fs.writeFileSync('test2', 'Hello There');
    expect(fs.readFileSync('test')).toEqual('Hello World');
    expect(fs.readFileSync('test2')).toEqual('Hello There');
  });
});

describe('writeFile and readFile', () => {
  test('Write string to a file then read', () => {
    fs.writeFile('test', 'Hello World', 'utf-8', () => {});
    expect(fs.readFile('test', 'utf-8', () => {})).toEqual('Hello World');
  });
  test('Writing string to a different file doesn\'t overwrite prior test but is still stored', () => {
    fs.writeFile('test2', 'Hello There', 'utf-8', () => {});
    expect(fs.readFile('test', 'utf-8', () => {})).toEqual('Hello World');
    expect(fs.readFile('test2', 'utf-8', () => {})).toEqual('Hello There');
  });
});

describe('existsSync', () => {
  test('Successfully identifies existing file', () => {
    expect(fs.existsSync('test')).toEqual(true);
  });
  test('Successfully idenifies non-existent file', () => {
    expect(fs.existsSync('honeybadger')).toEqual(false);
  });
});

describe('unlink', () => {
  test('Delete file', () => {
    fs.writeFileSync('test', 'Hello World');
    expect(fs.existsSync('test')).toEqual(true);
    fs.unlink('test', () => {});
    expect(fs.existsSync('test')).toEqual(false);
  });
});
