// paste your exact Google Web App deployment URL here:
const API_URL = "https://script.google.com/macros/s/AKfycbzzT26fDQZLHo-dFfNqrmVxVBBUHm-DoScUAkEObBS3SNsO0x7SjVA44TZtJeWS-oBSAw/exec"; 
let globalTacticalItems = {}; // Stores tactical data for the popup


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
    
    if (!savedData) {
        window.location.href = "index.html";
        return; 
    }

    // 1. Instantly display cached data so the UI doesn't look blank or broken
    const user = JSON.parse(savedData);
    updateDashboardUI(user);

    // 2. Immediately fetch fresh data from the server in the background
    console.log("Syncing with server for fresh data...");
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "getUserData",
            userId: user.id
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            console.log("Database sync complete.");
            // Overwrite local memory with fresh server data
            localStorage.setItem("scoutUser", JSON.stringify(data.user));
            // Update the UI elements seamlessly with the new numbers/history
            updateDashboardUI(data.user);
            fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "getTeamData",
                    tali3aId: data.user.tali3aId
                })
            })
            .then(res => res.json())
            .then(teamData => {
                if(teamData.status === "success") {
                    console.log("Team Sync Complete", teamData);
                    // Save the team data to browser memory
                    localStorage.setItem("teamInventory", JSON.stringify(teamData.inventory));
                    localStorage.setItem("teamShip", JSON.stringify(teamData.ship));
                    localStorage.setItem("teamDataCache", JSON.stringify(teamData));

                    // --- NEW: Trigger the Shipyard drawing ---
                    initShipyard();
                    initTacticalUI();
                    initTradePort();
                    initLeaderboard();
                    
                    // --- NEW: Dynamically render Active Defense Shield ---
                    document.getElementById("currentShield").innerText = teamData.defense || "None";
                }
            })
            .catch(err => console.error("Team sync failed:", err))
            .finally(() => {
                hideLoading();
            });
        }
    })
    .catch(error => {
        console.error("Background sync failed:", error);
        hideLoading();
    });

    // Setup Logout Button
    document.getElementById("logoutBtn").addEventListener("click", function() {
        localStorage.removeItem("scoutUser");
        window.location.href = "index.html";
    });
}

// Helper function to safely change the text on the screen
function updateDashboardUI(user) {
    document.getElementById("playerName").innerText = user.name;
    document.getElementById("playerIsland").innerText = user.tali3aId;
    document.getElementById("playerRole").innerText = user.role;
    document.getElementById("playerBalance").innerText = user.balance;

    // Trigger an evaluation of the calendar date choice if it has a value selected
    const dateInput = document.getElementById("trackDate");
    if (dateInput && dateInput.value) {
        // Force the date blocker to recalculate based on the updated history array
        const event = new Event('change');
        dateInput.dispatchEvent(event);
    }
}

// --- TRACKER LOGIC ---
const trackerForm = document.getElementById("trackerForm");
if (trackerForm) {
    const dateInput = document.getElementById("trackDate");
    const submitBtn = document.getElementById("trackerSubmitBtn");
    const messageEl = document.getElementById("trackerMessage");
    
    // Get user data including their history
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    const today = new Date().toISOString().split('T')[0];
    dateInput.max = today;

    // REAL-TIME UI BLOCKER: Listen for when the user picks a date
    dateInput.addEventListener("change", function() {
        if (user && user.history && user.history.includes(this.value)) {
            submitBtn.disabled = true;
            submitBtn.style.backgroundColor = "gray";
            messageEl.innerText = "⚠️ لقد قمت بتسجيل هذا اليوم مسبقاً.";
            messageEl.style.color = "red";
        } else {
            submitBtn.disabled = false;
            submitBtn.style.backgroundColor = ""; // Reset to default CSS
            messageEl.innerText = "";
        }
    });

    trackerForm.addEventListener("submit", function(event) {
        event.preventDefault(); 
        
        submitBtn.innerText = "جاري الحفظ...";
        messageEl.innerText = "";

        const payload = {
            action: "submitTracker",
            userId: user.id,
            date: dateInput.value,
            morning: document.getElementById("checkMorning").checked,
            night: document.getElementById("checkNight").checked,
            team: document.getElementById("checkTeam").checked,
            bible: document.getElementById("checkBible").checked,
            tasbeha: document.getElementById("checkTasbeha").checked,
            mass: document.getElementById("checkMass").checked,
            sundaySchool: document.getElementById("checkSundaySchool").checked,
            khoros: document.getElementById("checkKhoros").checked
        };

        showLoading("Saving Daily Log...");

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if(data.status === "success") {
                messageEl.innerText = "تم تسجيل اليوم بنجاح!";
                messageEl.style.color = "green";
                
                // Add the new date to the local history so it blocks immediately
                user.history.push(dateInput.value);
                localStorage.setItem("scoutUser", JSON.stringify(user));
                
                trackerForm.reset();
            } else {
                messageEl.innerText = data.message; 
                messageEl.style.color = "red";
            }
        })
        .catch(error => {
            messageEl.innerText = "حدث خطأ في الاتصال. حاول مرة أخرى.";
            messageEl.style.color = "red";
        })
        .finally(() => {
            submitBtn.innerText = "تسجيل اليوم";
            dateInput.max = today; 
            hideLoading();
        });
    });
}

