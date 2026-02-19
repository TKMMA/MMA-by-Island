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
// 6) POPUP GENERATION
// ===============================
function openMultiPopup(latlng, features) {
  const style = `
    <style>
      .leaflet-popup-content { margin: 0 !important; }
      .leaflet-popup-content-wrapper { padding: 0 !important; border-radius: 12px !important; }
      .mmpopup { width: 360px; max-width: 360px; background: #ffffff; border-radius: 12px; overflow: hidden; font-family: sans-serif; }
      .mmpopup__header { padding: 12px 14px; background: #f6f6f6; border-bottom: 1px solid #e6e6e6; text-align: center; }
      .mmpopup__header-title { font-size: 11px; font-weight: 800; color: #666; letter-spacing: 0.02em; }
      .mmpopup__scroll { max-height: 440px; overflow-y: auto; padding: 12px; box-sizing: border-box; background: #ffffff; scrollbar-gutter: stable both-edges; scrollbar-width: thin; }
      .mmcard { border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 12px; }
      .mmcard--summary { border: 2px solid #005a87; background: #f0f7fb; }
      .mmcard__body { padding: 12px 12px 10px; }
      .section-divider { display: flex; align-items: center; text-align: center; margin: 20px 0 15px 0; color: #888; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
      .section-divider::before, .section-divider::after { content: ''; flex: 1; border-bottom: 1px solid #e6e6e6; }
      .mmcard__title { font-size: 16px; line-height: 1.2; margin: 0 0 10px 0; font-weight: 800; color: #222; }
      .mmcard__subtitle { font-size: 13px; color: #005a87; font-weight: 700; margin-bottom: 12px; line-height: 1.6; }
      .mm-statewide-notice { background: #e1e9ee; padding: 12px; border-radius: 8px; border: 1px solid #005a87; font-size: 12px; line-height: 1.45; margin-bottom: 14px; color: #33444d; text-align: center; }
      .mm-statewide-notice a { color: #005a87; font-weight: 800; text-decoration: underline; }
      .mmtabs { display: flex; gap: 8px; border-bottom: 1px solid #e6e6e6; margin-bottom: 10px; flex-wrap: wrap; }
      .mmtabs button { flex: 1; min-width: 60px; background: none; border: none; cursor: pointer; padding: 8px 4px; font-size: 9px; font-weight: 800; color: #444; border-bottom: 2px solid transparent; text-transform: uppercase; }
      .mmtabs button.active { color: #005a87; border-bottom-color: #005a87; }
      .mmtabpane { font-size: 13px; line-height: 1.45; color: #222; }
      .summary-section-title { font-weight: 800; color: #005a87; margin-top: 14px; margin-bottom: 4px; border-bottom: 1px solid #cce0eb; font-size: 11px; text-transform: uppercase; }
      .area-label { font-size: 11px; font-weight: 800; color: #555; margin-top: 8px; margin-bottom: 2px; }
      .reg-link { color: #005a87; font-weight: 800; text-decoration: none; display: block; margin-top: 4px; }
      .mm-bullet-container { display: flex; align-items: flex-start; margin-bottom: 6px; }
      .mm-bullet-point { min-width: 14px; font-weight: bold; color: #005a87; }
      .mm-bullet-text { flex: 1; }
    </style>
  `;

  const formatBulletsWithIndents = (text) => {
    if (!text || text === "N/A") return "N/A";
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(l => `<div class="mm-bullet-container"><span class="mm-bullet-point">•</span><span class="mm-bullet-text">${l.replace(/^[•●○◦*-]\s+/, "").trim()}</span></div>`).join("");
  };

  let summaryCardHtml = "";
  let sectionDividerHtml = "";

  if (features.length > 1) {
    const areaNamesHtml = features.map(f => `<div class="mm-bullet-container"><span class="mm-bullet-point">•</span><span class="mm-bullet-text">${getVal(f.properties, "Full_name") || getVal(f.properties, "Full_Name") || "Unknown Area"}</span></div>`).join("");
    const stateRegsUrl = getVal(features[0].properties, "State_Fishing_Regs_URL") || "https://dlnr.hawaii.gov/dar/fishing/fishing-regulations/";

    const buildSummaryBlock = (title, fieldKey) => {
      const items = features.map(f => ({ name: getVal(f.properties, "Full_name") || getVal(f.properties, "Full_Name"), val: getVal(f.properties, fieldKey) })).filter(i => i.val);
      if (!items.length) return "";
      return `<div class="summary-section-title">${title}</div>` + items.map(item => `<div class="area-label">${item.name}:</div><div style="margin-bottom:8px;">${formatBulletsWithIndents(item.val)}</div>`).join("");
    };

    summaryCardHtml = `
      <div class="area-section mmcard mmcard--summary">
        <div class="mmcard__body">
          <h3 class="mmcard__title">Fishing Rules Summary</h3>
          <span class="mmcard__subtitle-label">Managed Areas at this Location:</span>
          <div class="mmcard__subtitle">${areaNamesHtml}</div>
          <div class="mm-statewide-notice">The site-specific rules below apply in addition to all <a href="${stateRegsUrl}" target="_blank">Statewide Fishing Regulations</a>.</div>
          <div class="mmtabs"><button class="active">CONSOLIDATED RULES</button></div>
          <div class="mmtabpane">
            ${buildSummaryBlock("Gear Restrictions", "Rules_Gear")}
            ${buildSummaryBlock("Species & Bag Limits", "Rules_Species_Size_Bag")}
            ${buildSummaryBlock("Prohibited Activities", "Rules_Activities")}
            ${buildSummaryBlock("Seasons & Times Rules", "Rules_Seasons_Times")}
            ${buildSummaryBlock("Transit & Anchor Rules", "Rules_Transit_Anchor")}
          </div>
        </div>
      </div>`;
    sectionDividerHtml = `<div class="section-divider">Detailed Area Information Below</div>`;
  }

  const individualCardsHtml = features.map((feature, index) => {
    const props = feature.properties;
    const uid = `area-${index}`;
    const name = getVal(props, "Full_name") || getVal(props, "Full_Name") || "Unknown Area";
    const img = getVal(props, "Area_Image_URL_1") || getVal(props, "Area_Image_URL_2") || getVal(props, "Area_Image_URL_3");
    const stateUrl = getVal(props, "State_Fishing_Regs_URL") || "https://dlnr.hawaii.gov/dar/fishing/fishing-regulations/";

    const renderFieldIndented = (alias, value, isBullet = false, isDate = false) => {
      if (!value || value === "N/A" || value === "") return "";
      const displayValue = isDate ? formatDate(value) : isBullet ? formatBulletsWithIndents(value) : value;
      return `<div style="margin-bottom:12px;"><div style="font-weight:700; margin-bottom:2px;">${alias}</div><div>${displayValue}</div></div>`;
    };

    return `
    <div class="area-section mmcard">
      ${img ? `<img style="width:100%; aspect-ratio:16/9; object-fit:cover; display:block;" src="${img}">` : ""}
      <div class="mmcard__body">
        <h3 class="mmcard__title">${name}</h3>
        <div class="mmtabs">
          <button class="active" onclick="showTab(this,'about-${uid}')">ABOUT</button>
          <button onclick="showTab(this,'rules-${uid}')">RULES</button>
          <button onclick="showTab(this,'laws-${uid}')">LAWS</button>
        </div>
        <div id="about-${uid}" class="tab-pane mmtabpane" style="display:block;">
          ${renderFieldIndented("Designation", joinFields(props, "Designation_1", "Designation_2", "Designation_3"))}
          ${renderFieldIndented("Island", getVal(props, "Island"))}
          ${renderFieldIndented("Purpose", getVal(props, "Purpose"), true)}
          ${renderFieldIndented("Cultural Info", getVal(props, "Cultural"), true)}
          ${renderFieldIndented("Fishing Info", getVal(props, "Fishing_Info"), true)}
          ${renderFieldIndented("Date Established", getVal(props, "Establish_Date"), false, true)}
          ${renderFieldIndented("Date Modified", getVal(props, "Modify_Date"), false, true)}
          ${renderFieldIndented("Location", getVal(props, "Location"))}
          ${getVal(props, "DAR_URL") ? `<a class="reg-link" href="${getVal(props, "DAR_URL")}" target="_blank">OFFICIAL DAR PAGE ›</a>` : ""}
        </div>
        <div id="rules-${uid}" class="tab-pane mmtabpane" style="display:none;">
          <div class="mm-statewide-notice">The site-specific rules below apply in addition to all <a href="${stateUrl}" target="_blank">Statewide Fishing Regulations</a>.</div>
          ${renderFieldIndented("Gear Rules", getVal(props, "Rules_Gear"), true)}
          ${renderFieldIndented("Species & Bag Limits", getVal(props, "Rules_Species_Size_Bag"), true)}
          ${renderFieldIndented("Activities Rules", getVal(props, "Rules_Activities"), true)}
          ${renderFieldIndented("Seasons & Times Rules", getVal(props, "Rules_Seasons_Times"), true)}
          ${renderFieldIndented("Transit & Anchor Rules", getVal(props, "Rules_Transit_Anchor"), true)}
          ${renderFieldIndented("Additional Rules", getVal(props, "Rules_Also_Text"), true)}
        </div>
        <div id="laws-${uid}" class="tab-pane mmtabpane" style="display:none;">
          ${getVal(props, "HAR_Name") ? `<div><strong>HAR Name:</strong> ${getVal(props, "HAR_Name")}</div>` : ""}
          ${getVal(props, "HAR_Link") ? `<a class="reg-link" href="${getVal(props, "HAR_Link")}" target="_blank">VIEW HAR PDF ›</a>` : ""}
          ${renderFieldIndented("Penalties", getVal(props, "Penalties"), true)}
          ${renderFieldIndented("Management Authority", getVal(props, "Mgmt_Auth"))}
        </div>
      </div>
    </div>`;
  }).join("");

  const headerTitle = features.length === 1 ? "1 Area Selected" : `${features.length} Areas Selected`;

  // Create or update the docked popup
  L.popup({
    maxWidth: 360,
    minWidth: 360,
    className: 'leaflet-popup-docked',
    autoPan: false,
    closeOnClick: false
  })
    .setLatLng(map.getBounds().getNorthWest())
    .setContent(`${style}<div class="mmpopup"><div class="mmpopup__header"><div class="mmpopup__header-title">${headerTitle}</div></div><div class="mmpopup__scroll">${summaryCardHtml}${sectionDividerHtml}${individualCardsHtml}</div></div>`)
    .openOn(map);
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
    const globalOpacity = (100 - (metadata?.drawingInfo?.transparency || 0)) / 100;

    const dataResp = await fetch(`${layerUrl}/query?where=1=1&outFields=*&f=geojson&returnGeometry=true`);
    const geojsonData = await dataResp.json();

    const geoLayer = L.geoJSON(geojsonData, {
      style: function (feature) {
        const fName = (getVal(feature.properties, "Full_Name") || getVal(feature.properties, "Full_name") || "").toLowerCase();
        const match = renderer?.uniqueValueInfos?.find((info) => String(info.value || "").toLowerCase() === fName);
        if (match) {
          const c = match.symbol.color;
          return { fillColor: `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`, fillOpacity: globalOpacity, color: `rgb(${match.symbol.outline.color[0]},${match.symbol.outline.color[1]},${match.symbol.outline.color[2]})`, weight: 1.5 };
        }
        return { weight: 1.2, fillOpacity: 0.3, color: "#005a87" };
      },
      onEachFeature: function (feature, layer) {
        layer.on("click", function (e) {
          L.DomEvent.stopPropagation(e);

          // 1. Center map and drop a temporary pin
          map.setView(e.latlng, map.getZoom());
          if (window.currentPin) map.removeLayer(window.currentPin);
          window.currentPin = L.marker(e.latlng).addTo(map);

          // 2. Clear old flashes
          document.querySelectorAll('.leaflet-interactive').forEach(el => el.classList.remove('selected-polygon-flash'));

          const hits = [];
          Object.values(allIslandLayers).forEach(islandLayerGroup => {
            if (map.hasLayer(islandLayerGroup)) {
              islandLayerGroup.eachLayer(l => {
                if (l instanceof L.Polygon && latlngInPolygon(e.latlng, l, map)) {
                  hits.push(l.feature);
                  // 3. Add the flash class to the SVG element
                  if (l._path) l._path.classList.add('selected-polygon-flash');
                }
              });
            }
          });

          if (hits.length) openMultiPopup(e.latlng, hits);
        });
      }
    }).addTo(map);

    allIslandLayers[config.name] = geoLayer;
    populateSidebar(config.name, geojsonData.features);

  } catch (e) { console.error(e); }
}

