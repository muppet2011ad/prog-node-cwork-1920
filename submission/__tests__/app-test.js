/* eslint-disable jest/expect-expect */

let app;
const request = require('supertest');
const fs = require('fs');

const usersFile = './tmp/data/users.json';
const charindexFile = './tmp/data/charindex.json';
const spellsFile = './tmp/data/spells.json';
const charDir = './tmp/data/chars/'; // Set constants for where we store files

beforeAll(() => {
  if (process.env.NODE_ENV !== 'test') { // In order for the server to be in testing mode, we need to make sure the appropriate environment variable is set
    process.env.NODE_ENV = 'test';
  }
  fs.rmdirSync('./tmp/', { recursive: true }); // Remove anything in /tmp (this should be done already but we do it here in case the last test crashed)
  app = require('../app'); // Load in the app
});

describe('Verify app is responding', () => { // This test suite just checks everything is working before moving on
  test('GET /ping', () => {
    return request(app)
      .get('/ping')
      .expect(200);
  });
});

describe('Test user creation and subsequent authentication', () => { // Tests for /auth and /api/newuser
  beforeEach(() => {
    writeObject(usersFile, [{ Name: 'taken', Password: 'secret', chars: [] }]); // Reset the users file to a known user before each test
  });
  test('POST /newuser with valid user succeeds', () => { // Verify we can make a user
    return request(app)
      .post('/newuser')
      .send({ username: 'test', password: 'secret' })
      .expect(200) // We expect the request to succeed
      .then(() => {
        expect(readObject(usersFile)[1]).toEqual({ Name: 'test', Password: 'secret', Chars: [] }); // Afterwards check that the user actually exists
      });
  });
  test('POST /newuser with already taken username fails with 403', () => {
    return request(app)
      .post('/newuser')
      .send({ username: 'taken', password: 'password' })
      .expect(403);
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
      .auth('taken', 'secret')
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

describe('Character creation and deletion', () => { // Test for /api/newchar and /api/delchar
  beforeEach(() => {
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: [] }]); // We need to have a user available to start interacting with characters
    writeObject(charindexFile, []); // Also write a blank charindex (we do this each test just in case a failed test corrupts the file)
  });
  test('POST /api/newchar with new character details succeeds', () => {
    return request(app)
      .post('/api/newchar')
      .auth('test', 'password')
      .send({ Name: 'John Smith', Class: 'Fighter', Race: 'Human', Level: 2 })
      .expect(200) // Verifies request completed successfully
      .then(response => {
        const charid = JSON.parse(fs.readFileSync('./tmp/data/users.json'))[0].Chars[0]; // Get the id of the character from file
        expect(charid).toEqual(response.text); // Check it's equal to what the request gave us
        expect(fs.existsSync(charDir + charid + '.json')).toBeTruthy(); // Verify that the file has been written
        expect(fs.readFileSync(charindexFile).includes(charid)).toBeTruthy(); // Verify that an entry for the new character exists in the index
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
    writeObject(charindexFile, [{ Id: '123', Name: 'test' }]);
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: ['123'] }]); // Fill in a sampel character
    writeObject(charDir + '123.json', { Id: '123', Name: 'test' }); // I haven't filled in all of the character information but it shouldn't make any difference
    return request(app)
      .post('/api/delchar')
      .auth('test', 'password')
      .send({ Id: '123' })
      .expect(200) // The request should complete successfully
      .then(() => {
        expect(fs.existsSync(charDir + '123.json')).toBeFalsy(); // The character file should be deleted
        expect(readObject(usersFile)[0].Chars).toEqual([]); // The user shouldn't have any characters anymore
        expect(readObject(charindexFile)).toEqual([]); // The character shouldn't exist in the index
      });
  });
  test('POST /api/delchar with non-existent character fails with 400', () => {
    return request(app)
      .post('/api/delchar')
      .auth('test', 'password')
      .send({ Id: '124' })
      .expect(400);
  });
  test('POST /api/delchar without authorisation files with 401', () => {
    return request(app)
      .post('/api/delchar')
      .send({ Id: '123' })
      .expect(401);
  });
});

