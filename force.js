// https://stackoverflow.com/questions/21776389/javascript-object-grouping

// This is adapted from https://bl.ocks.org/mbostock/2675ff61ea5e063ede2b5d63c08020c7

mapboxgl.accessToken =
  "pk.eyJ1IjoibWFya21jbGFyZW4iLCJhIjoiY2tyZGxoZXNkMDQxMTJ2bGgzZzdjaGJsMCJ9.m6uFDsFGrDQBn3oQTxukJQ";
let map = new mapboxgl.Map({
  container: "map", // container ID
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: "mapbox://styles/mapbox/light-v11", // style URL
  projection: "globe", // Display the map as a globe, since satellite-v9 defaults to Mercator
  //projection: "mercator",
  zoom: 3, // starting zoom
  center: [113.26, 23.13], // // starting center in [lng, lat]
});

map.setRenderWorldCopies(false);

map.on("style.load", () => {
  map.setFog({}); // Set the default atmosphere style
});

const padding = 100; // separation between nodes
const nav = new mapboxgl.NavigationControl();
map.addControl(nav, "top-right");

let mapLoaded = false;
let selectedYear = 1842;
let locations;
let clusterBy = "Company";

let clusterStrength = 0.5;
let clusterCentreInertia = 0;
let linkDistance = 0;
let linkStrength = 0;

const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
});

$(document).ready(function () {
  $("#yearRange").focus();
  configureLocations();
  configureSelections();
});

function configureLocations() {
  fetch("json/locations.json")
    .then((response) => response.json())
    .then(function (json) {
      locations = json;
    })
    .then(function () {
      updateSimulationProperties();
      formChange();
    });
}

function configureSelections() {
  fetch("json/selections.json")
    .then((response) => response.json())
    .then(function (json) {
      populateSelect("selectCompany", json.companies);
      populateSelect("selectLocation", json.locations);
      populateSelect("selectOccupation", json.occupations);
      populateSelect("selectNationality", json.nationalities);
    });
}

function populateSelect(select, options) {
  const selectOutput = document.getElementById(select);
  let opt, el;
  for (let i = 0; i < options.length; i++) {
    opt = options[i];
    el = document.createElement("option");
    el.textContent = opt;
    el.value = opt;
    selectOutput.appendChild(el);
  }
}

function updateSimulationProperties(redraw) {
  if (document.getElementById("controls")) {
    document.getElementById("zoom").innerText = map.getZoom();
    clusterStrength = document.getElementById("clusterStrength").value;
    clusterCentreInertia = document.getElementById(
      "clusterCentreInertia"
    ).value;
    linkDistance = document.getElementById("linkDistance").value;
    linkStrength = document.getElementById("linkStrength").value;
    document.getElementById("clusterStrengthDisplay").innerText =
      clusterStrength;
    document.getElementById("clusterCentreInertiaDisplay").innerText =
      clusterCentreInertia;
    document.getElementById("linkDistanceDisplay").innerText = linkDistance;
    document.getElementById("linkStrengthDisplay").innerText = linkStrength;
    if (redraw) {
      formChange();
    }
  }
}

function formChange() {
  $("#yearRange").focus();
  selectedYear = document.getElementById("yearRange").value;
  clusterBy = document.getElementById("clusterBy").value;
  const filterCriteria = [
    {
      attribute: "Company",
      value: document.getElementById("selectCompany").value,
    },
    {
      attribute: "Location",
      value: document.getElementById("selectLocation").value,
    },
    {
      attribute: "Occupation",
      value: document.getElementById("selectOccupation").value,
    },
    {
      attribute: "Nationality",
      value: document.getElementById("selectNationality").value,
    },
  ];
  update(filterCriteria);
}

// we calculate the scale given mapbox state (derived from viewport-mercator-project's code)
// to define a d3 projection
function d3Projection() {
  const bbox = document.body.getBoundingClientRect();
  const center = map.getCenter();
  // const zoom = map.getZoom();
  const zoom = 4;
  //let zoom = map.getZoom() + 2;
  // 512 is hardcoded tile size, might need to be 256 or changed to suit your map config
  const scale = ((512 * 0.5) / Math.PI) * Math.pow(2, zoom);
  const d3projection = d3
    .geoMercator()
    .center([center.lng, center.lat])
    .translate([bbox.width / 2, bbox.height / 2])
    .scale(scale);
  return d3projection;
}

// LatLng to Pixels
function d3Project(latlng) {
  return d3Projection()(latlng);
}

