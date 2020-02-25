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

var users = require('./data/users.json'); // Load user data
app.use('/auth', basicAuth({authorizer: Authorise, authorizeAsync: true}));
app.use('/api', basicAuth({authorizer: Authorise, authorizeAsync: true})); // Everything by default requires authorisation
var admin = {'admin' : 'password'}; // Admin user
app.use('/api/admin', basicAuth({users: admin})); // If something is under the admin category it needs to use the admin user

var spells = require('./data/spells.json');
var charindex = require('./data/charindex.json'); // Loads the spell and character index data

function Authorise(username, password, cb) { // Authoriser function
    if (basicAuth.safeCompare(username, 'admin') & basicAuth.safeCompare(password, 'password')){ // If they use the admin login then they're in
        return cb(null, true);
    }
    let requser = users.find(x => x.Name === username); // If they specify a valid user, find it
    if (requser != undefined) { // If they gave a user
        return cb(null, basicAuth.safeCompare(requser.Password, password)); // Check the password and return status
    }
    else {
        return cb(null, false); // Otherwise don't let them in
    }
}

app.get('/', function (req, resp) { // Add a get route at / to give an easy check that the server is up
    resp.send('Hello, World!');
});

app.get('/auth', function (req, resp) {
    try {
        if (req.auth.user === "admin") { resp.send("admin"); }
        else { resp.send("user"); }
    }
    catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/admin/addspell', function (req, resp){ // Route to add a spell
    try { // Error catching (don't want to bring down the whole server lol)
        let newspell = { // Create a new spell object
            Id: uuid(), // Generate a uuid for that spell
            Name: req.body.Name,
            Level: req.body.Level,
            School: req.body.School,
            Components: req.body.Components,
            Damage: req.body.Damage,
            Desc: req.body.Desc // Set everything else based on the request
        };
        if (newspell.Name == undefined || newspell.Level === undefined || newspell.School === undefined || newspell.Components === undefined || newspell.Damage === undefined){
            // If any of the major things are undefined, then we give a bad request
            resp.status(400).send();
            return;
        }
        spells.push(newspell); // If everything is kosher then add the spell to the list
        let json = JSON.stringify(spells); // JSON it up
        fs.writeFile('./data/spells.json', json, 'utf8', () => {}); // Write it to the file (this goes to the worker pool so shouldn't be blocking)
        resp.status(200).send(); // Send an ok message
    } catch (e) { // If we have an error
        console.log(e); // Log it (for debugging)
        resp.status(500).send(); // Give a client an internal server error
    }
});

