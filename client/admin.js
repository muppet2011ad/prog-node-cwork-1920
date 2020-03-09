let auth = localStorage.getItem("auth");

document.getElementById("addSpellForm").onsubmit = async function (event) {
    try {
        event.preventDefault();
        let formData = new FormData(event.target);
        let formJson = {};
        for (const [k,v] of formData.entries()) { // This should parse it into json,
            formJson[k] = v;
        }
        const response = await fetch("http://localhost:8090/api/admin/addspell", {
            method: "POST",
            headers: new Headers({"Authorization": auth, "Content-Type": "application/json"}),
            body: JSON.stringify(formJson)
        });
        const resultText = document.getElementById("addSpellResult");
        if (response.status == 200) {
            event.target.reset();
            resultText.innerText = "Spell creation successful";
            resultText.setAttribute("style", "color:green");
        }
        else if (response.status == 401) {
            resultText.innerText = "Authentication failed. Are you logged in?";
            resultText.setAttribute("style", "color:red");
        }
        else if (response.status == 500) {
            resultText.innerText = "Internal Server Error";
            resultText.setAttribute("style", "color:red");
        }
        else if (response.status == 400) {
            resultText.innerText = "Form not completed";
            resultText.setAttribute("style", "color:red");
        }
    } catch (e) {
        if (e instanceof TypeError) {
            const resultText = document.getElementById("addSpellResult");
            resultText.innerText = "Could not reach the server. Please try again later.";
            resultText.setAttribute("style", "color:red");
        }
        else {
            throw e;
        }
    }
}