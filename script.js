// ===============================
// 0) GLOBAL STORE
// ===============================
const allIslandLayers = {}; 

// ===============================
// 1) TAB SWITCHING
// ===============================
window.showTab = function (btn, tabId) {
  const section = btn.closest(".area-section");
  if (!section) return;
  section
    .querySelectorAll(".tab-pane")
    .forEach((p) => (p.style.display = "none"));
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

// Helper to strip ʻokinas and accents for "fuzzy" searching
const normalizeText = (text) => {
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[ʻ'‘’"“”]/g, "");     
};

const getVal = (props, key) => {
  if (!props) return null;
  const foundKey = Object.keys(props).find(k => k.toLowerCase() === key.toLowerCase());
  const val = foundKey ? props[foundKey] : null;
  return val === "N/A" || val === "" || val === null || val === "Null" ? null : val;
};

const formatBullets = (text) => {
  if (!text || text === "N/A") return "N/A";
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.some(l => /^[•●○◦*-]\s+/.test(l))) return text;
  return `<div style="padding-left:14px; margin-top:5px;">${lines.map(l => `<div style="margin-bottom:6px;">• ${l.replace(/^[•●○◦*-]\s+/, "")}</div>`).join("")}</div>`;
};

const formatDate = (dateVal) => {
  if (!dateVal || dateVal === "N/A") return "N/A";
  const date = new Date(dateVal);
  return Number.isNaN(date.getTime()) ? dateVal : `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
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
// 4) ISLAND CONFIG
// ===============================
const islandConfigs = [
  { name: "Oʻahu", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_OAHU/FeatureServer", layerId: 736 },
  { name: "Molokaʻi", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_MOLOKAI/FeatureServer", layerId: 735 },
  { name: "Maui", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_MAUI/FeatureServer", layerId: 734 },
  { name: "Lānaʻi", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_LANAI/FeatureServer", layerId: 733 },
  { name: "Kauaʻi", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_KAUAI/FeatureServer", layerId: 732 },
  { name: "Hawaiʻi Island", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_HAWAII_ISLAND/FeatureServer", layerId: 730 },
  { name: "Kahoʻolawe", baseUrl: "https://services.arcgis.com/HQ0xoN0EzDPBOEci/arcgis/rest/services/TKMMAFEATURECLASS_KAHAOLAWE/FeatureServer", layerId: 731 }
];

// ===============================
// 5) UTILITIES & SIDEBAR LOGIC
// ===============================
function latlngInPolygon(latlng, layer, map) {
  const point = map.latLngToLayerPoint(latlng);
  if (!layer._parts || !layer._parts.length) return layer.getBounds().contains(latlng);
  
  const insideRing = (ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].x, yi = ring[i].y;
      const xj = ring[j].x, yj = ring[j].y;
      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };
  return layer._parts.some(ring => insideRing(ring));
}

function populateSidebar(islandName, features) {
  const container = document.getElementById('island-list');
  if (!container) return;
  
  // Removes "Loading..." message when the first island finishes fetching
  if (container.innerHTML.includes("Loading island data...")) {
    container.innerHTML = "";
  }

  const islandId = islandName.toLowerCase().replace(/[^\w]/g, "-");
  const group = document.createElement('div');
  group.className = 'island-group';
  
  const areaItems = features.map(f => {
    const name = getVal(f.properties, "Full_Name") || getVal(f.properties, "Full_name") || "Unknown Area";
    return `<div class="area-item" onclick="zoomToArea('${islandName}', '${name}')">${name}</div>`;
  }).sort((a, b) => a.localeCompare(b)).join('');

  group.innerHTML = `
    <div class="island-header" id="header-${islandId}" onclick="toggleIsland('${islandId}')">
      <div class="header-left">
        <input type="checkbox" checked onclick="toggleLayerVisibility(event, '${islandName}')">
        <span>${islandName}</span>
      </div>
      <span class="chevron">▼</span>
    </div>
    <div id="list-${islandId}" class="area-list" style="display: none;">${areaItems}</div>`;
  container.appendChild(group);
}

window.toggleSidebar = function() {
  document.getElementById('map-sidebar').classList.toggle('collapsed');
};

window.toggleIsland = (id) => {
  const list = document.getElementById(`list-${id}`);
  const header = document.getElementById(`header-${id}`);
  if (!list || !header) return;

  if (list.style.display === "none") {
    list.style.display = "block";
    header.classList.add('expanded');
  } else {
    list.style.display = "none";
    header.classList.remove('expanded');
  }
};

window.toggleLayerVisibility = (event, islandName) => {
  event.stopPropagation();
  const layer = allIslandLayers[islandName];
  if (!layer) return;
  if (event.target.checked) map.addLayer(layer);
  else map.removeLayer(layer);
};

window.zoomToArea = (islandName, areaName) => {
  const layerGroup = allIslandLayers[islandName];
  if (!layerGroup) return;
  layerGroup.eachLayer(layer => {
    const name = getVal(layer.feature.properties, "Full_Name") || getVal(layer.feature.properties, "Full_name");
    if (name === areaName) {
      map.fitBounds(layer.getBounds());
      openMultiPopup(layer.getBounds().getCenter(), [layer.feature]);
    }
  });
};

window.filterSidebar = () => {
  const term = normalizeText(document.getElementById('area-search').value);
  
  document.querySelectorAll('.island-group').forEach(group => {
    let hasMatch = false;
    const items = group.querySelectorAll('.area-item');
    
    items.forEach(item => {
      const itemName = normalizeText(item.innerText);
      if (itemName.includes(term)) {
        item.style.display = 'block';
        hasMatch = true;
      } else {
        item.style.display = 'none';
      }
    });

    const list = group.querySelector('.area-list');
    const header = group.querySelector('.island-header');
    
    if (term !== "" && hasMatch) {
      list.style.display = "block";
      header.classList.add('expanded');
      group.style.display = 'block';
    } else if (term !== "" && !hasMatch) {
      group.style.display = 'none';
    } else {
      group.style.display = 'block';
      list.style.display = "none";
      header.classList.remove('expanded');
    }
  });
};

// ===============================
// 6) INFORMATION SIDEBAR GENERATION
// ===============================
function openInfoSidebar(features) {
  const container = document.getElementById('info-sidebar');
  if (!container) return;

  const formatBulletsWithIndents = (text) => {
    if (!text || text === "N/A") return "N/A";
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(l => `<div class="mm-bullet-container"><span class="mm-bullet-point">•</span><span>${l.replace(/^[•●○◦*-]\s+/, "").trim()}</span></div>`).join("");
  };

  let summaryCardHtml = "";
  if (features.length > 1) {
    const areaNamesHtml = features.map(f => `<div class="mm-bullet-container"><span class="mm-bullet-point">•</span><span>${getVal(f.properties, "Full_Name") || "Unknown"}</span></div>`).join("");
    summaryCardHtml = `
      <div class="mmcard mmcard--summary">
        <div class="mmcard__body">
          <h3 class="mmcard__title">Rules Summary</h3>
          <div class="mmtabpane">${areaNamesHtml}</div>
        </div>
      </div>`;
  }

  const individualCardsHtml = features.map((feature, index) => {
    const props = feature.properties;
    const uid = `area-${index}`;
    const name = getVal(props, "Full_Name") || "Unknown Area";
    return `
    <div class="mmcard area-section">
      <div class="mmcard__body">
        <h3 class="mmcard__title">${name}</h3>
        <div class="mmtabs">
          <button class="active" onclick="showTab(this,'about-${uid}')">ABOUT</button>
          <button onclick="showTab(this,'rules-${uid}')">RULES</button>
        </div>
        <div id="about-${uid}" class="tab-pane mmtabpane" style="display:block;">
          <strong>Island:</strong> ${getVal(props, "Island")}<br>
          <strong>Designation:</strong> ${getVal(props, "Designation_1")}
        </div>
        <div id="rules-${uid}" class="tab-pane mmtabpane" style="display:none;">
          ${formatBulletsWithIndents(getVal(props, "Rules_Gear"))}
        </div>
      </div>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="info-sidebar-header">
        <h3>${features.length} Areas Selected</h3>
        <button class="close-info-btn" onclick="closeInfoSidebar()">×</button>
    </div>
    <div class="info-content-scroll">
        ${summaryCardHtml}
        ${individualCardsHtml}
    </div>
  `;
  container.classList.add('active');
}

// ===============================
// 7) LOAD LAYERS
// ===============================
async function loadIslandLayer(config) {
  const layerUrl = `${config.baseUrl}/${config.layerId}`;
  try {
    const metadataResp = await fetch(`${layerUrl}?f=json`);
    const metadata = await metadataResp.json();
    const renderer = metadata?.drawingInfo?.renderer;
    
    const dataResp = await fetch(`${layerUrl}/query?where=1=1&outFields=*&f=geojson&returnGeometry=true`);
    const geojsonData = await dataResp.json();

    const geoLayer = L.geoJSON(geojsonData, {
      style: function (feature) {
        return { weight: 1.2, fillOpacity: 0.3, color: "#005a87" };
      },
      onEachFeature: function (feature, layer) {
        layer.on("click", function (e) {
          L.DomEvent.stopPropagation(e);
          map.setView(e.latlng, map.getZoom());
          if (window.currentPin) map.removeLayer(window.currentPin);
          window.currentPin = L.marker(e.latlng).addTo(map);

          // Clear previous flashes
          document.querySelectorAll('.leaflet-interactive').forEach(el => el.classList.remove('selected-polygon-flash'));

          const hits = [];
          Object.values(allIslandLayers).forEach(islandLayerGroup => {
            islandLayerGroup.eachLayer(l => {
              if (l instanceof L.Polygon && latlngInPolygon(e.latlng, l, map)) {
                hits.push(l.feature);
                if (l._path) {
                  l._path.classList.add('selected-polygon-flash');
                  // REMOVE FLASH AFTER 1 SECOND
                  setTimeout(() => { l._path.classList.remove('selected-polygon-flash'); }, 1000);
                }
              }
            });
          });
          if (hits.length) openInfoSidebar(hits);
        });
      }
    }).addTo(map);

    allIslandLayers[config.name] = geoLayer;
    populateSidebar(config.name, geojsonData.features);
  } catch (e) { console.error(e); }
}

islandConfigs.forEach((cfg) => loadIslandLayer(cfg));
