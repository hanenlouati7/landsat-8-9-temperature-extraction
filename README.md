# Landsat Surface Water Temperature Extraction with Google Earth Engine

## Overview

This repository contains a **Google Earth Engine (GEE) script** to compute **surface water temperature (°C)** from **Landsat 8 and Landsat 9 Collection 2 Level-2 imagery**.

The workflow performs:

* Cloud masking using the QA_PIXEL band
* Thermal band scaling and conversion from Kelvin to Celsius
* Empirical temperature correction
* Water masking using Copernicus Land Cover data
* Mosaicking of overlapping scenes acquired on the same date
* Extraction of temperature time series at user-defined locations
* Export of temperature rasters as GeoTIFF files

The script is designed to be **reusable for any area of interest** by modifying a small set of user parameters.

---

## Data Sources

### Landsat Surface Reflectance and Surface Temperature

* Landsat 8 Collection 2 Level-2
* Landsat 9 Collection 2 Level-2

Provider: **U.S. Geological Survey (USGS)** via Google Earth Engine.

References:

USGS Landsat Collection 2 documentation
https://www.usgs.gov/landsat-missions/landsat-collection-2

Google Earth Engine Landsat dataset documentation
https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC08_C02_T1_L2

---

## Requirements

* Google Earth Engine account
* Access to the GEE Code Editor

GEE Code Editor:
https://code.earthengine.google.com

---

## How to Run the Script

### 1. Open Google Earth Engine

Open the Code Editor:

https://code.earthengine.google.com

---

### 2. Copy the Script

Copy the script from this repository and paste it into a **new script in the GEE Code Editor**.

---

### 3. Define the Region of Interest (ROI)

Create a polygon in the GEE map interface and assign it to the ROI variable.

Example:

```javascript
var roi_poly = YourPolygon;
```

The polygon defines the **area where Landsat images will be processed and exported**.

---

### 4. Define Sample Points (Optional)

Sample points allow extraction of **temperature time series** at specific locations.

Example:

```javascript
var roi_point = ee.Geometry.Point(lon, lat);
var roi_point2 = ee.Geometry.Point(lon, lat);
```

Additional points can be added if needed.

---

### 5. Define the Time Range

Set the date range for the Landsat image collection.

Example:

```javascript
.filter(ee.Filter.date('YYYY-MM-DD','YYYY-MM-DD'))
```

---

### 6. Run the Script

Run the script in the GEE editor.

The script will automatically:

1. Load Landsat 8 and 9 imagery
2. Apply cloud masking
3. Convert thermal band values to Celsius
4. Apply empirical temperature correction
5. Mask land pixels
6. Mosaic overlapping scenes acquired on the same date
7. Generate temperature maps
8. Produce time-series charts at the defined sample points

---

## Workflow Description

The workflow consists of the following steps:

1. Define the region of interest and sample points
2. Load Landsat 8 and 9 Level-2 image collections
3. Filter images by date and spatial extent
4. Apply cloud masking using the QA_PIXEL band
5. Apply radiometric scaling to optical and thermal bands
6. Convert thermal band ST_B10 from Kelvin to Celsius
7. Apply empirical temperature offset correction
8. Mask land pixels using Copernicus Land Cover data
9. Mosaic scenes acquired on the same day
10. Extract temperature values at sample points
11. Export temperature rasters to Google Drive

---

## Outputs

The script produces the following outputs:

### Temperature Maps

Surface water temperature rasters exported as:

* **GeoTIFF format**
* **30 m spatial resolution**
* **WGS84 coordinate system**

---

### Time Series Charts

Temperature time series are generated at each defined sample point.

These charts display:

* Temperature (°C)
* Date of satellite acquisition

---

### CSV File (Optional)

A table containing:

* Acquisition date (`DATE_ACQUIRED`)
* Scene center time (`SCENE_CENTER_TIME`)

This file can be exported to Google Drive.

---

## Export Configuration

Exports are configured using the following parameters:

```javascript
var exportArgs = {
  folder: "YourFolderName",
  region: roi_poly,
  scale: 30,
  crs: "epsg:4326",
  fileFormat: "GeoTIFF",
  maxPixels: 1e9
};
```

Users should modify:

* export folder
* export date range

---

## Notes

* The script supports **Landsat 8 and Landsat 9 imagery**.
* The ROI polygon automatically filters relevant scenes using `filterBounds`.
* Multiple Landsat scenes acquired on the same day are **mosaicked to produce a single temperature map per date**.
* Sample points are optional and only required if time series extraction is needed.

---



