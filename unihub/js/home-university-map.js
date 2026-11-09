(function () {
  const BLUE = "#1283ff";
  const STATES = [
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen",
  ];

  let map = null;
  let markers = null;
  let stateLayer = null;
  let institutions = [];
  let selectedState = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function geometryContains(geometry, lng, lat) {
    if (!geometry) return false;
    const polygons =
      geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const polygon of polygons) {
      if (!polygon[0] || !pointInRing(lng, lat, polygon[0])) continue;
      let inHole = false;
      for (let i = 1; i < polygon.length; i++) {
        if (pointInRing(lng, lat, polygon[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  }

  function stateFor(lat, lng, geo) {
    if (!geo?.features) return "";
    for (const feature of geo.features) {
      if (geometryContains(feature.geometry, lng, lat)) return feature.properties?.name || "";
    }
    return "";
  }

  const CITY_ALIASES = {
    cologne: "Köln",
    munich: "München",
    nuremberg: "Nürnberg",
    nurnberg: "Nürnberg",
    hanover: "Hannover",
    brunswick: "Braunschweig",
    "frankfurt main": "Frankfurt am Main",
    munster: "Münster",
    goettingen: "Göttingen",
    gottingen: "Göttingen",
    duesseldorf: "Düsseldorf",
    dusseldorf: "Düsseldorf",
    saarbrucken: "Saarbrücken",
    lubeck: "Lübeck",
    lueneburg: "Lüneburg",
    tuebingen: "Tübingen",
    wurzburg: "Würzburg",
    wuerzburg: "Würzburg",
  };

  function normalizeCityKey(name) {
    return String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function cityCoord(city) {
    const table = window.UNIHUB_CITY_COORDS || {};
    const name = String(city || "").replace(/\s+/g, " ").trim();
    if (!name) return null;
    let hit = table[name];
    if (!hit) {
      const lower = name.toLowerCase();
      const found = Object.keys(table).find((key) => key.replace(/\s+/g, " ").trim().toLowerCase() === lower);
      if (found) hit = table[found];
    }
    if (!hit) {
      const key = normalizeCityKey(name);
      const alias = CITY_ALIASES[key];
      if (alias && table[alias]) hit = table[alias];
      if (!hit) {
        const found = Object.keys(table).find((entry) => normalizeCityKey(entry) === key);
        if (found) hit = table[found];
      }
    }
    if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) return null;
    return hit;
  }

  function buildInstitutions() {
    const hiddenTypes = new Set([11, 12]);
    const courses = (window.UNIHUB_DATA?.courses || []).filter(
      (course) => !hiddenTypes.has(Number(course.type))
    );
    const geo = window.UNIHUB_GERMANY_STATES;
    const sites = window.UNI_WEBSITES || {};
    const byName = new Map();
    for (const course of courses) {
      const academy = String(course.academy || "").trim();
      if (!academy) continue;
      const entry = byName.get(academy) || { academy, city: course.city || "", programmes: 0 };
      entry.programmes += 1;
      if (!entry.city && course.city) entry.city = course.city;
      byName.set(academy, entry);
    }
    const list = [];
    for (const entry of byName.values()) {
      const coords = cityCoord(entry.city);
      if (!coords) continue;
      list.push({
        academy: entry.academy,
        city: entry.city,
        programmes: entry.programmes,
        lat: coords.lat,
        lng: coords.lng,
        state: stateFor(coords.lat, coords.lng, geo),
        website: sites[entry.academy] || "",
      });
    }
    list.sort((a, b) => a.academy.localeCompare(b.academy));
    return list;
  }

  function countsByState() {
    const counts = new Map(STATES.map((name) => [name, 0]));
    for (const item of institutions) {
      if (counts.has(item.state)) counts.set(item.state, counts.get(item.state) + 1);
    }
    return counts;
  }

  function uniDotIcon() {
    return L.divIcon({
      className: "uni-map-pin uni-map-pin-single",
      html: '<div class="uni-map-pin-dot"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }

  function spreadInstitutions(items) {
    const buckets = new Map();
    for (const item of items) {
      const key = item.lat.toFixed(3) + "|" + item.lng.toFixed(3);
      const bucket = buckets.get(key) || [];
      bucket.push(item);
      buckets.set(key, bucket);
    }
    const placed = [];
    for (const bucket of buckets.values()) {
      if (bucket.length === 1) {
        placed.push(bucket[0]);
        continue;
      }
      bucket.forEach((item, index) => {
        const ring = Math.floor(index / 8);
        const slot = index % 8;
        const countOnRing = Math.min(8, bucket.length - ring * 8);
        const angle = (2 * Math.PI * slot) / countOnRing - Math.PI / 2;
        const radius = 0.012 + ring * 0.011;
        placed.push({
          ...item,
          lat: item.lat + Math.sin(angle) * radius,
          lng: item.lng + (Math.cos(angle) * radius) / Math.cos((item.lat * Math.PI) / 180),
        });
      });
    }
    return placed;
  }

  function popupHtml(item) {
    const website = item.website
      ? '<a href="' +
        escapeHtml(item.website) +
        '" target="_blank" rel="noopener noreferrer">Official website</a>'
      : "";
    return (
      '<div class="uni-map-popup"><strong>' +
      escapeHtml(item.academy) +
      "</strong><span>" +
      escapeHtml(item.city) +
      "</span>" +
      website +
      "</div>"
    );
  }

  function groupsFor(items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.city + "|" + item.lat.toFixed(3) + "|" + item.lng.toFixed(3);
      const group = groups.get(key) || { city: item.city, lat: item.lat, lng: item.lng, state: item.state, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  function updateLeadCopy() {
    const lead = document.getElementById("uni-map-lead");
    if (!lead) return;
    const total = institutions.length;
    if (!total) {
      lead.textContent =
        "Explore UniHub universities on the map — filter by federal state to browse the directory.";
      return;
    }
    lead.textContent =
      "Explore " +
      total.toLocaleString("en-GB") +
      " mapped universities across Germany — pick a federal state to zoom in on the full directory.";
  }

  function renderPanel() {
    const title = document.getElementById("uni-map-panel-title");
    const sub = document.getElementById("uni-map-panel-sub");
    const statesEl = document.getElementById("uni-map-states");
    const listEl = document.getElementById("uni-map-list");
    const back = document.getElementById("uni-map-back");
    if (!title || !statesEl || !listEl) return;

    const counts = countsByState();
    if (back) back.hidden = !selectedState;
    if (!window.UNIHUB_DATA?.courses?.length) {
      if (sub) sub.textContent = "Programme data did not load. Refresh the page.";
      return;
    }

    if (!selectedState) {
      title.textContent = "All federal states";
      if (sub) {
        const total = institutions.length;
        sub.textContent =
          total.toLocaleString("en-GB") +
          " universities mapped · pick a state in the list, on the map, or tap a blue dot.";
      }
      statesEl.hidden = false;
      listEl.hidden = true;
      statesEl.innerHTML = STATES.map((name) => {
        const count = counts.get(name) || 0;
        return (
          '<button type="button" class="uni-map-state" data-state="' +
          escapeHtml(name) +
          '" title="' +
          escapeHtml(name) +
          '"' +
          (count ? "" : " disabled") +
          "><span>" +
          escapeHtml(name) +
          "</span><strong>" +
          count +
          "</strong></button>"
        );
      }).join("");
      return;
    }

    const items = institutions.filter((item) => item.state === selectedState);
    title.textContent = selectedState;
    if (sub) {
      sub.textContent = items.length + " universit" + (items.length === 1 ? "y" : "ies");
    }
    statesEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = items.length
      ? items
          .map(
            (item) => {
              const programmeLabel = item.programmes === 1 ? "programme" : "programmes";
              const programmes = item.programmes
                ? '<span class="uni-map-institution-count" title="' +
                  item.programmes +
                  " " +
                  programmeLabel +
                  '"><span class="uni-map-institution-count-num">' +
                  item.programmes +
                  '</span><span class="uni-map-institution-count-label">' +
                  programmeLabel +
                  "</span></span>"
                : "";
              const link = item.website
                ? '<a class="uni-map-institution-link" href="' +
                  escapeHtml(item.website) +
                  '" target="_blank" rel="noopener noreferrer">' +
                  '<span class="uni-map-institution-link-text">Official website</span>' +
                  '<svg class="uni-map-institution-link-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">' +
                  '<path d="M14 4h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                  '<path d="M10 14 20 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                  '<path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
                  "</svg></a>"
                : "";
              return (
                '<article class="uni-map-institution">' +
                '<div class="uni-map-institution-head">' +
                '<h4 class="uni-map-institution-name" title="' +
                escapeHtml(item.academy) +
                '">' +
                escapeHtml(item.academy) +
                "</h4>" +
                programmes +
                "</div>" +
                '<div class="uni-map-institution-foot">' +
                '<p class="uni-map-institution-city">' +
                escapeHtml(item.city) +
                "</p>" +
                link +
                "</div></article>"
              );
            }
          )
          .join("")
      : '<p class="uni-map-empty">No mapped universities in this state yet.</p>';
  }

  function renderMarkers() {
    if (!map || !markers) return;
    markers.clearLayers();
    const items = selectedState ? institutions.filter((item) => item.state === selectedState) : institutions;

    if (!selectedState) {
      for (const group of groupsFor(items)) {
        const marker = L.marker([group.lat, group.lng], {
          icon: uniDotIcon(),
          zIndexOffset: 400,
        });
        marker.on("click", () => {
          if (group.state) selectState(group.state);
        });
        markers.addLayer(marker);
      }
      return;
    }

    for (const item of spreadInstitutions(items)) {
      const marker = L.marker([item.lat, item.lng], {
        icon: uniDotIcon(),
        zIndexOffset: 500,
      });
      marker.bindPopup(popupHtml(item), { closeButton: true, autoPan: true });
      markers.addLayer(marker);
    }
  }

  function restyleStates() {
    if (!stateLayer) return;
    stateLayer.setStyle((feature) => {
      const name = feature.properties?.name;
      const active = selectedState && name === selectedState;
      const dim = selectedState && name !== selectedState;
      return {
        color: active ? BLUE : "#8eb6ea",
        weight: active ? 2.2 : 1,
        fillColor: active ? "#c5ddff" : "#e3f0ff",
        fillOpacity: dim ? 0.25 : 0.95,
      };
    });
  }

  function fitView() {
    if (!map) return;
    const geo = window.UNIHUB_GERMANY_STATES;
    if (selectedState && geo?.features) {
      const feature = geo.features.find((item) => item.properties?.name === selectedState);
      if (feature) {
        const layer = L.geoJSON(feature);
        map.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: 8 });
        return;
      }
    }
    if (stateLayer) {
      map.fitBounds(stateLayer.getBounds(), { padding: [18, 18] });
      return;
    }
    map.setView([51.16, 10.45], 6);
  }

  function selectState(name) {
    selectedState = name || "";
    const select = document.getElementById("uni-map-state");
    if (select && select.value !== selectedState) select.value = selectedState;
    renderPanel();
    renderMarkers();
    restyleStates();
    fitView();
    requestAnimationFrame(() => map?.invalidateSize());
  }

  function fillSelect() {
    const select = document.getElementById("uni-map-state");
    if (!select) return;
    const counts = countsByState();
    const total = institutions.length;
    select.innerHTML =
      '<option value="">All of Germany (' + total + " universities)</option>" +
      STATES.map((name) => {
        const count = counts.get(name) || 0;
        const unit = count === 1 ? "university" : "universities";
        return (
          '<option value="' +
          escapeHtml(name) +
          '">' +
          escapeHtml(name) +
          " (" +
          count +
          " " +
          unit +
          ")</option>"
        );
      }).join("");
  }

  function initMap() {
    const el = document.getElementById("uni-map-canvas");
    if (!el || typeof L === "undefined" || map) return;
    map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([51.16, 10.45], 6);
    markers = L.layerGroup().addTo(map);
    const geo = window.UNIHUB_GERMANY_STATES;
    if (geo) {
      try {
        stateLayer = L.geoJSON(geo, {
          style: {
            color: "#8eb6ea",
            weight: 1,
            fillColor: "#e3f0ff",
            fillOpacity: 0.95,
          },
          onEachFeature(feature, layer) {
            layer.on("click", () => selectState(feature.properties?.name || ""));
          },
        }).addTo(map);
      } catch (err) {
        console.warn("[UniHub] State outlines unavailable", err);
      }
    }
    renderMarkers();
    fitView();
    setTimeout(() => map.invalidateSize(), 120);
  }

  function bind() {
    document.getElementById("uni-map-state")?.addEventListener("change", (event) => {
      selectState(event.target.value || "");
    });
    document.getElementById("uni-map-back")?.addEventListener("click", () => selectState(""));
    document.getElementById("uni-map-states")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-state]");
      if (!button || button.disabled) return;
      selectState(button.dataset.state || "");
    });
    let resizeTimer;
    const refreshMapSize = () => {
      if (!map) return;
      map.invalidateSize();
      if (selectedState) fitView();
    };
    window.addEventListener(
      "resize",
      () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(refreshMapSize, 160);
      },
      { passive: true }
    );
    window.addEventListener(
      "orientationchange",
      () => {
        setTimeout(refreshMapSize, 280);
      },
      { passive: true }
    );
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(refreshMapSize, 160);
        },
        { passive: true }
      );
    }
  }

  function start() {
    if (!document.getElementById("uni-map-canvas")) return;
    try {
      institutions = buildInstitutions();
    } catch (err) {
      console.warn("[UniHub] Institution list unavailable", err);
      institutions = [];
    }
    bind();
    fillSelect();
    updateLeadCopy();
    renderPanel();
    const bootMap = () => {
      try {
        initMap();
      } catch (err) {
        console.warn("[UniHub] Map unavailable", err);
      }
    };
    if (typeof L !== "undefined") bootMap();
    else window.addEventListener("load", bootMap);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
