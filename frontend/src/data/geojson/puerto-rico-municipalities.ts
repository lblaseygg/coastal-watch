import type { FeatureCollection } from "geojson";

const puertoRicoMunicipalities: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        geojson_key: "aguadilla",
        name: "Aguadilla"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-67.195, 18.445],
            [-67.115, 18.445],
            [-67.115, 18.39],
            [-67.195, 18.39],
            [-67.195, 18.445]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        geojson_key: "rincon",
        name: "Rincon"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-67.285, 18.37],
            [-67.22, 18.37],
            [-67.22, 18.315],
            [-67.285, 18.315],
            [-67.285, 18.37]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        geojson_key: "loiza",
        name: "Loiza"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-65.925, 18.455],
            [-65.84, 18.455],
            [-65.84, 18.4],
            [-65.925, 18.4],
            [-65.925, 18.455]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        geojson_key: "salinas",
        name: "Salinas"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-66.355, 17.99],
            [-66.245, 17.99],
            [-66.245, 17.935],
            [-66.355, 17.935],
            [-66.355, 17.99]
          ]
        ]
      }
    }
  ]
};

export default puertoRicoMunicipalities;
