// Convert RSS feed into news list
// http://www.davidjuth.com/rest-demo-jquery-rss.aspx
function updateFeed(data) {
    $(data).find('item').slice(0, 4).each(function() {
        var $item = $(this);
        var title = $item.find('title').text();
        var link = $item.find('link').text();

        var html = "<li><a href=\"" + link + "\">" + title + "</a></li>";

        $('#newsList').append(html);
    });
}
// Replacement for underscore's _.sample helper
// usage: getRandomSubarray(x, 5);
// http://stackoverflow.com/questions/11935175/sampling-a-random-subset-from-an-array
function getRandomSubarray(arr, size) {
    var shuffled = arr.slice(0), i = arr.length, temp, index;
    while (i--) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    return shuffled.slice(0, size);
}
// Replacement for underscore's _.shuffle helper
// usage: shuffleArray(x);
// http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
function shuffleArray(o){ //v1.0
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};
function setPlayerCaptions(data) {
        n = 6; // is there a nicer way to hardcode this?
        numimgs = 11; // the number of images in splashimgs/ -- remember the images are 0-indexed!
        // Generate the image candidates
        image_candidates = [];
        for (var i=0; i < numimgs; i++) {
            image_candidates.push('splashimgs/dcss-splash-' + i + '.png');
        }
        // Generate the spectator candidates
        // Preconditions:
        // We only want candidates with full info (some entries lack xl/race/background/location, so test for xl)
        // Check they have a species -- player might be on start screen
        // And we need a watch url
        candidates = data.filter(function(element) { return "XL" in element && element["species"] != '' && "watchurl" in element});
        // There are a two competing goals with the candidate selection:
        // * random each refresh
        // * picks the best candidates
        // To balance this, partition the candidate list into good, ok & bad groups, and select from each in turn as required
        // Good: has spectators
        // OK: idle < 5 secs
        // Bad: everything else
        good_candidates = []
        ok_candidates = []
        bad_candidates = []
        for (var i = 0; i < candidates.length; i++) {
            c = candidates[i];
            if (c['viewers'] > 0) {
                good_candidates.push(c);
            } else if (c['idle'] < 5) {
                ok_candidates.push(c);
            } else {
                bad_candidates.push(c);
            }
        }
        selected_candidates = getRandomSubarray(good_candidates, n);
        if (selected_candidates.length < n) {
            n = n - selected_candidates.length;
            selected_candidates = selected_candidates.concat(getRandomSubarray(ok_candidates, n));
            if (selected_candidates.length < n) {
                n = n - selected_candidates.length;
                selected_candidates = selected_candidates.concat(getRandomSubarray(bad_candidates, n));
             }
        }
        // Note that we might not have enough candidates at this point
        if (selected_candidates.length <  $( "#live-games-tiles div" ).length) {
            console.log("Warning: only found " + selected_candidates.length + " candidates.");
        }
        selected_candidates = shuffleArray(selected_candidates);
        selected_image_candidates = shuffleArray(getRandomSubarray(image_candidates, selected_candidates.length));

        // Create & write our tiles
        $( "#live-games-tiles" ).empty();
        for (var i = 0; i < selected_candidates.length; i++) {
            c = selected_candidates[i];
            e = $( "<div>" );
            e.addClass("col-md-4 col-sm-6 text-center");
            if (i >= 2) {
                e.addClass("hidden-xs");
            }
            if (i >= 4) {
                e.addClass("hidden-sm");
            }

            e.css("border-radius", "5px");
            // image
            e.append(
                $("<div/>").css('text-align', 'center').css('overflow', 'hidden').css('height', '150px').append(
                    $("<a/>").attr('href', c["watchurl"]).append(
                        $("<img/>").attr('src', selected_image_candidates.pop()).css('object-fit', 'relative').css('object-position', 'center')//.css('height', '100px')
                        )
                )
            );
            // description
            e.append(
                $("<p/>").addClass("lead").css('margin', '0').append(
                    $("<a/>").attr('href', c["watchurl"]).text(c["name"] + " the " + c["latest_milestone"]["title"])
                )
            );
            e.append($("<p/>").append($("<em/>").text(getFlavourLine(c))));

            $( "#live-games-tiles" ).append(e);

            // Add in clearfix classes if required
            if (i > 0 && i != selected_candidates.length) {
                if ((i+1) % 2 == 0) {
                    $( "#live-games-tiles" ).append($("<div/>").addClass("clearfix visible-sm"));
                }
                if ((i+1) % 3 == 0) {
                    $( "#live-games-tiles" ).append($("<div/>").addClass("clearfix visible-md visible-lg"));
                }
            }

        }

        $( "#live-games-link" ).text("See all " + data.length + " online games...");
}
function getFlavourLine(game) {
    // This function is given a dgl-status game and returns an interesting string about it.
    // We do this by generating every line and returning a random one.
    // This is sort of inefficient -- is there a smarter way?
    m = game["latest_milestone"];
    candidates = [];
    if (m['zigdeepest'] > 0) {
        candidates.push("Reached level " + m['zigdeepest'] + " of a Ziggurat");
    }
    if (m['zigscompleted'] > 0) {
        candidates.push("Completed " + m['zigscompleted'] + " Ziggurats");
    }
    if ((m['mhp'] * 2) <  m['hp']) {
        candidates.push("HP: " + m['hp'] + '/' + m['mhp'] + ' MP: ' + m['mp'] + '/' + m['mmp']);
    }
    if (m['status'].split(",").length > 2) {
        status = m['status'].split(",").join(", ")
        candidates.push(status.charAt(0).toUpperCase() + status.slice(1));
    }
    if (m['nrune'] > 1) {
        candidates.push("Collected " + m['nrune'] + " runes");
    }
    if (m['banisher']) {
        candidates.push("Banished to the Abyss by " + m['banisher']);
    }
    if (candidates.length < 1 || Math.random() < 0.33) {
        candidates.push("Just " + m['milestone'].slice(0, -1));
        candidates.push("Level " + game["XL"] + " " + game["species"] + " " + game["background"] + (m["god"] ? " of " + m["god"] : ""));
        // location field needs the first letter capitalised
        candidates.push(game["location"].charAt(0).toUpperCase() + game["location"].slice(1));
        if (m['sk']) {
            candidates.push("Highest skill: " + m['sk']);
        }
    }
    return getRandomSubarray(candidates, 1);
}

