(function () {
  var map = L.map('map', { zoomControl: true }).setView([18.5204, 73.8567], 16);
  var tiles = null;
  var tileUrl = null;
  var centre = null;
  var circle = null;
  var pins = [];
  var lastRecenter = null;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function update(s) {
    if (s.tileUrl !== tileUrl) {
      if (tiles) map.removeLayer(tiles);
      tileUrl = s.tileUrl;
      tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    }
    var ll = [s.center.lat, s.center.lng];
    if (!centre) {
      centre = L.marker(ll, {
        draggable: true,
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

    for (var i = 0; i < pins.length; i++) map.removeLayer(pins[i]);
    pins = [];
    for (var j = 0; j < s.pins.length; j++) {
      var p = s.pins[j];
      pins.push(L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 }).addTo(map));
    }

    if (s.recenterKey !== lastRecenter) {
      lastRecenter = s.recenterKey;
      var bounds = circle.getBounds();
      for (var k = 0; k < pins.length; k++) bounds.extend(pins[k].getLatLng());
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    }
  }

  window.veMap = { update: update };
  post({ type: 'ready' });
})();
