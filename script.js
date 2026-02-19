/**
 * Hawaii Regulated Areas Map - Unified Script
 */

const CONFIG = {
    MAP_CENTER: [20.4, -157.4],
    DEFAULT_ZOOM: 7,
    ISLANDS: {
        "Oʻahu": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_OAHU/FeatureServer/736",
        "Molokaʻi": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_MOLOKAI/FeatureServer/735",
        "Maui": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_MAUI/FeatureServer/734",
        "Lānaʻi": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_LANAI/FeatureServer/733",
        "Kauaʻi": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_KAUAI/FeatureServer/732",
        "Hawaiʻi Island": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_HAWAII_ISLAND/FeatureServer/730",
        "Kahoʻolawe": "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TKMMAFEATURECLASS_KAHAOLAWE/FeatureServer/731"
    }
};

let map;
let islandLayers = {}; 

// --- Initialization ---

function initMap() {
    map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    loadAllIslandData();
}

// --- Data Fetching & Rendering ---

async function loadAllIslandData() {
    const islandListContainer = document.getElementById('island-list');
    if (!islandListContainer) return;
    
    islandListContainer.innerHTML = '<div class="loading">Loading Map Data...</div>';

    for (const [islandName, baseUrl] of Object.entries(CONFIG.ISLANDS)) {
        try {
            // 1. Fetch Metadata for Drawing Info
            const metaRes = await fetch(`${baseUrl}?f=pjson`);
            const metadata = await metaRes.json();
            const arcgisStyle = metadata.drawingInfo?.renderer?.symbol || metadata.drawingInfo?.renderer?.defaultSymbol;

            // 2. Fetch Features with WGS84 coordinates
            const dataRes = await fetch(`${baseUrl}/query?where=1=1&outFields=*&outSR=4326&f=pjson`);
            const data = await dataRes.json();

            if (data.features) {
                const style = parseArcGISColor(arcgisStyle?.color);
                createMapLayer(islandName, data.features, style);
                renderIslandToSidebar(islandName, data.features, style);
            }
        } catch (err) {
            console.error(`Error loading ${islandName}:`, err);
        }
    }
    
    const loadingMsg = islandListContainer.querySelector('.loading');
    if (loadingMsg) loadingMsg.remove();
}

function parseArcGISColor(rgba) {
    if (!rgba) return { color: "#005a87", opacity: 0.6 };
    return {
        color: `rgb(${rgba[0]}, ${rgba[1]}, ${rgba[2]})`,
        opacity: rgba[3] / 255
    };
}

function createMapLayer(islandName, features, style) {
    const layerGroup = L.featureGroup();
    
    features.forEach(f => {
        if (!f.geometry?.rings) return;
        
        // Convert [lng, lat] to [lat, lng]
        const latLngs = f.geometry.rings.map(ring => 
            ring.map(coord => [coord[1], coord[0]])
        );

        const polygon = L.polygon(latLngs, {
            color: style.color,
            fillColor: style.color,
            fillOpacity: style.opacity,
            weight: 2
        });

        const name = f.attributes.MMA_Name || f.attributes.Name || "Unnamed Area";
        polygon.bindPopup(`<b>${name}</b>`);
        layerGroup.addLayer(polygon);
        
        // Link reference for sidebar zooming
        f._leafletLayer = polygon;
    });

    islandLayers[islandName] = { group: layerGroup, features: features };
}

function renderIslandToSidebar(islandName, features, style) {
    const container = document.createElement('div');
    container.className = 'island-group';
    
    const areaLinks = features.map(f => {
        const name = f.attributes.MMA_Name || f.attributes.Name || "Unnamed Area";
        return `<div class="area-item" onclick="zoomToFeature('${islandName}', '${name}')">
                    <span class="color-dot" style="background:${style.color}"></span> ${name}
                </div>`;
    }).join('');

    container.innerHTML = `
        <div class="island-header" onclick="toggleAccordion(this)">
            <div class="header-left">
                <input type="checkbox" onchange="toggleIslandLayer(event, '${islandName}')">
                <span>${islandName}</span>
            </div>
            <span class="chevron">▼</span>
        </div>
        <div class="area-list" style="display:none;">${areaLinks}</div>
    `;
    document.getElementById('island-list').appendChild(container);
}

// --- UI Interaction Logic ---

window.toggleSidebar = function() {
    const sidebar = document.getElementById('map-sidebar');
    const btn = document.querySelector('.left-toggle');
    const isCollapsed = sidebar.classList.toggle('collapsed');
    
    btn.innerHTML = isCollapsed ? '▶' : '◀';
    // Move button so it stays visible when pane is gone
    btn.style.left = isCollapsed ? '12px' : ''; 
    
    setTimeout(() => map.invalidateSize(), 400);
};

window.toggleInfoSidebar = function() {
    const infoSidebar = document.getElementById('info-sidebar');
    const btn = document.querySelector('.right-toggle');
    const isActive = infoSidebar.classList.toggle('active');
    
    btn.innerHTML = isActive ? '▶' : '◀';
    
    setTimeout(() => map.invalidateSize(), 400);
};

window.toggleAccordion = function(header) {
    const list = header.nextElementSibling;
    const isVisible = list.style.display === 'block';
    list.style.display = isVisible ? 'none' : 'block';
    header.classList.toggle('expanded', !isVisible);
};

window.toggleIslandLayer = function(event, islandName) {
    const layerData = islandLayers[islandName];
    if (event.target.checked) {
        layerData.group.addTo(map);
    } else {
        map.removeLayer(layerData.group);
    }
};

window.zoomToFeature = function(islandName, areaName) {
    const features = islandLayers[islandName].features;
    const feature = features.find(f => (f.attributes.MMA_Name || f.attributes.Name) === areaName);
    
    if (feature && feature._leafletLayer) {
        const layer = feature._leafletLayer;
        
        // Ensure layer is on map
        if (!map.hasLayer(layer)) {
            islandLayers[islandName].group.addTo(map);
            const checkbox = document.querySelector(`input[onchange*='${islandName}']`);
            if (checkbox) checkbox.checked = true;
        }

        map.fitBounds(layer.getBounds());
        
        // Update Info Sidebar
        document.getElementById('info-title').innerText = areaName;
        document.getElementById('info-body').innerHTML = `
            <div class="info-card">
                <h3>Regulations</h3>
                <p>${feature.attributes.Reg_Summary || 'Details for this area coming soon.'}</p>
                <hr>
                <small>Island: ${islandName}</small>
            </div>
        `;
        
        if (!document.getElementById('info-sidebar').classList.contains('active')) {
            toggleInfoSidebar();
        }
        
        layer.openPopup();
    }
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
