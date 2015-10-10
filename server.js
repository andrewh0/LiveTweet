var debugging = true;

//--------------
// DEPENDENCIES
//--------------

// Use Handlebars for templating
var hbs = require('hbs');

// Use body-parser for reading user (browser) input
var bodyParser = require('body-parser');

// Use express for routing
var express = require('express');
var app = express();
var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Listening at http://%s:%s', host, port);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'html');
app.engine('html', require('hbs').__express);
app.use(express.static('public'));

// Use Twit to request Tweets: https://github.com/ttezel/twit
var Twit = require('twit');
var config = {
	consumer_key:         'CONSUMER_KEY',
	consumer_secret:      'CONSUMER_SECRET',
	app_only_auth:        true
};

//--------
// ROUTES
//--------

// Render index.html (home page)
app.get('/', function(req, res) {
  res.render('index');
  return;
});

app.post('/tweets', function(req, res) {

  // Prevent timeouts for more popular shows (default is ~2min)
  res.setTimeout(0);
  var showName = req.body.showName;
  var hashtag = req.body.hashtag;
  var airdateStr = '';

  // Switch order from MM-DD-YYYY to YYYY-MM-DD for convenience
  if (req.body.airdate) {
    var MmDdYyyyArr = req.body.airdate.split('-');
    airdateStr = [MmDdYyyyArr[2], MmDdYyyyArr[0], MmDdYyyyArr[1]].join('-');
  }

  // Start search for Tweets based on user input
  findTweetsForShow(showName, hashtag, airdateStr, req, res);
  return;
});

//--------------------
// UTILITY FUNCTIONS
//--------------------
// Re-implement each, map, filter, reduce for practice
// Execute callback on each item in collection
function each(collection, callback) {
	if (Array.isArray(collection)) {
		for (var i = 0; i<collection.length; i++) {
			callback(collection[i]);
		}
	} else {
		for (var j in collection) {
			callback(collection[j]);
		}
	}
}

// Map callback to each item in collection and return in an array
function map(collection, callback) {
	var arr = [];
	each(collection, function (x) {
		arr.push(callback(x));
	});
	return arr;
}

// Filter items in collection based on callback and return in an array
function filter(collection, callback) {
	var arr = [];
	each(collection, function (x) {
		if (callback(x)) {
			arr.push(x);
		}
	});
	return arr;
}

// Combine items in collection based on callback starting with initial and return result
function reduce(collection, initial, callback) {
	var curr = initial;
	each(collection, function(item) {
		curr = callback(curr, item);
	});
	return curr;
}

// Add a unit of time to a Date
// Measure can be 'year','month','day', 'hour', 'min', 'sec', 'ms'
// Add offset to go from UTC to local
function addTime(date, amt, measure) {
	var d = new Date(date);
	switch (measure) {
		case 'year':
			d.setFullYear(d.getFullYear()+amt);
			break;
		case 'month':
			d.setMonth(d.getMonth()+amt);
			break;
		case 'day':
			d.setDate(d.getDate()+amt);
			break;
		case 'hour':
			d.setTime(d.getTime()+amt*60*60*1000);
			break;
		case 'min':
			d.setTime(d.getTime()+amt*60*1000);
			break;
		case 'sec':
			d.setTime(d.getTime()+amt*1000);
			break;
		case 'ms':
			d.setTime(d.getTime()+amt);
			break;
		default:
			console.log('not a valid time measure');
			break;
	}
	return d;
}

// Checks if n is between start and end, inclusive
function isBtwTimes(n, start, end) {
	return (n >= start) && (n <= end);
}

// Takes an ID string and array of Tweet objects
// and returns the matching Tweet object
function getTweetbyID(IDstr, tweets) {
  var matchingTweets = filter(tweets, function(tweet) {
    if (tweet.tweetIdNum == IDstr) {
      return tweet;
    }
  });
  if (matchingTweets.length > 1) {
    if (debugging) {
      console.log('Check this: there should only be one ID per Tweet.');
      console.log(matchingTweets);
    }
    return matchingTweets[0];
  } else if (matchingTweets.length === 0) {
    if (debugging) {
      console.log('No Tweets matched ID: '+IDstr);
    }
    return false;
  } else {
    return matchingTweets[0];
  }
}

//----------------
// APP FUNCTIONS
//----------------