app.post('/api/admin/addspells', function (req, resp) { // Route to add multiple spells
    try {
        spells.concat(req.body.arr); // Requires many spells to be given in an array
        let json = JSON.stringify(spells);
        fs.writeFile('./data/spells.json', json, 'utf8', () => {}); // Save it all
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/admin/delspell', function (req, resp){ // Route to delete a spell
    try {
        if (req.query.id != undefined){ // If the spell given isn't undefined
            spells = spells.filter(x => x.Id != req.query.id); // Remove the spell in question
            let json = JSON.stringify(spells);
            fs.writeFile('./data/spells.json', json, 'utf8', () => {}); // Write to file
            resp.status(200).send();
        }
        else{
            resp.status(400).send(); // If they didn't give us a spell id to work with it's a bad request
        }
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/newchar', function (req, resp) { // Route to create a character
    try {
        let newchar = {
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
        charindex.push({Id: newchar.Id, Name: newchar.Name}); // Add the character to our index
        let indexjson = JSON.stringify(charindex);
        fs.writeFile('./data/charindex.json', indexjson, 'utf8', () => {}); // Write it to file
        let charjson = JSON.stringify(newchar);
        fs.writeFile('./data/chars/' + newchar.Id + '.json', charjson, 'utf8', () => {}); // Write the character to file
        let user = users.find(x => x.Name == req.auth.user);
        user.Chars.push(newchar.Id); // Add the character to the user's list of chars
        fs.writeFile('./data/users.json', JSON.stringify(users), 'utf8', () => {}); // Write to file
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/editchar', async function (req, resp) { // Route to edit character
    try {
        let user = users.find(x => x.Name == req.auth.user); // Find the user who's making the request
        if (!user.Chars.includes(req.body.Id)) { resp.status(401).send(); return;} // If the character they're trying to edit isn't theirs, give them a 401
        if (req.body.Id === undefined) { resp.status(400).send(); return;} // If they haven't given a character, give them a 400
        let index = charindex.find(x => x.Id == req.body.Id); // Otherwise find the character's index entry
        if (index === undefined) { resp.status(400).send(); return;} // If it's undefined, send a bad request since the char doesn't exist
        let char = require('./data/chars/' + index.Id + '.json'); // Load the character's file
        if (req.body.Name != undefined) { // If the request wants to change the character's name
            char.Name = req.body.Name;
            index.Name = req.body.Name; // Update it on both the index and the character
            let indexjson = JSON.stringify(charindex);
            fs.writeFile('./data/charindex.json', indexjson, 'utf8', () => {}); // Write the new index to file
        }
        if (req.body.Level != undefined) {char.Level = req.body.Level;}
        if (req.body.Class != undefined) {char.Class = req.body.Class;}
        if (req.body.Race != undefined) {char.Race = req.body.Race;} // If any properties want changing, do that
        if (req.body.Spells != undefined) { // If the user wants to change spells
            if (req.body.Spells.length != 2) { resp.status(400).send(); return;} // They should give an array of spells to add and of spells to remove. If they haven't give a 400
            char.Spells = char.Spells.filter(x => !req.body.Spells[1].includes(x)); // Remove the old ones
            char.Spells = char.Spells.concat(req.body.Spells[0]); // Add in the new spells
        }
        let charjson = JSON.stringify(char);
        fs.writeFile('./data/chars/' + char.Id + '.json', charjson, 'utf8', () => {}); // Update the character file
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/newuser', function (req, resp) {
    try{
        let newuser = {
            Name: req.body.username,
            Password: req.body.password,
            Chars: []
        };
        if (users.find(x => x.Name == newuser.Name) != undefined) {resp.status(401).send();}
        if (newuser.Name == "" || newuser.Password == "" || newuser.Name == undefined || newuser.Password == undefined) {resp.status(400).send(); return;}
        users.push(newuser);
        fs.writeFile('./data/users.json', JSON.stringify(users), 'utf8', () => {}); // Write to file
        resp.status(200).send();
    }
    catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.get('/api/spells', function (req, resp) { // Function to get spells
    try {
        if (Object.keys(req.query).length === 0) { resp.send(spells); } // If they don't give any query string, return all spells
        else {
            let validspells = spells;
            if (req.query.id != undefined){ // If they've given an id to find
                validspells = [validspells.find(x => x.Id === req.query.id)]; // Find that spell and return it
            }
            else if (req.query.ids != undefined){ // If they're giving a number of ids
                let ids = JSON.parse(req.query.ids);
                validspells = validspells.filter(x => ids.includes(x.Id)); // Give them the corresponding spells
            }
            if (req.query.name != undefined){
                validspells = validspells.filter(x => x.Name.includes(req.query.name));
            }
            if (req.query.level != undefined){
                validspells = validspells.filter(x => x.Level === parseInt(req.query.level));
            }
            if (req.query.school != undefined){
                validspells = validspells.filter(x => x.School === req.query.school);
            }
            if (req.query.damage != undefined){
                validspells = validspells.filter(x => x.Damage === req.query.damage);
            } // If they specify any other filters, use them
            resp.send(validspells); // Send the spells that might the criteria
        }
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

function readCharacter(file, callback) { // Function to read a single file in (this is used to help do lots of file i/o asynchronously)
    fs.readFile(file, 'utf8', callback);
}

app.get('/api/characters', function (req, resp) { // Route to search through characters
    try {
        let userchars = []; // Sets up a list to store the characters that the user has access to
        let usercharindex = users.find(x => x.Name === req.auth.user).Chars;
        if (req.auth.user != "admin"){ userchars = charindex.filter(x => usercharindex.includes(x.Id)); } // Filter the characters based on what the user has access to
        else { userchars = charindex; } // If the user is the admin, they can see all characters
        if (Object.keys(req.query).length != 0) {
            if (req.query.id != undefined) {
                userchars = [userchars.find(x => x.Id === req.query.id)];
                if (userchars[0] === undefined) {resp.status(401).send(); return;}
            }
            if (req.query.name != undefined) {
                userchars = userchars.filter(x => x.Name.includes(req.query.name));
            }
        }
        let files = userchars.map(x => './data/chars/' + x.Id + '.json'); // Load these characters into memory
        nodeasync.map(files, readCharacter, function (err, characters) { // This does it asynchronously so we don't block the event loop
            characters = characters.map(x => JSON.parse(x)); // Parse all of the loaded data into JSON objects
            resp.send(characters);
        });
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.listen(8090);