// This function runs automatically every time a cell is manually edited in the spreadsheet
function onEdit(e) {
  // If the edit wasn't done by a user or is out of bounds, stop.
  if (!e || !e.range) return;
  
  const sheet = e.source.getActiveSheet();
  
  // Only listen to edits happening in the Daily_Tracking tab
  if (sheet.getName() !== "Daily_Tracking") return;
  
  const range = e.range;
  const col = range.getColumn();
  const row = range.getRow();
  
  // Check if the edited column was "Status" (Column M is the 13th column)
  if (col === 13 && row > 1) {
    const newValue = e.value;
    
    // Trigger the automation ONLY if the leader typed "Approved"
    if (newValue === "Approved") {
      // Read the entire row's data
      const dataRow = sheet.getRange(row, 1, 1, 13).getValues()[0];
      const userId = dataRow[1]; // Column B (User_ID)
      const awarded = parseInt(dataRow[11]); // Column L (La7alee7_Awarded)
      
      // Safety Check: Make sure the leader actually typed a number in the Awarded column!
      if (isNaN(awarded) || awarded <= 0) {
        e.range.setValue("Error: Enter Tokens");
        return;
      }
      
      // Now, open the Users sheet to update their wallet
      const usersSheet = e.source.getSheetByName("Users");
      const usersData = usersSheet.getDataRange().getValues();
      
      for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][0] === userId) {
          // Found the user! Grab their current balances
          const currentBalance = parseInt(usersData[i][5]) || 0; // Column F
          const lifetimeEarned = parseInt(usersData[i][6]) || 0; // Column G
          
          // Add the new tokens
          usersSheet.getRange(i + 1, 6).setValue(currentBalance + awarded);
          usersSheet.getRange(i + 1, 7).setValue(lifetimeEarned + awarded);
          usersSheet.getRange(i + 1, 8).setValue(new Date()); // Update Last_Track_Date
          
          // Change the tracking status to "Updated" so it can't be processed again
          e.range.setValue("Updated");
          break;
        }
      }
    }
  }
}

// --- PORT MARKET LOGIC ---

// Automatically check if the market container exists when the dashboard loads
if (document.getElementById("marketContainer")) {
    initMarket();
}

function initMarket() {
    // Load the game config file from your local repository folder
    fetch("gameData.json")
        .then(response => response.json())
        .then(config => {
            renderMarketCards(config.gameEconomy.rawMaterials);
        })
        .catch(err => console.error("Error loading market config data:", err));
}

function renderMarketCards(materials) {
    const marketContainer = document.getElementById("marketContainer");
    marketContainer.innerHTML = ""; // Clear existing elements

    // Loop through each raw material item inside the configuration dictionary
    for (const [key, item] of Object.entries(materials)) {
        const card = document.createElement("div");
        card.className = "market-card";
        card.style = "border: 1px solid #ccc; padding: 10px; border-radius: 5px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;";

        card.innerHTML = `
            <img src="assets/${key}.png" class="item-icon" onerror="this.style.display='none'" alt="${item.name}">
            <h4 style="margin: 5px 0;">${item.name}</h4>
            <p style="font-size: 12px; color: #666; margin: 5px 0; height: 35px;">${item.description}</p>
            <p style="font-weight: bold; margin: 5px 0; color: #856404; background: #fff3cd; padding: 5px; border-radius: 5px;">💰 ${item.cost} La7alee7</p>
            <div style="margin-top: 10px; display: flex; gap: 5px;">
                <input type="number" id="qty_${key}" value="1" min="1" max="99" style="width: 50px; text-align: center; padding: 5px; margin: 0;">
                <button onclick="purchaseMaterial('${key}')" style="flex-grow: 1; padding: 5px; font-size: 14px;">Buy</button>
            </div>
        `;
        marketContainer.appendChild(card);
    }
}

