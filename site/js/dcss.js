// Convert RSS feed into news list
// http://www.davidjuth.com/rest-demo-jquery-rss.aspx
function updateFeed(data) {
    $('#newsContainer').append("<ul>");
    $(data).find('item').slice(0, 4).each(function() {
        var $item = $(this);
        var title = $item.find('title').text();
        var link = $item.find('link').text();

        var html = "<a href=\"" + link + "\"><li>" + title + "</a></li>";

        $('#newsContainer').append(html);
    });
    $('#newsContainer').append("</ul>");
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
function addImageUrls(games) {
  // Can we not hardcode these numbers?
  // Note: image numbers are zero-indexed
  // Number of branch-specific images available ('splashimgs/dcss-splash-$branch-$num.png')
  available_images = { 'Dungeon': 3, 'Shoals': 4, 'Snake Pit': 2, 'Swamp': 3, 'Vaults': 4, };
  // Number of generic fallback images available ('splashimgs/dcss-splash-$num.png')
  fallback_images = 11;
  // Count the number of games per branch
  per_branch_games = {}
  games.forEach(function(game, index) {
    if (per_branch_games[game['branch']] === undefined) {
      per_branch_games[game['branch']] = 1;
    } else {
      per_branch_games[game['branch']]++;
    }
  });

  // Add branch-specific images
  missing_images = 0
  Object.keys(per_branch_games).forEach(function(current_branch, index) {
    console.log(`current_branch: ${current_branch}`);
    // How many images do we have for this branch?
    max_images = available_images[current_branch];
    if (max_images === undefined) { max_images = 0; }
    // How many images do we need?
    images_needed = per_branch_games[current_branch];
    // Add as many branch-specific images as we can
    images = []
    for (var i = 0; i < Math.min(max_images, images_needed); i++) {
      images.push(`splashimgs/dcss-splash-${current_branch}-${i}.png`);
    }
    images = shuffleArray(images);
    games.forEach(function(game, index) {
      if (images.length === 0) { return; }
      if (game['branch'] !== current_branch) { return; }
      console.log(`Adding image for ${game['username']} in ${game['branch']}`);
      game['image_url'] = images.pop();
    });
    if (images_needed > max_images) {
      missing_images += (images_needed - max_images);
    }
  });

  // Now add the fallback images
  images = []
  for (var i = 0; i < fallback_images; i++) {
    images.push(`splashimgs/dcss-splash-${i}.png`);
  }
  images = getRandomSubarray(images, missing_images);
  images = shuffleArray(images);
  games.forEach(function(game, index) {
    if (images.length === 0) { return; }
    if (game['image_url']) { return; }
    console.log(`Adding fallback image for ${game['username']} in ${game['branch']}`);
    game['image_url'] = images.pop();
  });

  // Convert per_branch_games back to flat array
  return games;
}
function setPlayerCaptions(data) {
        n = 6; // number of games. Is there a nicer way to hardcode this?
        // Generate the spectator candidates
        // Preconditions:
        // We only want candidates with full info (some entries lack xl/race/background/location, so test for xl)
        // Check they have a species -- player might be on start screen
        // And we need a watch url
        candidates = data.filter(function(game) { return "xl" in game && "species" in game && "watchlink" in game});
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
        selected_candidates = addImageUrls(selected_candidates);

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
                    $("<a/>").attr('href', c["watchlink"]).append(
                        $("<img/>").attr('src', c['image_url']).css('object-fit', 'relative').css('object-position', 'center')//.css('height', '100px')
                        )
                )
            );
            // description
            // Figure out the player's name line
            // Ideal: "Foo the Axe Maniac"
            if (c["title"]) {
              player_title = c["username"] + " the " + c["title"];
            // Fallback (if the player is on character select screen): "Foo"
            } else {
              player_title = c["username"];
            }
            e.append(
                $("<p/>").addClass("lead").css('margin', '0').append(
                    $("<a/>").attr('href', c["watchlink"]).text(player_title)
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
    // This function is given a game and returns an interesting string about it.
    candidates = [];
    if ('milestone' in game) {
      m = game['milestone'];
      // Strip trailing period (not all milestones have this)
      if (m.slice(-1) === '.') { m = m.slice(0, -1); }
      // Normally we use "Just $milestone", but if the milestone starts with "was", use "Was just $milestone_without_was"
      if (m.startsWith('was ')) {
        m = 'Was just ' + m.slice(4);
      } else {
        m = "Just " + m;
      }
      candidates.push(m);
    }
    if ('xl' in game && 'species' in game && 'background' in game) {
      candidates.push("Level " + game["xl"] + " " + game["species"] + " " + game["background"] + ("god" in game ? " of " + game["god"] : ""));
    }
    if ('place_human_readable' in game) {
      // location field needs the first letter capitalised
      candidates.push(game["place_human_readable"].charAt(0).toUpperCase() + game["place_human_readable"].slice(1));
    }
    // If we couldn't find a candidate, return nothing
    if (candidates.length === 0) { return ''; }
    // Return a random string from the ones available
    return candidates[Math.floor(Math.random()*candidates.length)];
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
        tr.append($("<td/>").append($("<a/>").text("Watch now.").attr('href', e['watchlink'])));
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
        $.get("https://api.crawl.project357.org/live/games").done(setPlayerCaptions);
        $.get("//crawl.develz.org/wordpress/feed").done(updateFeed);
    }
    // play.html
    if ($( "#play-status" ).length) {
        if (navigator.userAgent.match(/Android/i))
        {
            $( "#play-status" ).replaceWith('<div class="alert alert-warning alert-dismissible fade in" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">x</span></button><center><strong>Android Users!</strong><br>Playing DCSS online directly in the Web browser of your Android device doesn\'t work. We recommend Brian Newtz\'s DCSS Online WebTiles app.<br><a href="https://play.google.com/store/apps/details?id=com.newtzgames.dcssonline"><img alt="Get it on Google Play" src="https://developer.android.com/images/brand/en_generic_rgb_wo_45.png" /></a></center></div>');
        } else if (navigator.userAgent.match(/(iPad|iPhone|iPod)/)) {
            $( "#play-status" ).replaceWith('<div class="alert alert-warning alert-dismissible fade in" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">x</span></button><center><strong>iOS Users!</strong><br>Playing DCSS online directly in the Web browser of your Apple devices doesn\'t work. Sorry!</center></div>');
        } else {
            $.get( "servers.json" ).done(handleServerList).fail(failServerList);
        }
    }
    // watch.html
    if ($( "#livegames" ).length) {
        $.get('dgl-status.json').done(fillPlayerTable).fail(networkError);
    }
});
