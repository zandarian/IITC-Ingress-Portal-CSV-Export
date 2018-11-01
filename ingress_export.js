// ==UserScript==
// @id iitc-plugin-ingressportalcsvexport@zetaphor
// @name IITC Plugin: Ingress Portal Exporter
// @category Information
// @version 0.0.3
// @namespace http://github.com/zandarian/IITC-Ingress-Portal-CSV-Export
// @updateURL http://github.com/zandarian/IITC-Ingress-Portal-CSV-Export/raw/master/ingress_export.js
// @downloadURL http://github.com/zandarian/IITC-Ingress-Portal-CSV-Export/raw/master/ingress_export.js
// @description Exports portals to CSV, KML, and XML
// @include https://*.ingress.com/intel*
// @include http://*.ingress.com/intel*
// @include https://*.ingress.com/mission/*
// @include http://*.ingress.com/mission/*
// @match https://*.ingress.com/intel*
// @match http://*.ingress.com/intel*
// @match https://*.ingress.com/mission/*
// @match http://*.ingress.com/mission/*
// @grant none
// ==/UserScript==
/*global $:false */
/*global map:false */
/*global L:false */
function wrapper() {
    // in case IITC is not available yet, define the base plugin object
    if (typeof window.plugin !== "function") {
        window.plugin = function() {};
    }

    // base context for plugin
    window.plugin.portal_export = function() {};
    var self = window.plugin.portal_export;

    window.master_portal_list = {};
    window.portal_scraper_enabled = false;
    window.current_area_scraped = false;

    self.portalInScreen = function portalInScreen(p) {
        return map.getBounds().contains(p.getLatLng());
    };

    //  adapted from
    //+ Jonas Raoni Soares Silva
    //@ http://jsfromhell.com/math/is-point-in-poly [rev. #0]
    self.portalInPolygon = function portalInPolygon(polygon, portal) {
        var poly = polygon.getLatLngs();
        var pt = portal.getLatLng();
        var c = false;
        for (var i = -1, l = poly.length, j = l - 1; ++i < l; j = i) {
            ((poly[i].lat <= pt.lat && pt.lat < poly[j].lat) || (poly[j].lat <= pt.lat && pt.lat < poly[i].lat)) && (pt.lng < (poly[j].lng - poly[i].lng) * (pt.lat - poly[i].lat) / (poly[j].lat - poly[i].lat) + poly[i].lng) && (c = !c);
        }
        return c;
    };

    // return if the portal is within the drawtool objects.
    // Polygon and circles are available, and circles are implemented
    // as round polygons.
    self.portalInForm = function(layer) {
        if (layer instanceof L.Rectangle) {
            return true;
        }
        if (layer instanceof L.Circle) {
            return true;
        }
        return false;
    };

    self.portalInGeo = function(layer) {
        if (layer instanceof L.GeodesicPolygon) {
            return true;
        }
        if (layer instanceof L.GeodesicCircle) {
            return true;
        }
        return false;
    };

    self.portalInDrawnItems = function(portal) {
        var c = false;
        window.plugin.drawTools.drawnItems.eachLayer(function(layer) {
            if (!(self.portalInForm(layer) || self.portalInGeo(layer))) {
                return false;
            }
            if (self.portalInPolygon(layer, portal)) {
                c = true;
            }
        });
        return c;
    };

    self.inBounds = function(portal) {
        if (window.plugin.drawTools && window.plugin.drawTools.drawnItems.getLayers().length) {
            return self.portalInDrawnItems(portal);
        } else {
            return self.portalInScreen(portal);
        }
    };

    self.updateTotalScrapedCount = function() {
        $('#totalScrapedPortals').html(Object.keys(window.master_portal_list).length);
    };

    self.drawRectangle = function() {
        var bounds = window.map.getBounds();
        var boundsNew = [[bounds._southWest.lat, bounds._southWest.lng], [bounds._northEast.lat, bounds._northEast.lng]];
        L.rectangle(boundsNew, {color: "#00ff11", weight: 1, opacity: 0.9}).addTo(window.map);
    };

    self.managePortals = function managePortals(portal, portalGuid) {
        if (self.inBounds(portal)) {
            //create object
            var lat = portal._latlng.lat;
            var lng = portal._latlng.lng;
            var title = portal.options.data.title || "untitled portal";
            var image = portal.options.data.image || "";
            //add to portal list
            if (typeof window.master_portal_list[portalGuid] == 'undefined') {
                window.master_portal_list[portalGuid] = {guid: portalGuid, lat:lat, lng: lng, title: title, image: image};
                self.updateTotalScrapedCount()
            }
        }
    };

    self.checkPortals = function checkPortals(portals) {
        for (var portal in portals) {
            if (typeof window.portals[portal] !== "undefined") {
                self.managePortals(window.portals[portal], portal);
            }
        }
    };

    self.escapeXml = function(unsafe) {
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    self.downloadKML = function(file) {
        var kmlData = '';
        kmlData += '<?xml version="1.0" encoding="UTF-8"?>\r\n'
        kmlData += '<kml xmlns="http://www.opengis.net/kml/2.2">\r\n'
        kmlData += '  <Document>\r\n'
        kmlData += '    <name>Portals</name>\r\n'
        $.each(window.master_portal_list, function(key, value) {
            kmlData += '    <Placemark>\r\n'
            kmlData += '      <name>' + self.escapeXml(value.title) + '</name>\r\n'
            kmlData += '      <description><![CDATA[<img src="' + value.image + '" height="200" width="auto" />]]></description>\r\n'
            kmlData += '      <ExtendedData>\r\n'
            kmlData += '        <Data name="directions"><value>https://www.google.com/maps/dir//' + value.lat + ',' + value.lng + '></value></Data>\r\n'
            kmlData += '      </ExtendedData>\r\n'
            kmlData += '      <Point><coordinates>' + value.lng + ',' + value.lat + ',0</coordinates></Point>\r\n'
            kmlData += '    </Placemark>\r\n'
        });
        kmlData += '  </Document>\r\n'
        kmlData += '</kml>'
        var link = document.createElement("a");
        link.download = file;
        link.href = "data:text/xml," + kmlData;
        //link.href = "data:text/xml," + escape(kmlData);
        link.click();
    }

    self.downloadCSV = function(file) {
        var csvData = '"id","name","latitude","longitude","image"\r\n';
        $.each(window.master_portal_list, function(key, value) {
            csvData += '"' + value.guid + '","' + value.title + '","' + value.lat + '","' + value.lng + '","' + value.image + '"\r\n';
        });
        var link = document.createElement("a");
        link.download = file;
        link.href = "data:text/csv," + escape(csvData);
        link.click();
    }

    self.showDialog = function showDialog() {
        var dialogData = 'Name, Latitude, Longitude, Image\r\n';
        $.each(window.master_portal_list, function(key, value) {
            //not sure if these escapes are still needed here -zandarian
            //var str = value.title.replace(/\"/g,"\\\"").replace(";"," ") + ", " + value.lat + ", " + value.lng + ", " + value.image;
            var str = value.title + ", " + value.lat + ", " + value.lng + ", " + value.image;
            if (window.plugin.keys && (typeof window.portals[key] !== "undefined")) {
                var keyCount = window.plugin.keys.keys[key] || 0;
                str = str + ";" + keyCount;
            }
            dialogData += (str + "\r\n");
        });
        var data = `
        <form name='maxfield' action='#' method='post' target='_blank'>
            <div class="row">
                <div id='form_area' class="column" style="float:left;width:100%;box-sizing: border-box;padding-right: 5px;">
                    <textarea class='form_area' name='portal_list_area' rows='30' placeholder='Placeholder' style="width: 100%; white-space: nowrap;">${dialogData}</textarea>
                </div>
            </div>
        </form>
        `;
        var dialog = window.dialog({
            title: "Portal Data",
            html: data
        }).parent();
        $(".ui-dialog-buttonpane", dialog).remove();
        dialog.css("width", "600px").css("top", ($(window).height() - dialog.height()) / 2).css("left", ($(window).width() - dialog.width()) / 2);
        return dialog;
    };

    self.setZoomLevel = function() {
        window.map.setZoom(15);
        $('#currentZoomLevel').html('15');
        self.updateZoomStatus();
    };

    self.updateZoomStatus = function() {
        var zoomLevel = window.map.getZoom();
        $('#currentZoomLevel').html(window.map.getZoom());
        if (zoomLevel != 15) {
            window.current_area_scraped = false;
            $('#currentZoomLevel').css('color', 'red');
            if (window.portal_scraper_enabled) $('#scraperStatus').html('Invalid Zoom Level').css('color', 'yellow');
        }
        else $('#currentZoomLevel').css('color', 'green');
    };

    self.updateTimer = function() {
        self.updateZoomStatus();
        if (window.portal_scraper_enabled) {
            if (window.map.getZoom() == 15) {
                if ($('#innerstatus > span.map > span').html() === 'done') {
                    if (!window.current_area_scraped) {
                        self.checkPortals(window.portals);
                        window.current_area_scraped = true;
                        $('#scraperStatus').html('Running').css('color', 'green');
                        self.drawRectangle();
                    } else {
                        $('#scraperStatus').html('Area Scraped').css('color', 'green');
                    }
                } else {
                    window.current_area_scraped = false;
                    $('#scraperStatus').html('Waiting For Map Data').css('color', 'yellow');
                }
            }
        }
    };

    self.panMap = function() {
        window.map.getBounds();
        window.map.panTo({lat: 40.974379, lng: -85.624982});
    };

    self.toggleStatus = function() {
        if (window.portal_scraper_enabled) {
            window.portal_scraper_enabled = false;
            $('#scraperStatus').html('Stopped').css('color', 'red');
            $('#startScraper').show();
            $('#stopScraper').hide();
            $('#dataControlsBox').hide();
            $('#totalPortals').hide();
        } else {
            window.portal_scraper_enabled = true;
            $('#scraperStatus').html('Running').css('color', 'green');
            $('#startScraper').hide();
            $('#stopScraper').show();
            $('#dataControlsBox').show();
            $('#totalPortals').show();
            self.updateTotalScrapedCount();
        }

    };

    // setup function called by IITC
    self.setup = function init() {
        // add controls to toolbox
        var link = $("");
        $("#toolbox").append(link);
        var dataToolbox = `
        <div id="dataToolbox" style="position: relative;">
            <p style="margin: 5px 0 5px 0; text-align: center; font-weight: bold;">Portal Exporter</p>
            <a id="startScraper" style="position: absolute; top: 0; left: 0; margin: 0 5px 0 5px;" onclick="window.plugin.portal_export.toggleStatus();" title="Start the portal data scraper">Start</a>
            <a id="stopScraper" style="position: absolute; top: 0; left: 0; display: none; margin: 0 5px 0 5px;" onclick="window.plugin.portal_export.toggleStatus();" title="Stop the portal data scraper">Stop</a>

            <div class="zoomControlsBox" style="margin-top: 5px; padding: 5px 0 5px 5px;">
                Current Zoom Level: <span id="currentZoomLevel">0</span>
                <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_export.setZoomLevel();" title="Set zoom level to enable portal data download.">Set Zoom Level</a>
            </div>

            <p style="margin:0 0 0 5px;">Scraper Status: <span style="color: red;" id="scraperStatus">Stopped</span></p>
            <p id="totalPortals" style="display: none; margin:0 0 0 5px;">Total Portals Scraped: <span id="totalScrapedPortals">0</span></p>

            <div id="dataControlsBox" style="display: none; margin-top: 5px; padding: 5px 0 5px 5px; border-top: 1px solid #20A8B1;">
                <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_export.showDialog();" title="View Portal Data">View Data</a>
                <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_export.downloadCSV('iitc-portals.csv');" title="Download iitc-portals.csv">Get CSV</a>
                <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_export.downloadKML('iitc-portals.kml');" title="Download iitc-portals.kml">Get KML</a>
                <a style="margin: 0 5px 0 5px;" onclick="window.plugin.portal_export.downloadKML('iitc-portals.xml');" title="Download iitc-portals.xml">Get XML</a>
            </div>
        </div>
        `;
        $(dataToolbox).insertAfter('#toolbox');
        // run
        window.csvUpdateTimer = window.setInterval(self.updateTimer, 500);

        // delete self to ensure init can't be run again
        delete self.init;
    };
    // IITC plugin setup
    if (window.iitcLoaded && typeof self.setup === "function") {
        self.setup();
    } else if (window.bootPlugins) {
        window.bootPlugins.push(self.setup);
    } else {
        window.bootPlugins = [self.setup];
    }
}
// inject plugin into page
var script = document.createElement("script");
script.appendChild(document.createTextNode("(" + wrapper + ")();"));
(document.body || document.head || document.documentElement)
.appendChild(script);
