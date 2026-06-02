// paste your exact Google Web App deployment URL here:
const API_URL = "https://script.google.com/macros/s/AKfycbzzT26fDQZLHo-dFfNqrmVxVBBUHm-DoScUAkEObBS3SNsO0x7SjVA44TZtJeWS-oBSAw/exec"; 

// --- LOGIN LOGIC ---
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", function() {
        const passcode = document.getElementById("passcodeInput").value;
        const errorMsg = document.getElementById("errorMessage");
        
        if(passcode === "") {
            showError("Please enter a passcode.");
            return;
        }

        this.innerText = "Loading...";
        errorMsg.style.display = "none";

        const payload = { action: "login", passcode: passcode };

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Server responded with:", data); // Debugging line
            if(data.status === "success") {
                localStorage.setItem("scoutUser", JSON.stringify(data.user));
                window.location.href = "dashboard.html";
            } else {
                showError(data.message);
            }
        })
        .catch(error => {
            console.error("Fetch Error:", error);
            showError("Network error. Please try again.");
        })
        .finally(() => {
            document.getElementById("loginBtn").innerText = "Set Sail";
        });
    });
}

function showError(message) {
    const errorMsg = document.getElementById("errorMessage");
    errorMsg.innerText = message;
    errorMsg.style.display = "block";
}


// --- DASHBOARD LOGIC ---
if (document.getElementById("playerName")) {
    console.log("Dashboard detected. Loading data..."); // Debugging line
    loadDashboard();
}

function loadDashboard() {
    const savedData = localStorage.getItem("scoutUser");
    console.log("Saved Data in memory:", savedData); // Debugging line
    
    if (!savedData) {
        console.log("No data found, redirecting to login...");
        window.location.href = "index.html";
        return; 
    }

    try {
        const user = JSON.parse(savedData);
        console.log("Parsed User Object:", user); // Debugging line

        document.getElementById("playerName").innerText = user.name;
        document.getElementById("playerIsland").innerText = user.tali3aId;
        document.getElementById("playerRole").innerText = user.role;
        document.getElementById("playerBalance").innerText = user.balance;

        document.getElementById("logoutBtn").addEventListener("click", function() {
            localStorage.removeItem("scoutUser");
            window.location.href = "index.html";
        });
    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

// --- TRACKER LOGIC ---
const trackerForm = document.getElementById("trackerForm");
if (trackerForm) {
    trackerForm.addEventListener("submit", function(event) {
        event.preventDefault(); // Prevents the page from refreshing
        
        const submitBtn = document.getElementById("trackerSubmitBtn");
        const messageEl = document.getElementById("trackerMessage");
        const user = JSON.parse(localStorage.getItem("scoutUser"));

        submitBtn.innerText = "Submitting...";
        messageEl.innerText = "";
        messageEl.style.color = "black";

        // Gather the form data
        const payload = {
            action: "submitTracker",
            userId: user.id,
            date: document.getElementById("trackDate").value,
            prayers: document.getElementById("checkPrayers").checked,
            mass: document.getElementById("checkMass").checked,
            church: document.getElementById("checkChurch").checked
        };

        // Send to Google Sheets
        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if(data.status === "success") {
                messageEl.innerText = "Log submitted successfully! Pending leader approval.";
                messageEl.style.color = "green";
                trackerForm.reset(); // Clear the form
            } else {
                messageEl.innerText = "Error: " + data.message;
                messageEl.style.color = "red";
            }
        })
        .catch(error => {
            messageEl.innerText = "Network error. Try again.";
            messageEl.style.color = "red";
        })
        .finally(() => {
            submitBtn.innerText = "Submit Log";
        });
    });
}