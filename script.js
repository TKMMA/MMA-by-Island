/* --- CONFIGURATION & GLOBALS --- */
const allIslandLayers = {};
const SERVICE_LAYER_URL = "https://services.arcgis.com/HQ0xoN0EzDPBOEci/ArcGIS/rest/services/TK_MMA_FEATURECLASS/FeatureServer/727";
const islandDisplayOrder = ["Oʻahu", "Molokaʻi", "Maui", "Lānaʻi", "Kauaʻi", "Hawaiʻi Island", "Kahoʻolawe"];

let activeSelectionMarker = null;
let activeAccordionLayer = null;
let activeHoverLayer = null;
let infoHintEl = null;
let infoHintTimer = null;
let hasEverSelected = false;
let activeAreaSelection = null;
let mobileInfoHideTimer = null;

const mapSidebarEl = document.getElementById("map-sidebar");
const sidebarToggleEl = document.getElementById("sidebar-toggle");
const infoSidebarEl = document.getElementById("info-sidebar");
const paneStageEl = document.getElementById("pane-stage");
const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
const mapInterfaceEl = document.querySelector(".map-interface");

const isMobileView = () => mobileMediaQuery.matches;

/* --- MOBILE VIEWPORT & BROWSER BAR SYNC --- */

function syncMobileBrowserInset() {
    if (!paneStageEl || !isMobileView()) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const offset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    paneStageEl.style.setProperty("--browser-offset", `${offset}px`);
}

/* --- MOBILE STAGE STATE MANAGEMENT --- */

function setMobileHomeState(options = {}) {
    if (!isMobileView() || !paneStageEl) return;

    if (mobileInfoHideTimer) {
        clearTimeout(mobileInfoHideTimer);
        mobileInfoHideTimer = null;
    }

    paneStageEl.classList.remove('is-info-view');
    paneStageEl.classList.add('is-minimized');

    paneStageEl.style.setProperty('--stage-x', '0');
    paneStageEl.style.setProperty('--stage-y', 'calc(60dvh - 48px)');

    if (options.hideInfoAfterTransition) {
        mobileInfoHideTimer = setTimeout(() => {
            infoSidebarEl.classList.add('mobile-hidden');
            mobileInfoHideTimer = null;
        }, 400);
    } else {
        infoSidebarEl.classList.add('mobile-hidden');
    }
    updateMapSidebarBanner();
}

function toggleMobileStageMinimized() {
    if (!isMobileView() || !paneStageEl) return;
    paneStageEl.classList.toggle('is-minimized');
}

function setMobilePaneStage(stage = "list") {
    if (!isMobileView() || !paneStageEl) return;

    if (stage === "info") {
        paneStageEl.classList.add('is-info-view');
        infoSidebarEl.classList.remove('mobile-hidden');
        paneStageEl.style.setProperty('--stage-x', '-100vw');
    } else {
        paneStageEl.classList.remove('is-info-view');
        paneStageEl.style.setProperty('--stage-x', '0');
    }
}

/* --- DYNAMIC BANNER GENERATION --- */

function ensureSidebarBanner(sidebarEl, options = {}) {
    if (!sidebarEl) return null;
    let banner = sidebarEl.querySelector(".sheet-banner");

    if (!banner) {
        banner = document.createElement("div");
        banner.className = "sheet-banner";
        banner.innerHTML = `
            <button type="button" class="sheet-banner-action"></button>
            <span class="sheet-banner-title"></span>
            <button type="button" class="sheet-banner-right-action">✕</button>
            <button type="button" class="sheet-handle" aria-label="Toggle Pane"></button>
        `;
        sidebarEl.prepend(banner);
    }

    const titleEl = banner.querySelector(".sheet-banner-title");
    const actionEl = banner.querySelector(".sheet-banner-action");
    const rightActionEl = banner.querySelector(".sheet-banner-right-action");
    const handleEl = banner.querySelector(".sheet-handle");

    titleEl.textContent = options.title || "";
    banner.onclick = options.onToggle || null;

    if (options.actionText) {
        actionEl.textContent = options.actionText;
        actionEl.style.display = "flex";
        actionEl.onclick = (e) => { e.stopPropagation(); options.onAction(); };
    } else {
        actionEl.style.display = "none";
    }

    rightActionEl.style.display = options.showClose ? "flex" : "none";
    rightActionEl.onclick = (e) => { e.stopPropagation(); clearMapSelection(); };

    handleEl.style.display = options.showHandle === false ? "none" : "block";

    return banner;
}

function updateMapSidebarBanner() {
    if (!isMobileView()) return;
    ensureSidebarBanner(mapSidebarEl, {
        title: "AREAS LIST",
        showHandle: true,
        showClose: false,
        onToggle: () => toggleMobileStageMinimized()
    });
}

function updateInfoBannerTitle() {
    if (!isMobileView()) return;
    ensureSidebarBanner(infoSidebarEl, {
        title: "AREA INFO",
        showHandle: false,
        showClose: true,
        actionText: "← BACK TO LIST",
        onAction: () => {
            setMobilePaneStage("list");
            paneStageEl.classList.remove('is-minimized');
            paneStageEl.style.setProperty('--stage-y', '0');
        }
    });
}

