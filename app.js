/**
 * Express app providing routes for the roll20 spell manager
 */

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var uuid = require('uuid/v1');
var basicAuth = require('express-basic-auth');
var nodeasync = require('async'); // Require a load of modules
app.use(express.static('client')); // Use static so we can serve pages
app.use(bodyParser.urlencoded({ extended: false })); // Use bodyparser for post requests
app.use(bodyParser.json()); // Lets us parse json

let charDir;
let spellsFile;
let charIndexFile;
let usersFile; // Declare some variables to store file paths

if (process.env.NODE_ENV === 'test') { // If we should be in test mode
  fs.mkdirSync('./tmp/');
  fs.mkdirSync('./tmp/data/');
  fs.mkdirSync('./tmp/data/chars/');
  fs.writeFileSync('./tmp/data/charindex.json', '[]');
  fs.writeFileSync('./tmp/data/spells.json', '[]');
  fs.writeFileSync('./tmp/data/users.json', '[]'); // Create some blank test files
  charDir = './tmp/data/chars/';
  spellsFile = './tmp/data/spells.json';
  charIndexFile = './tmp/data/charindex.json';
  usersFile = './tmp/data/users.json'; // Set up all of our file paths
} else { // Otherwise
  if (!fs.existsSync('./data/')) {
    fs.mkdirSync('./data/');
  }
  if (!fs.existsSync('./data/chars/')) {
    fs.mkdirSync('./data/chars/');
  }
  if (!fs.existsSync('./data/charindex.json')) {
    fs.writeFileSync('./data/charindex.json', '[]');
  }
  if (!fs.existsSync('./data/spells.json')) {
    fs.writeFileSync('./data/spells.json', '[]');
  }
  if (!fs.existsSync('./data/users.json')) {
    fs.writeFileSync('./data/users.json', '[]');
  } // Check if the files we need exist, otherwise make them
  charDir = './data/chars/';
  spellsFile = './data/spells.json';
  charIndexFile = './data/charindex.json';
  usersFile = './data/users.json'; // Set up our file paths
}

app.use('/auth', basicAuth({ authorizer: Authorise, authorizeAsync: true }));
app.use('/api', basicAuth({ authorizer: Authorise, authorizeAsync: true })); // Everything by default requires authorisation
var admin = { admin: 'password' }; // Admin user
app.use('/api/admin', basicAuth({ users: admin })); // If something is under the admin category it needs to use the admin user

function Authorise (username, password, cb) { // Authoriser function
  var users = JSON.parse(fs.readFileSync(usersFile)); // Load user data
  if (basicAuth.safeCompare(username, 'admin') & basicAuth.safeCompare(password, 'password')) { // If they use the admin login then they're in
    return cb(null, true);
  }
  const requser = users.find(x => x.Name === username); // If they specify a valid user, find it
  if (requser !== undefined) { // If they gave a user
    return cb(null, basicAuth.safeCompare(requser.Password, password)); // Check the password and return status
  } else {
    return cb(null, false); // Otherwise don't let them in
  }
}

app.get('/ping', function (req, resp) { // Add a get route at /ping to give an easy check that the server is up
  resp.status(200).send();
});

