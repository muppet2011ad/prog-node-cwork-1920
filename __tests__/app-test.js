/* eslint-disable jest/expect-expect */

const app = require('../app');
const request = require('supertest');

describe('Verify app is responding', () => {
  test('GET /ping', () => {
    return request(app)
      .get('/ping')
      .expect(200);
  });
});
