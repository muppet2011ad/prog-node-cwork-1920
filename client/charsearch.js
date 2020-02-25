document.getElementById("charsearch").onsubmit = async function (event) {
    event.preventDefault();
    const response = await fetch("http://localhost:8090/api/characters?name=" + document.getElementById("name").value, {
        method: "GET",
        headers: new Headers({"Authorization": localStorage.getItem("auth")}),
    });
    let json = await response.json()
    console.log(json);
}