(function () {
  var INDIA = [[6.5, 68], [35.5, 97.5]];
  var map = L.map('map', { zoomControl: true });
  map.fitBounds(INDIA);
  var tiles = null;
  var tileUrl = null;
  var centre = null;
  var circle = null;
  var pins = [];
  var siteLayers = [];
  var tagLayers = [];
  var meDot = null;
  var meRing = null;
  var tapToPlace = false;
  var lastRecenter = null;
  var overviewShown = false;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  map.on('click', function (e) {
    if (tapToPlace) post({ type: 'moved', lat: e.latlng.lat, lng: e.latlng.lng });
  });

  function setTiles(url) {
    if (url === tileUrl) return;
    if (tiles) map.removeLayer(tiles);
    tileUrl = url;
    tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  }

  function setCentre(s) {
    if (!s.center) {
      if (centre) {
        map.removeLayer(centre);
        map.removeLayer(circle);
        centre = null;
        circle = null;
      }
      return;
    }
    var ll = [s.center.lat, s.center.lng];
    if (!centre) {
      centre = L.marker(ll, {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:22px;height:22px;border-radius:11px;background:#1B1D1F;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(map);
      circle = L.circle(ll, { radius: s.radiusM, color: '#B8480F', weight: 2.5, fillOpacity: 0.14 }).addTo(map);
      centre.on('drag', function (e) { circle.setLatLng(e.target.getLatLng()); });
      centre.on('dragend', function (e) {
        var p = e.target.getLatLng();
        post({ type: 'moved', lat: p.lat, lng: p.lng });
      });
    }
    centre.setLatLng(ll);
    circle.setLatLng(ll);
    circle.setRadius(s.radiusM);
    if (s.draggable) centre.dragging.enable(); else centre.dragging.disable();
  }

  function setPins(list) {
    for (var i = 0; i < pins.length; i++) map.removeLayer(pins[i]);
    pins = [];
    for (var j = 0; j < list.length; j++) {
      var p = list[j];
      pins.push(L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 }).addTo(map));
    }
  }

  var TONES = { green: '#15803D', orange: '#E0500F', grey: '#6B6B70' };

  function el(tag, style, text) {
    var e = document.createElement(tag);
    e.setAttribute('style', style);
    if (text != null) e.textContent = text;
    return e;
  }

  /** Every site as a circle; inactive sites are grey. */
  function setSites(list) {
    for (var i = 0; i < siteLayers.length; i++) map.removeLayer(siteLayers[i]);
    siteLayers = [];
    for (var j = 0; j < (list || []).length; j++) {
      var s = list[j];
      var color = s.active === false ? '#8A8A90' : '#E0500F';
      siteLayers.push(L.circle([s.lat, s.lng], { radius: s.radiusM, color: color, weight: 2, fillOpacity: 0.1, interactive: false }).addTo(map));
      siteLayers.push(L.circleMarker([s.lat, s.lng], { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1, interactive: false }).addTo(map));
    }
  }

  /** Name tags above a point; a tap posts the tag's key. Labels are set as text, never as HTML. */
  function setTags(list) {
    for (var i = 0; i < tagLayers.length; i++) map.removeLayer(tagLayers[i]);
    tagLayers = [];
    for (var j = 0; j < (list || []).length; j++) {
      var t = list[j];
      var bg = TONES[t.tone] || TONES.grey;
      var box = el('div', 'position:absolute;left:0;top:0;transform:translate(-50%,calc(-100% - 8px));white-space:nowrap;padding:4px 9px;border-radius:999px;background:' + bg + ';color:#fff;font:600 12px/1.4 sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.35)');
      if (t.count > 1) box.appendChild(el('span', 'display:inline-block;min-width:16px;margin-right:6px;padding:0 4px;border-radius:999px;background:rgba(255,255,255,.25);text-align:center;font-size:11px', String(t.count)));
      box.appendChild(document.createTextNode(t.label));
      box.appendChild(el('div', 'position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-bottom:0;border-top-color:' + bg));
      var wrap = el('div', 'position:relative;width:0;height:0');
      wrap.appendChild(box);
      var m = L.marker([t.lat, t.lng], { icon: L.divIcon({ className: '', html: wrap, iconSize: [0, 0], iconAnchor: [0, 0] }) }).addTo(map);
      (function (key) { m.on('click', function () { post({ type: 'tag', key: key }); }); })(t.key);
      tagLayers.push(m);
      tagLayers.push(L.circleMarker([t.lat, t.lng], { radius: 5, color: '#fff', weight: 2, fillColor: bg, fillOpacity: 1, interactive: false }).addTo(map));
    }
  }

  function setMe(me) {
    if (!me) {
      if (meDot) {
        map.removeLayer(meDot);
        map.removeLayer(meRing);
        meDot = null;
        meRing = null;
      }
      return;
    }
    var ll = [me.lat, me.lng];
    if (!meDot) {
      meRing = L.circle(ll, { radius: me.accuracyM, color: '#1F4E8C', weight: 1, fillColor: '#1F4E8C', fillOpacity: 0.12, interactive: false }).addTo(map);
      meDot = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#1F4E8C', fillOpacity: 1, interactive: false }).addTo(map);
    }
    meRing.setLatLng(ll);
    meRing.setRadius(me.accuracyM);
    meDot.setLatLng(ll);
  }

  /** The site circle, the pins and the blue dot; null when there is nothing to frame. */
  function contentBounds(s) {
    var b = L.latLngBounds([]);
    if (s.center) b.extend(L.latLng(s.center.lat, s.center.lng).toBounds(s.radiusM * 2));
    for (var i = 0; i < pins.length; i++) b.extend(pins[i].getLatLng());
    for (var j = 0; j < (s.sites || []).length; j++) b.extend(L.latLng(s.sites[j].lat, s.sites[j].lng).toBounds(s.sites[j].radiusM * 2));
    for (var k = 0; k < (s.tags || []).length; k++) b.extend([s.tags[k].lat, s.tags[k].lng]);
    if (s.me) b.extend(L.latLng(s.me.lat, s.me.lng));
    return b.isValid() ? b : null;
  }

  function fitContent(s) {
    var b = contentBounds(s);
    if (b) map.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
  }

  function update(s) {
    setTiles(s.tileUrl);
    tapToPlace = !!s.tapToPlace;
    setCentre(s);
    setSites(s.sites);
    setPins(s.pins);
    setTags(s.tags);
    setMe(s.me);

    if (!s.center && !overviewShown && s.overview && s.overview.length > 0) {
      overviewShown = true;
      map.fitBounds(L.latLngBounds(s.overview.map(function (p) { return [p.lat, p.lng]; })).pad(0.3), { maxZoom: 13 });
    }
    if (s.recenterKey !== lastRecenter) {
      lastRecenter = s.recenterKey;
      fitContent(s);
    } else if (s.follow && s.me && !map.getBounds().contains([s.me.lat, s.me.lng])) {
      fitContent(s);
    }
  }

  window.veMap = { update: update };
  post({ type: 'ready' });
})();
