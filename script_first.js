//// DANUBE 2019 - 2022 

// Danube_Head = LAT = 45.357, LON = 28.022
// Danube_Sulina (outlet) LAT = 45.15, LON = 29.67


// Define map center within Danube ROI
Map.setCenter(29.67, 45.15, 9);

// Define the region of interest (ROI) - Danube Delta
var roi_point = ee.Geometry.Point(28.022, 45.357); // Danube_Head
var roi_point2 = ee.Geometry.Point(29.67, 45.15); // Danube_Sulina (outlet)
var roi_point3 = Danube_Sulina_adjusted; // Danube_Sulina (outlet)

// Define the region of interest (ROI) as a polygon
var roi_poly = Danube_domain;

// Clip collection (Landsat 8 & 9, collection 2, tier 1, L2 imagery to ROI
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');
var l8_9 = ee.ImageCollection(l8.merge(l9))
                  .filter(ee.Filter.date('2019-01-01', '2022-12-31'))
                  .sort('DATE_ACQUIRED')
                  .filter(ee.Filter.or(
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 181),         
                                ee.Filter.eq('WRS_ROW', 28)),
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 181), 
                                ee.Filter.eq('WRS_ROW', 29)),
//                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 181), 
//                                ee.Filter.eq('WRS_ROW', 30)),
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 180), 
                                ee.Filter.eq('WRS_ROW', 28)),
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 180), 
                                ee.Filter.eq('WRS_ROW', 29))))
//                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 180), 
//                                ee.Filter.eq('WRS_ROW', 30))))
                  .filterBounds(roi_poly);
print ('selected paths, no cmask', l8_9);
                  
function clp(img) {
  return img.clip(roi_poly);
}

var clippedl8_9 = l8_9.map(clp);
print('clippedl8_9', clippedl8_9);

// checking individual images
var check_image = clippedl8_9.filterMetadata('system:index', 'equals', '1_LC08_180028_20190221'); // 1st sample image


// Display the raw sample image.
//var visParams = {
//  bands: ['SR_B5', 'SR_B4', 'SR_B3'],
//  min: 5000.0,
//  max: 20000.0,
//  gamma: [0.95, 1.1, 1]
//};

//Map.setCenter(29.67, 45.15, 9);
//Map.addLayer(check_image, visParams, 'Raw sample image');



// filtering how many images were acquired at GMT (23:00) night acquired images
// What time of the day images were taken?
var time = clippedl8_9;
print("SCENE_CENTER_TIME histogram", time.aggregate_histogram("SCENE_CENTER_TIME"));




// WITH CLOUD MASKING (from https://code.earthengine.google.com/b9a1316f744f75277f314698b0094da2)
// This example demonstrates the use of the Landsat 8 Collection 2, Level 2 
// QA_PIXEL band (CFMask) to mask unwanted pixels.