islandConfigs.forEach((cfg) => loadIslandLayer(cfg));

// ===============================
// 7) LOAD LAYERS
// ===============================
async function loadIslandLayer(config) {
  const layerUrl = `${config.baseUrl}/${config.layerId}`;
  try {
    const metadataResp = await fetch(`${layerUrl}?f=json`);
    const metadata = await metadataResp.json();
    const renderer = metadata?.drawingInfo?.renderer;
    const globalOpacity = (100 - (metadata?.drawingInfo?.transparency || 0)) / 100;
    
    const dataResp = await fetch(`${layerUrl}/query?where=1=1&outFields=*&f=geojson&returnGeometry=true`);
    const geojsonData = await dataResp.json();
    
    const geoLayer = L.geoJSON(geojsonData, {
      style: function (feature) {
        const fName = (getVal(feature.properties, "Full_Name") || getVal(feature.properties, "Full_name") || "").toLowerCase();
        const match = renderer?.uniqueValueInfos?.find((info) => String(info.value || "").toLowerCase() === fName);
        if (match) {
          const c = match.symbol.color;
          return { fillColor: `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`, fillOpacity: globalOpacity, color: `rgb(${match.symbol.outline.color[0]},${match.symbol.outline.color[1]},${match.symbol.outline.color[2]})`, weight: 1.5 };
        }
        return { weight: 1.2, fillOpacity: 0.3, color: "#005a87" };
      },
     onEachFeature: function (feature, layer) {
        layer.on("click", function (e) {
          L.DomEvent.stopPropagation(e);
          
          // 1. Center map and drop a temporary pin
          map.setView(e.latlng, map.getZoom());
          if (window.currentPin) map.removeLayer(window.currentPin);
          window.currentPin = L.marker(e.latlng).addTo(map);

          // 2. Clear old flashes
          document.querySelectorAll('.leaflet-interactive').forEach(el => el.classList.remove('selected-polygon-flash'));
          
          const hits = [];
          Object.values(allIslandLayers).forEach(islandLayerGroup => {
            if (map.hasLayer(islandLayerGroup)) {
              islandLayerGroup.eachLayer(l => {
                if (l instanceof L.Polygon && latlngInPolygon(e.latlng, l, map)) {
                  hits.push(l.feature);
                  // 3. Add the flash class to the SVG element
                  if (l._path) l._path.classList.add('selected-polygon-flash');
                }
              });
            }
          });
          
          if (hits.length) openMultiPopup(e.latlng, hits);
        });
      } // Added missing bracket
    }).addTo(map); // Added missing bracket

    allIslandLayers[config.name] = geoLayer;
    populateSidebar(config.name, geojsonData.features);

  } catch (e) { console.error(e); }
}

islandConfigs.forEach((cfg) => loadIslandLayer(cfg));