app.get('/auth', function (req, resp) {
  try {
    if (req.auth.user === 'admin') { resp.send('admin'); } else { resp.send('user'); }
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

app.post('/api/admin/addspell', function (req, resp) { // Route to add a spell
  try { // Error catching (don't want to bring down the whole server lol)
    fs.readFile(spellsFile, (e, d) => {
      if (e) { throw e; }
      const spells = JSON.parse(d);
      const newspell = { // Create a new spell object
        Id: uuid(), // Generate a uuid for that spell
        Name: req.body.Name,
        Level: req.body.Level,
        School: req.body.School,
        Components: req.body.Components,
        Damage: req.body.Damage,
        Desc: req.body.Desc // Set everything else based on the request
      };
      if (newspell.Name === undefined || newspell.Level === undefined || newspell.School === undefined || newspell.Components === undefined || newspell.Damage === undefined || newspell.Level < 0 || newspell.Level > 9) {
        // If any of the major things are undefined, then we give a bad request
        resp.status(400).send();
        return;
      }
      spells.push(newspell); // If everything is kosher then add the spell to the list
      const json = JSON.stringify(spells); // JSON it up
      fs.writeFile(spellsFile, json, 'utf8', () => { resp.status(200).send(newspell.Id); }); // Write it to the file (this goes to the worker pool so shouldn't be blocking)
    });
  } catch (e) { // If we have an error
    console.log(e); // Log it (for debugging)
    resp.status(500).send(); // Give a client an internal server error
  }
});

app.post('/api/admin/delspell', function (req, resp) { // Route to delete a spell
  try {
    if (req.query.id !== undefined) { // If the spell given isn't undefined
      const reads = [charIndexFile, spellsFile]; // Create a list of reads we need to do this
      nodeasync.map(reads, readFile, async function (e, d) { // Get those reads done asynchronously
        const charindex = JSON.parse(d[0]);
        let spells = JSON.parse(d[1]); // Extract the reads
        if (!spells.find(x => x.Id === req.query.id)) { resp.status(400).send(); return; } // If the spell doesn't exist, it's a bad request
        const files = charindex.map(x => charDir + x.Id + '.json'); // Get the character index and use it to work out all character files
        nodeasync.map(files, readFile, async function (err, characters) { // Read them all in
          if (err) { // If it went wrong, handle it gracefully-ish
            console.log(err);
            resp.status(500).send();
            return;
          }
          const jsonchars = characters.map(x => JSON.parse(x)); // Get an array of characters
          const writes = []; // Create an array to store writes
          jsonchars.forEach(char => {
            char.Spells = char.Spells.filter(x => x !== req.query.id); // Cascade delete the spell
            writes.push({ path: charDir + char.Id + '.json', json: char }); // Add it to the list of writes to do
          });
          nodeasync.map(writes, JSONToFile, (e, r) => { // Do all the writes
            if (e) {
              resp.status(500).send(); // If there's an error, send a 500
            }
            else {
              spells = spells.filter(x => x.Id !== req.query.id); // Remove the spell in question
              const json = JSON.stringify(spells);
              fs.writeFile(spellsFile, json, 'utf8', () => { resp.status(200).send(); }); // Write to file
            }
          });
        });
      });
    } else {
      resp.status(400).send(); // If they didn't give us a spell id to work with it's a bad request
    }
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

app.post('/api/newchar', function (req, resp) { // Route to create a character
  try {
    const reads = [charIndexFile, usersFile]; // We need these files to do it
    nodeasync.map(reads, readFile, (e, d) => { // Load them in and finish the request
      if (e) { throw e; }
      const charindex = JSON.parse(d[0]);
      const users = JSON.parse(d[1]);
      const newchar = {
        Id: uuid(),
        Name: req.body.Name,
        Level: req.body.Level,
        Class: req.body.Class,
        Race: req.body.Race,
        Spells: []
      }; // Make the character
      if (newchar.Name === undefined || req.auth.user === undefined || newchar.Level === undefined || newchar.Class === undefined || newchar.Race === undefined) {
        resp.status(400).send(); // If they didn't finish the character, tell them it was a bad request
        return;
      }
      charindex.push({ Id: newchar.Id, Name: newchar.Name }); // Add the character to our index
      const user = users.find(x => x.Name === req.auth.user);
      user.Chars.push(newchar.Id); // Add the character to the user's list of chars
      const writes = [{ path: charIndexFile, json: charindex }, { path: charDir + newchar.Id + '.json', json: newchar }, { path: usersFile, json: users }];
      // All of the above files need to be changed for this
      nodeasync.map(writes, JSONToFile, (e, r) => {
        if (e) { resp.status(500).send(); }
        else { resp.status(200).send(newchar.Id); }
      }); // Do the writes
    });
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

app.post('/api/delchar', async function (req, resp) { // Route to delete character
  try {
    const reads = [charIndexFile, usersFile]; // We need both of these files to process this request
    nodeasync.map(reads, readFile, (e, d) => {
      if (e) { throw e; }
      let charindex = JSON.parse(d[0]);
      const users = JSON.parse(d[1]);
      if (!charindex.find(x => x.Id === req.body.Id)) { resp.status(400).send(); } // If this character doesn't exist, it's a bad request
      const user = users.find(x => x.Name === req.auth.user); // Find the user that sent the request
      if (!user.Chars.includes(req.body.Id)) { resp.status(403).send(); return; } // If the character specified isn't theirs, it's a 403
      charindex = charindex.filter(x => x.Id !== req.body.Id);
      user.Chars = user.Chars.filter(x => x !== req.body.Id); // Ditch the character
      const writes = [{ path: charIndexFile, json: charindex }, { path: usersFile, json: users }];
      nodeasync.map(writes, JSONToFile, (e, r) => { // Write the changes
        fs.unlink(charDir + req.body.Id + '.json', () => { resp.status(200).send(); }); // Then delete the character's file
      });
    });
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

app.post('/api/editchar', async function (req, resp) { // Route to edit character
  try {
    const reads = [charIndexFile, usersFile];
    if (!req.body.Id) { resp.status(400).send(); }
    nodeasync.map(reads, readFile, (e, d) => {
      if (e) { throw e; }
      const charindex = JSON.parse(d[0]);
      const users = JSON.parse(d[1]);
      const index = charindex.find(x => x.Id === req.body.Id); // Otherwise find the character's index entry
      if (index === undefined) { resp.status(400).send(); return; } // If it's undefined, send a bad request since the char doesn't exist
      const user = users.find(x => x.Name === req.auth.user); // Find the user who's making the request
      if (!user.Chars.includes(req.body.Id)) { resp.status(403).send(); return; } // If the character they're trying to edit isn't theirs, give them a 403
      if (req.body.Id === undefined) { resp.status(400).send(); return; } // If they haven't given a character, give them a 400
      const char = JSON.parse(fs.readFileSync(charDir + index.Id + '.json')); // Load the character's file
      if (req.body.Name !== undefined) { // If the request wants to change the character's name
        char.Name = req.body.Name;
        index.Name = req.body.Name; // Update it on both the index and the character
      }
      if (req.body.Level !== undefined) { char.Level = req.body.Level; }
      if (req.body.Class !== undefined) { char.Class = req.body.Class; }
      if (req.body.Race !== undefined) { char.Race = req.body.Race; } // If any properties want changing, do that
      if (req.body.Spells !== undefined) { // If the user wants to change spells
        if (req.body.Spells.length !== 2 && !Array.isArray(req.body.Spells[0]) && !Array.isArray(req.body.Spells[1])) { resp.status(400).send(); return; } // They should give an array of spells to add and of spells to remove. If they haven't give a 400
        char.Spells = char.Spells.filter(x => !req.body.Spells[1].includes(x)); // Remove the old ones
        char.Spells = char.Spells.concat(req.body.Spells[0]); // Add in the new spells
      }
      const writes = [{ path: charDir + char.Id + '.json', json: char }];
      if (req.body.Name !== undefined) { writes.push({ path: charIndexFile, json: charindex }); }
      nodeasync.map(writes, JSONToFile, (e, r) => {
        resp.status(200).send();
      });
    });
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

app.post('/newuser', function (req, resp) { // Route to add a new user
  try {
    fs.readFile(usersFile, (e, d) => { // Load in the users file
      if (e) { throw e; }
      const users = JSON.parse(d);
      const newuser = {
        Name: req.body.username,
        Password: req.body.password,
        Chars: []
      }; // Create a new user
      if (users.find(x => x.Name === newuser.Name) !== undefined) { resp.status(403).send(); } // If the username is taken, it's a 403
      if (newuser.Name === '' || newuser.Password === '' || newuser.Name === undefined || newuser.Password === undefined) { resp.status(400).send(); return; }
      // If they don't finish the user, it's a bad request
      users.push(newuser); // If everything is still ok, add htem to the list
      fs.writeFile(usersFile, JSON.stringify(users), 'utf8', () => { resp.status(200).send(); }); // Write to file
    });
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

app.get('/api/spells', function (req, resp) { // Function to get spells
  try {
    fs.readFile(spellsFile, (e, d) => {
      if (e) { throw e; }
      const spells = JSON.parse(d);
      if (Object.keys(req.query).length === 0) { resp.send(spells); } // If they don't give any query string, return all spells
      else {
        let validspells = spells;
        if (req.query.id !== undefined) { // If they've given an id to find
          validspells = [validspells.find(x => x.Id === req.query.id)]; // Find that spell and return it
        } else if (req.query.ids !== undefined) { // If they're giving a number of ids
          const ids = JSON.parse(req.query.ids);
          validspells = validspells.filter(x => ids.includes(x.Id)); // Give them the corresponding spells
        }
        if (req.query.name !== undefined && req.query.name !== '') {
          validspells = validspells.filter(x => x.Name.includes(req.query.name));
        }
        if (req.query.level !== undefined && req.query.level) {
          validspells = validspells.filter(x => x.Level === parseInt(req.query.level));
        }
        if (req.query.school !== undefined && req.query.school !== '') {
          validspells = validspells.filter(x => x.School === req.query.school);
        }
        if (req.query.damage !== undefined && req.query.damage !== '') {
          validspells = validspells.filter(x => x.Damage === req.query.damage);
        } // If they specify any other filters, use them
        resp.send(validspells); // Send the spells that might the criteria
      }
    });
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

function readFile (file, callback) { // Function to read a single file in (this is used to help do lots of file i/o asynchronously)
  fs.readFile(file, 'utf8', callback);
}

app.get('/api/characters', function (req, resp) { // Route to search through characters
  try {
    const reads = [charIndexFile, usersFile];
    nodeasync.map(reads, readFile, (e, d) => {
      if (e) { throw e; }
      const charindex = JSON.parse(d[0]);
      const users = JSON.parse(d[1]);
      let userchars = []; // Sets up a list to store the characters that the user has access to
      const usercharindex = users.find(x => x.Name === req.auth.user).Chars;
      if (req.auth.user !== 'admin') { userchars = charindex.filter(x => usercharindex.includes(x.Id)); } // Filter the characters based on what the user has access to
      else { userchars = charindex; } // If the user is the admin, they can see all characters
      if (Object.keys(req.query).length !== 0) {
        if (req.query.id !== undefined) {
          if (!charindex.find(x => x.Id === req.query.id)) { resp.status(400).send(); }
          userchars = [userchars.find(x => x.Id === req.query.id)];
          if (userchars[0] === undefined) { resp.status(403).send(); return; }
        }
        if (req.query.name !== undefined) {
          userchars = userchars.filter(x => x.Name.includes(req.query.name));
        }
      }
      const files = userchars.map(x => charDir + x.Id + '.json'); // Load these characters into memory
      nodeasync.map(files, readFile, function (err, characters) { // This does it asynchronously so we don't block the event loop
        if (err) {
          console.log(err);
          resp.status(500).send();
          return;
        }
        characters = characters.map(x => JSON.parse(x)); // Parse all of the loaded data into JSON objects
        resp.send(characters);
      });
    });
  } catch (e) {
    console.log(e);
    resp.status(500).send();
  }
});

function JSONToFile (obj, callback) {
  fs.writeFile(obj.path, JSON.stringify(obj.json), callback);
}

module.exports = app;
