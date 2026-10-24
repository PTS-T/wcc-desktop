const appConfig = {
  "title": "WCC",
  "brandPrivate": "WCC",
  "brandPublic1": "WCC",
  "brandPublic2": "Web Containers Chain",
  "headerBgPublic": "#cfcfcf",
  "headerTextPublic": "#1f2937",
  "faviconColor": "#22d3ee",
  "menus": [
    {
      "id": "public_home",
      "name": "Web Containers Chain",
      "url": "public-home.html",
      "zone": "public",
      "active": false,
      "adminOnly": false,
      "type": "x-frame"
    },
    {
      "id": "sign_up",
      "name": "Sign up",
      "url": "sign_up.html",
      "zone": "public",
      "active": true,
      "adminOnly": false,
      "type": "x-frame",
      "align": "right"
    },
    {
      "id": "wcc_desktop",
      "name": "Desktop",
      "icon": "fas fa-desktop",
      "url": "/mawcc/desktop/wcc/",
      "zone": "private",
      "active": true,
      "adminOnly": false,
      "type": "x-frame",
      "align": "left",
      "showIcon": true,
      "bgColor": "#2563eb"
    },
    {
      "id": "config_box",
      "name": "WCC Backend",
      "icon": "fas fa-cogs",
      "url": "config-box.html",
      "zone": "private",
      "active": true,
      "adminOnly": true,
      "type": "x-frame",
      "align": "right",
      "showIcon": true
    },
    {
      "id": "manage_users",
      "name": "Admin Panel",
      "icon": "fas fa-users-cog",
      "url": "admin-view.html",
      "zone": "private",
      "active": true,
      "adminOnly": true,
      "type": "x-frame",
      "align": "right",
      "showIcon": true
    },
    {
      "id": "users",
      "name": "User Panel",
      "icon": "fas fa-user",
      "url": "user-view.html",
      "zone": "private",
      "active": true,
      "adminOnly": false,
      "type": "x-frame",
      "align": "right",
      "showIcon": true
    }
  ]
};
