let characters;
let selectedChar;
let charSpells;

const auth = localStorage.getItem('auth');

async function getAllChars () { // Setup function
  try {
    const response = await fetch('http://localhost:8090/api/characters', {
      method: 'GET',
      headers: new Headers({ Authorization: localStorage.getItem('auth') })
    }); // Fetch all characters
    characters = await response.json(); // Json it up
    makeCharList(characters); // Display it
  } catch (e) {
    if (e instanceof TypeError) {
      alert('Could not reach server. Please try again later.');
    }
    else {
      throw e;
    }
  }
}

async function makeCharList (chars) {
  const results = document.querySelector('#results'); // Find where we intend to display this
  const old = document.getElementById('charresults'); // Find what we already had displayed there
  if (old !== undefined) { old.remove(); } // If it exists, purge it
  const newlist = document.createElement('div'); // Create a new div to store it in
  newlist.id = 'charresults';
  chars.forEach(character => { // For every character fetched
    const newnode = document.createElement('a'); // Make them a box
    newnode.setAttribute('href', '#');
    newnode.setAttribute('class', 'list-group-item list-group-item-action flex-column align-items-start');
    newnode.setAttribute('data-character', character.Id); // Stores character data with node so we can access it later
    newnode.onclick = selectChar; // Bind a function to select a character to the node
    const heading = document.createElement('h5');
    heading.innerText = character.Name;
    newnode.appendChild(heading); // Fill the heading
    const labels = ['Level: ' + character.Level, 'Class: ' + character.Class, 'Race: ' + character.Race];
    labels.forEach(label => {
      const newlabel = document.createElement('small');
      newlabel.innerText = label + '\n';
      newnode.appendChild(newlabel);
    }); // Fill out the data for all of the basic features of the character
    newlist.appendChild(newnode); // Append the list entry to the whole list
  });
  results.appendChild(newlist); // Display the whole thing (it's better to construct it all then parent the whole thing for performance reasons)
}

async function selectChar (event) { // Event handler for a search result being clicked
  try {
    event.preventDefault();
    let target;
    if (event.target.localName !== 'a') {
      target = event.target.parentElement;
    }
    else {
      target = event.target;
    }
    selectedChar = characters.find(x => x.Id === target.getAttribute('data-character')); // Find the character
    Array.from(document.getElementById('charresults').children).forEach(result => result.classList.remove('active')); // Clear the active status of any other entries
    target.classList.add('active'); // Set active on the current result, making it appear blue
    document.getElementById('charName').innerText = selectedChar.Name;
    document.getElementById('charLevelClass').innerText = 'Level ' + selectedChar.Level + ' ' + selectedChar.Class;
    document.getElementById('charRace').innerText = 'Race: ' + selectedChar.Race;
    // Code to display spells
    const response = await fetch('http://localhost:8090/api/spells?ids=' + JSON.stringify(selectedChar.Spells), {
      method: 'GET',
      headers: new Headers({ Authorization: auth })
    }); // Get the character's spells from the server
    charSpells = await response.json(); // Parse to json
    const spellList = document.getElementById('spellList'); // Get the element on the page that we're using to display them
    spellList.innerHTML = ''; // Clear it of any existing spells
    for (let i = 0; i < 10; i++) { // Iterate through all possible d20 spell levels
      const lvlXSpells = charSpells.filter(x => x.Level === i); // Filter the spells of this level
      if (lvlXSpells.length === 0) { continue; } // If there aren't any, move on to the next level
      const levelTitle = document.createElement('button');
      levelTitle.setAttribute('class', 'list-group-item list-group-item-action flex-column align-items-start list-group-item-secondary');
      const levelText = document.createElement('h6');
      levelText.innerText = 'Level ' + i + ' Spells';
      levelTitle.appendChild(levelText);
      spellList.appendChild(levelTitle); // Create the title for the spell level
      lvlXSpells.forEach(spell => { // For every spell the character has of this level
        const newnode = document.createElement('button');
        newnode.setAttribute('class', 'list-group-item list-group-item-action flex-column align-items-start');
        newnode.innerText = spell.Name;
        newnode.setAttribute('data-id', spell.Id);
        newnode.setAttribute('data-name', spell.Name);
        newnode.setAttribute('data-level', spell.Level);
        newnode.setAttribute('data-school', spell.School);
        newnode.setAttribute('data-components', spell.Components);
        newnode.setAttribute('data-damage', spell.Damage);
        newnode.setAttribute('data-desc', spell.Desc);
        newnode.setAttribute('data-toggle', 'modal');
        newnode.setAttribute('data-target', '#spellInfoModal'); // Set up an element to display it
        newnode.onclick = readySpellModal; // Bind it to the modal
        spellList.appendChild(newnode); // And display it
      });
    }
    document.getElementById('charPanel').classList.remove('d-none'); // Unhide the character panel
  } catch (e) {
    if (e instanceof TypeError) {
      alert('Could not reach server. Please try again later.');
    }
    else {
      throw e;
    }
  }
}