describe('Character editing', () => {
  beforeEach(() => {
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: ['1'] }, { Name: 'test2', Password: 'password', Chars: ['2'] }]); // Write some sample users
    writeObject(charindexFile, [{ Id: '1', Name: 'char1' }, { Id: '2', Name: 'char2' }]); // Two characters exist in the index
    writeObject(charDir + '1.json', { Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] });
    writeObject(charDir + '2.json', { Id: '2', Name: 'char2', Level: 2, Class: 'Wizard', Race: 'Human', Spells: ['spell1', 'spell4'] }); // Write files for both characters
  });
  test('POST /api/editchar to change all but character name and spells succeeds', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Id: '1', Level: 2, Class: 'Monk', Race: 'Dwarf' })
      .expect(200)
      .then(() => {
        // Verifies that the changes are actually written to disk
        expect(readObject(charDir + '1.json')).toEqual({ Id: '1', Name: 'char1', Level: 2, Class: 'Monk', Race: 'Dwarf', Spells: [] });
      });
  });
  test('POST /api/editchar to change character name succeeds', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Id: '1', Name: 'John Smith' })
      .expect(200)
      .then(() => {
        expect(readObject(charDir + '1.json').Name).toEqual('John Smith');
        expect(readObject(charindexFile)[0].Name).toEqual('John Smith'); // When changing the name, we also have to check the change applies to the index
      });
  });
  test('POST /api/editchar to change spells succeeds', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test2', 'password')
      .send({ Id: '2', Spells: [['spell2', 'spell3'], ['spell1', 'spell4']] })
      .expect(200)
      .then(() => {
        expect(readObject(charDir + '2.json').Spells).toEqual(['spell2', 'spell3']);
      });
  });
  test('POST /api/editchar to another user\'s character fails with 403', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Id: '2', Class: 'Fighter' })
      .expect(403);
  });
  test('POST /api/editchar without character id fails with 400', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Class: 'Fighter' })
      .expect(400);
  });
  test('POST /api/editchar with invalid spell changes fails with 400', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Id: '1', Spells: ['spell1'] })
      .expect(400);
  });
  test('POST /api/editchar with non-existent character fails with 400', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Id: '3', Class: 'Fighter' })
      .expect(400);
  });
});

describe('Character searching/fetching', () => {
  beforeAll(() => { // We write out this data only once since a GET request shouldn't change the content
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: ['1', '3'] }, { Name: 'test2', Password: 'password', Chars: ['2'] }]);
    writeObject(charindexFile, [{ Id: '1', Name: 'char1' }, { Id: '2', Name: 'char2' }, { Id: '3', Name: 'char3' }]);
    writeObject(charDir + '1.json', { Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] });
    writeObject(charDir + '3.json', { Id: '3', Name: 'char3', Level: 1, Class: 'Ranger', Race: 'Elf', Spells: ['spell1'] });
    writeObject(charDir + '2.json', { Id: '2', Name: 'char2', Level: 2, Class: 'Wizard', Race: 'Human', Spells: ['spell1', 'spell4'] }); // Write out some sample data
  });
  test('GET /api/characters with no query returns all characters for the user', () => {
    return request(app)
      .get('/api/characters')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8') // We're getting JSON back so it's best to check that the server sets the content type
      .expect(JSON.stringify([{ Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] }, { Id: '3', Name: 'char3', Level: 1, Class: 'Ranger', Race: 'Elf', Spells: ['spell1'] }]));
  });
  test('GET /api/characters querying by name succeeds', () => {
    return request(app)
      .get('/api/characters?name=char1')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] }]));
  });
  test('GET /api/characters querying by id succeeds', () => {
    return request(app)
      .get('/api/characters?id=1')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] }]));
  });
  test('GET /api/characters querying id of another user\'s character fails with 403', () => {
    return request(app)
      .get('/api/characters?id=2')
      .auth('test', 'password')
      .expect(403);
  });
  test('GET /api/characters querying an invalid id fails with 400', () => {
    return request(app)
      .get('/api/characters?id=5')
      .auth('test', 'password')
      .expect(400);
  });
  test('GET /api/characters querying with a non-existent name succeeds but gives no results', () => {
    return request(app)
      .get('/api/characters?name=John')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([]));
  });
  test('GET /api/characters with no authentication fails with 401', () => {
    return request(app)
      .get('/api/characters')
      .expect(401);
  });
});

describe('Spell searching/fetching', () => {
  beforeAll(() => {
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: [] }]);
    writeObject(spellsFile, [{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }, { Id: '3', Name: 'spell3', Level: 12, School: 'Transmutation', Components: ['V', 'S', 'M'], Damage: '', Desc: 'lol3' }]);
  });
  test('GET /api/spells without query string returns all spells', () => {
    return request(app)
      .get('/api/spells')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }, { Id: '3', Name: 'spell3', Level: 12, School: 'Transmutation', Components: ['V', 'S', 'M'], Damage: '', Desc: 'lol3' }]));
  });
  test('GET /api/spells with single id succeeds', () => {
    return request(app)
      .get('/api/spells?id=1')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]));
  });
  test('GET /api/spells with multiple ids succeeds', () => {
    return request(app)
      .get('/api/spells?ids=["1","2"]')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }]));
  });
  test('GET /api/spells with name succeeds', () => {
    return request(app)
      .get('/api/spells?name=1')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]));
  });
  test('GET /api/spells with spell level succeeds', () => {
    return request(app)
      .get('/api/spells?level=3')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]));
  });
  test('GET /api/spells with spell school succeeds', () => {
    return request(app)
      .get('/api/spells?school=Evocation')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }]));
  });
  test('GET /api/spells with spell damage succeeds', () => {
    return request(app)
      .get('/api/spells?damage=2d6%2B2')
      .auth('test', 'password')
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]));
  });
});

