(function () {
  "use strict";

  var PER_PAGE = 12;
  var state = {
    tabs: [],
    activeKey: "100",
    page: 1,
  };

  var els = {
    tabs: document.getElementById("uni-rank-tabs"),
    list: document.getElementById("uni-list"),
    pagination: document.getElementById("uni-pagination"),
    count: document.getElementById("uni-count"),
    search: document.getElementById("uni-search"),
  };

  if (!els.tabs || !els.list || !els.pagination) return;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function tuitionLabel(value) {
    if (value == null || value === "" || value === 0 || value === "0") return "Free / varies";
    return "€" + String(value);
  }

  function activeTab() {
    return state.tabs.find(function (tab) {
      return tab.key === state.activeKey;
    }) || state.tabs[0];
  }

  function filteredItems() {
    var tab = activeTab();
    var items = (tab && tab.items) || [];
    var q = ((els.search && els.search.value) || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(function (item) {
      return [item.name, item.type, item.control, item.ranking, item.rank]
        .join(" ")
        .toLowerCase()
        .indexOf(q) !== -1;
    });
  }

  function renderTabs() {
    els.tabs.innerHTML = state.tabs
      .map(function (tab) {
        var selected = tab.key === state.activeKey;
        return (
          '<button type="button" class="notice-tab" role="tab" data-uni-tab="' +
          escapeHtml(tab.key) +
          '" aria-selected="' +
          (selected ? "true" : "false") +
          '" tabindex="' +
          (selected ? "0" : "-1") +
          '">' +
          '<span class="uni-tab-label-full">' +
          escapeHtml(tab.label) +
          "</span>" +
          '<span class="uni-tab-label-short">' +
          escapeHtml(tab.key) +
          "</span>" +
          ' <span class="uni-tab-count">' +
          tab.items.length +
          "</span></button>"
        );
      })
      .join("");
  }

  function renderCards(items) {
    if (!items.length) {
      els.list.innerHTML =
        '<div class="notice-empty"><strong>No universities found</strong><p>Try another ranking tab or clear the search.</p></div>';
      return;
    }

    els.list.innerHTML = items
      .map(function (item) {
        var logo = item.logo
          ? '<img class="uni-card-logo" src="' +
            escapeHtml(item.logo) +
            '" alt="" loading="lazy" decoding="async" width="56" height="56" onerror="this.remove()">'
          : '<span class="uni-card-logo uni-card-logo-fallback" aria-hidden="true">' +
            escapeHtml((item.name || "?").charAt(0)) +
            "</span>";

        return (
          '<article class="uni-card">' +
          '<div class="uni-card-top">' +
          logo +
          '<div class="uni-card-copy">' +
          '<p class="uni-card-rank">Rank ' +
          escapeHtml(item.rank) +
          "</p>" +
          "<h2>" +
          escapeHtml(item.name) +
          "</h2>" +
          '<p class="uni-card-meta">' +
          escapeHtml(item.type || "University") +
          (item.control ? " · " + escapeHtml(item.control) : "") +
          "</p>" +
          "</div></div>" +
          '<dl class="uni-card-facts">' +
          "<div><dt>Programmes</dt><dd>" +
          escapeHtml(item.programs) +
          "</dd></div>" +
          "<div><dt>Students</dt><dd>" +
          escapeHtml(item.students) +
          "</dd></div>" +
          "<div><dt>Tuition</dt><dd>" +
          escapeHtml(tuitionLabel(item.tuition)) +
          "</dd></div>" +
          "</dl>" +
          (item.ranking
            ? '<p class="uni-card-ranking">' + escapeHtml(item.ranking) + "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      els.pagination.innerHTML = "";
      els.pagination.hidden = true;
      return;
    }
    els.pagination.hidden = false;
    var buttons = [];
    buttons.push(
      '<button type="button" class="page-btn" data-uni-page="prev" ' +
        (state.page <= 1 ? "disabled" : "") +
        '>Prev</button>'
    );
    for (var i = 1; i <= totalPages; i += 1) {
      if (totalPages > 7 && Math.abs(i - state.page) > 2 && i !== 1 && i !== totalPages) {
        if (buttons[buttons.length - 1] !== '<span class="uni-page-gap">…</span>') {
          buttons.push('<span class="uni-page-gap">…</span>');
        }
        continue;
      }
      buttons.push(
        '<button type="button" class="page-btn' +
          (i === state.page ? " is-active" : "") +
          '" data-uni-page="' +
          i +
          '"' +
          (i === state.page ? ' aria-current="page"' : "") +
          ">" +
          i +
          "</button>"
      );
    }
    buttons.push(
      '<button type="button" class="page-btn" data-uni-page="next" ' +
        (state.page >= totalPages ? "disabled" : "") +
        ">Next</button>"
    );
    els.pagination.innerHTML = buttons.join("");
  }

  function render() {
    var items = filteredItems();
    var totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PER_PAGE;
    var pageItems = items.slice(start, start + PER_PAGE);
    var tab = activeTab();

    if (els.count) {
      els.count.textContent =
        items.length +
        " universities in " +
        ((tab && tab.label) || "this ranking") +
        (items.length ? " · page " + state.page + " of " + totalPages : "");
    }

    renderCards(pageItems);
    renderPagination(totalPages);
  }

  function setTab(key, focus) {
    state.activeKey = key;
    state.page = 1;
    renderTabs();
    render();
    if (focus) {
      var btn = els.tabs.querySelector('[data-uni-tab="' + key + '"]');
      if (btn) btn.focus();
    }
  }

  els.tabs.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-uni-tab]");
    if (!btn) return;
    setTab(btn.getAttribute("data-uni-tab"), false);
  });

  els.tabs.addEventListener("keydown", function (event) {
    var buttons = Array.prototype.slice.call(els.tabs.querySelectorAll("[data-uni-tab]"));
    var index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    var next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setTab(buttons[next].getAttribute("data-uni-tab"), true);
  });

  els.pagination.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-uni-page]");
    if (!btn || btn.disabled) return;
    var value = btn.getAttribute("data-uni-page");
    var items = filteredItems();
    var totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
    if (value === "prev") state.page = Math.max(1, state.page - 1);
    else if (value === "next") state.page = Math.min(totalPages, state.page + 1);
    else state.page = Number(value) || 1;
    render();
    els.list.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (els.search) {
    els.search.addEventListener("input", function () {
      state.page = 1;
      render();
    });
  }

  function boot(payload) {
    state.tabs = (payload && payload.tabs) || [];
    if (!state.tabs.length) throw new Error("No university tabs");
    state.activeKey = state.tabs[0].key;
    renderTabs();
    render();
  }

  function fail() {
    els.list.innerHTML =
      '<div class="notice-empty"><strong>Couldn’t load universities</strong><p>Please refresh and try again.</p></div>';
  }

  // Prefer embedded data (works with file:// / Live Preview); fall back to JSON fetch.
  if (window.UNIHUB_UNIVERSITIES) {
    try {
      boot(window.UNIHUB_UNIVERSITIES);
    } catch (err) {
      fail();
    }
    return;
  }

  fetch(new URL("data/universities.json", window.location.href).href)
    .then(function (res) {
      if (!res.ok) throw new Error("Failed to load universities");
      return res.json();
    })
    .then(boot)
    .catch(fail);
})();
