var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var uuid = require('uuid/v1');
var basicAuth = require('express-basic-auth');
var nodeasync = require('async');
app.use(express.static('client'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var admin = {'admin' : 'password'};
app.use('/api/admin', basicAuth({users: admin}));

var spells = require('./data/spells.json');
var charindex = require('./data/charindex.json');

app.use(express.static('client'));

app.get('/', function (req, resp) {
    resp.send('Hello, World!');
});

app.post('/api/admin/addspell', function (req, resp){
    try {
        let newspell = {
            Id: uuid(),
            Name: req.body.Name,
            Level: req.body.Level,
            School: req.body.School,
            Components: req.body.Components,
            Damage: req.body.Damage,
            Desc: req.body.Desc
        };
        if (newspell.Name == undefined){
            resp.status(400).send();
            return;
        }
        spells.push(newspell);
        let json = JSON.stringify(spells);
        fs.writeFile('./data/spells.json', json, 'utf8', () => {});
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/admin/addspells', function (req, resp) {
    try {
        spells.concat(req.body.arr);
        let json = JSON.stringify(spells);
        fs.writeFile('./data/spells.json', json, 'utf8', () => {});
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/admin/delspell', function (req, resp){
    try {
        if (req.query.id != undefined){
            spells = spells.filter(x => x.Id != req.query.id);
            let json = JSON.stringify(spells);
            fs.writeFile('./data/spells.json', json, 'utf8', () => {});
            resp.status(200).send();
        }
        else{
            resp.status(400).send();
        }
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/newchar', function (req, resp) {
    try {
        let newchar = {
            Id: uuid(),
            Name: req.body.Name,
            Level: req.body.Level,
            Class: req.body.Class,
            Race: req.body.Race,
            Spells: []
        };
        if (newchar.Name === undefined) {
            resp.status(400).send();
            return;
        }
        charindex.push({Id: newchar.Id, Name: newchar.Name});
        let indexjson = JSON.stringify(charindex);
        fs.writeFile('./data/charindex.json', indexjson, 'utf8', () => {});
        let charjson = JSON.stringify(newchar);
        fs.writeFile('./data/chars/' + newchar.Id + '.json', charjson, 'utf8', () => {});
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/editchar', async function (req, resp) {
    try {
        if (req.body.Id === undefined) { resp.status(400).send(); return;}
        let index = charindex.find(x => x.Id == req.body.Id);
        if (index === undefined) { resp.status(400).send(); return;}
        let char = require('./data/chars/' + index.Id + '.json');
        if (req.body.Name != undefined) {
            char.Name = req.body.Name;
            index.Name = req.body.Name;
            let indexjson = JSON.stringify(charindex);
            fs.writeFile('./data/charindex.json', indexjson, 'utf8', () => {});
        }
        if (req.body.Level != undefined) {char.Level = req.body.Level;}
        if (req.body.Class != undefined) {char.Class = req.body.Class;}
        if (req.body.Race != undefined) {char.Race = req.body.Race;}
        if (req.body.Spells != undefined) {
            if (req.body.Spells.length != 2) { resp.status(400).send(); return;}
            char.Spells = char.Spells.concat(req.body.Spells[0]);
            char.Spells = char.Spells.filter(x => !req.body.Spells[1].includes(x));
        }
        let charjson = JSON.stringify(char);
        fs.writeFile('./data/chars/' + char.Id + '.json', charjson, 'utf8', () => {});
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.get('/api/spells', function (req, resp) {
    try {
        if (Object.keys(req.query).length === 0) { resp.send(spells); }
        else {
            let validspells = spells;
            if (req.query.id != undefined){
                validspells = [validspells.find(x => x.Id === req.query.id)];
            }
            else if (req.query.ids != undefined){
                let ids = JSON.parse(req.query.ids);
                validspells = validspells.filter(x => ids.includes(x.Id));
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
            }
            resp.send(validspells);
        }
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

function readCharacter(file, callback) {
    fs.readFile(file, 'utf8', callback);
}

app.get('/api/characters', function (req, resp) {
    try {
        let files = charindex.map(x => './data/chars/' + x.Id + '.json');
        nodeasync.map(files, readCharacter, function (err, characters) {
            characters = characters.map(x => JSON.parse(x));
            if (Object.keys(req.query).length === 0) { resp.send(characters); }
            else {
                let validchars = characters;
                if (req.query.id != undefined) {
                    validchars = [validchars.find(x => x.Id === req.query.id)];
                }
                if (req.query.name != undefined) {
                    validchars = validchars.filter(x => x.Name.includes(req.query.name));
                }
                resp.send(validchars);
            }
        });
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.listen(8090);