function maskL8sr(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBands, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

// Map the function over the time period.
var collection_cmasked = clippedl8_9
                     .map(maskL8sr);
                     
var composite = collection_cmasked.median();

// Display the cloud-free median composite.
var visParams = {
  bands: ['SR_B6', 'SR_B5', 'SR_B3'],
  min: 0,
  max: 0.4,
};
Map.setCenter(29.67, 45.15, 9);
Map.addLayer(composite.clip(roi_poly), visParams, 'Cloud-free mosaic');

print ('cloud mask_mosaic', composite);


// check other parameters
print("processing level", collection_cmasked.aggregate_histogram("PROCESSING_LEVEL"));
print("cloud cover", collection_cmasked.aggregate_histogram("CLOUD_COVER"));
print("collection category", collection_cmasked.aggregate_histogram("COLLECTION_CATEGORY"));
print("spacecraft_ID", collection_cmasked.aggregate_histogram("SPACECRAFT_ID"));
print("WRS row", collection_cmasked.aggregate_histogram("TARGET_WRS_ROW"));
print("WRS path", collection_cmasked.aggregate_histogram("TARGET_WRS_PATH"));



// retrieving Surface Temperature from ST_B10 band
var testPoint = roi_point;
var testPoint2 = roi_point2;
var testPoint3 = roi_point3;

var sst_chart = ui.Chart.image.series({
  imageCollection: collection_cmasked.select('ST_B10'),
  region: testPoint,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
  title: 'SST trial (Landsat 8/9, atmospherically corrected, Danube_Head)',
  vAxis: { title: 'Surface Temp (in Kelvin)' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST_B10_Kelvin', sst_chart);

///// STEP 3: CALCULATING THE BRIGHTNESS TEMPERATURE FROM ST_B10_Kelvin to Celsius /////

// Function to calculate brightness temperature in Celsius
var ST_B10_celsius = function(image) {
  // Select the necessary bands from the image
  var ST_B10 = image.select('ST_B10');

  // Apply the expression to calculate brightness temperature in Celsius
  var temperature = image.expression(
    'ST_B10 -273.15', {
      'ST_B10': ST_B10,
    }
  );

  // Add the calculated brightness temperature as a new band
  return image.addBands(temperature.rename('ST_B10_celsius'));
};

// Map the function over the image collection
var Landsat_with_BT_celsius = collection_cmasked.map(ST_B10_celsius);

// Print the resulting collection
print('Landsat_with_BT_celsius', Landsat_with_BT_celsius);

// visualization of ST_B10_celsius
var sst_chart_celsius = ui.Chart.image.series({
  imageCollection: Landsat_with_BT_celsius.select('ST_B10_celsius'),
  region: testPoint,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
  title: 'SST trial (Landsat 8/9, atmospherically corrected, Danube_Head, no offset)',
  vAxis: { title: 'Surface Temp (in Celsius)' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST_B10_Celsius', sst_chart_celsius);

// checking individual images (BT in Celsius)
var check_image_celsius = Landsat_with_BT_celsius.filterMetadata('system:index', 'equals', '1_LC08_180029_20190221'); // 1st sample image


// Display the cloud-free sample image.
//var visParams = {
//  bands: ['ST_B10_celsius'],
//  min: 0,  
//  max: 37,  
//  palette: ['blue', 'cyan', 'yellow', 'orange', 'red'],
//};
//Map.setCenter(12.3138, 45.0555, 9);
//Map.addLayer(check_image_celsius, visParams, 'Cloud-free sample image (Temp in °C)');

//// map with emissivity
// Function to scale emissivity
var ST_emis_scaled = function(image) {
  // Select the necessary bands from the image
  var ST_EMIS = image.select('ST_EMIS');

  // Apply the expression to scale emissivity
  var emis = ST_EMIS.multiply(0.0001);


  // Add the scaled emissivity as a new band
  return image.addBands(emis.rename('ST_emissivity'));
};

// Map the function over the image collection
var Landsat_with_STcelsius_EMIS = collection_cmasked.map(function(image){
  return ST_B10_celsius(ST_emis_scaled(image));
});

// Print the resulting collection
print('Landsat_with_STcelsius_EMIS', Landsat_with_STcelsius_EMIS);



//// Extracting SCENE_CENTER_TIME and DATE_ACQUIRED time series

// Extract SCENE_CENTER_TIME as an array
var sceneCenterTimeArray = Landsat_with_STcelsius_EMIS.aggregate_array('SCENE_CENTER_TIME');

// Extract DATE_ACQUIRED as an array
var dateAcquiredArray = Landsat_with_STcelsius_EMIS.aggregate_array('DATE_ACQUIRED');

// Extract system:index as an array
var systemIndexArray = Landsat_with_STcelsius_EMIS.aggregate_array('system:index');

// Create a FeatureCollection from the arrays
var featureCollection = ee.FeatureCollection(
  ee.List.sequence(0, sceneCenterTimeArray.length().subtract(1)).map(function(i) {
    return ee.Feature(null, {
      'SCENE_CENTER_TIME': ee.List(sceneCenterTimeArray).get(i),
      'DATE_ACQUIRED': ee.List(dateAcquiredArray).get(i),
      'system:index': ee.List(systemIndexArray).get(i)
    });
  })
);



//// PLOTTING ST and EMIS values in the Danube_Head (no offset yet)
// Visualization of surface temperature in Celsius & emissivity
var sst_chart_STcelsius_emis = ui.Chart.image.series({
  imageCollection: Landsat_with_STcelsius_EMIS.select('ST_B10_celsius', 'ST_emissivity'),
  region: testPoint,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
  title: 'SST trial (Landsat 8/9, atmospherically corrected, Danube_Head, no offset)',
  vAxis: { title: 'Surface Temp (in Celsius), emissivity' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST in Celsius & Emissivity', sst_chart_STcelsius_emis);

//// PLOTTING ST and EMIS values in the Danube_Sulina (no offset yet)
// Visualization of surface temperature in Celsius & emissivity
var sst_chart_STcelsius_emis = ui.Chart.image.series({
  imageCollection: Landsat_with_STcelsius_EMIS.select('ST_B10_celsius', 'ST_emissivity'),
  region: testPoint2,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
  title: 'SST trial (Landsat 8/9, atmospherically corrected, Danube_Sulina, no offset)',
  vAxis: { title: 'Surface Temp (in Celsius), emissivity' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST in Celsius & Emissivity', sst_chart_STcelsius_emis);


//// PLOTTING ST and EMIS values in the Danube_Sulina_adjusted (no offset yet)
// Visualization of surface temperature in Celsius & emissivity
var sst_chart_STcelsius_emis = ui.Chart.image.series({
  imageCollection: Landsat_with_STcelsius_EMIS.select('ST_B10_celsius', 'ST_emissivity'),
  region: testPoint3,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
  title: 'SST trial (Landsat 8/9, atmospherically corrected, Danube_Sulina_adjusted, no offset)',
  vAxis: { title: 'Surface Temp (in Celsius), emissivity' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST in Celsius & Emissivity', sst_chart_STcelsius_emis);





//// APPLYING THE y = 0.8649x + 1.9365 equation (Temp offset) ////

// Function to calculate brightness temperature in Celsius with offset
var ST_B10_celsius_offset = function(image) {
  // Select the necessary bands from the image
  var ST_B10_celsius = image.select('ST_B10_celsius');

  // Apply the expression to calculate brightness temperature in Celsius with offset
  var temp_offset = ST_B10_celsius.expression(
    '(0.8649 * ST_B10_celsius) + 1.9365', {
      'ST_B10_celsius': ST_B10_celsius
    }
  );

  // Add the calculated brightness temperature as a new band
  return image.addBands(temp_offset.rename('Temp_celsius_final'));
};

// Map the function over the image collection
var Landsat_with_BT_celsius_offset = Landsat_with_STcelsius_EMIS.map(ST_B10_celsius_offset);

// Print the resulting collection
print('Landsat_with_BT_celsius_offset', Landsat_with_BT_celsius_offset);


//// PLOTTING THE LANDSAT TEMPERATURE W/ CALIBRATION EQUATION (Temp offset) ////
//// plotting of temperature with offset applied (Danube_Head)
var sst_chart_STcelsius_emis = ui.Chart.image.series({
//  imageCollection: Landsat_with_BT_celsius_offset.select('ST_emissivity', 'Temp_celsius_final'),
  imageCollection: Landsat_with_BT_celsius_offset.select('Temp_celsius_final'),
  region: testPoint,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
  title: 'SST trial (Landsat 8/9 surface temperature & emissivity, Danube_Head_w/offset)',
  vAxis: { title: 'Surface Temp (in Celsius) & emissivity' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST in Celsius & Emissivity', sst_chart_STcelsius_emis);

//// plotting of temperature with offset applied (Danube_Sulina, w/ offset)
var sst_chart_STcelsius_emis = ui.Chart.image.series({
//  imageCollection: Landsat_with_BT_celsius_offset.select('ST_emissivity', 'Temp_celsius_final'),
  imageCollection: Landsat_with_BT_celsius_offset.select('Temp_celsius_final'),
  region: testPoint2,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
//  title: 'SST trial (Landsat 8/9 surface temperature & emissivity, Po di Goro outlet 1)',
  title: 'SST trial (Landsat 8/9 surface temperature, Danube_Sulina, w/offset)',
  vAxis: { title: 'Surface Temp (in Celsius) & emissivity' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST in Celsius & Emissivity', sst_chart_STcelsius_emis);

//// plotting of temperature with offset applied (Danube_Sulina_guide, w/ offset)
var sst_chart_STcelsius_emis = ui.Chart.image.series({
//  imageCollection: Landsat_with_BT_celsius_offset.select('ST_emissivity', 'Temp_celsius_final'),
  imageCollection: Landsat_with_BT_celsius_offset.select('Temp_celsius_final'),
  region: testPoint3,
}).setOptions({
  interpolateNulls: true,
  lineWidth: 1,
  pointSize: 3,
//  title: 'SST trial (Landsat 8/9 surface temperature & emissivity, Po di Goro outlet 1)',
  title: 'SST trial (Landsat 8/9 surface temperature, Danube_Sulina_adjusted, w/offset)',
  vAxis: { title: 'Surface Temp (in Celsius)' },
  hAxis: { title: 'Date', format: 'YYYY-MMM', gridlines: { count: 12 } },
});

print('ST in Celsius & Emissivity', sst_chart_STcelsius_emis);



///// Applying land masking to the final temperature data band  ////// 
// using land cover
var LandCov = ee.Image('COPERNICUS/Landcover/100m/Proba-V-C3/Global/2019')
  .select('discrete_classification');

var geomPoly = roi_poly;
var LandCov_clip = LandCov.clip(geomPoly);
print('Clipped Land Cover', LandCov_clip);

// Define water classes
var waterClasses = [80, 90, 200]; // water classes

// Create individual masks for each water class
var permanentWaterMask = LandCov_clip.eq(waterClasses[0]);
//var herbaceousWetlandMask = LandCov_clip.eq(waterClasses[1]);
var oceansMask = LandCov_clip.eq(waterClasses[2]);

// Combine the masks
//var waterMask = permanentWaterMask.or(herbaceousWetlandMask).or(oceansMask);
var waterMask = permanentWaterMask.or(oceansMask);


// Clip Landsat_with_BT_celsius_offset with water mask to keep water bodies
var Landsat_with_BT_celsius_offset_masked = Landsat_with_BT_celsius_offset.map(function(image) {
  return image.updateMask(waterMask);
});

// Visualize water bodies
//Map.setCenter(12.3138, 45.0555, 9);
//Map.addLayer(waterMask.updateMask(waterMask), {palette: 'blue', opacity: 0.3}, 'Water Mask');

// Add the masked image to the map
//Map.addLayer(Landsat_with_BT_celsius_offset_masked, {}, 'Landsat with BT (celsius) offset - masked');

print (Landsat_with_BT_celsius_offset_masked, 'Landsat_with_BT_celsius_offset_masked');

/////checking individual images of landsat temperature final
//var check_image_lmasked = Landsat_with_BT_celsius_offset_masked.filterMetadata('system:index', 'equals', '1_LC08_180029_20190221');




////////////// MOSAICKING OVERLAPPING SCENES FOR FINAL TEMPERATURE //////////////
// https://gis.stackexchange.com/questions/280156/mosaicking-image-collection-by-date-day-in-google-earth-engine
//original version
var roi = roi_poly;

var start = ee.Date('2019-01-01');
var finish = ee.Date('2022-12-31');

var imcol = Landsat_with_BT_celsius_offset_masked
.filterDate(start, finish)
.filterBounds(roi)
.select("Temp_celsius_final");

// Difference in days between start and finish
var diff = finish.difference(start, 'day');

// Make a list of all dates
var range = ee.List.sequence(0, diff.subtract(1)).map(function(day){return start.advance(day,'day')});

function mosaicByDate(imcol){
  var imlist = imcol.toList(imcol.size());
  print(imlist);

  var unique_dates = imlist.map(function(im){
    return ee.Image(im).date().format("YYYY-MM-dd");
  }).distinct();
print(unique_dates);

  var mosaic_imlist = unique_dates.map(function(d){
    d = ee.Date(d);
    //print(d)
    var im = imcol
      .filterDate(d, d.advance(1, "day"))
      .mosaic();
    //print(im)
    return im.set(
        "system:time_start", d.millis(), 
        "system:id", d.format("YYYY-MM-dd"));
  });

  return ee.ImageCollection(mosaic_imlist);
}

//var ic = ic.filterBounds(roi)
//print(ic)
var ic_m = mosaicByDate(imcol); // image collection_mosaicked
print(ic_m, "collection_date_mosaicked");


// Display the cloud-free sample image of Landsat temperature
var check_image_mosaic = ic_m.filterMetadata('system:index', 'equals', '14');
var visParams = {
  bands: ['Temp_celsius_final'],
  min: 8,  
  max: 50,  
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red'],
};
Map.setCenter(29.67, 45.15, 9);
Map.addLayer(check_image_mosaic, visParams, 'sample temperature scene in °C, landmasked');

// Define a sample point ROI
var samplePoint1 = Danube_Head_adjusted;

// Function to extract temperature values at the sample point
var extractTemperatures = function(image) {
  // Sample the temperature values at the point
  var temperatureValue = image.reduceRegion({
    reducer: ee.Reducer.first(), // If you want the first value, change this to mean, median, etc.
    geometry: samplePoint1,
    scale: 30, // Adjust scale as needed
  });
  // Return the image date and temperature value
  return ee.Feature(null, {
    date: image.date(),
    temperature: temperatureValue.get('Temp_celsius_final') 
  });
};

// Map the extraction function over the image collection
var temperatureData = ic_m.map(extractTemperatures);

// Create a time series chart
var temperatureChart = ui.Chart.feature.byFeature({
  features: temperatureData,
  xProperty: 'date',
  yProperties: ['temperature']
}).setOptions({
  title: 'Temperature Time Series',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Temperature (°C)'},
  lineWidth: 1,
  pointSize: 3,
});

// Display the chart
print(temperatureChart, "temp_final_mosaicked by date, Danube (Head)");



// Define a sample point ROI
var samplePoint2 = Danube_Sulina_adjusted;

// Function to extract temperature values at the sample point
var extractTemperatures = function(image) {
  // Sample the temperature values at the point
  var temperatureValue = image.reduceRegion({
    reducer: ee.Reducer.first(), // If you want the first value, change this to mean, median, etc.
    geometry: samplePoint2,
    scale: 30, // Adjust scale as needed
  });
  // Return the image date and temperature value
  return ee.Feature(null, {
    date: image.date(),
    temperature: temperatureValue.get('Temp_celsius_final') 
  });
};

// Map the extraction function over the image collection
var temperatureData = ic_m.map(extractTemperatures);

// Create a time series chart
var temperatureChart = ui.Chart.feature.byFeature({
  features: temperatureData,
  xProperty: 'date',
  yProperties: ['temperature']
}).setOptions({
  title: 'Temperature Time Series',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Temperature (°C)'},
  lineWidth: 1,
  pointSize: 3,
});

// Display the chart
print(temperatureChart, "temp_final_mosaicked by date, Sulina (outlet)");



// Display the cloud-free sample image of raw image
//var check_image_raw = clippedl8_9.filterMetadata('system:index', 'equals', '1_LC08_192029_20170118');
//var visParams = {
//  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
//  min: 5000.0,
//  max: 20000.0,
//  gamma: [0.95, 1.1, 1]
//};
//Map.setCenter(12.3138, 45.0555, 9);
//Map.addLayer(check_image_raw, visParams, 'raw_first_image');



//// EXPORT IN GEOTIFF FORMAT - 1 month/year per batch ////
var final_data = ic_m
.filterDate("2020-11-20", "2020-11-23")
.select('Temp_celsius_final');

// defining export parameters
var exportArgs = {
  folder: "Danube_2020",
  region: roi_poly,
  scale: 30,
  crs: "epsg:4326", // WGS84
  fileFormat: "GeoTIFF",
  maxPixels: 1e9, // for Danube
  formatOptions: {
    cloudOptimized: true
  }
};

// convert the image collection into a list
var imageList = final_data.toList(final_data.size());

var numImages = imageList.size().getInfo();

for(var i = 0; i<numImages; i++) {
  // get the images from the list
  var image = ee.Image(imageList.get(i));
  
  // get the date of the image
//  var date = ee.Date(image.get('DATE_ACQUIRED')).format('yyyy-mm-dd');
  var date = ee.Date(image.get('system:time_start')).format('yyyy-mm-dd');

  
  exportArgs.image = image;
  
  exportArgs.fileNamePrefix = "temperature_Danube_" + date.getInfo();

  
// export the images
Export.image.toDrive(exportArgs);
}



// Extracting DATE_ACQUIRED and SCENE_CENTER_TIME
var dateAndTimeCollection = Landsat_with_BT_celsius_offset_masked.map(function(image) {
  var dateAcquired = ee.Date(image.get('DATE_ACQUIRED')).format('yyyy-MM-dd');
  var sceneCenterTime = ee.String(image.get('SCENE_CENTER_TIME'));
  return ee.Feature(null, {
    'DATE_ACQUIRED': dateAcquired,
    'SCENE_CENTER_TIME': sceneCenterTime
  });
});

// Exporting to CSV
Export.table.toDrive({
  collection: dateAndTimeCollection,
  description: 'Date_SceneCenterTime_Danube',
  folder: 'SurfaceTemp_GEE_Danube', // Adjust the folder as needed
  fileFormat: 'CSV'
});