// Pixels to LatLng
function d3Unproject(pixels) {
  let results = d3Projection().invert(pixels);
  results[0] = results[0] - 360;
  return results;
}

function filterData(graph, filterCriteria) {
  let filteredNodes = graph.nodes;
  // Iterate over each filter criteria
  for (let criteria of filterCriteria) {
    // Extract the attribute and value
    let attribute = criteria.attribute;
    let value = criteria.value;
    if (value !== "na") {
      switch (attribute) {
        case "Company":
          filteredNodes = filterNodesByCompany(filteredNodes, value);
          break;
        case "Location":
          filteredNodes = filterNodesByLocation(filteredNodes, value);
          break;
        case "Nationality":
          filteredNodes = filterNodesByNationality(filteredNodes, value);
          break;
        case "Occupation":
          filteredNodes = filterNodesByOccupation(filteredNodes, value);
          break;
      }
    }
  }
  let filteredLinks = filterLinks(filteredNodes, graph.links);
  graph.nodes = filteredNodes;
  graph.links = filteredLinks;
  return graph;
}

function filterNodesByOccupation(nodes, value) {
  return nodes.filter(function (node) {
    let result = false;
    if (node.details.Occupation === value) {
      result = true;
      return result;
    }
  });
}

function filterNodesByNationality(nodes, value) {
  return nodes.filter(function (node) {
    let result = false;
    if (node.details.Nationality === value) {
      result = true;
    }
    return result;
  });
}

function filterNodesByCompany(nodes, value) {
  return nodes.filter(function (node) {
    let result = false;
    if (node.details.Company === value) {
      result = true;
    }
    return result;
  });
}

function filterNodesByLocation(nodes, value) {
  return nodes.filter(function (node) {
    let result = false;
    if (node.details.Location === value) {
      result = true;
    }
    return result;
  });
}

function filterLinks(filteredNodes, links) {
  let ids = new Set();
  filteredNodes.forEach(function (d) {
    ids.add(d.id);
  });
  return links.filter(function (link) {
    return ids.has(link.source) && ids.has(link.target);
  });
}