async function readySpellModal (event) { // Event handler to fill in the details of the spell to the modal before we display it
  document.getElementById('spellInfoName').innerText = event.target.getAttribute('data-name');
  document.getElementById('spellInfoLevel').innerText = 'Level: ' + event.target.getAttribute('data-level');
  document.getElementById('spellInfoSchool').innerText = 'School: ' + event.target.getAttribute('data-school');
  document.getElementById('spellInfoComponents').innerText = 'Components: ' + event.target.getAttribute('data-components');
  document.getElementById('spellInfoDamage').innerText = 'Damage: ' + event.target.getAttribute('data-damage');
  document.getElementById('spellInfoDesc').innerText = event.target.getAttribute('data-desc');
}

async function addSpell (event) {
  try {
    const spell = event.target.getAttribute('data-spell');
    const bodyJson = { Spells: [[spell], []], Id: selectedChar.Id };
    const response = await fetch('http://localhost:8090/api/editchar', {
      method: 'POST',
      headers: new Headers({ Authorization: auth, 'Content-Type': 'application/json' }),
      body: JSON.stringify(bodyJson)
    });
    if (response.status === 200) {
      characters.find(x => x.Id === selectedChar.Id).Spells.push(spell);
      document.getElementById('addSpellModalClose').click();
      Array.from(document.getElementById('charresults').children).forEach(char => {
        if (char.getAttribute('data-character') === selectedChar.Id) {
          char.click(); // We simulate a click to get the char info again, just in case someone else made a change we need to fetch
        }
      });
    }
    else if (response.status === 400) {
      alert('Somthing went wrong trying to edit the character. Try reloading the page.');
    }
    else if (response.status === 401) {
      alert('Authorisation failed: are you logged in?');
    }
    else if (response.status === 500) {
      alert('Internal Server Error');
    }
    else {
      alert('Something went wrong. HTTP: ' + response.status);
    }
  } catch (e) {
    if (e instanceof TypeError) {
      alert('Could not reach the server. Please try again later.');
    }
    else {
      throw e;
    }
  }
}

async function removeSpell (event) {
  try {
    const spell = event.target.getAttribute('data-id');
    const response = await fetch('http://localhost:8090/api/editchar', {
      method: 'POST',
      headers: new Headers({ Authorization: auth, 'Content-Type': 'application/json' }),
      body: JSON.stringify({ Spells: [[], [spell]], Id: selectedChar.Id })
    });
    if (response.status === 200) {
      const spellList = document.getElementById('spellList');
      Array.from(spellList.children).forEach(x => {
        if (x.getAttribute('data-id') === spell) {
          spellList.removeChild(x);
        }
      });
      const spellData = charSpells.find(x => x.Id === spell);
      selectedChar.Spells = selectedChar.Spells.filter(x => x !== spellData.Id);
      const level = spellData.Level;
      charSpells = charSpells.filter(x => x !== spellData);
      if (charSpells.filter(x => x.Level === level).length === 0) {
        spellList.removeChild(Array.from(spellList.children).find(x => x.innerText === 'Level ' + level + ' Spells'));
      }
      document.getElementById('removeSpellModalClose').click();
    }
    else if (response.status === 400) {
      alert('Somthing went wrong trying to edit the character. Try reloading the page.');
    }
    else if (response.status === 401) {
      alert('Authorisation failed: are you logged in?');
    }
    else if (response.status === 500) {
      alert('Internal Server Error');
    }
    else {
      alert('Something went wrong. HTTP: ' + response.status);
    }
  } catch (e) {
    if (e instanceof TypeError) {
      alert('Could not reach the server. Please try again later.');
    }
    else {
      throw e;
    }
  }
}

document.getElementById('charsearch').onsubmit = async function (event) {
  try {
    event.preventDefault(); // We don't want to actually GET since that switches page
    const response = await fetch('http://localhost:8090/api/characters?name=' + document.getElementById('name').value, {
      method: 'GET',
      headers: new Headers({ Authorization: auth })
    }); // Complete the user's search
    characters = await response.json();
    makeCharList(characters); // Display it
  } catch (e) {
    if (e instanceof TypeError) {
      alert('Could not reach server. Please try again later.');
    }
    else {
      throw e;
    }
  }
};