// With raw JSON data, return an object with only useful TV show data
function extractShowInfo(data) {
	return {
		title: data.title,
		airday: data.airs.day,
		airtime: data.airs.time,
		timezone: data.airs.timezone,
		runtime: data.runtime,
    overview: data.overview
	};
}

function findTweetsForShow(showTitle, hashtag, episodeDate, req, res) {
  var encodedTitle = encodeURI(showTitle);

  // Search for show name on Trakt.tv and return the show slug of the first result
  requestTVInfo('search?query='+encodedTitle+'&type=show', function(err, response, data) {

    if (err) {
      if (debugging) {
        console.log(err);
      }
      res.json([{error: err}]);
      return;
    }

    if (!data) {
      if (debugging) {
        console.log('No data returned.');
      }
      res.json([{message: 'No data returned when searching for show.'}]);
      return;
    }

    var searchResults = JSON.parse(data);

    // If no shows are found, send a message to the client
    if (searchResults.length === 0) {
      if (debugging) {
        console.log('No shows were found with that title.');
      }
      res.json([{message: 'No shows were found with that title.'}]);
      return;
    } else {

      // Call Trakt.TV API again and return detailed info using the show slug
      var showSlug = searchResults[0].show.ids.slug;
      requestTVInfo('shows/'+showSlug+'?extended=full', function(err, response, data) {
        if (err) {

          // Error when getting TV show data
          if (debugging) {
            console.log(err);
          }
          res.json([{error: err}]);
          return;
        }
        if (!data) {
          res.json([{message: 'No data returned when searching shows/'+showSlug+'?extended=full.'}]);
          return;
        }
        var showDataFormatted = extractShowInfo(JSON.parse(data));

        // If there's no airdate, calculate one based on day of the week the show airs
        var airdate;
        if (episodeDate === '') {
          if (!showDataFormatted.airday) {
            res.json([{message: 'No information on when the show airs.'}]);
            return;
          } else {
            if (debugging) {
              console.log('No airdate specified. Finding last airdate.');
            }
            airdate = calcLastDate(showDataFormatted.airday);
          }
        } else {
          var dateArray = episodeDate.split('-');
          var year = parseInt(dateArray[0]);
          var month = parseInt(dateArray[1])-1; // months are zero-indexed
          var day = parseInt(dateArray[2]);
          airdate = new Date(Date.UTC(year, month, day));
        }
        var tweetQuery = formatTwitterQuery(airdate, hashtag);

        // Search Twitter with given show data
        queryTwitter(tweetQuery, airdate, showDataFormatted, req, res);
      });
    }
  });
}

// Returns the query string required for Twitter API request given date and hashtag
// Example query string: '#ModernFamily since:2015-08-11 until:2015-08-13
function formatTwitterQuery(date, hashtag) {
  if (hashtag[0] != '#') {
    hashtag = '#'+hashtag;
  }
	var since = date;

  // Add two days to account for timezone differences
	var until = addTime(date, 2, 'day');

	// Grab dates around airdate to account for timezone offsets
	return hashtag+' since:' + toYMDStr(since) +' until:' + toYMDStr(until);
}

// Converts a Date object to YYYY-MM-DD format in UTC
function toYMDStr(date) {
	var year = date.getUTCFullYear();
	var month = date.getUTCMonth()+1;
	var UTCdate = date.getUTCDate();
	if (month < 10) { month = '0'+month; }
	if (UTCdate < 10) { UTCdate = '0'+ UTCdate; }
	return year+'-'+month+'-'+UTCdate;
}

// Grabs TV information from Trakt.tv API
function requestTVInfo(requestStr, callback) {
	var APIBaseUrl = 'https://api-v2launch.trakt.tv/';
	var APIKey = '8ab90e731cf0931e9271da7d039bef38573d38b25f0e47c78eae22f3c98f3c52';
	var request = require('request');
	request({
	method: 'GET',
	url: APIBaseUrl+requestStr,
	headers: {
	    'Content-Type': 'application/json',
	    'trakt-api-version': '2',
	    'trakt-api-key': APIKey,
	}}, function (err, response, data) {
	  	callback(err, response, data);
	});
}

// Extract info, filter, request tweets, repeat until start time is reached/no Tweets
function queryTwitter(query, queryStartDate, showDataFormatted, req, res) {
	queryTwitterHelper(query, queryStartDate, [], [], showDataFormatted, req, res);
}

