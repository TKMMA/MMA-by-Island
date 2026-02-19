/* Layout & Base */
html, body {
    margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.map-interface {
    display: flex;
    width: 100vw;
    height: 100vh;
}

#map {
    flex: 1;
    height: 100%;
    z-index: 1;
}

/* Sidebar Styles */
.map-sidebar {
    width: 320px;
    background: #fff;
    border-right: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
    z-index: 10;
    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
}

.map-sidebar.collapsed {
    width: 45px;
}

.map-sidebar.collapsed .header-top h2,
.map-sidebar.collapsed .search-box,
.map-sidebar.collapsed .island-list {
    display: none;
}

/* Header & Search */
.sidebar-header { padding: 20px 15px; background: #005a87; color: white; }
.header-top { display: flex; justify-content: space-between; align-items: center; }
.search-box { position: relative; margin-top: 15px; }

#area-search {
    width: 100%;
    padding: 10px 15px;
    border-radius: 20px;
    border: none;
    outline: none;
}

/* Accordion & List Items */
.island-list { flex: 1; overflow-y: auto; }
.island-group { border-bottom: 1px solid #eee; }
.island-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 15px; cursor: pointer; background: #fcfcfc;
}

.area-item {
    padding: 10px 15px 10px 45px;
    font-size: 13px;
    cursor: pointer;
    border-bottom: 1px solid #fafafa;
}

.area-item:hover { background: #f0f7fb; color: #005a87; }

/* Info Sidebar */
.info-sidebar {
    width: 0;
    background: #fcfcfc;
    transition: width 0.3s ease;
    overflow: hidden;
    z-index: 5;
}

.info-sidebar.active { width: 320px; border-right: 1px solid #ddd; }
