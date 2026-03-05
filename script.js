// Define map center within Danube ROI
Map.setCenter(29.67, 45.15, 9);

// Define the region of interest (ROI) - Danube Delta
// add as many point as needed then adjust in the script
// you can also use the point creator tool in the GEE map when assigning a point variable
var roi_point = ee.Geometry.Point(28.022, 45.357); // Danube_Head
var roi_point2 = ee.Geometry.Point(29.67, 45.15); // Danube_Sulina (outlet)
//var roi_point2 = Danube_Sulina_adjusted - same as roi_point2 but based on the point creator tool, so need to provide coordinates 

// Define the region of interest (ROI) as a polygon
// Define the new ROI polygon
var roi_poly = ee.Geometry.Polygon([
  [
    [26.004639, 47.129951],
    [25.43335, 45.966425],
    [24.664307, 44.699898],
    [30.750732, 43.004647],
    [32.299805, 45.506347],
    [26.004639, 47.129951]
  ]
]);

// Optional: visualize
Map.centerObject(roi_poly, 6); // Zoom out to see the whole polygon
Map.addLayer(roi_poly, {color: 'blue'}, 'ROI Polygon');
// Clip collection (Landsat 8 & 9, collection 2, tier 1, L2 imagery to ROI
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');
var l8_9 = ee.ImageCollection(l8.merge(l9))
                  .filter(ee.Filter.date('2019-01-01', '2022-12-31')) // change this
                  .sort('DATE_ACQUIRED')
                  .filter(ee.Filter.or(
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 181),     // change WRS_path and WRS_row depending on the study area  
                                ee.Filter.eq('WRS_ROW', 28)),
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 181), 
                                ee.Filter.eq('WRS_ROW', 29)),
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 180), 
                                ee.Filter.eq('WRS_ROW', 28)),
                                ee.Filter.and(ee.Filter.eq('WRS_PATH', 180), 
                                ee.Filter.eq('WRS_ROW', 29))))
                  .filterBounds(roi_poly);
print ('selected paths, no cmask', l8_9);
                  
function clp(img) {
  return img.clip(roi_poly);
}

var clippedl8_9 = l8_9.map(clp);
print('clippedl8_9', clippedl8_9);

// checking individual images - optional
var check_image = clippedl8_9.filterMetadata('system:index', 'equals', '1_LC08_180028_20190221'); // 1st sample image


// What time of the day images were taken? This is just for checking; optional step
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


///// Converting ST_B10 (Kelvin to Celsius) /////
var ST_B10_celsius = function(image) {
  var ST_B10 = image.select('ST_B10');

  var temperature = image.expression(
    'ST_B10 -273.15', {
      'ST_B10': ST_B10,
    }
  );

  return image.addBands(temperature.rename('ST_B10_celsius'));
};

// Map the function over the image collection
var Landsat_with_BT_celsius = collection_cmasked.map(ST_B10_celsius);

// Print the resulting collection
print('Landsat_with_BT_celsius', Landsat_with_BT_celsius);

// visualization of ST_B10_celsius
var testPoint = roi_point;
var testPoint2 = roi_point2;

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



//// Extracting SCENE_CENTER_TIME and DATE_ACQUIRED time series
var sceneCenterTimeArray = Landsat_with_BT_celsius.aggregate_array('SCENE_CENTER_TIME');
var dateAcquiredArray = Landsat_with_BT_celsius.aggregate_array('DATE_ACQUIRED');
var systemIndexArray = Landsat_with_BT_celsius.aggregate_array('system:index');

var featureCollection = ee.FeatureCollection(
  ee.List.sequence(0, sceneCenterTimeArray.length().subtract(1)).map(function(i) {
    return ee.Feature(null, {
      'SCENE_CENTER_TIME': ee.List(sceneCenterTimeArray).get(i),
      'DATE_ACQUIRED': ee.List(dateAcquiredArray).get(i),
      'system:index': ee.List(systemIndexArray).get(i)
    });
  })
);




//// APPLYING THE y = 0.8649x + 1.9365 equation (Temperature offset) ////
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
var Landsat_with_BT_celsius_offset = Landsat_with_BT_celsius.map(ST_B10_celsius_offset);

// Print the resulting collection
print('Landsat_with_BT_celsius_offset', Landsat_with_BT_celsius_offset);


///// Applying land masking to the final temperature data band  ////// 
// using land cover
var LandCov = ee.Image('COPERNICUS/Landcover/100m/Proba-V-C3/Global/2019')
  .select('discrete_classification');

var geomPoly = roi_poly;
var LandCov_clip = LandCov.clip(geomPoly);
print('Clipped Land Cover', LandCov_clip);

var waterClasses = [80, 90, 200]; // water classes

var permanentWaterMask = LandCov_clip.eq(waterClasses[0]);
var oceansMask = LandCov_clip.eq(waterClasses[2]);

var waterMask = permanentWaterMask.or(oceansMask);

var Landsat_with_BT_celsius_offset_masked = Landsat_with_BT_celsius_offset.map(function(image) {
  return image.updateMask(waterMask);
});

print (Landsat_with_BT_celsius_offset_masked, 'Landsat_with_BT_celsius_offset_masked');


////////////// MOSAICKING OVERLAPPING SCENES FOR FINAL TEMPERATURE //////////////
// https://gis.stackexchange.com/questions/280156/mosaicking-image-collection-by-date-day-in-google-earth-engine
var roi = roi_poly;

var start = ee.Date('2019-01-01'); // change date
var finish = ee.Date('2022-12-31'); // change date

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



//// Define a sample point ROI
var samplePoint1 = roi_point;

// Function to extract temperature values at the sample point
var extractTemperatures = function(image) {
  // Sample the temperature values at the point
  var temperatureValue = image.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: samplePoint1,
    scale: 30,
  }).get('Temp_celsius_final');  // <-- get the value immediately

  // Return a Feature with client-ready property
  return ee.Feature(null, {
    'date': image.date().format('YYYY-MM-dd'),  // format as string
    'temperature': temperatureValue              // assign the numeric value
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
var samplePoint2 = roi_point2;

// Function to extract temperature values at the sample point
var extractTemperatures = function(image) {
  // Sample the temperature values at the point
  var temperatureValue = image.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: samplePoint1,
    scale: 30,
  }).get('Temp_celsius_final');  // <-- get the value immediately

  // Return a Feature with client-ready property
  return ee.Feature(null, {
    'date': image.date().format('YYYY-MM-dd'),  // format as string
    'temperature': temperatureValue              // assign the numeric value
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



//// EXPORT IN GEOTIFF FORMAT - 1 month/year per batch ////
var final_data = ic_m
.filterDate("2020-11-20", "2020-11-23") // change this
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

  
// export the images - THIS IS THE FINAL OUTPUT
Export.image.toDrive(exportArgs);
}


// Extracting DATE_ACQUIRED and SCENE_CENTER_TIME - optional; do as needed
var dateAndTimeCollection = Landsat_with_BT_celsius_offset_masked.map(function(image) {
  var dateAcquired = ee.Date(image.get('DATE_ACQUIRED')).format('yyyy-MM-dd');
  var sceneCenterTime = ee.String(image.get('SCENE_CENTER_TIME'));
  return ee.Feature(null, {
    'DATE_ACQUIRED': dateAcquired,
    'SCENE_CENTER_TIME': sceneCenterTime
  });
});

Export.table.toDrive({
  collection: dateAndTimeCollection,
  description: 'Date_SceneCenterTime_Danube',
  folder: 'SurfaceTemp_GEE_Danube', // Adjust the folder as needed
  fileFormat: 'CSV'
});