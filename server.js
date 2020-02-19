var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
var fetch = require('node-fetch');
app.use(express.static('client'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var spells = require('./data/spells.json');
var characters = require('./data/characters.json')

app.get('/', function (req, resp) {
    resp.send('Hello, World!');
});

app.post('/api/admin/addspell', function (req, resp){
    try {
        let newspell = {
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
        resp.status(500).send(e);
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

app.get('/api/spells', function (req, resp) {
    try {
        resp.send(spells);
    } catch (e) {
        console.log(e);
        resp.status(500).send();
    }
})

app.listen(8090);