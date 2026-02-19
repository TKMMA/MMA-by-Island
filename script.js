// ===============================
// 0) GLOBAL STORE & CONFIG
// ===============================
const allIslandLayers = {};

// Updated ArcGIS URLs from your spreadsheet
const islandConfigs = [
    { name: 'Oʻahu', baseUrl: 'https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_OAHU/FeatureServer', layerId: 736 },
    { name: 'Molokaʻi', baseUrl: 'https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_MOLOKAI/FeatureServer', layerId: 735 },
    { name: 'Maui', baseUrl: 'https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_MAUI/FeatureServer', layerId: 734 },
    { name: 'Lānaʻi', baseUrl: 'https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_LANAI/FeatureServer', layerId: 733 },
    { name: 'Kauaʻi', baseUrl: 'https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_KAUAI/FeatureServer', layerId: 732 },
    { name: 'Hawaiʻi Island', baseUrl: 'https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_HAWAII_ISLAND/FeatureServer', layerId: 730 },
    { name: 'Kahoʻolawe', baseUrl: 'https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_KAHAOLAWE/FeatureServer', layerId: 731 }
];

// ===============================
// 1) FORMATTING HELPERS
// ===============================
const getVal = (props, key) => {
    const foundKey = Object.keys(props).find(k => k.toLowerCase() === key.toLowerCase());
    return foundKey ? props[foundKey] : null;
};

const formatBullets = (text) => {
    if (!text || text === "N/A") return "N/A";
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return `<div style="padding-left:14px; margin-top:5px;">
        ${lines.map(l => `<div style="margin-bottom:6px;">• ${l}</div>`).join("")}
    </div>`;
};

// ===============================
// 2) MAP INIT
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
// 3) DATA LOADING (ARCGIS)
// ===============================
async function loadAllData() {
    const islandData = {};
    for (const config of islandConfigs) {
        try {
            const url = `${config.baseUrl}/${config.layerId}/query?where=1%3D1&outFields=*&f=geojson&returnGeometry=true`;
            const resp = await fetch(url);
            const data = await resp.json();
            islandData[config.name] = data;
            addIslandToMap(config.name, data);
        } catch (e) {
            console.error(`Error loading ${config.name}:`, e);
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
                    <p><strong>Island:</strong> ${getVal(p, "Island") || name}</p>
                    <p><strong>Prohibited:</strong> ${formatBullets(getVal(p, "Prohibited_Activities"))}</p>
                </div>`;
            layer.bindPopup(popupContent, { maxWidth: 300 });
        }
    }).addTo(map);
    allIslandLayers[name] = layer;
}

// ===============================
// 4) SIDEBAR LOGIC
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

        // onclick is now on the island-header DIV
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
    event.stopPropagation(); // Prevents the sidebar from expanding when checking the box
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