document.getElementById('newCharBtn').onclick = async function (event) {
  document.getElementById('newCharErrorP').innerHTML = ''; // When we open the dialog, we don't want to inherit any old error messages
};

document.getElementById('newCharForm').onsubmit = async function (event) { // Form handler for new character
  try {
    event.preventDefault(); // Intercept default form method
    const form = document.getElementById('newCharForm'); // Get the form in question
    const formData = new FormData(form); // Grab the data out of the form
    const formJson = {};
    let incomplete = false; // This helps with a bit of input validation
    const text = document.getElementById('newCharErrorP');
    for (const [k, v] of formData.entries()) {
      formJson[k] = v;
      if (v === '') {
        incomplete = true;
      }
    } // Parser to turn the formdata object into express-friendly json
    if (incomplete) { // If the user hasn't filled out the form
      text.innerText = 'Please complete the form.';
      return; // Let them know
    }
    const response = await fetch('http://localhost:8090/api/newchar', {
      method: 'POST',
      headers: new Headers({ Authorization: auth, 'Content-Type': 'application/json' }),
      body: JSON.stringify(formJson)
    }); // Make the request to the server
    if (response.status === 400) { // We shouldn't get here since we handle this validation client-side, but just in case we have this
      text.innerText = 'Please complete the form.';
    }
    else if (response.status === 500) { // If the server has an issue just let the client know
      text.innerText = 'Internal Server Error';
    }
    else if (response.status === 401) { // This should only occur if the auth property is not set in localStorage (i.e. the user is not logged in)
      text.innerText = 'Request was unauthorised. Are you logged in?';
    }
    else if (response.status === 200) { // If everything is ok then we can close the dialog and reset the form
      document.getElementById('newCharModalClose').click();
      form.reset();
      getAllChars();
    }
    else {
      text.innerText = 'Something went wrong, got http ' + response.status; // Generic catch all
    }
  }
  catch (e) { // Error handling
    if (e instanceof TypeError) { // NetworkErrors come under here (these fire when the server is unreachable)
      document.getElementById('newCharErrorP').innerText = 'Could not reach server. Please try again later.';
    }
    else {
      throw e; // If it's any other kind of error then throw it
    }
  }
};

document.getElementById('editCharForm').onsubmit = async function (event) { // Form handler for the edit char form
  event.preventDefault(); // Stop the default form response
  const form = document.getElementById('editCharForm');
  const formData = new FormData(form); // Get the data
  const formJson = {};
  for (const [k, v] of formData.entries()) { // This should parse it into json,
    if (v !== selectedChar[k]) { // Only include elements that have been changed - resubmitting unchanged elements wouldn't break anything but it is wasteful
      formJson[k] = v;
    }
  }
  formJson.Id = selectedChar.Id; // Include the id so the server knows what character to edit
  const response = await fetch('http://localhost:8090/api/editchar', {
    method: 'POST',
    headers: new Headers({ Authorization: auth, 'Content-Type': 'application/json' }),
    body: JSON.stringify(formJson)
  }); // Make the request to the server
  const text = document.getElementById('editCharErrorP');
  if (response.status === 400) { // This should only happen if the same user is logged in on two machines and starts deleting stuff
    text.innerText = 'Could not find character - it may have been deleted. Try reloading the page.';
  }
  else if (response.status === 500) { // If the server has an issue just let the client know
    text.innerText = 'Internal Server Error';
  }
  else if (response.status === 401) { // This should only occur if the auth property is not set in localStorage (i.e. the user is not logged in)
    text.innerText = 'Request was unauthorised. Are you logged in?';
  }
  else if (response.status === 200) { // If everything is ok then we can close the dialog, reset the form, and reload the character's info
    document.getElementById('editCharModalClose').click();
    form.reset();
    await getAllChars();
    Array.from(document.getElementById('charresults').children).forEach(char => {
      if (char.getAttribute('data-character') === selectedChar.Id) {
        char.click(); // We simulate a click to get the char info again, just in case someone else made a change we need to fetch
      }
    });
  }
  else {
    text.innerText = 'Something went wrong, got http ' + response.status; // Generic catch all
  }
};