function purchaseMaterial(materialKey) {
    const qtyInput = document.getElementById(`qty_${materialKey}`);
    const quantity = parseInt(qtyInput.value, 10);
    const user = JSON.parse(localStorage.getItem("scoutUser"));

    if (isNaN(quantity) || quantity <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    if (!confirm(`Are you sure you want to buy ${quantity} unit(s)?`)) {
        return;
    }

    // Transmit the purchase action payload to the Apps Script endpoint
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "buyMaterial",
            userId: user.id,
            materialId: materialKey,
            qty: quantity
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            alert("Purchase successful! Resources delivered to your Tali3a inventory.");
            qtyInput.value = "1"; // Reset quantity input field
            
            // Trigger a background refresh to instantly update the wallet balance numbers on screen
            loadDashboard(); 
        } else {
            alert("Purchase Denied: " + data.message);
            hideLoading();
        }
    })
    .catch(error => {
        console.error("Market Transaction Error:", error);
        alert("Network error processing transaction. Please try again.");
        hideLoading();
    });
}

// --- SHIPYARD LOGIC ---

function initShipyard() {
    const container = document.getElementById("shipyardContainer");
    if (!container) return;

    fetch("gameData.json")
        .then(res => res.json())
        .then(config => {
            renderShipyardCards(config.gameEconomy.shipParts, config.gameEconomy.rawMaterials);
        })
        .catch(err => console.error("Error loading shipyard config:", err));
}

function renderShipyardCards(shipParts, rawMaterials) {
    const container = document.getElementById("shipyardContainer");
    container.innerHTML = "";
    //container.style = "display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-top: 15px;";

    const teamInv = JSON.parse(localStorage.getItem("teamInventory")) || {};
    const teamShip = JSON.parse(localStorage.getItem("teamShip")) || {};
    const user = JSON.parse(localStorage.getItem("scoutUser"));

    for (const [partKey, part] of Object.entries(shipParts)) {
// Safely check if Google Sheets sent a boolean OR the word "TRUE"
        const isBuilt = (teamShip[partKey] === true || String(teamShip[partKey]).toUpperCase() === "TRUE");
        const depMet = part.dependency === null ? true : (teamShip[part.dependency] === true || String(teamShip[part.dependency]).toUpperCase() === "TRUE");
        // Generate the Recipe HTML
        let recipeHtml = `<ul style="text-align: left; font-size: 13px; list-style-type: none; padding-left: 0;">`;
        let canAfford = true;

        for (const [matKey, reqQty] of Object.entries(part.recipe)) {
            const currentAmount = teamInv[matKey] || 0;
            if (currentAmount < reqQty) canAfford = false;
            
            const matName = rawMaterials[matKey].name;
            const color = currentAmount >= reqQty ? "green" : "red";
            recipeHtml += `<li style="color: ${color}; padding: 2px 0;">• ${currentAmount}/${reqQty} ${matName}</li>`;
        }
        recipeHtml += `</ul>`;

        // Determine what button/warning to show
        let actionHtml = "";
        if (isBuilt) {
            actionHtml = `<div style="background-color: #d4edda; color: #155724; padding: 10px; border-radius: 5px; font-weight: bold;">✔️ Built</div>`;
        } else if (!depMet) {
            actionHtml = `<div style="background-color: #e2e3e5; color: #383d41; padding: 10px; border-radius: 5px; font-size: 13px;">🔒 Requires: ${shipParts[part.dependency].name}</div>`;
        } else if (!canAfford) {
            actionHtml = `<div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; font-size: 13px;">❌ Not enough materials</div>`;
        } else if (user.role !== "Master") {
            actionHtml = `<div style="background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; font-size: 13px;">⚠️ Only the Master can craft</div>`;
        } else {
            actionHtml = `<button onclick="craftPart('${partKey}')" style="background-color: #28a745; color: white; padding: 10px; width: 100%; cursor: pointer; border: none; border-radius: 5px; font-weight: bold; font-size: 15px;">🔨 Craft ${part.name}</button>`;
        }

        // Draw the Card
        const card = document.createElement("div");
        card.style = `border: 2px solid ${isBuilt ? "#28a745" : "#ccc"}; padding: 15px; border-radius: 8px; text-align: center; background-color: ${isBuilt ? "#f2fff5" : "#fff"};`;
        card.innerHTML = `
            <img src="assets/${partKey}.png" class="ship-icon" onerror="this.style.display='none'" alt="${part.name}">
            <h3 style="margin: 0 0 5px 0;">${part.name}</h3>
            <p style="font-size: 12px; color: #666; margin-bottom: 10px; height: 35px;">${part.description}</p>
            <div style="background: rgba(255,255,255,0.5); padding: 10px; border-radius: 5px; margin-bottom: 15px; min-height: 80px; border: 1px solid #ddd;">
                <p style="margin: 0 0 5px 0; font-weight: bold; font-size: 14px; text-align: left;">Requirements:</p>
                ${recipeHtml}
            </div>
            ${actionHtml}
        `;
        container.appendChild(card);
    }
}

