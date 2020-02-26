let characters;

let auth = localStorage.getItem("auth");

async function getAllChars(){ // Setup function
    const response = await fetch("http://localhost:8090/api/characters", {
        method: "GET",
        headers: new Headers({"Authorization": localStorage.getItem("auth")}),
    }); // Fetch all characters
    characters = await response.json(); // Json it up
    makeCharList(characters); // Display it
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
    event.preventDefault(); // We don't want to actually GET since that switches page
    const response = await fetch("http://localhost:8090/api/characters?name=" + document.getElementById("name").value, {
        method: "GET",
        headers: new Headers({"Authorization": localStorage.getItem("auth")}),
    }); // Complete the user's search
    characters = await response.json();
    makeCharList(characters); // Display it
}

document.getElementById("newCharBtn").onclick = async function (event) {
    document.getElementById("newCharErrorP").innerHTML = "";
}

document.getElementById("newCharForm").onsubmit = async function (event) {
    event.preventDefault();
    let form = document.getElementById("newCharForm");
    let formData = new FormData(form);
    let formJson = {};
    let incomplete = false;
    let text = document.getElementById("newCharErrorP");
    for (const [k, v] of formData.entries()) {
        formJson[k] = v;
        if (v == "") {
            incomplete = true;
        }
    }
    if (incomplete) {
        text.innerText = "Please complete the form.";
        return;
    }
    const response = await fetch("http://localhost:8090/api/newchar", {
        method: "POST",
        headers: new Headers({"Authorization": auth, "Content-Type": "application/json"}),
        body: JSON.stringify(formJson)
    });
    if (response.status == 400) {
        text.innerText = "Please complete the form.";
    }
    else if (response.status == 500) {
        text.innerText = "Internal Server Error";
    }
    else if (response.status == 200) {
        document.getElementById("newCharModalClose").click();
        form.reset();
        getAllChars();
    }
    else {
        text.innerText = "Something went wrong"
    }
}

getAllChars();