document.getElementById('charConDelBtn').onclick = async function (event) {
  try {
    const response = await fetch('http://localhost:8090/api/delchar', {
      method: 'POST',
      headers: new Headers({ Authorization: auth, 'Content-Type': 'application/json' }),
      body: JSON.stringify({ Id: selectedChar.Id })
    });
    if (response.status === 401) {
      alert('Deletion was unauthorised. Are you logged in?');
    }
    else if (response.status === 500) {
      alert('Internal Server Error');
    }
    else if (response.status === 200) {
      selectedChar = undefined;
      document.getElementById('charPanel').classList.add('d-none');
      getAllChars();
    }
  } catch (e) {
    if (e instanceof TypeError) {
      alert('Could not reach server. Please try again later.');
    }
  }
};

document.getElementById('editCharBtn').onclick = async function (event) { // Event handler to populate editing form when it's needed
  document.getElementById('editCharTitle').innerText = 'Editing ' + selectedChar.Name;
  document.getElementById('editCharName').value = selectedChar.Name;
  document.getElementById('editCharLvl').value = selectedChar.Level;
  document.getElementById('editCharClass').value = selectedChar.Class;
  document.getElementById('editCharRace').value = selectedChar.Race;
};

document.getElementById('spellSearchForm').onsubmit = async function (event) {
  try {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const queryString = new URLSearchParams(formData).toString();
    const response = await fetch('http://localhost:8090/api/spells?' + queryString, {
      method: 'GET',
      headers: new Headers({ Authorization: auth })
    });
    if (response.status === 500) {
      alert('Internal Server Error');
    }
    else if (response.status === 200) {
      let spells = await response.json();
      const resultsDiv = document.getElementById('addSpellResults');
      resultsDiv.innerHTML = '';
      spells = spells.filter(x => !selectedChar.Spells.includes(x.Id));
      spells.forEach(spell => {
        const template = document.getElementById('addSpellSearchResult');
        const clone = template.content.cloneNode(true);
        const button = clone.querySelector('button');
        button.innerText = spell.Name;
        button.setAttribute('data-target', '#spell-' + spell.Id);
        clone.querySelector('.resultLevel').innerText = 'Level: ' + spell.Level;
        clone.querySelector('.resultDamage').innerText = 'Damage: ' + spell.Damage;
        clone.querySelector('.resultSchool').innerText = 'School: ' + spell.School;
        clone.querySelector('.resultComponents').innerText = 'Components: ' + spell.Components;
        clone.querySelector('.resultDesc').innerText = spell.Desc;
        clone.querySelector('.collapse').setAttribute('id', 'spell-' + spell.Id);
        clone.querySelector('.btn-success').setAttribute('data-spell', spell.Id);
        clone.querySelector('.btn-success').onclick = addSpell;
        resultsDiv.appendChild(clone);
      });
      document.getElementById('addSpellResultsHeader').innerText = 'Results:';
    }
    else {
      alert('HTTP error ' + response.status);
    }
  } catch (e) {
    if (e instanceof TypeError) {
      alert('Could not reach server. Please try again later.');
    }
    else {
      throw e;
    }
  }
};

document.getElementById('removeSpellBtn').onclick = async function (event) {
  const spellList = document.getElementById('removeSpellList');
  spellList.innerHTML = '';
  for (let i = 0; i < 10; i++) { // Iterate through all possible d20 spell levels
    const lvlXSpells = charSpells.filter(x => x.Level === i); // Filter the spells of this level
    if (lvlXSpells.length === 0) { continue; } // If there aren't any, move on to the next level
    const levelTitle = document.createElement('button');
    levelTitle.setAttribute('class', 'list-group-item list-group-item-action flex-column align-items-start list-group-item-secondary');
    const levelText = document.createElement('h6');
    levelText.innerText = 'Level ' + i + ' Spells';
    levelTitle.appendChild(levelText);
    spellList.appendChild(levelTitle); // Create the title for the spell level
    lvlXSpells.forEach(spell => { // For every spell the character has of this level
      const newnode = document.createElement('div');
      newnode.setAttribute('class', 'list-group-item list-group-item-action flex-column align-items-start');
      const flex = document.createElement('div');
      flex.setAttribute('class', 'd-flex justify-content-between align-items-center');
      const text = document.createElement('div');
      text.setAttribute('class', 'justify-content-start');
      text.innerText = spell.Name;
      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('class', 'btn btn-danger justify-content-end');
      removeBtn.innerText = 'Remove';
      removeBtn.setAttribute('data-id', spell.Id);
      removeBtn.onclick = removeSpell;
      flex.appendChild(text);
      flex.appendChild(removeBtn);
      newnode.append(flex);
      spellList.appendChild(newnode); // And display it
    });
  }
};

getAllChars();
