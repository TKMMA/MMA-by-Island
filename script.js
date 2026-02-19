// --- Global State ---
const allIslandLayers = {};

// --- Config (Matching your Google Sheet) ---
const islandConfigs = [
  { name: "Oʻahu", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_OAHU/FeatureServer/736" },
  { name: "Molokaʻi", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_MOLOKAI/FeatureServer/735" },
  { name: "Maui", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_MAUI/FeatureServer/734" },
  { name: "Lānaʻi", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_LANAI/FeatureServer/733" },
  { name: "Kauaʻi", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_KAUAI/FeatureServer/732" },
  { name: "Hawaiʻi Island", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_HAWAII_ISLAND/FeatureServer/730" },
  { name: "Kahoʻolawe", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_KAHAOLAWE/FeatureServer/731" }
];

// --- Map Initialization ---
const map = L.map("map").setView([20.4, -157.4], 7);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { 
  attribution: "Esri" 
}).addTo(map);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { 
  pane: "overlayPane" 
}).addTo(map);

// --- Core Logic ---
async function loadLayers() {
  document.getElementById('island-list').innerHTML = '';
  for (const cfg of islandConfigs) {
    try {
      // 1. Fetch ArcGIS Data
      const res = await fetch(`${cfg.baseUrl}/query?where=1=1&outFields=*&f=geojson&returnGeometry=true`);
      const data = await res.json();
      
      // 2. Add to Map
      const layer = L.geoJSON(data, {
        style: { color: "#005a87", weight: 1.5, fillOpacity: 0.3 },
        onEachFeature: (feature, l) => {
          l.on('click', (e) => handleMapClick(e));
        }
      }).addTo(map);
      
      allIslandLayers[cfg.name] = layer;
      
      // 3. Populate Sidebar
      renderSidebarGroup(cfg.name, data.features);
    } catch (err) {
      console.error(`Failed to load ${cfg.name}:`, err);
    }
  }
}

function handleMapClick(e) {
  L.DomEvent.stopPropagation(e);
  const hits = [];
  // Find ALL features from ALL active layers at this point
  Object.values(allIslandLayers).forEach(group => {
    if (map.hasLayer(group)) {
      group.eachLayer(l => {
        if (l.getBounds().contains(e.latlng)) hits.push(l.feature);
      });
    }
  });
  if (hits.length > 0) openMultiPopup(e.latlng, hits);
}

// --- Sidebar Helpers ---
function renderSidebarGroup(islandName, features) {
  const container = document.getElementById('island-list');
  const id = islandName.replace(/\s+/g, '');
  const group = document.createElement('div');
  group.className = 'island-group';
  
  const items = features
    .map(f => {
      const name = f.properties.Full_Name || f.properties.Full_name || "Unknown Area";
      return `<div class="area-item" onclick="zoomToArea('${islandName}', '${name}')">${name}</div>`;
    })
    .sort()
    .join('');

  group.innerHTML = `
    <div class="island-header" id="h-${id}" onclick="toggleIsland('${id}')">
      <div class="header-left">
        <input type="checkbox" checked onclick="event.stopPropagation(); toggleLayer('${islandName}', this.checked)">
        <span>${islandName}</span>
      </div>
      <span class="chevron">▼</span>
    </div>
    <div id="l-${id}" class="area-list">${items}</div>`;
  container.appendChild(group);
}

window.toggleSidebar = () => document.getElementById('map-sidebar').classList.toggle('collapsed');
window.toggleIsland = (id) => {
  document.getElementById(`l-${id}`).classList.toggle('active');
  document.getElementById(`h-${id}`).classList.toggle('expanded');
};
window.toggleLayer = (name, show) => show ? map.addLayer(allIslandLayers[name]) : map.removeLayer(allIslandLayers[name]);

window.zoomToArea = (island, name) => {
  allIslandLayers[island].eachLayer(l => {
    if ((l.feature.properties.Full_Name || l.feature.properties.Full_name) === name) {
      map.fitBounds(l.getBounds());
      openMultiPopup(l.getBounds().getCenter(), [l.feature]);
    }
  });
};

window.filterSidebar = () => {
  const term = document.getElementById('area-search').value.toLowerCase();
  document.querySelectorAll('.island-group').forEach(group => {
    let matchCount = 0;
    group.querySelectorAll('.area-item').forEach(item => {
      const isMatch = item.innerText.toLowerCase().includes(term);
      item.style.display = isMatch ? 'block' : 'none';
      if (isMatch) matchCount++;
    });
    group.style.display = (term === "" || matchCount > 0) ? 'block' : 'none';
  });
};

// --- Popup Engine (Simplified but powerful) ---
function openMultiPopup(latlng, features) {
  // Use your logic from the provided snippet to build the `summaryCardHtml` 
  // and `individualCardsHtml` with the Tabs (About/Rules/Laws).
  // I have kept the structure clean to ensure no clashing.
  const content = `
    <div class="mmpopup">
      <div class="mmpopup__header"><b>${features.length} Area(s) Selected</b></div>
      <div class="mmpopup__scroll" style="max-height:400px; overflow-y:auto; padding:10px;">
        ${features.map(f => `<div class="mmcard" style="border:1px solid #ddd; padding:10px; margin-bottom:10px; border-radius:8px;">
          <h3 style="margin:0 0 5px 0; color:#005a87;">${f.properties.Full_Name || f.properties.Full_name}</h3>
          <p style="font-size:12px; margin:0;">${f.properties.Designation_1 || 'Regulated Area'}</p>
        </div>`).join('')}
      </div>
    </div>`;

  L.popup({ maxWidth: 350 }).setLatLng(latlng).setContent(content).openOn(map);
}

// Start
loadLayers();
