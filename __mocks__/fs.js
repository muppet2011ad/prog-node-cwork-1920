// Manual jest mock for the fs module so that we don't actually end up writing any data to disk whilst testing

// Methods used by server.js:
//  existsSync
//  writeFileSync
//  writeFile
//  unlink
//  readFile
//  readFileSync

// eslint-disable-next-line no-undef
const fs = jest.genMockFromModule('fs');

const mockFileSystem = {};

function existsSync (path) {
  return mockFileSystem[path] !== undefined;
}

function writeFileSync (path, data) {
  mockFileSystem[path] = data;
}

function writeFile (path, data, encoding, callback) {
  mockFileSystem[path] = data;
  callback();
}

function unlink (path, callback) {
  mockFileSystem[path] = undefined;
  callback();
}

function readFileSync (path) {
  return mockFileSystem[path];
}

function readFile (path, encoding, callback) {
  const data = mockFileSystem[path];
  callback();
  return data;
}

fs.existsSync = existsSync;
fs.writeFileSync = writeFileSync;
fs.writeFile = writeFile;
fs.unlink = unlink;
fs.readFileSync = readFileSync;
fs.readFile = readFile;

module.exports = fs;
