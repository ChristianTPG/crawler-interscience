var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var jsonfile = require('jsonfile');

var START_URL = "http://www.interscience.com/es/productos/";
var BASE_URL = "http://www.interscience.com/";

var pagesVisited = [];
var pagesToVisit = [];
var productos = [];
var numPagesVisited = 0;
var numProductCrawled = 0;
var url = new URL(START_URL);
var file = __dirname + '/data.json'

pagesToVisit.push(START_URL);
crawl();

function crawl() {
    if (pagesToVisit.length == 0) {
        // Write results into file and exit
        jsonfile.writeFileSync(file, productos);
        return;
    }

    var nextPage = pagesToVisit.pop();
    if (pagesVisited.indexOf(nextPage) != -1)
        crawl(); // We have already visited this page, so repeat the crawl
    else
        visitPage(nextPage, crawl);
}

function visitPage(url, callback) {
    // Add page to our set
    pagesVisited.push(url);
    numPagesVisited++;

    // Make the request
    console.log("Visiting page " + url);
    request(url, function(error, response, body) {

        if (response.statusCode !== 200) {
            callback();
            return;
        }

        // Parse the document body
        var $ = cheerio.load(body);
        if (searchForProducts($).length == 0) { // if its a product save it
            numProductCrawled++;

            var product = scrapeProduct($, url);

            // Scrape classification
            var hierarchy = $('div#hierarchie').find("a[href^='es/productos']");
            addProduct($, product, hierarchy, productos);

        } else // if its a collection of products then get all products links
            collectInternalLinks($);

        // In this short program, our callback is just calling crawl()
        callback();
    })
}

function getTab($, tabName) {
    var index = $("h2.tab").map(function() {
        return $(this).text().toLowerCase();
    }).get().indexOf(tabName);

    if (index > -1) // Search for tab with the index
        return $("div.tab-page").eq(index);
}

function scrapeProduct($, url) {
    var name = $("h1.entry-title").text().trim().replace("®", "");
    var description = $("div.chapo").html().replace(/(\r\n|\n|\r)/gm, "").trim();

    var tab = getTab($, "ventajas");
    var caracteristicas = tab ? tab.html().replace(/(\r\n|\n|\r)/gm, "").trim() : "";

    tab = getTab($, "rasgos claves");
    var rasgos_claves = tab ? tab.html().replace(/(\r\n|\n|\r)/gm, "").trim() : "";

    tab = getTab($, "especificaciones técnicas");
    var especificaciones = tab ? tab.html().replace(/(\r\n|\n|\r)/gm, "").trim() : "";

    var codigo = $("h4.soustitre").text();
    var index_codigo = codigo.indexOf("Ref. ") + 5;
    codigo = codigo.indexOf('(') == -1 ? codigo.substring(index_codigo, codigo.length).trim() : "";

    return {
        id: numProductCrawled,
        name: name,
        url: url,
        imgs: [],
        descripcion: description,
        caracteristicas: caracteristicas == "" ? rasgos_claves : caracteristicas,
        especificaciones: especificaciones,
        codigo: codigo
    }
}

function buildClassification(product, hierarchy) {

    var parentName = hierarchy.last().text(); // get clasification of product
    hierarchy.splice(hierarchy.length - 1, 1);

    var parent = {
        name: parentName,
        img: [],
        sub: [product]
    };

    if (hierarchy.length > 0)
        return buildClassification(parent, hierarchy);
    else
        return parent;
}

function addProduct($, product, hierarchy, pProductos) {

    if (hierarchy.length == 0) { // No more parents found
        pProductos.push(product); // Add product with its hierarchy
        return;
    }

    var parentName = hierarchy.first().text(); // get clasification of product
    var parent = pProductos.filter(function(producto) {
        return producto.name == parentName;
    });

    if (parent.length > 0) {
        hierarchy.splice(0, 1); // Found Parent, keep cycling
        addProduct($, product, hierarchy, parent[0].sub);
    } else {
        var newClassification = buildClassification(product, hierarchy); // Build parent hierarchy
        addProduct($, newClassification, hierarchy, pProductos); // Add hierarchy
    }
}

function searchForProducts($) {
    var bodyText = $('html > body').text();
    return $("div.articles");
}

function collectInternalLinks($) {
    var allRelativeLinks = [];

    var relativeLinks = $("a[href^='es/productos']");
    relativeLinks.each(function() {
        var href = BASE_URL + $(this).attr('href');
        if (pagesToVisit.indexOf(href) == -1 && pagesVisited.indexOf(href) == -1)
            pagesToVisit.push(href);
    });
}
