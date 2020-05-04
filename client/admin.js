const auth = localStorage.getItem('auth');

async function getAllSpells () {
  const spellList = document.getElementById('delSpellList');
  spellList.innerHTML = '';
  const response = await fetch('http://localhost:8090/api/spells', {
    method: 'GET',
    headers: new Headers({ Authorization: auth })
  });
  const spells = await response.json();
  for (let i = 0; i < 10; i++) { // Iterate through all possible d20 spell levels
    const lvlXSpells = spells.filter(x => x.Level === i); // Filter the spells of this level
    if (lvlXSpells.length === 0) { continue; } // If there aren't any, move on to the next level
    const levelTitle = document.createElement('button');
    levelTitle.setAttribute('class', 'list-group-item list-group-item-action flex-column align-items-start list-group-item-secondary');
    const levelText = document.createElement('h6');
    levelText.innerText = 'Level ' + i + ' Spells';
    levelTitle.appendChild(levelText);
    spellList.appendChild(levelTitle); // Create the title for the spell level
    lvlXSpells.forEach(spell => { // For every spell the character has of this level
      const newnode = document.createElement('div'); // DOM manipulation to create the element, nothing to see here
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
      removeBtn.setAttribute('data-toggle', 'modal');
      removeBtn.setAttribute('data-target', '#delSpellModal');
      removeBtn.onclick = prepModal;
      flex.appendChild(text);
      flex.appendChild(removeBtn);
      newnode.append(flex);
      spellList.appendChild(newnode); // And display it
    });
  }
}

async function delSpell (event) { // Function to delete spell
  try {
    const spell = event.target.getAttribute('data-id'); // Get the spell id
    const response = await fetch('http://localhost:8090/api/admin/delspell?id=' + spell, {
      method: 'POST',
      headers: new Headers({ Authorization: auth })
    }); // Make the request
    if (response.status === 200) {
      getAllSpells(); // If everything went ok, reload the available spells
    }
    else if (response.status === 401) { // Otherwise begin the HTTP error handling
      alert('Authentication failed. Are you logged in?');
    }
    else if (response.status === 500) {
      alert('Internal Server Error');
    }
    else if (response.status === 400) {
      alert('Bad request. Try reloading the page.');
    }
    else {
      alert('Something went wrong. HTTP ' + response.status);
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

async function prepModal (event) { // Prepares the modal to delete a spell
  document.getElementById('delSpellConfirm').setAttribute('data-id', event.target.getAttribute('data-id')); // Sets a data attribute with the id to delete
}

document.getElementById('addSpellForm').onsubmit = async function (event) { // Function to add a spell
  try {
    event.preventDefault(); // Prevent default form submission
    const formData = new FormData(event.target); // Get the formdata
    const formJson = {};
    for (const [k, v] of formData.entries()) { // Parse it into JSON
      if (k === 'Level') { formJson[k] = parseInt(v); } // Make sure to convert level to an int
      else { formJson[k] = v; }
    }
    const response = await fetch('http://localhost:8090/api/admin/addspell', {
      method: 'POST',
      headers: new Headers({ Authorization: auth, 'Content-Type': 'application/json' }),
      body: JSON.stringify(formJson)
    }); // Make the request
    const resultText = document.getElementById('addSpellResult'); // Get the element used to display the result
    if (response.status === 200) { // If all went well
      event.target.reset();
      resultText.innerText = 'Spell creation successful';
      resultText.setAttribute('style', 'color:green');
      getAllSpells(); // Make that clear and reload all spells
    }
    else if (response.status === 401) { // Otherwise get some error handling going
      resultText.innerText = 'Authentication failed. Are you logged in?';
      resultText.setAttribute('style', 'color:red');
    }
    else if (response.status === 500) {
      resultText.innerText = 'Internal Server Error';
      resultText.setAttribute('style', 'color:red');
    }
    else if (response.status === 400) {
      resultText.innerText = 'Form not completed';
      resultText.setAttribute('style', 'color:red');
    }
  } catch (e) {
    if (e instanceof TypeError) {
      const resultText = document.getElementById('addSpellResult');
      resultText.innerText = 'Could not reach the server. Please try again later.';
      resultText.setAttribute('style', 'color:red');
    }
    else {
      throw e;
    }
  }
};

document.getElementById('delSpellConfirm').onclick = delSpell;

getAllSpells();
