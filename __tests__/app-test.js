/* eslint-disable jest/expect-expect */

let app;
const request = require('supertest');
const fs = require('fs');

const usersFile = './tmp/data/users.json';
const charindexFile = './tmp/data/charindex.json';
const spellsFile = './tmp/data/spells.json';
const charDir = './tmp/data/chars/';

beforeAll(() => {
  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }
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
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: [] }]);
    writeObject(charindexFile, []);
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
    writeObject(charindexFile, [{ Id: '123', Name: 'test' }]);
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: ['123'] }]);
    writeObject(charDir + '123.json', { Id: '123', Name: 'test' }); // I haven't filled in all of the character information but it shouldn't make any difference
    return request(app)
      .post('/api/delchar')
      .auth('test', 'password')
      .send({ Id: '123' })
      .expect(200)
      .then(() => {
        expect(fs.existsSync(charDir + '123.json')).toBeFalsy();
        expect(readObject(usersFile)[0].Chars).toEqual([]);
        expect(readObject(charindexFile)).toEqual([]);
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
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: ['1'] }, { Name: 'test2', Password: 'password', Chars: ['2'] }]);
    writeObject(charindexFile, [{ Id: '1', Name: 'char1' }, { Id: '2', Name: 'char2' }]);
    writeObject(charDir + '1.json', { Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] });
    writeObject(charDir + '2.json', { Id: '2', Name: 'char2', Level: 2, Class: 'Wizard', Race: 'Human', Spells: ['spell1', 'spell4'] });
  });
  test('POST /api/editchar to change all but character name and spells succeeds', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Id: '1', Level: 2, Class: 'Monk', Race: 'Dwarf' })
      .expect(200)
      .then(() => {
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
        expect(readObject(charindexFile)[0].Name).toEqual('John Smith');
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
  test('POST /api/editchar to another user\'s character fails with 401', () => {
    return request(app)
      .post('/api/editchar')
      .auth('test', 'password')
      .send({ Id: '2', Class: 'Fighter' })
      .expect(401);
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
  beforeAll(() => {
    writeObject(usersFile, [{ Name: 'test', Password: 'password', Chars: ['1', '3'] }, { Name: 'test2', Password: 'password', Chars: ['2'] }]);
    writeObject(charindexFile, [{ Id: '1', Name: 'char1' }, { Id: '2', Name: 'char2' }, { Id: '3', Name: 'char3' }]);
    writeObject(charDir + '1.json', { Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] });
    writeObject(charDir + '3.json', { Id: '3', Name: 'char3', Level: 1, Class: 'Ranger', Race: 'Elf', Spells: ['spell1'] });
    writeObject(charDir + '2.json', { Id: '2', Name: 'char2', Level: 2, Class: 'Wizard', Race: 'Human', Spells: ['spell1', 'spell4'] });
  });
  test('GET /api/characters with no query returns all characters for the user', () => {
    return request(app)
      .get('/api/characters')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] }, { Id: '3', Name: 'char3', Level: 1, Class: 'Ranger', Race: 'Elf', Spells: ['spell1'] }]));
  });
  test('GET /api/characters querying by name succeeds', () => {
    return request(app)
      .get('/api/characters?name=char1')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] }]));
  });
  test('GET /api/characters querying by id succeeds', () => {
    return request(app)
      .get('/api/characters?id=1')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'char1', Level: 1, Class: 'Fighter', Race: 'Human', Spells: [] }]));
  });
  test('GET /api/characters querying id of another user\'s character fails with 401', () => {
    return request(app)
      .get('/api/characters?id=2')
      .auth('test', 'password')
      .expect(401);
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
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }, { Id: '3', Name: 'spell3', Level: 12, School: 'Transmutation', Components: ['V', 'S', 'M'], Damage: '', Desc: 'lol3' }]));
  });
  test('GET /api/spells with single id succeeds', () => {
    return request(app)
      .get('/api/spells?id=1')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]));
  });
  test('GET /api/spells with multiple ids succeeds', () => {
    return request(app)
      .get('/api/spells?ids=["1","2"]')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }]));
  });
  test('GET /api/spells with name succeeds', () => {
    return request(app)
      .get('/api/spells?name=1')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]));
  });
  test('GET /api/spells with spell level succeeds', () => {
    return request(app)
      .get('/api/spells?level=3')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }]));
  });
  test('GET /api/spells with spell school succeeds', () => {
    return request(app)
      .get('/api/spells?school=Evocation')
      .auth('test', 'password')
      .expect(200)
      .expect(JSON.stringify([{ Id: '1', Name: 'spell1', Level: 3, School: 'Evocation', Components: ['V', 'S', 'M'], Damage: '2d6+2', Desc: 'lol' }, { Id: '2', Name: 'spell2', Level: 4, School: 'Evocation', Components: ['V', 'M'], Damage: '4d8+1', Desc: 'lol2' }]));
  });
  test('GET /api/spells with spell damage succeeds', () => {
    return request(app)
      .get('/api/spells?damage=2d6%2B2')
      .auth('test', 'password')
      .expect(200)
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
