/**
 * Hawaii Regulated Areas Map - Core Logic
 */

const CONFIG = {
    MAP_CENTER: [20.4, -157.4],
    DEFAULT_ZOOM: 7,
    // Map islands to their specific ArcGIS Query URLs
    ISLANDS: {
        "Oʻahu": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_OAHU/FeatureServer/736/query?where=1=1&outFields=*&f=pjson&returnGeometry=true",
        "Molokaʻi": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_MOLOKAI/FeatureServer/735/query?where=1=1&outFields=*&f=pjson&returnGeometry=true",
        "Maui": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_MAUI/FeatureServer/734/query?where=1=1&outFields=*&f=pjson&returnGeometry=true",
        "Lānaʻi": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_LANAI/FeatureServer/733/query?where=1=1&outFields=*&f=pjson&returnGeometry=true",
        "Kauaʻi": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_KAUAI/FeatureServer/732/query?where=1=1&outFields=*&f=pjson&returnGeometry=true",
        "Hawaiʻi Island": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_HAWAII_ISLAND/FeatureServer/730/query?where=1=1&outFields=*&f=pjson&returnGeometry=true",
        "Kahoʻolawe": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_KAHAOLAWE/FeatureServer/731/query?where=1=1&outFields=*&f=pjson&returnGeometry=true"
    }
};

let map;
let islandLayers = {}; // Store L.geoJSON layers for toggling

function initMap() {
    map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    loadAllIslandData();
}

/**
 * Fetches data for all islands and builds the sidebar
 */
async function loadAllIslandData() {
    const islandListContainer = document.getElementById('island-list');
    islandListContainer.innerHTML = ''; // Clear loading message

    for (const [islandName, url] of Object.entries(CONFIG.ISLANDS)) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            // ArcGIS JSON to GeoJSON conversion is handled better if we use Esri Leaflet, 
            // but for raw JSON we process the 'features' array.
            if (data.features) {
                renderIslandToSidebar(islandName, data.features);
            }
        } catch (err) {
            console.error(`Failed to load ${islandName}:`, err);
        }
    }
}

function renderIslandToSidebar(islandName, features) {
    const container = document.createElement('div');
    container.className = 'island-group';
    
    // Extract names for the list - adjust 'MMA_Name' based on your actual field name
    const areaLinks = features.map(f => {
        const name = f.attributes.MMA_Name || f.attributes.Name || "Unnamed Area";
        return `<div class="area-item" onclick="zoomToFeature('${islandName}', '${name}')">${name}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="island-header" onclick="toggleAccordion(this)">
            <div class="header-left">
                <input type="checkbox" onclick="toggleIslandLayer(event, '${islandName}')">
                <span>${islandName}</span>
            </div>
            <span class="chevron">▼</span>
        </div>
        <div class="area-list" style="display:none;">
            ${areaLinks}
        </div>
    `;
    document.getElementById('island-list').appendChild(container);
}

// Global UI Logic
window.toggleSidebar = function() {
    document.getElementById('map-sidebar').classList.toggle('collapsed');
    setTimeout(() => map.invalidateSize(), 300);
};

window.toggleAccordion = function(header) {
    const list = header.nextElementSibling;
    const isExpanded = list.style.display === 'block';
    list.style.display = isExpanded ? 'none' : 'block';
    header.classList.toggle('expanded', !isExpanded);
};

window.filterSidebar = function() {
    const query = document.getElementById('area-search').value.toLowerCase();
    document.querySelectorAll('.area-item').forEach(item => {
        const match = item.textContent.toLowerCase().includes(query);
        item.style.display = match ? 'block' : 'none';
        if (match) item.closest('.island-group').style.display = 'block';
    });
};

document.addEventListener('DOMContentLoaded', initMap);
