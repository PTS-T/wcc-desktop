// WCC Desktop — WCC Menu (top bar of desktop/wcc/). Moved from the old Agent Backend (multi-agent-kung menu_config.js).
// Off unless System Config → WCC Menu → "Enable WCC Menu" (wcc_config_menuEnabled). System Config itself moved to the WCC Dock.
// url: relative = a page of the WCC root (/mawcc/ behind the gateway), "/..." = absolute. active:false hides an item.
const appConfig = {
    title: "WCC Desktop",
    menus: [
        { id: "system_config", name: "System Config", icon: "fas fa-tools", url: "config.html", active: false, showIcon: true, description: "System Config (multi-agent-kung)", bgColor: "#8b949e", textColor: "#ffffff" }
    ]
};
