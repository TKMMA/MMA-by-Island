// ===============================
// 0) GLOBAL STORE & STATE
// ===============================
const allIslandLayers = {};

// ===============================
// 1) TAB SWITCHING (For Detail Panel)
// ===============================
window.showTab = function (btn, tabId) {
  const section = btn.closest(".area-section");
  if (!section) return;
  section
    .querySelectorAll(".tab-pane")
    .forEach((p) => (p.style.display = "none"));
  btn.parentElement.querySelectorAll("button").forEach((b) => {
    b.classList.remove("active");
  });
  const target = section.querySelector("#" + CSS.escape(tabId));
  if (target) target.style.display = "block";
  btn.classList.add("active");
};

// ===============================
// 2) FORMATTING HELPERS
// ===============================
const getVal = (props, key) => {
  const foundKey = Object.keys(props).find(k => k.toLowerCase() === key.toLowerCase());
  const val = foundKey ? props[foundKey] : null;
  return val === "N/A" || val === "" || val === null ? null : val;
};

const formatBulletsWithIndents = (text) => {
  if (!text || text === "N/A") return "N/A";
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map(l => `
    <div class="mm-bullet-container">
      <span class="mm-bullet-point">•</span>
      <span class="mm-bullet-text">${l.replace(/^[•●○◦*-]\s+/, "").trim()}</span>
    </div>`).join("");
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
// 5) SIDEBAR NAVIGATION LOGIC
// ===============================
function populateSidebar(islandName, features) {
  const container = document.getElementById('island-list');
  if (!container) return;
  const islandId = islandName.replace(/\s+/g, '');
  const group = document.createElement('div');
  group.className = 'island-group';
  
  const areaItems = features.map(f => {
    const name = getVal(f.properties, "Full_Name") || getVal(f.properties, "Full_name") || "Unknown";
    return `<div class="area-item" onclick="zoomToArea('${islandName}', '${name}')">${name}</div>`;
  }).sort().join('');

  // Entire island-header is now clickable to toggle the accordion
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
}

window.toggleSidebar = () => document.getElementById('map-sidebar').classList.toggle('collapsed');

window.toggleIsland = (id) => {
  const list = document.getElementById(`list-${id}`);
  const header = document.getElementById(`header-${id}`);
  if (list) {
    list.classList.toggle('active');
    header.classList.toggle('expanded');
  }
};

window.toggleLayerVisibility = (event, islandName) => {
  // Prevent the island-header's click event from firing when clicking the checkbox
  event.stopPropagation();
  const layer = allIslandLayers[islandName];
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
      openInfoPanel(layer.getBounds().getCenter(), [layer.feature]);
    }
  });
};

window.filterSidebar = () => {
  const term = document.getElementById('area-search').value.toLowerCase();
  document.querySelectorAll('.island-group').forEach(group => {
    let hasMatch = false;
    const items = group.querySelectorAll('.area-item');
    items.forEach(item => {
      if (item.innerText.toLowerCase().includes(term)) {
        item.style.display = 'block';
        hasMatch = true;
      } else {
        item.style.display = 'none';
      }
    });
    const list = group.querySelector('.area-list');
    const header = group.querySelector('.island-header');
    if (term !== "" && hasMatch) {
      list.classList.add('active');
      header.classList.add('expanded');
      group.style.display = 'block';
    } else if (term !== "" && !hasMatch) {
      group.style.display = 'none';
    } else {
      group.style.display = 'block';
      list.classList.remove('active');
      header.classList.remove('expanded');
    }
  });
};