function handleServerList(servers) {
    $( "#play-list" ).empty();
    var arrayLength = servers.length;
    for (var i = 0; i < arrayLength; i++) {
        $( "#play-list" ).append("<li>" + servers[i]['location'] + ": " + "<a href=\"" + servers[i]['url'] + "\">" + servers[i]['name'] + "</a>" + "</li>");
    }
    navigator.geolocation.getCurrentPosition(knownPosition, unknownPosition);
}
function failServerList() {
    $( "#play-list" ).empty();
    $( "#play-list-message" ).html("<li>Couldn't get server list :(</li>");
}
function knownPosition(position) {
    $.getJSON( "servers.json" ).done( function (servers) {
        server = NearestPoint( position.coords.latitude, position.coords.longitude, servers );
        $( "#play-status" ).text("Playing on " + server["name"] + " located in " + server["location"] + "...");
        setTimeout( function() {
            window.location = server["url"];
        }, 2000);
    });
}
function unknownPosition(error) {
    $( "#play-status" ).text("Can't get your location :(");
    $( "#play-list-message" ).text("Select a server manually:");
}

// Adapted from
// http://stackoverflow.com/questions/21279559/geolocation-closest-locationlat-long-from-my-position
// Convert Degress to Radians
function Deg2Rad( deg ) {
    return deg * Math.PI / 180;
}

function PythagorasEquirectangular( lat1, lon1, lat2, lon2 ) {
    lat1 = Deg2Rad(lat1);
    lat2 = Deg2Rad(lat2);
    lon1 = Deg2Rad(lon1);
    lon2 = Deg2Rad(lon2);
    var R = 6371; // km
    var x = (lon2-lon1) * Math.cos((lat1+lat2)/2);
    var y = (lat2-lat1);
    var d = Math.sqrt(x*x + y*y) * R;
    return d;
}

function NearestPoint( latitude, longitude, points )
{
    var mindif=99999;
    var closest;

    for (index = 0; index < points.length; ++index) {
        var dif =  PythagorasEquirectangular( latitude, longitude, points[ index ][ "latlongdecimal" ][0], points[ index ][ "latlongdecimal" ][1] );
        if ( dif < mindif )
        {
            closest=index;
            mindif = dif;
        }
    }

    return points[closest];
}

function fillPlayerTable(games) {
    $( "#livegames tbody" ).empty();
    for (var i = 0; i < games.length; i++) {
        e = games[i];
        tr = $( "<tr/>" );
        tr.append($("<td/>").text(e['name']));
        tr.append($("<td/>").text(e['version']));
        tr.append($("<td/>").text(e['XL']));
        tr.append($("<td/>").text(e['species']));
        tr.append($("<td/>").text(e['background']));
        if (e['branch']) {
            if (e['branchlevel'] != 0) {
                tr.append($("<td/>").text(e['branch'] + ":" + e['branchlevel']));
            } else {
                tr.append($("<td/>").text(e['branch']));
            }
        } else {
            tr.append($("<td/>"));
        }
        if (e['idle'] >= 300) {
             tr.append($("<td/>").text("Over 5 minutes").attr('data-value', e['idle']));
        } else if (e['idle'] >= 60) {
             tr.append($("<td/>").text(Math.round(e['idle'] / 60) + " minutes").attr('data-value', e['idle']));
        } else {
             tr.append($("<td/>").text(e['idle'] + " seconds").attr('data-value', e['idle']));
        }
        tr.append($("<td/>").text(e['viewers']));
        tr.append($("<td/>").append($("<a/>").text("Watch now.").attr('href', e['watchurl'])));
        $( "#livegames tbody" ).append(tr);
    }
    $.bootstrapSortable();

}
function networkError(error) {
    $( "#livegames tbody" ).empty();
    tr = $( "<tr/>" );
    tr.append($("<td/>").text("Network error, try again :("));
    $( "#livegames tbody" ).append(tr);
}

/////// Per-page entry logic goes here
$(function() {
    // index.html
    if ($( "#live-games-tiles" ).length) {
        $.get("dgl-status.json").done(setPlayerCaptions);
        $.get("//crawl.develz.org/wordpress/feed").done(updateFeed);
    }
    // play.html
    if ($( "#play-status" ).length) {
        $.get( "servers.json" ).done(handleServerList).fail(failServerList);
    }
    // watch.html
    if ($( "#livegames" ).length) {
        $.get('dgl-status.json').done(fillPlayerTable).fail(networkError);
    }
});
