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

/**
 * Syncs the banner position with the dynamic browser search bar (Safari/Chrome).
 * Updates the --browser-offset CSS variable.
 */
function syncMobileBrowserInset() {
    if (!paneStageEl || !isMobileView()) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const offset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    paneStageEl.style.setProperty("--browser-offset", `${offset}px`);
}

/* --- MOBILE STAGE STATE MANAGEMENT --- */

/**
 * Sets the mobile UI to the fallback "Home" state: Minimized Areas List.
 */
function setMobileHomeState(options = {}) {
    if (!isMobileView() || !paneStageEl) return;

    if (mobileInfoHideTimer) {
        clearTimeout(mobileInfoHideTimer);
        mobileInfoHideTimer = null;
    }

    // Force stage to List View (X=0) and Minimized View (Y=Offset)
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

/**
 * Toggles expansion/collapse of the banner.
 */
function toggleMobileStageMinimized() {
    if (!isMobileView() || !paneStageEl) return;
    paneStageEl.classList.toggle('is-minimized');
}

/**
 * Switches horizontal position between List and Info.
 */
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

/* --- SELECTION & INTERACTION --- */

function openInfoPanel(latlng, features, options = {}) {
    // [Internal Card HTML Generation Logic...]
    // Note: Use your existing logic to build individualCardsHtml and summaryCardHtml here.
    
    const content = document.getElementById("info-content");
    // content.innerHTML = ... (Construct your HTML as per previous builds)

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
    // loadAllFromSingleService(); // Trigger your data load here
});

map.on("click", (e) => {
    // If not clicking a feature
    if (e.originalEvent.target.id === 'map') {
        clearMapSelection();
    }
});
