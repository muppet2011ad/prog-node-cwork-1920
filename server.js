var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var uuid = require('uuid/v1');
var basicAuth = require('express-basic-auth');
app.use(express.static('client'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var admin = {'admin' : 'password'};
app.use('/api/admin', basicAuth({users: admin}));

var spells = require('./data/spells.json');
var characters = require('./data/characters.json')

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
            Spells: []
        };
        if (newchar.Name === undefined) {
            resp.status(400).send();
            return;
        }
        characters.push(newchar);
        let json = JSON.stringify(characters);
        fs.writeFile('./data/characters.json', json, 'utf8', () => {});
        resp.status(200).send();
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.post('/api/editchar', function (req, resp) {
    try {
        if (req.body.Id === undefined) { resp.status(400).send(); return;}
        let char = characters.find(x => x.Id == req.body.Id);
        if (char === undefined) { resp.status(400).send(); return;}
        if (req.body.Name != undefined) {char.Name = req.body.Name;}
        if (req.body.Level != undefined) {char.Level = req.body.Level;}
        if (req.body.Class != undefined) {char.Class = req.body.Class;}
        if (req.body.Spells != undefined) {
            if (req.body.Spells.length != 2) { resp.status(400).send(); return;}
            char.Spells = char.Spells.concat(req.body.Spells[0]);
            char.Spells = char.Spells.filter(x => !req.body.Spells[1].includes(x));
        }
        let json = JSON.stringify(characters);
        fs.writeFile('./data/characters.json', json, 'utf8', () => {});
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

app.get('/api/characters', function (req, resp) {
    try {
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
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
});

app.listen(8090);