function craftPart(partKey) {
    if (!confirm("Are you sure you want to craft this part? This will permanently consume your Tali3a's materials.")) return;
    showLoading("Crafting ship part...");
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "craftPart",
            tali3aId: user.tali3aId,
            userId: user.id,
            partId: partKey
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            alert("Success! Your Shipyard has been upgraded.");
            loadDashboard(); // Refreshes everything instantly
        } else {
            alert("Crafting Failed: " + data.message);
            hideLoading();
        }
    })
    .catch(err => {
        alert("Network error. Check connection.");
        hideLoading();
    });
}

// Automatically check if the shipyard container exists when the dashboard loads
if (document.getElementById("shipyardContainer")) {
    initShipyard();
}


// --- TACTICAL MARKET, COMBAT & NOTIFICATIONS LOGIC ---

function initTacticalUI() {
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    const teamData = JSON.parse(localStorage.getItem("teamDataCache")); // We will save this in loadDashboard
    
    if(!teamData) return;

    fetch("gameData.json")
        .then(res => res.json())
        .then(config => {
            globalTacticalItems = config.gameEconomy.tacticalItems; // <-- ADD THIS LINE
            renderBlackMarket(config.gameEconomy.tacticalItems, config.gameEconomy.rawMaterials, teamData);
            renderTacticalMap(config.gameEconomy.tacticalItems, teamData, user);
            renderNotifications(teamData.notifications);
        });
}

