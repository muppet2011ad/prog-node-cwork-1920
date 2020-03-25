/* eslint-disable jest/expect-expect */

let app;
const request = require('supertest');
const fs = require('fs');

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
  test('POST /newuser with valid user', () => {
    return request(app)
      .post('/newuser')
      .send({ username: 'test', password: 'secret' })
      .expect(200);
  });
  test('POST /newuser with already taken username', () => {
    return request(app)
      .post('/newuser')
      .send({ username: 'test', password: 'password' })
      .expect(401);
  });
  test('POST /newuser with incomplete user data', () => {
    return request(app)
      .post('/newuser')
      .send({})
      .expect(400);
  });
  test('GET /auth with created user', () => {
    return request(app)
      .get('/auth')
      .auth('test', 'secret')
      .expect('user')
      .expect(200);
  });
  test('GET /auth with admin credentials', () => {
    return request(app)
      .get('/auth')
      .auth('admin', 'password')
      .expect('admin')
      .expect(200);
  });
  test('GET /auth with wholly incorrect credentials', () => {
    return request(app)
      .get('/auth')
      .auth('asdfasdf', 'asdfas')
      .expect(401);
  });
  test('GET /auth with incorrect password', () => {
    return request(app)
      .get('/auth')
      .auth('test', 'password')
      .expect(401);
  });
});

describe('Character creation and deletion', () => {
  beforeAll(() => {
    fs.writeFileSync('./tmp/data/users.json', JSON.stringify([{ Name: 'test', Password: 'password', Chars: [] }]));
  });
  test('POST /api/newchar with new character details', () => {
    return request(app)
      .post('/api/newchar')
      .auth('test', 'password')
      .send({ Name: 'John Smith', Class: 'Fighter', Race: 'Human', Level: 2 })
      .expect(200) // Verifies request completed successfully
      .then(response => {
        const charid = JSON.parse(fs.readFileSync('./tmp/data/users.json'))[0].Chars[0];
        expect(fs.existsSync('./tmp/data/chars/' + charid + '.json')).toBeTruthy();
        expect(fs.readFileSync('./tmp/data/charindex.json').includes(charid)).toBeTruthy();
      });
  });
  test('POST /api/newchar with incomplete character details', () => {
    return request(app)
      .post('/api/newchar')
      .auth('test', 'password')
      .send({ Class: 'Fighter', Race: 'Human', Level: 2 })
      .expect(400);
  });
  test('POST /api/newchar without supplying credentials', () => {
    return request(app)
      .post('/api/newchar')
      .send({ Name: 'John Smith', Class: 'Fighter', Race: 'Human', Level: 2 })
      .expect(401);
  });
});

afterAll(async () => {
  fs.rmdirSync('./tmp/', { recursive: true });
});