/* --- MAP INITIALIZATION --- */

const map = L.map("map", { zoomControl: false }).setView([20.4, -157.4], 7);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Esri"
}).addTo(map);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Labels",
    pane: "shadowPane"
}).addTo(map);

/* --- UTILITIES --- */

const getVal = (props, key) => {
    const foundKey = Object.keys(props).find((k) => k.toLowerCase() === key.toLowerCase());
    const val = foundKey ? props[foundKey] : null;
    return val === "N/A" || val === "" || val === null ? null : val;
};

const formatBulletsWithIndents = (text) => {
    if (!text || text === "N/A") return "N/A";
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((l) => `
        <div class="mm-bullet-container">
            <span class="mm-bullet-point">•</span>
            <span class="mm-bullet-text">${l.replace(/^[•●○◦*-]\s+/, "").trim()}</span>
        </div>
    `).join("");
};

const getFirstExistingValue = (props, candidateKeys) => {
    for (const key of candidateKeys) {
        const value = getVal(props, key);
        if (value) return value;
    }
    return null;
};

const getAreaName = (props) => getFirstExistingValue(props, ["Name", "AREA_NAME", "MANAGED_AREA", "SITE_NAME", "TITLE"]) || "Unnamed area";

const getIslandName = (props) => getFirstExistingValue(props, ["Island", "ISLAND", "ISLAND_NAME", "County"]) || "Other";

const getDescription = (props) => getFirstExistingValue(props, ["Description", "DESCRIPTION", "Summary", "Notes", "NOTES", "Rule_Summary"]);

const escapeHtml = (raw = "") => String(raw)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/* --- DATA LOADING --- */

async function loadAllFromSingleService() {
    const islandListEl = document.getElementById("island-list");
    if (!islandListEl) return;

    islandListEl.innerHTML = `<div id="loading-notice" class="loading-notice">Loading Managed Areas...</div>`;

    const queryParams = new URLSearchParams({
        where: "1=1",
        outFields: "*",
        returnGeometry: "true",
        outSR: "4326",
        f: "geojson"
    });

    try {
        const response = await fetch(`${SERVICE_LAYER_URL}/query?${queryParams.toString()}`);
        if (!response.ok) throw new Error(`Service returned ${response.status}`);

        const geojson = await response.json();
        const features = Array.isArray(geojson.features) ? geojson.features : [];
        if (!features.length) throw new Error("Service returned zero features");

        const groupedByIsland = groupFeaturesByIsland(features);
        renderFeaturesOnMap(groupedByIsland);
        renderSidebar(groupedByIsland);
    } catch (error) {
        console.error("Failed to load managed areas", error);
        islandListEl.innerHTML = `<div class="loading-notice">Unable to load areas from the service. Please refresh and try again.</div>`;
    }
}

function groupFeaturesByIsland(features) {
    return features.reduce((acc, feature) => {
        const props = feature.properties || {};
        const island = getIslandName(props);
        if (!acc[island]) acc[island] = [];
        acc[island].push(feature);
        return acc;
    }, {});
}

function renderFeaturesOnMap(groupedByIsland) {
    Object.keys(groupedByIsland).forEach((island) => {
        const islandLayer = L.geoJSON(groupedByIsland[island], {
            style: {
                color: "#00a6ff",
                weight: 2,
                opacity: 0.9,
                fillColor: "#3dc5ff",
                fillOpacity: 0.25
            },
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: () => {
                        if (activeHoverLayer && activeHoverLayer !== layer) {
                            activeHoverLayer.setStyle({ weight: 2, fillOpacity: 0.25 });
                        }
                        layer.setStyle({ weight: 3, fillOpacity: 0.4 });
                        activeHoverLayer = layer;
                    },
                    mouseout: () => {
                        if (activeAreaSelection?.layer !== layer) {
                            layer.setStyle({ weight: 2, fillOpacity: 0.25 });
                        }
                    },
                    click: (event) => {
                        if (activeAreaSelection?.layer && activeAreaSelection.layer !== layer) {
                            activeAreaSelection.layer.setStyle({ weight: 2, fillOpacity: 0.25 });
                        }
                        layer.setStyle({ color: "#0072ce", weight: 4, fillOpacity: 0.5 });
                        activeAreaSelection = { layer, feature };
                        openInfoPanel(event.latlng, [feature], { source: "map" });
                    }
                });
            }
        }).addTo(map);

        allIslandLayers[island] = islandLayer;
    });
}

