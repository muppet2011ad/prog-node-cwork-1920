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

afterAll(() => {
  fs.rmdirSync('./tmp/', { recursive: true });
});