function update(filterCriteria) {
  //console.log("Updating");
  const filename = "json/" + selectedYear + ".json?" + new Date().getTime();

  d3.json(filename).then(function (graph) {
    graph = filterData(graph, filterCriteria);
    //
    graph.nodes.forEach(function (d) {
      //d.Company = d.details.Company;
      d.group = d.details.Company;
    });
    //
    const zoom = map.getZoom();
    const simulation = d3
      .forceSimulation(graph.nodes)
      // cluster by section
      .force(
        "cluster",
        d3
          .forceCluster()
          .centers(function (d) {
            // console.log(d.details.Location);
            let location = locations[d.details.Location];
            d.LngLat = new mapboxgl.LngLat(location.Lng, location.Lat);
            d.point = [location.Lng, location.Lat];
            let coords = d3Project(d.point);
            d.x = coords[0];
            d.y = coords[1];
            return d;
          })
          .strength(clusterStrength)
          .centerInertia(clusterCentreInertia)
      )
      // apply collision with padding
      /*
      .force(
        "collide",
        d3
          .forceCollide(function (d) {
            return 5 + padding;
          })
          .strength(0)
      )
      */
      //
      .force(
        "link",
        d3
          .forceLink(graph.links)
          .id(function (d) {
            return d.id;
          })
          .distance(linkDistance)
          .strength(linkStrength)
      )
      .force("charge", d3.forceManyBody().strength(-2))
      .stop();
    simulation.force("link").links(graph.links);
    simulation.tick(300);
    //console.log(graph.nodes);
    //console.log(graph.links);
    //
    graph.nodes.forEach(function (d) {
      p = [d.x, d.y];
      d.LngLat = d3Unproject(p);
      d.Lng = d.LngLat[0];
      d.Lat = d.LngLat[1];
    });
    //
    graph.links.forEach(function (d) {
      d.line = [
        [d.source.Lng, d.source.Lat],
        [d.target.Lng, d.target.Lat],
      ];
    });
    const colours = d3.scaleOrdinal(d3.schemeCategory10);
    switch (clusterBy) {
      case "NetworkClustering":
        document.getElementById("legend").style.display = "none";
        //console.log(graph.nodes);
        //console.log(graph.links);

        netClustering.cluster(graph.nodes, graph.links);
        graph.nodes.forEach(function (d) {
          //console.log(d);
          d.colour = colours(d.cluster);
        });
        break;
      case "BronKerborsch":
        document.getElementById("legend").style.display = "none";
        let edges = [];
        graph.links.forEach(function (d) {
          edges.push([d.source_id, d.target_id]);
        });
        //console.log(edges);
        let cliques = BronKerbosch(edges);
        let idx;
        graph.nodes.forEach(function (d) {
          idx = 0;
          cliques.forEach(function (clique, cliqueIdx) {
            if (clique.includes(d.id)) {
              idx = cliqueIdx + 1;
            }
          });
          d.colour = colours(idx);
        });

        break;
      default:
        document.getElementById("legend").style.display = "block";
        graph.nodes = colourGroups(graph.nodes);
    }
    //

    //
    const nodes = GeoJSON.parse(graph.nodes, {
      Point: ["Lat", "Lng"],
      include: ["id", "details", "colour"],
    });
    const edges = GeoJSON.parse(graph.links, {
      LineString: "line",
      include: ["details", "source", "target", "source_id", "target_id"],
    });
    const locationArray = Object.entries(locations).map(([name, value]) => ({
      ...value,
      name,
    }));
    const locationsGeoJson = GeoJSON.parse(locationArray, {
      Point: ["Lat", "Lng"],
    });

    if (mapLoaded) {
      init(edges, nodes, locationsGeoJson, centre);
      clearFeatureStates();
    } else {
      map.on("load", function () {
        map.addSource("locations", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
        map.addLayer({
          id: "locations-layer",
          type: "circle",
          source: "locations",
          paint: {
            "circle-radius": 10,
            "circle-color": "red",
            "circle-stroke-color": "white",
            "circle-opacity": 0.2,
          },
        });

        map.addSource("edges", {
          type: "geojson",
          generateId: true,
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "edges-layer",
          type: "line",
          source: "edges",
          paint: {
            "line-color": "#666",
            "line-opacity": [
              "case",
              ["==", ["feature-state", "neighbour"], null],
              0.8,
              ["==", ["feature-state", "neighbour"], true],
              0.8,
              ["==", ["feature-state", "neighbour"], false],
              0.5,
              0.8,
            ],
            "line-width": [
              "case",
              ["==", ["feature-state", "neighbour"], null],
              1,
              ["==", ["feature-state", "neighbour"], true],
              3,
              ["==", ["feature-state", "neighbour"], false],
              0.8,
              1,
            ],
          },
        });

        map.addSource("nodes", {
          type: "geojson",
          promoteId: "id",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "nodes-layer",
          type: "circle",
          source: "nodes",
          paint: {
            "circle-radius": 5,
            "circle-stroke-width": 2,
            "circle-color": ["get", "colour"],
            "circle-stroke-color": "white",
            "circle-opacity": [
              "case",
              ["==", ["feature-state", "neighbour"], null],
              1,
              ["==", ["feature-state", "neighbour"], true],
              1,
              ["==", ["feature-state", "neighbour"], false],
              0.3,
              1,
            ],
          },
        });

        map.on("click", (e) => {
          if (map.getCanvas().style.cursor != "pointer") {
            clearFeatureStates();
          }
        });

        map.on("click", "nodes-layer", (e) => {
          const selectedNode = e.features[0].id;
          let allNodes = map.querySourceFeatures("nodes", {});
          let allEdges = map.querySourceFeatures("edges", {});
          let matchedNodes = new Set();
          matchedNodes.add(selectedNode);
          allEdges.forEach(function (d) {
            let neighbour = false;
            if (selectedNode === d.properties.source_id) {
              matchedNodes.add(d.properties.target_id);
              neighbour = true;
            }
            if (selectedNode === d.properties.target_id) {
              matchedNodes.add(d.properties.source_id);
              neighbour = true;
            }
            setEdgeNeighbourState(d.id, neighbour);
          });
          allNodes.forEach(function (d) {
            setNodeNeighbourState(d.id, matchedNodes.has(d.id));
          });
        });

        map.on("mouseenter", "nodes-layer", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const data = e.features[0];
          const coordinates = data.geometry.coordinates.slice();
          // Ensure that if the map is zoomed out such that multiple
          // copies of the feature are visible, the popup appears
          // over the copy being pointed to.
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }
          //
          let html;
          details = JSON.parse(data.properties.details);
          html = `
                <div class="row0">${data.properties.id}</div>
                <div class="row0">${details.Occupation}</div>
                <div class="row0">${details.Nationality}</div>
                <div class="row0">${details.Company}</div>
                <div class="row1 person">${details.Location}</div>
                <div class="row2">Person</div>
              `;
          popup.setLngLat(coordinates).setHTML(html).addTo(map);
        });

        map.on("mouseleave", "nodes-layer", (e) => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });

        map.on("zoomend", function () {
          updateSimulationProperties();
          formChange();
        });

        mapLoaded = true;
        //console.log("Map loaded");
        init(edges, nodes, locationsGeoJson);
      });
    }
  });
}