function renderSidebar(groupedByIsland) {
    const islandListEl = document.getElementById("island-list");
    if (!islandListEl) return;

    const orderedIslands = [
        ...islandDisplayOrder.filter((island) => groupedByIsland[island]),
        ...Object.keys(groupedByIsland).filter((island) => !islandDisplayOrder.includes(island)).sort()
    ];

    islandListEl.innerHTML = orderedIslands.map((island) => {
        const islandFeatures = groupedByIsland[island]
            .slice()
            .sort((a, b) => getAreaName(a.properties || {}).localeCompare(getAreaName(b.properties || {})));

        const featureItems = islandFeatures.map((feature) => {
            const name = getAreaName(feature.properties || {});
            return `<li class="area-item" data-area-name="${escapeHtml(name)}">${escapeHtml(name)}</li>`;
        }).join("");

        return `
            <section class="island-group" data-island-name="${escapeHtml(island)}">
                <h3 class="island-title">${escapeHtml(island)}</h3>
                <ul class="area-list">${featureItems}</ul>
            </section>
        `;
    }).join("");

    islandListEl.querySelectorAll(".area-item").forEach((item) => {
        item.addEventListener("click", () => {
            const selectedName = item.dataset.areaName;
            const feature = findFeatureByName(groupedByIsland, selectedName);
            if (!feature) return;

            const layer = findLayerForFeature(feature);
            if (layer) {
                const bounds = layer.getBounds?.();
                if (bounds && bounds.isValid()) map.fitBounds(bounds, { maxZoom: 13, padding: [24, 24] });
                layer.fire("click", {
                    latlng: bounds && bounds.isValid() ? bounds.getCenter() : map.getCenter()
                });
            } else {
                openInfoPanel(map.getCenter(), [feature], { source: "list" });
            }
        });
    });
}

function findFeatureByName(groupedByIsland, areaName) {
    for (const features of Object.values(groupedByIsland)) {
        const found = features.find((f) => getAreaName(f.properties || {}) === areaName);
        if (found) return found;
    }
    return null;
}

function findLayerForFeature(targetFeature) {
    for (const islandLayer of Object.values(allIslandLayers)) {
        let matchedLayer = null;
        islandLayer.eachLayer((layer) => {
            const currentFeature = layer.feature;
            if (currentFeature === targetFeature) matchedLayer = layer;
        });
        if (matchedLayer) return matchedLayer;
    }
    return null;
}

/* --- SELECTION & INTERACTION --- */

function openInfoPanel(latlng, features, options = {}) {
    const [feature] = features;
    const props = feature?.properties || {};
    const name = getAreaName(props);
    const island = getIslandName(props);
    const description = getDescription(props);

    const content = document.getElementById("info-content");
    content.innerHTML = `
        <article class="info-card">
            <h2>${escapeHtml(name)}</h2>
            <p><strong>Island:</strong> ${escapeHtml(island)}</p>
            <p><strong>Description:</strong> ${description ? formatBulletsWithIndents(escapeHtml(description)) : "N/A"}</p>
        </article>
    `;

    if (isMobileView()) {
        setMobilePaneStage("info");
        paneStageEl.classList.remove('is-minimized');
        paneStageEl.style.setProperty('--stage-y', '0');
        updateInfoBannerTitle();
    } else {
        infoSidebarEl.classList.add("active");
    }

    hasEverSelected = true;
    if (options.source === "map" && latlng) {
        updateClickMarker(latlng);
    }
}

function clearMapSelection() {
    if (activeSelectionMarker) {
        map.removeLayer(activeSelectionMarker);
        activeSelectionMarker = null;
    }

    if (activeAreaSelection?.layer) {
        activeAreaSelection.layer.setStyle({ color: "#00a6ff", weight: 2, fillOpacity: 0.25 });
    }
    activeAreaSelection = null;

    if (isMobileView()) {
        setMobileHomeState({ hideInfoAfterTransition: true });
    } else {
        infoSidebarEl.classList.remove("active");
    }
}

function updateClickMarker(latlng) {
    if (activeSelectionMarker) map.removeLayer(activeSelectionMarker);
    activeSelectionMarker = L.marker(latlng).addTo(map);
}

function toggleSidebar() {
    if (isMobileView()) {
        toggleMobileStageMinimized();
    } else {
        mapSidebarEl.classList.toggle("collapsed");
        mapInterfaceEl.classList.toggle("sidebar-collapsed");
        sidebarToggleEl.textContent = mapSidebarEl.classList.contains("collapsed") ? "▶" : "◀";
    }
}

function filterSidebar() {
    const query = (document.getElementById("area-search")?.value || "").toLowerCase().trim();
    document.querySelectorAll(".area-item").forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? "" : "none";
    });

    document.querySelectorAll(".island-group").forEach((section) => {
        const anyVisible = Array.from(section.querySelectorAll(".area-item")).some((item) => item.style.display !== "none");
        section.style.display = anyVisible ? "" : "none";
    });
}

/* --- LIFECYCLE --- */

window.addEventListener("resize", () => {
    syncMobileBrowserInset();
    if (!isMobileView()) {
        paneStageEl.style.removeProperty('--stage-x');
        paneStageEl.style.removeProperty('--stage-y');
        infoSidebarEl.classList.remove('mobile-hidden');
    } else {
        updateMapSidebarBanner();
    }
});

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncMobileBrowserInset);
    window.visualViewport.addEventListener("scroll", syncMobileBrowserInset);
}

document.addEventListener("DOMContentLoaded", () => {
    if (isMobileView()) {
        setMobileHomeState();
        syncMobileBrowserInset();
    }
    loadAllFromSingleService();
});

map.on("click", (e) => {
    if (e.originalEvent.target.id === 'map') {
        clearMapSelection();
    }
});