// Get all Tweets starting at startdate, and keep track of Tweets received
function queryTwitterHelper(query, queryStartDate, curr, tweetsFormatted, showDataFormatted, req, res) {
	if (debugging) {
		if (curr.length > 0) { console.log('Last date queried: ', curr[curr.length-1].createdAt); }
		console.log('Query start date:', queryStartDate.toISOString());
    // console.log('Start date in local time:', queryStartDate,'\n');
    console.log('Tweets formatted length is', tweetsFormatted.length, '\n');
	}

	// Base case: stop querying if we've queried too far in the past or if we've reached the end
	if ((tweetsFormatted.length > 0 && tweetsFormatted.length < 100) ||
  (curr.length > 0 && (new Date(curr[curr.length-1].createdAt) < queryStartDate))) {

		// Process all data received, and add back a day to offset query
		curr = processTweets(curr, showDataFormatted, queryStartDate);
    if (curr) {

      // Pass on show information as well
      res.json([showDataFormatted,curr]);
      return;
    } else {
      res.json([{message: 'No tweets to display after processing.'}]);
      return;
    }
	} else {

	// Recursive case: paginate through Twitter search results, extracting info and keeping track of what has been received
		var T = new Twit(config);
		T.get('search/tweets', { q: query, lang: 'en', count: 100 }, function (e,d,r) {
      if (e) {
        if (debugging) {
          each(d.errors, function(err) {
            console.log('Error: ', err.message);
          });
        }

        // Pass on error message to client
        res.json([{error: e}]);
        return;
      }
      if (d.statuses.length === 0 || !d) {
        res.json([{message: 'There were no tweets found.'}]);
        return;
      }

			// Extract only meaningful data from Twitter API
			tweetsFormatted = map(d.statuses, function (status) {
				return extractTweetInfo(status);
			});

			// Save data and request next page
      if (curr === '') {
        curr = curr.concat(tweetsFormatted);
      } else {

        // Remove the first element (duplicate) if it's not the first page returned
        curr = curr.concat(tweetsFormatted.slice(1));
      }

			var maxID = tweetsFormatted[tweetsFormatted.length-1].tweetIdNum;
			if (debugging) {console.log(query);}

      // Remove max_id: portion of the query before searching again
			if (query.indexOf(' max_id:')>0) {
				query = query.slice(0,query.indexOf(' max_id:'));
			}
			queryTwitterHelper(query+' max_id:'+maxID, queryStartDate, curr, tweetsFormatted, showDataFormatted, req, res);
		});
	}
}

// With raw JSON data, return an object with only useful Tweet info
function extractTweetInfo(status) {
	var tweet = {
		'createdAt' : status.created_at,
		'tweetIdNum' : status.id_str,
		'text' : status.text,
		'userIdNum' : status.user.id,
		'handle' : status.user.screen_name,
		'name' : status.user.name,
		'utcOffset' : (status.user.utc_offset || 0),
		'userAvatarURL' : status.user.profile_image_url, //_https?
		'tweetURL' : 'http://www.twitter.com/'+status.screen_name+'/status/'+status.id_str,
	};
	return tweet;
}

// Given show data, start date, and list of Tweet objects,
// remove tweets not tweeted during the show, remove retweets, and add local time to tweet object
function processTweets(tweets, showData, showStartDate) {
  var tweetsDuringShow = filterTweetsDuringShow(tweets, showData, showStartDate);
  var noRetweets = filterOutRetweets(tweetsDuringShow);

  // optionally filter to only Eastern Daylight time Tweets.
  // var timezoneFiltered = filterByTimezone(noRetweets, '-14400');
  // return addLocalTimeInfo(timezoneFiltered, showData, showStartDate);

  return addLocalTimeInfo(noRetweets, showData, showStartDate);
}

// Filter by Tweets made during local airtime + runtime
function filterTweetsDuringShow(tweets, showData, showStartDate) {
	var tweetsFiltered = filter(tweets, function(tweet) {
		var startTime = calcUTCAirTime(showStartDate, showData.airtime, tweet.utcOffset);

    // Add 30 minutes to the episode runtime to account for inconsistent TV data (from API),
    // reactions after the episode is over, and commercials
		var endTime = addTime(startTime, (showData.runtime + 30), 'min');
		if (isBtwTimes(new Date(tweet.createdAt), startTime, endTime)) {
			return tweet;
		}
	});
  return tweetsFiltered;
}

