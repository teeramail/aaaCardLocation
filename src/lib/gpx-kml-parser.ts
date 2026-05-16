export function parseGpxKml(xmlString: string): Array<{ lat: number; lng: number; ele?: number }> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const points: Array<{ lat: number; lng: number; ele?: number }> = [];

  // Try parsing GPX first (<trkpt lat="..." lon="...">)
  const trkpts = xmlDoc.getElementsByTagName("trkpt");
  if (trkpts.length > 0) {
    for (let i = 0; i < trkpts.length; i++) {
      const pt = trkpts[i];
      if (!pt) continue;
      const lat = parseFloat(pt.getAttribute("lat") || "0");
      const lng = parseFloat(pt.getAttribute("lon") || "0");
      
      const eleNode = pt.getElementsByTagName("ele")[0];
      const ele = eleNode?.textContent ? parseFloat(eleNode.textContent) : undefined;
      
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({ lat, lng, ele: isNaN(ele as number) ? undefined : ele });
      }
    }
    return points;
  }

  // Try parsing KML (<coordinates>lon,lat,alt lon,lat,alt ...</coordinates>)
  const coordinates = xmlDoc.getElementsByTagName("coordinates");
  if (coordinates.length > 0) {
    for (let i = 0; i < coordinates.length; i++) {
      const coordText = coordinates[i]?.textContent;
      if (!coordText) continue;

      const pairs = coordText.trim().split(/\s+/);
      for (const pair of pairs) {
        const [lngStr, latStr, altStr] = pair.split(",");
        if (lngStr && latStr) {
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          const ele = altStr ? parseFloat(altStr) : undefined;
          
          if (!isNaN(lat) && !isNaN(lng)) {
            points.push({ lat, lng, ele: isNaN(ele as number) ? undefined : ele });
          }
        }
      }
    }
    return points;
  }

  return points;
}