function renderBlackMarket(tacticalItems, rawMaterials, teamData) {
    const container = document.getElementById("blackMarketContainer");
    if(!container) return;
    container.innerHTML = "";

    const user = JSON.parse(localStorage.getItem("scoutUser"));

    for (const [key, item] of Object.entries(tacticalItems)) {
        let reqHtml = `<p style="margin:5px 0; font-size: 13px;">💰 ${item.costTokens} La7alee7</p><ul style="font-size: 12px; padding-left: 15px; margin: 0 0 10px 0;">`;
        let canAfford = (user.balance >= item.costTokens);

        for (const [matKey, qty] of Object.entries(item.costMats)) {
            const hasAmount = teamData.inventory[matKey] || 0;
            const color = hasAmount >= qty ? "green" : "red";
            if(hasAmount < qty) canAfford = false;
            reqHtml += `<li style="color: ${color}">📦 ${hasAmount}/${qty} ${rawMaterials[matKey].name}</li>`;
        }
        reqHtml += `</ul>`;

        const btnHtml = canAfford 
            ? `<button onclick="buyTacticalItem('${key}')" style="background-color: purple; color: white; border: none; padding: 8px; width: 100%; border-radius: 4px; cursor: pointer; font-weight: bold;">Buy ${item.name}</button>`
            : `<button disabled style="background-color: gray; color: white; border: none; padding: 8px; width: 100%; border-radius: 4px;">Cannot Afford</button>`;

        // NEW: The Intel Button
        const infoBtn = `<button onclick="showTacticalInfo('${key}')" style="background-color: #2980b9; color: white; border: none; padding: 8px; width: 100%; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 8px;">ℹ️ Strategic Intel</button>`;

        const card = document.createElement("div");
        card.style = "border: 1px solid #ccc; padding: 10px; border-radius: 5px; background-color: #f9f9f9;";
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <h4 style="margin: 0 0 5px 0; color: purple;">${item.name}</h4>
                <span class="inventory-badge">Owned: ${teamData.tactical[key] || 0}</span>
            </div>
            <img src="assets/${key}.png" class="item-icon" onerror="this.style.display='none'" alt="${item.name}">
            <p style="font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 0 0 10px 0; color: gray;">${item.type} Item</p>
            <div style="background: white; border: 1px solid #eee; padding: 5px; border-radius: 5px; margin-bottom: 10px;">
                ${reqHtml}
            </div>
            ${infoBtn} ${btnHtml}
        `;
        container.appendChild(card);
    }
}

function renderTacticalMap(tacticalItems, teamData, user) {
    // 1. Calculate 7-Day Cooldowns
    const now = new Date();
    const isMaster = user.role === "Master";
    
    let canAttack = true;
    let canDefend = true;

    if (teamData.cooldowns.attack) {
        const lastAtk = new Date(teamData.cooldowns.attack);
        const diffDays = Math.floor((now - lastAtk) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
            canAttack = false;
            document.getElementById("attackCooldownText").innerText = `⏳ Weapons cooling down. Available in ${7 - diffDays} days.`;
            document.getElementById("raidSubmitBtn").disabled = true;
            document.getElementById("raidSubmitBtn").style.backgroundColor = "gray";
        }
    }

    if (teamData.cooldowns.defense) {
        const lastDef = new Date(teamData.cooldowns.defense);
        const diffDays = Math.floor((now - lastDef) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
            canDefend = false;
            document.getElementById("defenseCooldownText").innerText = `⏳ Shields recharging. Available in ${7 - diffDays} days.`;
        }
    }

    // 2. Populate Target Dropdown dynamically
    const targetSelect = document.getElementById("targetSelect");
    targetSelect.innerHTML = `<option value="">-- Choose Target --</option>`;
    teamData.islandList.forEach(island => {
        if (island.id !== user.tali3aId) {
            targetSelect.innerHTML += `<option value="${island.id}">${island.name} (${island.id})</option>`;
        }
    });

    // 3. Populate Weapons & Defenses from Arsenal
    const weaponSelect = document.getElementById("weaponSelect");
    weaponSelect.innerHTML = `<option value="">-- Select Weapon from Arsenal --</option>`;
    
    const defContainer = document.getElementById("defenseActionContainer");
    defContainer.innerHTML = "";

    let hasWeapon = false;

    for (const [key, qty] of Object.entries(teamData.tactical)) {
        if (qty > 0) {
            const itemConfig = tacticalItems[key];
            if (itemConfig.type === "attack") {
                weaponSelect.innerHTML += `<option value="${key}">${itemConfig.name} (x${qty})</option>`;
                hasWeapon = true;
            } else if (itemConfig.type === "defense") {
                const btn = document.createElement("button");
                btn.innerText = `🛡️ Activate ${itemConfig.name} (x${qty})`;
                btn.style = `padding: 10px; background-color: blue; color: white; font-weight: bold; border-radius: 5px; cursor: pointer; border: none;`;
                if (!canDefend || !isMaster) {
                    btn.style.backgroundColor = "gray";
                    btn.disabled = true;
                } else {
                    btn.onclick = () => submitTacticalAction("defense", key, itemConfig.name, null);
                }
                defContainer.appendChild(btn);
            }
        }
    }

    if (!hasWeapon) weaponSelect.innerHTML = `<option value="">Arsenal Empty! Buy weapons from Black Market.</option>`;
}

function buyTacticalItem(itemKey) {
    if(!confirm("Are you sure?")) return;
    showLoading("Smuggling items from the Black Market..."); // SHOW LOADER
    
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "buyTacticalItem", userId: user.id, tali3aId: user.tali3aId, itemKey: itemKey })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") { alert("Item added!"); loadDashboard(); } 
        else { alert("Purchase failed: " + data.message); hideLoading(); } // HIDE ON ERROR
    }).catch(() => hideLoading());
}

function submitTacticalAction(type, itemKey, itemName, targetId) {
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    
    // Double Confirmation Protocol
    let msg = type === "defense" 
        ? `FINAL WARNING: Activating [${itemName}] will consume the item and freeze your defense systems for 7 DAYS. Proceed?`
        : `FINAL WARNING: Launching [${itemName}] at ${targetId} will consume the weapon and freeze your attack systems for 7 DAYS. Proceed?`;
        
    if (!confirm(msg)) return;
    if (!confirm("Are you ABSOLUTELY sure? This action cannot be undone.")) return;

    showLoading("Executing tactical orders...");

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "executeTacticalAction", type: type, tali3aId: user.tali3aId, userId: user.id, itemKey: itemKey, itemName: itemName, targetId: targetId })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            alert(type === "defense" ? "Defense Activated Successfully!" : "Attack submitted to Fleet Leaders for approval!");
            loadDashboard();
        } else {
            alert("Error: " + data.message);
            hideLoading();
        }
    })
    .catch(() => hideLoading());
}

// Attach combat form listener
const combatForm = document.getElementById("combatForm");
if (combatForm) {
    combatForm.addEventListener("submit", function(e) {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem("scoutUser"));
        if (user.role !== "Master") return alert("Only the Master can launch attacks!");
        
        const target = document.getElementById("targetSelect").value;
        const weaponKey = document.getElementById("weaponSelect").value;
        const weaponName = document.getElementById("weaponSelect").options[document.getElementById("weaponSelect").selectedIndex].text.split(" (")[0];

        if(!target || !weaponKey) return alert("Select target and weapon!");
        submitTacticalAction("attack", weaponKey, weaponName, target);
    });
}

function renderNotifications(notifs) {
    const section = document.getElementById("notificationSection");
    const container = document.getElementById("notificationContainer");
    container.innerHTML = "";
    
    if (!notifs || notifs.length === 0) {
        section.style.display = "none";
        return;
    }
    
    section.style.display = "block";
    const user = JSON.parse(localStorage.getItem("scoutUser"));

    notifs.forEach(n => {
        const div = document.createElement("div");
        div.style = "background: white; padding: 10px; border-radius: 5px; border-left: 5px solid #856404; display: flex; justify-content: space-between; align-items: center;";
        
        const content = document.createElement("div");
        content.innerHTML = `<p style="margin: 0; font-weight: bold;">${n.message}</p><p style="margin: 0; font-size: 11px; color: gray;">Approved By: ${n.leader} | Date: ${n.date}</p>`;
        div.appendChild(content);

        if (user.role === "Master" && !n.isRead) {
            const btn = document.createElement("button");
            btn.innerText = "Mark as Read";
            btn.style = "padding: 5px 10px; cursor: pointer; background: #856404; color: white; border: none; border-radius: 3px;";
            btn.onclick = () => {
                fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "markNotificationRead", notifId: n.id }) })
                .then(() => loadDashboard());
            };
            div.appendChild(btn);
        }
        container.appendChild(div);
    });
}

// --- TRADING PORT & CREW BANK LOGIC ---

// Call this inside loadDashboard -> .then() alongside initTacticalUI()
function initTradePort() {
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    const teamData = JSON.parse(localStorage.getItem("teamDataCache"));
    if(!teamData) return;

    fetch("gameData.json")
        .then(res => res.json())
        .then(config => {
            renderTradeUI(user, teamData, config.gameEconomy.rawMaterials);
        });
}

function renderTradeUI(user, teamData, rawMaterials) {
    const isMaster = user.role === "Master";
    
    // 1. Role Verification & UI Toggles
    if(isMaster) {
        document.getElementById("createTradePanel").style.display = "block";
        document.getElementById("bankSection").style.display = "none";
        
        // Populate Dropdowns
        const offSel = document.getElementById("offerMatSelect");
        const reqSel = document.getElementById("reqMatSelect");
        offSel.innerHTML = "";
        reqSel.innerHTML = `<option value="None">No Materials</option>`;
        
        for (const [key, mat] of Object.entries(rawMaterials)) {
            const owned = teamData.inventory[key] || 0;
            offSel.innerHTML += `<option value="${key}">${mat.name} (Own: ${owned})</option>`;
            reqSel.innerHTML += `<option value="${key}">${mat.name}</option>`;
        }
    } else {
        document.getElementById("bankSection").style.display = "block";
    }

    // 2. Render Global Offers
    const container = document.getElementById("globalTradesContainer");
    container.innerHTML = "";
    
    if(!teamData.globalTrades || teamData.globalTrades.length === 0) {
        container.innerHTML = `<p style="color: gray; font-size: 14px;">No active trades on the market.</p>`;
        return;
    }

    teamData.globalTrades.forEach(trade => {
        const offName = rawMaterials[trade.offerMat].name;
        const reqName = trade.reqMat !== "None" ? rawMaterials[trade.reqMat].name : "";
        
        let reqString = "";
        if(trade.reqQty > 0) reqString += `${trade.reqQty}x ${reqName}`;
        if(trade.reqQty > 0 && trade.reqTokens > 0) reqString += ` AND `;
        if(trade.reqTokens > 0) reqString += `${trade.reqTokens} La7alee7`;
        if(reqString === "") reqString = "Free (Donation)";

        const isOwn = trade.sellerTali3a === user.tali3aId;
        let actionBtn = "";
        
        if (isOwn) {
            actionBtn = `<div style="text-align: center; color: gray; font-size: 12px; font-weight: bold; margin-top: 10px;">Your Island's Offer</div>`;
        } else if (!isMaster) {
            actionBtn = `<div style="text-align: center; color: gray; font-size: 12px; font-weight: bold; margin-top: 10px;">Only Master Can Accept</div>`;
        } else {
            actionBtn = `<button onclick="acceptTrade('${trade.offerId}')" style="width: 100%; background: #007bff; color: white; border: none; padding: 8px; margin-top: 10px; font-weight: bold; cursor: pointer; border-radius: 3px;">Accept Trade</button>`;
        }

        container.innerHTML += `
            <div style="border: 2px solid ${isOwn ? '#28a745' : '#ccc'}; padding: 15px; border-radius: 5px; background: #fff;">
                <p style="margin: 0 0 5px 0; font-size: 11px; color: gray;">Seller: ${trade.sellerTali3a} | Expires: 3 Days</p>
                <h4 style="margin: 0 0 10px 0; color: #28a745;">Offering: ${trade.offerQty}x ${offName}</h4>
                <div style="background: #f8f9fa; padding: 8px; border-radius: 3px;">
                    <p style="margin: 0; font-size: 12px; font-weight: bold;">Requiring:</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #dc3545;">${reqString}</p>
                </div>
                ${actionBtn}
            </div>
        `;
    });
}

