/* eslint-disable jest/expect-expect */

let app;
const request = require('supertest');
const fs = require('fs');

const usersFile = './tmp/data/users.json';
const charindexFile = './tmp/data/charindex.json';
const spellsFile = './tmp/data/spells.json';
const charDir = './tmp/data/chars/';

beforeAll(() => {
  fs.rmdirSync('./tmp/', { recursive: true });
  app = require('../app');
});

describe('Verify app is responding', () => {
  test('GET /ping', () => {
    return request(app)
      .get('/ping')
      .expect(200);
  });
});

describe('Test user creation and subsequent authentication', () => {
  test('POST /newuser with valid user succeeds', () => {
    return request(app)
      .post('/newuser')
      .send({ username: 'test', password: 'secret' })
      .expect(200);
  });
  test('POST /newuser with already taken username fails with 401', () => {
    return request(app)
      .post('/newuser')
      .send({ username: 'test', password: 'password' })
      .expect(401);
  });
  test('POST /newuser with incomplete user data fails with 400', () => {
    return request(app)
      .post('/newuser')
      .send({})
      .expect(400);
  });
  test('GET /auth with created user succeeds', () => {
    return request(app)
      .get('/auth')
      .auth('test', 'secret')
      .expect('user')
      .expect(200);
  });
  test('GET /auth with admin credentials succeeds', () => {
    return request(app)
      .get('/auth')
      .auth('admin', 'password')
      .expect('admin')
      .expect(200);
  });
  test('GET /auth with wholly incorrect credentials fails with 401', () => {
    return request(app)
      .get('/auth')
      .auth('asdfasdf', 'asdfas')
      .expect(401);
  });
  test('GET /auth with incorrect password fails with 401', () => {
    return request(app)
      .get('/auth')
      .auth('test', 'password')
      .expect(401);
  });
});

describe('Character creation and deletion', () => {
  beforeEach(() => {
    fs.writeFileSync(usersFile, JSON.stringify([{ Name: 'test', Password: 'password', Chars: [] }]));
    fs.writeFileSync(charindexFile, '[]');
  });
  test('POST /api/newchar with new character details succeeds', () => {
    return request(app)
      .post('/api/newchar')
      .auth('test', 'password')
      .send({ Name: 'John Smith', Class: 'Fighter', Race: 'Human', Level: 2 })
      .expect(200) // Verifies request completed successfully
      .then(response => {
        const charid = JSON.parse(fs.readFileSync('./tmp/data/users.json'))[0].Chars[0];
        expect(fs.existsSync(charDir + charid + '.json')).toBeTruthy();
        expect(fs.readFileSync(charindexFile).includes(charid)).toBeTruthy();
      });
  });
  test('POST /api/newchar with incomplete character details fails with 400', () => {
    return request(app)
      .post('/api/newchar')
      .auth('test', 'password')
      .send({ Class: 'Fighter', Race: 'Human', Level: 2 })
      .expect(400);
  });
  test('POST /api/newchar without supplying credentials fails with 401', () => {
    return request(app)
      .post('/api/newchar')
      .send({ Name: 'John Smith', Class: 'Fighter', Race: 'Human', Level: 2 })
      .expect(401);
  });
  test('POST /api/delchar with existing character succeeds', () => {
    fs.writeFileSync(charindexFile, JSON.stringify([{ Id: '123', Name: 'test' }]));
    fs.writeFileSync(usersFile, JSON.stringify([{ Name: 'test', Password: 'password', Chars: ['123'] }]));
    fs.writeFileSync(charDir + '123.json', JSON.stringify({ Id: '123', Name: 'test' })); // I haven't filled in all of the character information but it shouldn't make any difference
    return request(app)
      .post('/api/delchar')
      .auth('test', 'password')
      .send({ Id: '123' })
      .expect(200)
      .then(() => {
        expect(fs.existsSync(charDir + '123.json')).toBeFalsy();
        expect(JSON.parse(fs.readFileSync(usersFile))[0].Chars).toEqual([]);
        expect(JSON.parse(fs.readFileSync(charindexFile))).toEqual([]);
      });
  });
  test('POST /api/delchar with non-existent character fails with 401', () => {
    return request(app)
      .post('/api/delchar')
      .auth('test', 'password')
      .send({ Id: '124' })
      .expect(401);
  });
  test('POST /api/delchar without authorisation files with 401', () => {
    return request(app)
      .post('/api/delchar')
      .send({ Id: '123' })
      .expect(401);
  });
});

afterAll(async () => {
  fs.rmdirSync('./tmp/', { recursive: true });
});