// Add localCreateDate to Tweet object
function addLocalTimeInfo(tweets, showData, showStartDate) {
  var tweetsMapped = map(tweets, function(tweet) {
    var startTime = calcUTCAirTime(showStartDate, showData.airtime, tweet.utcOffset);
    tweet.localStartTime = addTime(startTime, tweet.utcOffset, 'sec');
    tweet.localCreateDate = addTime(new Date(tweet.createdAt), tweet.utcOffset, 'sec');
    return tweet;
  });
  return tweetsMapped;
}

// Retweets always start with 'RT @'
// Filter out any Tweets starting with that string
function filterOutRetweets(tweets) {
  var noRetweets = filter(tweets, function(tweet) {
    if (tweet.text.indexOf('RT @') !== 0) {
      return tweet;
    }
  });
  return noRetweets;
}

// Filter out any Tweets not in a certain timezone
// Pacific Daylight Time: '-25200', Eastern Daylight Time: '-14400'
// (ended up not being used as it reduced Tweet count by too much)
function filterByTimezone(tweets, utcOffsetSecondsStr) {
  var onlyOneTimezone = filter(tweets, function(tweet) {
    if (tweet.utcOffset == utcOffsetSecondsStr) {
      return tweet;
    }
  });
  return onlyOneTimezone;
}

// Given a date d, a time in HH:MM, and an offset in seconds, find when the show airs in UTC
function calcUTCAirTime(d, timeStr, offset) {

	// Time is a string in HH:MM format
	var hours = parseInt(timeStr.split(':')[0]);
	var minutes = parseInt(timeStr.split(':')[1]);
	d.setUTCHours(hours);
	d.setUTCMinutes(minutes);
	d = addTime(d, -offset, 'sec');
	return d;
}

// Finds the last date given day of week (used when no date provided)
// e.g. What was the date last Wednesday?
function calcLastDate(dayOfWeek) {
	var dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	var d = new Date(Date.now());
	d.setUTCHours(0,0,0,0);
	while (dayName[d.getUTCDay()] != dayOfWeek) { // changed from UTC day to day
		d = addTime(d, -1, 'day');
	}
	return d;
}

//--------------------
// DEBUGGING FUNCTIONS
//--------------------

// Displays Tweet results for a query string. Useful for manually searching for Tweets.
// app.get('/test', function(req, res) {
//   testTweetQuery('#hashtag since:2015-09-01 until:2015-09-03 max_id:123456789', res);
// });
function testTweetQuery(query, res) {
	var T = new Twit(config);
	T.get('search/tweets', { q: query, count: 100 }, function (e,d,r) {
		if (e) {
			console.log(e);
		}
		else {
      // console.log(d);
			res.send(d);
		}
	});
}

// Displays Twitter's rate limit for searching Tweets (450 per 15 minutes)
function getRateLimit() {
	var T = new Twit(config);
	T.get('application/rate_limit_status', {q: 'resources=help,users,search,statuses'}, function (e,d,r) {
		if (e) {
			console.log(e);
		}
		else {
			d.resources.search['/search/tweets'].reset= new Date(d.resources.search['/search/tweets'].reset*1000);
			console.log(d.resources.search['/search/tweets']);
		}
	});
}

if (debugging) {
  getRateLimit();
}

// Returns the length of a show in minutes
function getRuntime(showName) {
	requestTVInfo('shows/'+showName+'?extended=full', function (error, response, data) {
		if (error) {
			console.log(error);
		} else {
			return JSON.parse(data).runtime;
		}
	});
}

// Displays show information at /show given a show slug (e.g. 'conan-2010')
function getShow(showName) {
  requestTVInfo('shows/'+showName+'?extended=full', function (error, response, body) {
    if (error) {
      console.log(error);
    } else {
      app.get('/show', function(req, res) {
        res.send(body);
      });
      console.log('Show:', JSON.parse(body).title);
      console.log('Day:', JSON.parse(body).airs.day);
      console.log('Timezone:', JSON.parse(body).airs.timezone);
      console.log('Time:', JSON.parse(body).airs.time);
    }
  });
}

// Searches shows given a string: showName, and returns list of shows at /search
function searchShow(showName) {
  showName = encodeURI(showName);
  requestTVInfo('search?query='+showName+'&type=show', function (error, response, body) {
    if (error) {
      console.log(error);
    } else {
      app.get('/search', function(req, res) {
        res.send(body);
      });
    }
  });
}

// Grabs trending shows from Trakt.tv's API
function getTrendingShows() {
	requestTVInfo('shows/trending', function (error, response, body) {
		if (error) {
			console.log(error);
		} else {
			console.log(body);
		}
	});
}