function setEdgeNeighbourState(id, state) {
  setNeighbourState(id, state, "edges");
}

function setNodeNeighbourState(id, state) {
  setNeighbourState(id, state, "nodes");
}

function setNeighbourState(id, state, source) {
  map.setFeatureState(
    {
      source: source,
      id: id,
    },
    {
      neighbour: state,
    }
  );
}

function clearFeatureStates() {
  map.removeFeatureState({
    source: "edges",
  });
  map.removeFeatureState({
    source: "nodes",
  });
}

function getCentreOfDisplayedNodes() {
  const features = map.queryRenderedFeatures({ layers: ["nodes-layer"] });
  const nodesCoords = [];
  features.forEach(function (d) {
    nodesCoords.push([d.geometry.coordinates[0], d.geometry.coordinates[1]]);
  });
  if (nodesCoords.length === 0) {
    nodesCoords.push([0, 0]);
  }
  const turfPoints = turf.points(nodesCoords);
  const centre = turf.center(turfPoints);
  return centre;
}

function init(edges, nodes, locationsGeoJson) {
  map.getSource("edges").setData(edges);
  map.getSource("nodes").setData(nodes);
  map.getSource("locations").setData(locationsGeoJson);
  centre = getCentreOfDisplayedNodes();
  if (
    centre.geometry.coordinates[0] !== 0 &&
    centre.geometry.coordinates[1] !== 0
  ) {
    const centreLngLat = new mapboxgl.LngLat(
      centre.geometry.coordinates[0],
      centre.geometry.coordinates[1]
    );
    map.panTo(centreLngLat);
  }
}

//

function colors(s) {
  return s.match(/.{6}/g).map(function (x) {
    return "#" + x;
  });
}

const schemeCategory20 = colors(
  "1f77b4aec7e8ff7f0effbb782ca02c98df8ad62728ff98969467bdc5b0d58c564bc49c94e377c2f7b6d27f7f7fc7c7c7bcbd22dbdb8d17becf9edae5"
);
//const schemeCategory20b = colors("393b795254a36b6ecf9c9ede6379398ca252b5cf6bcedb9c8c6d31bd9e39e7ba52e7cb94843c39ad494ad6616be7969c7b4173a55194ce6dbdde9ed6");
//const schemeCategory20c = colors("3182bd6baed69ecae1c6dbefe6550dfd8d3cfdae6bfdd0a231a35474c476a1d99bc7e9c0756bb19e9ac8bcbddcdadaeb636363969696bdbdbdd9d9d9");

function resolve(path, obj = self, separator = ".") {
  var properties = Array.isArray(path) ? path : path.split(separator);
  return properties.reduce((prev, curr) => prev?.[curr], obj);
}

const groupBy = (key) => (array) =>
  array.reduce((objectsByKeyValue, obj) => {
    const value = resolve(key, obj);
    objectsByKeyValue[value] = (objectsByKeyValue[value] || []).concat(obj);
    return objectsByKeyValue;
  }, {});

function colourGroups(nodes) {
  //console.log(clusterBy);
  //const colourArray = schemeCategory20;
  const colourArray = d3.schemeCategory10;
  const path = "details." + clusterBy;
  const groupByValue = groupBy(path);
  let colourGroups = groupByValue(nodes);
  colourGroupsKeys = Object.keys(colourGroups).sort();

  let val, idx, colour;
  nodes.forEach(function (d) {
    //console.log(d);
    val = resolve(path, d);
    //console.log(val);
    idx = colourGroupsKeys.indexOf(val);
    //console.log(idx);
    //console.log(schemeCategory20[idx]);
    d.colour = colourArray[idx];
  });
  let legendOutput = "<dl>";
  colourGroupsKeys.forEach(function (d, cidx) {
    //console.log(cidx);
    //console.log(d);
    colour = colourArray[cidx];
    legendOutput += `
    <dt style="background-color: ${colour}"></dt>
    <dd>${d  || 'Unattached'}</dd>
    `;
  });
  legendOutput += "</dl>";
  document.getElementById("legend").innerHTML = legendOutput;
  return nodes;
}