function createTrade() {
    const offMat = document.getElementById("offerMatSelect").value;
    const offQty = parseInt(document.getElementById("offerQty").value);
    const reqMat = document.getElementById("reqMatSelect").value;
    const reqQty = parseInt(document.getElementById("reqQty").value) || 0;
    const reqTokens = parseInt(document.getElementById("reqTokens").value) || 0;
    
    if(!offQty || offQty <= 0) return alert("You must offer a valid quantity.");
    if(reqQty === 0 && reqTokens === 0) {
        if(!confirm("You are offering this for FREE. Are you sure?")) return;
    }

    const user = JSON.parse(localStorage.getItem("scoutUser"));
    showLoading("Posting trade offer...");
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "createTrade", tali3aId: user.tali3aId, userId: user.id,
            offerMat: offMat, offerQty: offQty, reqMat: reqMat, reqQty: reqQty, reqTokens: reqTokens
        })
    }).then(res => res.json()).then(data => {
        if(data.status === "success") { alert("Trade posted globally!"); loadDashboard(); }
        else {alert("Failed: " + data.message); hideLoading();}
    }).catch(() => hideLoading());
}

function acceptTrade(offerId) {
    if(!confirm("Accepting this trade will instantly deduct the requested materials/tokens from your Island and transfer the offered materials to you. Proceed?")) return;
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    showLoading("Securing trade...");
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "acceptTrade", buyerTali3a: user.tali3aId, buyerUserId: user.id, offerId: offerId })
    }).then(res => res.json()).then(data => {
        if(data.status === "success") { alert("Trade successful!"); loadDashboard(); }
        else {alert("Trade Failed: " + data.message); hideLoading();}
    }).catch(() => hideLoading());
}

