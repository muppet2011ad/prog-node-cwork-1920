let characters;

let auth = localStorage.getItem("auth");

async function getAllChars(){ // Setup function
    try {
        const response = await fetch("http://localhost:8090/api/characters", {
            method: "GET",
            headers: new Headers({"Authorization": localStorage.getItem("auth")}),
        }); // Fetch all characters
        characters = await response.json(); // Json it up
        makeCharList(characters); // Display it
    } catch (e) {
        if (e instanceof TypeError) {
            alert("Could not reach server. Please try again later.")
        }
        else {
            throw e;
        }
    }
}

function makeCharList(chars){
    let results = document.querySelector('#results'); // Find where we intend to display this
    let old = document.getElementById("charresults"); // Find what we already had displayed there
    if (old != undefined) { old.remove(); } // If it exists, purge it
    let newlist = document.createElement("div"); // Create a new div to store it in
    newlist.id = "charresults";
    chars.forEach(character => { // For every character fetched
        let newnode = document.createElement("a"); // Make them a box
        newnode.setAttribute("href", "#");
        newnode.setAttribute("class", "list-group-item list-group-item-action flex-column align-items-start");
        let heading = document.createElement("h5");
        heading.innerText = character.Name;
        newnode.appendChild(heading); // Fill the heading
        let labels = ["Level: " + character.Level, "Class: " + character.Class, "Race: " + character.Race];
        labels.forEach(label => {
            let newlabel = document.createElement("small");
            newlabel.innerText = label + "\n";
            newnode.appendChild(newlabel);
        }); // Fill out the data for all of the basic features of the character
        newlist.appendChild(newnode); // Append the list entry to the whole list
    });
    results.appendChild(newlist); // Display the whole thing (it's better to construct it all then parent the whole thing for performance reasons)
}

document.getElementById("charsearch").onsubmit = async function (event) {
    try {
        event.preventDefault(); // We don't want to actually GET since that switches page
        const response = await fetch("http://localhost:8090/api/characters?name=" + document.getElementById("name").value, {
            method: "GET",
            headers: new Headers({"Authorization": localStorage.getItem("auth")}),
        }); // Complete the user's search
        characters = await response.json();
        makeCharList(characters); // Display it
    } catch (e) {
        if (e instanceof TypeError) {
            alert("Could not reach server. Please try again later.")
        }
        else {
            throw e;
        }
    }
}

document.getElementById("newCharBtn").onclick = async function (event) {
    document.getElementById("newCharErrorP").innerHTML = ""; // When we open the dialog, we don't want to inherit any old error messages
}

document.getElementById("newCharForm").onsubmit = async function (event) { // Form handler for new character
    try {
        event.preventDefault(); // Intercept default form method
        let form = document.getElementById("newCharForm"); // Get the form in question
        let formData = new FormData(form); // Grab the data out of the form
        let formJson = {};
        let incomplete = false; // This helps with a bit of input validation
        let text = document.getElementById("newCharErrorP");
        for (const [k, v] of formData.entries()) {
            formJson[k] = v;
            if (v == "") {
                incomplete = true;
            }
        } // Parser to turn the formdata object into express-friendly json
        if (incomplete) { // If the user hasn't filled out the form
            text.innerText = "Please complete the form.";
            return; // Let them know
        }
        const response = await fetch("http://localhost:8090/api/newchar", {
            method: "POST",
            headers: new Headers({"Authorization": auth, "Content-Type": "application/json"}),
            body: JSON.stringify(formJson)
        }); // Make the request to the server
        if (response.status == 400) { // We shouldn't get here since we handle this validation client-side, but just in case we have this
            text.innerText = "Please complete the form.";
        }
        else if (response.status == 500) { // If the server has an issue just let the client know
            text.innerText = "Internal Server Error";
        }
        else if (response.status == 401) { // This should only occur if the auth property is not set in localStorage (i.e. the user is not logged in)
            text.innerText = "Request was unauthorised. Are you logged in?"
        }
        else if (response.status == 200) { // If everything is ok then we can close the dialog and reset the form
            document.getElementById("newCharModalClose").click();
            form.reset();
            getAllChars();
        }
        else {
            text.innerText = "Something went wrong, got http " + response.status // Generic catch all
        }
    }
    catch (e) { // Error handling
        if (e instanceof TypeError) { // NetworkErrors come under here (these fire when the server is unreachable)
            document.getElementById("newCharErrorP").innerText = "Could not reach server. Please try again later."
        }
        else{
            throw e; // If it's any other kind of error then throw it
        }
    }
}

getAllChars();