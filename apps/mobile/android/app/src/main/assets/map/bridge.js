(function () {
  var INDIA = [[6.5, 68], [35.5, 97.5]];
  var map = L.map('map', { zoomControl: true });
  map.fitBounds(INDIA);
  var tiles = null;
  var tileUrl = null;
  var centre = null;
  var circle = null;
  var pins = [];
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
    setPins(s.pins);
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