function submitTransfer() {
    const amount = parseInt(document.getElementById("transferAmount").value);
    if(!amount || amount <= 0) return alert("Enter a valid amount.");
    if(!confirm(`You are sending ${amount} La7alee7. A 10% tax will be applied. Proceed?`)) return;
    
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    const msg = document.getElementById("transferMsg");
    msg.innerText = "Processing transfer...";
    msg.style.color = "blue";
    showLoading("Transferring La7alee7...");
    
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "transferToMaster", crewId: user.id, tali3aId: user.tali3aId, amount: amount })
    }).then(res => res.json()).then(data => {
        if(data.status === "success") {
            msg.innerText = data.message;
            msg.style.color = "green";
            loadDashboard();
        } else {
            msg.innerText = data.message;
            msg.style.color = "red";
            hideLoading();
        }
    }).catch(() => hideLoading());
}


// --- LEADERBOARD LOGIC ---

function initLeaderboard() {
    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "getLeaderboard" })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            renderLeaderboard(data.leaderboard);
        }
    })
    .catch(err => console.error("Leaderboard fetch failed:", err));
}

function renderLeaderboard(board) {
    const container = document.getElementById("leaderboardContainer");
    const user = JSON.parse(localStorage.getItem("scoutUser"));
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 14px;">
            <tr style="background: #343a40; color: white;">
                <th style="padding: 12px;">Rank</th>
                <th style="padding: 12px; text-align: left;">Island Name</th>
                <th style="padding: 12px;">Ship Progress</th>
                <th style="padding: 12px;">Total Wealth</th>
                <th style="padding: 12px;">Fleet Score</th>
            </tr>
    `;
    
    board.forEach((team, index) => {
        const rank = index + 1;
        let rankDisplay = rank;
        
        // Add medals for the top 3
        if (rank === 1) rankDisplay = "🥇 1st";
        if (rank === 2) rankDisplay = "🥈 2nd";
        if (rank === 3) rankDisplay = "🥉 3rd";
        
        // Highlight the user's own Tali3a
        const isMyTeam = (team.id === user.tali3aId);
        const rowStyle = isMyTeam 
            ? "background-color: #d4edda; font-weight: bold; border-bottom: 2px solid #28a745;" 
            : "border-bottom: 1px solid #eee;";
            
        html += `
            <tr style="${rowStyle}">
                <td style="padding: 12px;">${rankDisplay}</td>
                <td style="padding: 12px; text-align: left;">
                    ${team.name} 
                    <span style="font-size: 11px; color: gray; display: block;">${team.id}</span>
                </td>
                <td style="padding: 12px;">${team.parts} / 12</td>
                <td style="padding: 12px;">💰 ${team.wealth.toLocaleString()}</td>
                <td style="padding: 12px; color: purple; font-weight: bold; font-size: 16px;">
                    ${team.score.toLocaleString()}
                </td>
            </tr>
        `;
    });
    
    html += `</table>`;
    container.innerHTML = html;
}

function showLoading(text) {
    document.getElementById("loaderText").innerText = text;
    document.getElementById("globalLoader").classList.add("active");
}
function hideLoading() {
    document.getElementById("globalLoader").classList.remove("active");
}

function showTacticalInfo(key) {
    const item = globalTacticalItems[key];
    if (!item) return;

    document.getElementById("modalTitle").innerText = item.name;
    document.getElementById("modalIcon").src = `assets/${key}.png`;
    
    const typeEl = document.getElementById("modalType");
    if (item.type === "attack") {
        typeEl.innerText = "🧨 Offensive Weapon";
        typeEl.style.color = "#c0392b";
    } else {
        typeEl.innerText = "🛡️ Defensive Shield";
        typeEl.style.color = "#27ae60";
    }

    // Use fallback text just in case you forgot to add it to JSON
    document.getElementById("modalDesc").innerText = item.description || "Classified military asset.";
    document.getElementById("modalHint").innerText = item.hint || "Use strategically against rival Islands.";

    document.getElementById("tacticalModal").classList.add("active");
}

function closeTacticalModal() {
    document.getElementById("tacticalModal").classList.remove("active");
}