describe('Spell adding', () => {
  beforeEach(() => {
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: [] }]);
    writeObject(spellsFile, [{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]);
  });
  test('POST /api/admin/addspell with valid data succeeds', () => {
    return request(app)
      .post('/api/admin/addspell')
      .auth('admin', 'password')
      .send({ Name: 'spell2', Level: 2, School: 'Necromancy', Components: ['V', 'S'], Damage: '', Desc: 'lol2' })
      .expect(200)
      .then(() => {
        const spell = readObject(spellsFile)[1];
        delete spell.Id;
        expect(spell).toEqual({ Name: 'spell2', Level: 2, School: 'Necromancy', Components: ['V', 'S'], Damage: '', Desc: 'lol2' });
      });
  });
  test('POST /api/admin/addspell with incomplete data fails with 400', () => {
    return request(app)
      .post('/api/admin/addspell')
      .auth('admin', 'password')
      .send({ Name: 'spell2', Level: 2, Components: ['V', 'S'], Damage: '', Desc: 'lol2' })
      .expect(400);
  });
  test('POST /api/admin/addspell with invalid spell level fails with 400', () => {
    return request(app)
      .post('/api/admin/addspell')
      .auth('admin', 'password')
      .send({ Name: 'spell3', Level: 14, School: 'Transmutation', Components: ['V', 'S'], Damage: '', Desc: 'lol3' })
      .expect(400);
  });
  test('POST /api/admin/addspell with non-admin credentials fails with 401', () => {
    return request(app)
      .post('/api/admin/addspell')
      .auth('test', 'password')
      .send({ Name: 'spell2', Level: 2, School: 'Necromancy', Components: ['V', 'S'], Damage: '', Desc: 'lol2' })
      .expect(401);
  });
});

describe('Spell deleting', () => {
  beforeEach(() => {
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: [] }]);
    writeObject(charindexFile, [{ Id: '1', Name: 'char1' }]);
    writeObject(charDir + '1.json', { Id: '1', Name: 'char1', Race: 'Human', Class: 'Wizard', Spells: ['1', '2'] });
    writeObject(spellsFile, [{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }, { Id: '3', Name: 'spell3', Level: 12, School: 'Transmutation', Components: ['V', 'S', 'M'], Damage: '', Desc: 'lol3' }]);
  });
  test('POST /api/admin/delspell with valid spell id succeeds', () => {
    return request(app)
      .post('/api/admin/delspell?id=1')
      .auth('admin', 'password')
      .expect(200)
      .then(() => {
        expect(readObject(spellsFile)).toEqual([{ Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }, { Id: '3', Name: 'spell3', Level: 12, School: 'Transmutation', Components: ['V', 'S', 'M'], Damage: '', Desc: 'lol3' }]);
      });
  });
  test('POST /api/admin/delspell cascade deletes the spell from all characters with it', () => {
    return request(app)
      .post('/api/admin/delspell?id=2')
      .auth('admin', 'password')
      .expect(200)
      .then(() => {
        expect(readObject(charDir + '1.json').Spells).toEqual(['1']);
      });
  });
  test('POST /api/admin/delspell with non-existent spell id fails with 400', () => {
    return request(app)
      .post('/api/admin/delspell?id=4')
      .auth('admin', 'password')
      .expect(400);
  });
  test('POST /api/admin/delspell with no spell id fails with 400', () => {
    return request(app)
      .post('/api/admin/delspell')
      .auth('admin', 'password')
      .expect(400);
  });
  test('POST /api/admin/delspell with non-admin credentials fails with 401', () => {
    return request(app)
      .post('/api/admin/delspell?id=1')
      .auth('test', 'password')
      .expect(401);
  });
});

afterAll(async () => {
  fs.rmdirSync('./tmp/', { recursive: true });
});

function writeObject (path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj));
}

function readObject (path) {
  return JSON.parse(fs.readFileSync(path));
}
