// ===============================
// 0) GLOBAL STORE
// ===============================
const allIslandLayers = {};

// ===============================
// 1) TAB SWITCHING
// ===============================
window.showTab = function(btn, tabId) {
    const section = btn.closest(".area-section");
    if (!section) return;

    section.querySelectorAll(".tab-pane").forEach((p) => (p.style.display = "none"));
    btn.parentElement.querySelectorAll("button").forEach((b) => {
        b.classList.remove("active");
        b.style.borderBottomColor = "transparent";
    });

    const target = section.querySelector("#" + CSS.escape(tabId));
    if (target) target.style.display = "block";
    btn.classList.add("active");
    btn.style.borderBottomColor = "#005a87";
};

// ===============================
// 2) FORMATTING HELPERS
// ===============================
const getVal = (props, key) => {
    const foundKey = Object.keys(props).find(k => k.toLowerCase() === key.toLowerCase());
    const val = foundKey ? props[foundKey] : null;
    return val === "N/A" || val === "" || val === null ? null : val;
};

const formatBullets = (text) => {
    if (!text || text === "N/A") return "N/A";
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.some(l => /^[•●○◦*-]\s+/.test(l))) return text;
    return `<div style="padding-left:14px; margin-top:5px;">
        ${lines.map(l => `<div style="margin-bottom:6px;">• ${l.replace(/^[•●○◦*-]\s+/, "")}</div>`).join("")}
    </div>`;
};

const formatDate = (dateVal) => {
    if (!dateVal || dateVal === "N/A") return "N/A";
    const date = new Date(dateVal);
    return Number.isNaN(date.getTime()) ? dateVal : 
        `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
};

const joinFields = (props, ...keys) => keys.map(k => getVal(props, k)).filter(Boolean).join("<br>");

// ===============================
// 3) MAP INIT
// ===============================
const map = L.map("map").setView([20.4, -157.4], 7);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Esri"
}).addTo(map);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Labels",
    pane: "shadowPane"
}).addTo(map);

// ===============================
// 4) DATA LOADING
// ===============================
const islandFiles = [
    { name: "Hawaii", url: "https://raw.githubusercontent.com/TKMMA/MMA-by-Island/main/Hawaii.geojson" },
    { name: "Oahu", url: "https://raw.githubusercontent.com/TKMMA/MMA-by-Island/main/Oahu.geojson" },
    { name: "Maui", url: "https://raw.githubusercontent.com/TKMMA/MMA-by-Island/main/Maui.geojson" },
    { name: "Kauai", url: "https://raw.githubusercontent.com/TKMMA/MMA-by-Island/main/Kauai.geojson" },
    { name: "Molokai", url: "https://raw.githubusercontent.com/TKMMA/MMA-by-Island/main/Molokai.geojson" },
    { name: "Lanai", url: "https://raw.githubusercontent.com/TKMMA/MMA-by-Island/main/Lanai.geojson" }
];

async function loadAllData() {
    const islandData = {};
    for (const island of islandFiles) {
        try {
            const resp = await fetch(island.url);
            const data = await resp.json();
            islandData[island.name] = data;
            addIslandToMap(island.name, data);
        } catch (e) {
            console.error(`Error loading ${island.name}:`, e);
        }
    }
    populateSidebar(islandData);
}

function addIslandToMap(name, data) {
    const layer = L.geoJSON(data, {
        style: { color: "#3388ff", weight: 2, fillOpacity: 0.2 },
        onEachFeature: (feature, layer) => {
            const p = feature.properties;
            const popupContent = `
                <div class="area-section">
                    <h3 style="margin:0 0 10px; color:#005a87;">${getVal(p, "Area_Name") || "Regulated Area"}</h3>
                    <div class="tabs" style="border-bottom:2px solid #eee; margin-bottom:10px; display:flex; gap:10px;">
                        <button class="active" onclick="showTab(this, 'tab-info-${L.stamp(layer)}')">Info</button>
                        <button onclick="showTab(this, 'tab-regs-${L.stamp(layer)}')">Rules</button>
                    </div>
                    <div id="tab-info-${L.stamp(layer)}" class="tab-pane">
                        <p><strong>Island:</strong> ${getVal(p, "Island") || "N/A"}</p>
                        <p><strong>Category:</strong> ${getVal(p, "Category") || "N/A"}</p>
                    </div>
                    <div id="tab-regs-${L.stamp(layer)}" class="tab-pane" style="display:none;">
                        <p><strong>Prohibited:</strong> ${formatBullets(getVal(p, "Prohibited_Activities"))}</p>
                        <p><strong>Permitted:</strong> ${formatBullets(getVal(p, "Permitted_Activities"))}</p>
                    </div>
                </div>`;
            layer.bindPopup(popupContent, { maxWidth: 300 });
        }
    }).addTo(map);
    allIslandLayers[name] = layer;
}

// ===============================
// 5) SIDEBAR LOGIC
// ===============================
function populateSidebar(islandData) {
    const container = document.getElementById("island-list");
    container.innerHTML = "";

    Object.entries(islandData).forEach(([islandName, data]) => {
        const islandId = islandName.toLowerCase().replace(/\s+/g, "-");
        const group = document.createElement("div");
        group.className = "island-group";

        const areaItems = data.features.map(f => {
            const name = getVal(f.properties, "Area_Name") || "Unknown Area";
            return `<div class="area-item" onclick="zoomToArea('${islandName}', '${name}')">${name}</div>`;
        }).join("");

        group.innerHTML = `
            <div class="island-header" id="header-${islandId}" onclick="toggleIsland('${islandId}')">
                <div class="header-left">
                    <input type="checkbox" checked onclick="toggleLayerVisibility(event, '${islandName}')">
                    <span>${islandName}</span>
                </div>
                <span class="chevron">▼</span>
            </div>
            <div id="list-${islandId}" class="area-list">${areaItems}</div>`;
        
        container.appendChild(group);
    });
}

window.toggleSidebar = function() {
    document.getElementById('map-sidebar').classList.toggle('collapsed');
};

window.toggleIsland = function(islandId) {
    const list = document.getElementById(`list-${islandId}`);
    const header = document.getElementById(`header-${islandId}`);
    const isExpanding = list.style.display !== "block";
    
    list.style.display = isExpanding ? "block" : "none";
    header.classList.toggle("expanded", isExpanding);
};

window.toggleLayerVisibility = function(event, islandName) {
    event.stopPropagation();
    const layer = allIslandLayers[islandName];
    if (layer) {
        if (event.target.checked) map.addLayer(layer);
        else map.removeLayer(layer);
    }
};

window.zoomToArea = function(islandName, areaName) {
    const layer = allIslandLayers[islandName];
    if (!layer) return;
    layer.eachLayer(l => {
        if (getVal(l.feature.properties, "Area_Name") === areaName) {
            map.fitBounds(l.getBounds());
            l.openPopup();
        }
    });
};

window.filterSidebar = function() {
    const search = document.getElementById("area-search").value.toLowerCase();
    document.querySelectorAll(".island-group").forEach(group => {
        let hasMatch = false;
        group.querySelectorAll(".area-item").forEach(item => {
            const match = item.textContent.toLowerCase().includes(search);
            item.style.display = match ? "block" : "none";
            if (match) hasMatch = true;
        });
        group.style.display = hasMatch || !search ? "block" : "none";
    });
};

// Start initialization
loadAllData();
