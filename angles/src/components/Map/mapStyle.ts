// Dark base map. OpenFreeMap publishes a free, keyless, MapLibre-compatible
// vector tile dark style we can use directly:
//   https://openfreemap.org/quick_start/
// We pass the style URL straight to maplibre-gl; our custom marker layers
// (clusters / heading cones / live highlight) are added in MapView after load.
export const darkStyleURL = "https://tiles.openfreemap.org/styles/dark";
