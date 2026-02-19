/**
 * Hawaii Regulated Areas Map - Core Logic with ArcGIS Rendering
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

// Helper: Convert ArcGIS RGBA [r,g,b,a] to Leaflet-friendly values
function parseArcGISColor(arcgisColor) {
    if (!arcgisColor) return { color: "#3388ff", opacity: 0.8 };
    const [r, g, b, a] = arcgisColor;
    return {
        color: `rgb(${r},${g},${b})`,
        opacity: a / 255
    };
}

async function initMap() {
    map = L.map('map').setView(CONFIG.MAP_CENTER, CONFIG.DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    loadAllIslandData();
}

async function loadAllIslandData() {
    const islandListContainer = document.getElementById('island-list');
    islandListContainer.innerHTML = '';

    for (const [islandName, baseUrl] of Object.entries(CONFIG.ISLANDS)) {
        try {
            // 1. Fetch Metadata (for drawingInfo/colors)
            const metaRes = await fetch(`${baseUrl}?f=pjson`);
            const metadata = await metaRes.json();
            const renderer = metadata.drawingInfo.renderer;
            
            // 2. Fetch Features (data and geometry)
            // Added outSR=4326 to ensure we get Lat/Long for Leaflet
            const dataRes = await fetch(`${baseUrl}/query?where=1=1&outFields=*&outSR=4326&f=pjson`);
            const data = await dataRes.json();

            if (data.features) {
                // Determine styling based on ArcGIS renderer type
                const style = renderer.symbol 
                    ? parseArcGISColor(renderer.symbol.color)
                    : parseArcGISColor(renderer.defaultSymbol?.color);

                renderIslandToSidebar(islandName, data.features, style);
                createMapLayer(islandName, data.features, style);
            }
        } catch (err) {
            console.error(`Failed to load ${islandName}:`, err);
        }
    }
}

function createMapLayer(islandName, features, style) {
    // Convert ArcGIS JSON features to Leaflet Polygons
    const layerGroup = L.featureGroup();
    
    features.forEach(f => {
        if (!f.geometry || !f.geometry.rings) return;
        
        // ArcGIS rings are [lng, lat], Leaflet needs [lat, lng]
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
        
        // Store reference for zooming
        f._leafletLayer = polygon;
    });

    islandLayers[islandName] = {
        group: layerGroup,
        features: features
    };
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
        if (!map.hasLayer(layer)) {
            // Auto-check the island if it's not visible
            const checkbox = document.querySelector(`input[onclick*='${islandName}']`);
            if (checkbox) checkbox.checked = true;
            islandLayers[islandName].group.addTo(map);
        }
        map.fitBounds(layer.getBounds());
        layer.openPopup();
    }
};

// ... keep previous toggleSidebar, toggleAccordion, and filterSidebar functions ...

document.addEventListener('DOMContentLoaded', initMap);

// Add these to your existing script.js

window.toggleSidebar = function() {
    const sidebar = document.getElementById('map-sidebar');
    const btn = document.querySelector('.left-toggle');
    sidebar.classList.toggle('collapsed');
    
    btn.innerHTML = sidebar.classList.contains('collapsed') ? '▶' : '◀';
    btn.style.left = sidebar.classList.contains('collapsed') ? '12px' : '';
    
    setTimeout(() => map.invalidateSize(), 400);
};

window.toggleInfoSidebar = function() {
    const infoSidebar = document.getElementById('info-sidebar');
    const btn = document.querySelector('.right-toggle');
    infoSidebar.classList.toggle('active');
    
    btn.innerHTML = infoSidebar.classList.contains('active') ? '▶' : '◀';
    
    setTimeout(() => map.invalidateSize(), 400);
};

// Updated zoom function to automatically open the info sidebar
window.zoomToFeature = function(islandName, areaName) {
    const features = islandLayers[islandName].features;
    const feature = features.find(f => (f.attributes.MMA_Name || f.attributes.Name) === areaName);
    
    if (feature && feature._leafletLayer) {
        const layer = feature._leafletLayer;
        map.fitBounds(layer.getBounds());
        
        // Populate and Open Info Sidebar
        document.getElementById('info-title').innerText = areaName;
        document.getElementById('info-body').innerHTML = `
            <div class="info-card">
                <h3>Regulations</h3>
                <p>${feature.attributes.Reg_Summary || 'No summary available for this area.'}</p>
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