// ===============================
// 6) DETAIL PANEL ENGINE
// ===============================
function openInfoPanel(latlng, features) {
  let summaryCardHtml = "";
  let sectionDividerHtml = "";

  // BUILD SUMMARY (If overlapping areas)
  if (features.length > 1) {
    const areaNamesHtml = features.map(f => `
      <div class="mm-bullet-container">
        <span class="mm-bullet-point">•</span>
        <span class="mm-bullet-text">${getVal(f.properties, "Full_name") || getVal(f.properties, "Full_Name") || "Unknown Area"}</span>
      </div>`).join("");
    
    const stateRegsUrl = getVal(features[0].properties, "State_Fishing_Regs_URL") || "https://dlnr.hawaii.gov/dar/fishing/fishing-regulations/";

    const buildSummaryBlock = (title, fieldKey) => {
      const items = features.map(f => ({ 
        name: getVal(f.properties, "Full_name") || getVal(f.properties, "Full_Name"), 
        val: getVal(f.properties, fieldKey) 
      })).filter(i => i.val);
      if (!items.length) return "";
      return `<div class="summary-section-title">${title}</div>` + items.map(item => `
        <div class="area-label">${item.name}:</div>
        <div style="margin-bottom:8px;">${formatBulletsWithIndents(item.val)}</div>`).join("");
    };

    summaryCardHtml = `
      <div class="area-section mmcard mmcard--summary">
        <div class="mmcard__body">
          <h3 class="mmcard__title">Fishing Rules Summary</h3>
          <span class="mmcard__subtitle-label">Managed Areas at this Location:</span>
          <div class="mmcard__subtitle">${areaNamesHtml}</div>
          <div class="mm-statewide-notice">
            The site-specific rules below apply in addition to all 
            <a href="${stateRegsUrl}" target="_blank">Statewide Fishing Regulations</a>.
          </div>
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

  // BUILD INDIVIDUAL CARDS
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
        <div id="about-${uid}" class="tab-pane" style="display:block;">
          ${renderFieldIndented("Designation", joinFields(props, "Designation_1", "Designation_2", "Designation_3"))}
          ${renderFieldIndented("Island", getVal(props, "Island"))}
          ${renderFieldIndented("Purpose", getVal(props, "Purpose"), true)}
          ${renderFieldIndented("Cultural Info", getVal(props, "Cultural"), true)}
          ${renderFieldIndented("Fishing Info", getVal(props, "Fishing_Info"), true)}
          ${renderFieldIndented("Date Established", getVal(props, "Establish_Date"), false, true)}
          ${renderFieldIndented("Location", getVal(props, "Location"))}
          ${getVal(props, "DAR_URL") ? `<a class="reg-link" href="${getVal(props, "DAR_URL")}" target="_blank">OFFICIAL DAR PAGE ›</a>` : ""}
        </div>
        <div id="rules-${uid}" class="tab-pane" style="display:none;">
          <div class="mm-statewide-notice">The site-specific rules below apply in addition to all <a href="${stateUrl}" target="_blank">Statewide Fishing Regulations</a>.</div>
          ${renderFieldIndented("Gear Rules", getVal(props, "Rules_Gear"), true)}
          ${renderFieldIndented("Species & Bag Limits", getVal(props, "Rules_Species_Size_Bag"), true)}
          ${renderFieldIndented("Activities Rules", getVal(props, "Rules_Activities"), true)}
          ${renderFieldIndented("Seasons & Times Rules", getVal(props, "Rules_Seasons_Times"), true)}
          ${renderFieldIndented("Transit & Anchor Rules", getVal(props, "Rules_Transit_Anchor"), true)}
        </div>
        <div id="laws-${uid}" class="tab-pane" style="display:none;">
          ${getVal(props, "HAR_Name") ? `<div><strong>HAR Name:</strong> ${getVal(props, "HAR_Name")}</div>` : ""}
          ${getVal(props, "HAR_Link") ? `<a class="reg-link" href="${getVal(props, "HAR_Link")}" target="_blank">VIEW HAR PDF ›</a>` : ""}
          ${renderFieldIndented("Penalties", getVal(props, "Penalties"), true)}
        </div>
      </div>
    </div>`;
  }).join("");

  const headerTitle = features.length === 1 ? "1 Area Selected" : `${features.length} Areas Selected`;

  const content = document.getElementById('info-content');
  content.innerHTML = `
    <div class="mmpopup">
      <div class="mmpopup__header"><div class="mmpopup__header-title">${headerTitle}</div></div>
      <div class="mmpopup__scroll">
        ${summaryCardHtml}
        ${sectionDividerHtml}
        ${individualCardsHtml}
      </div>
    </div>`;

  document.getElementById('info-sidebar').classList.add('active');
  map.panTo(latlng);
}

window.closeInfoPanel = () => document.getElementById('info-sidebar').classList.remove('active');

// ===============================
// 7) DATA LOADING
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
      style: (feature) => {
        const fName = (getVal(feature.properties, "Full_Name") || getVal(feature.properties, "Full_name") || "").toLowerCase();
        const match = renderer?.uniqueValueInfos?.find((info) => String(info.value || "").toLowerCase() === fName);
        if (match) {
          const c = match.symbol.color;
          return { fillColor: `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`, fillOpacity: globalOpacity, color: `rgb(${match.symbol.outline.color[0]},${match.symbol.outline.color[1]},${match.symbol.outline.color[2]})`, weight: 1.5 };
        }
        return { weight: 1.2, fillOpacity: 0.3, color: "#005a87" };
      },
      onEachFeature: (feature, layer) => {
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const hits = [];
          Object.values(allIslandLayers).forEach(islandLayerGroup => {
            if (map.hasLayer(islandLayerGroup)) {
              islandLayerGroup.eachLayer(l => {
                if (l.getBounds().contains(e.latlng)) hits.push(l.feature);
              });
            }
          });
          if (hits.length) openInfoPanel(e.latlng, hits);
        });
      }
    }).addTo(map);

    allIslandLayers[config.name] = geoLayer;
    populateSidebar(config.name, geojsonData.features);
  } catch (e) { console.error(e); }
}

islandConfigs.forEach(cfg => loadIslandLayer(cfg));
