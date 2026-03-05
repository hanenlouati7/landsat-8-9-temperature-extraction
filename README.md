# Landsat Surface Water Temperature (Google Earth Engine)

## Description

This repository contains a **Google Earth Engine (GEE) script** to compute **surface water temperature (°C)** from **Landsat 8 and Landsat 9 Collection 2 Level-2 imagery**.
The script applies cloud masking, converts thermal data to Celsius, masks land pixels, mosaics overlapping scenes acquired on the same day, and exports temperature maps.

It can be reused for **any area of interest** by modifying a few user parameters.

---

## Data

* Landsat 8 Collection 2 Level-2
* Landsat 9 Collection 2 Level-2

Source: U.S. Geological Survey (USGS) via Google Earth Engine.

References
https://www.usgs.gov/landsat-missions/landsat-collection-2
https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C02_T1_L2

---

## How to Run

1. Open the **Google Earth Engine Code Editor**
   https://code.earthengine.google.com

2. Copy the script from this repository into a new GEE script.

3. Define the **region of interest (ROI)**:

```javascript
var roi_poly = YourPolygon;
```

4. Define **sample points** for temperature time series (optional):

```javascript
var roi_point = ee.Geometry.Point(lon, lat);
```

5. Set the **date range** for the Landsat collection.

6. Run the script.

---

## Outputs

The script produces:

* Surface water temperature maps (GeoTIFF)
* Temperature time series at selected points
* Optional CSV with acquisition date and scene time

Exports are saved to **Google Drive**.

---

