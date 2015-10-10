var debugging = true;

// Initialize variables
var rawTweetData = null;
var rawShowData = null;
var timeouts = [];

// Used for detecting emoji faces in Tweet analysis
var emojis = ['😀','😁','😂','😃','😄',
                '😅','😆','😇','😈','👿',
                '😉','😊','☺️','😋','😌',
                '😍','😎','😏','😐','😑',
                '😒','😓','😔','😕','😖',
                '😗','😘','😙','😚','😛',
                '😜','😝','😞','😟','😠',
                '😡','😢','😣','😤','😥',
                '😦','😧','😨','😩','😪',
                '😫','😬','😭','😮','😯',
                '😰','😱','😲','😳','😴',
                '😵','😶','😷'
              ];

// Displays a comment in the Tweet stream
function showComment(str) {
  var comment = '<div class="comment"><p>'+str+'</p></div>';
  $('#tweets').prepend(comment);
}

// Displays an error in the Tweet stream
function showError(str) {
  var err = '<div class="err"><p>'+str+'</p></div>';
  $('#tweets').prepend(err);
  $('#get-tweets').prop("disabled", false);
}

// Display tweets with correct timing
function displayTweets(tweetData) {
  var localStartTime = new Date(tweetData[0].localStartTime);
  var waitArr = tweetData.map(function(tweet) {
    return new Date(tweet.localCreateDate)-localStartTime;
  });
  if (debugging) {
    console.log(waitArr);
  }

  // Wrap Tweet text in HTML and add it to the #tweets box
  function displayTweet(tweet) {
    var timeStrArr = calculateTimeElapsed(tweet);
    var tweetContent = '<div class="tweet"><p><b>'+tweet.name+'</b><span class="handle"> @'+tweet.handle+' • '+timeStrArr[0]+timeStrArr[1]+timeStrArr[2]+'</span><br/>'+tweet.text+'</p><div>';
    $('#tweets').prepend(tweetContent);
  }

  // Create delays for each Tweet based on when it was created
  for (var i = 0; i<tweetData.length; i++) {
    timeouts.push(setTimeout(displayTweet, waitArr[i], tweetData[i]));
  }
}

// Return an array of [hours, minutes, seconds] since start time of episode for display next to the Tweet
function calculateTimeElapsed(tweet) {
  var msDifference = Date.parse(tweet.localCreateDate)-Date.parse(tweet.localStartTime);
  if (debugging) {
    console.log(msDifference);
  }

  var tweetHour = Math.floor(msDifference/3600000);
  var tweetHourStr = '';
  if (tweetHour !== 0) {
    tweetHourStr = ''+tweetHour+'h ';
  }

  var tweetMinute = Math.floor(msDifference/60000) % 60;
  var tweetMinuteStr = '';
  if (tweetMinute !== 0) {
    tweetMinuteStr = ''+tweetMinute+'m ';
  }

  var tweetSecond = (msDifference/1000) % 60;
  var tweetSecondStr = '';
  if (tweetSecond !== 0) {
    tweetSecondStr = ''+tweetSecond+'s ';
  }
  return [tweetHourStr, tweetMinuteStr, tweetSecondStr];
}

// Resets the page and allows the user to perform another search
function clearTweets() {
  for (var i = 0; i < timeouts.length; i++) {
    clearTimeout(timeouts[i]);
  }
  timeouts = [];
  rawTweetData = null;
  $('#play').prop("disabled", true);
  $('#tweets').html('');
  $('#stats').html('');
  $('#show-info').html('');
  $('.more-info').hide();
}

// Displays the most interesting Tweets at the bottom of the page
function displaySummary(tweetData) {
  var summaryStats = summarizeTweets(tweetData);
  for (var stat in summaryStats) {
    var statTitle = summaryStats[stat][0];
    var tweet = summaryStats[stat][1];
    var tweetContent = '';
    if (tweet) {
      tweetContent = '<h3 class>'+statTitle+'</h3><div class="top-tweet"><p><b>'+tweet.name+'</b><span class="handle"> @'+tweet.handle+'</span><br/>'+tweet.text+'</p><div>';
    }
    $('#stats').append(tweetContent);
  }
}

// Displays the show overview at the bottom of the page
function displayShowInfo(showData) {
  $('#show-info').append('<h3>'+showData.title+'</h3>');
  $('#show-info').append('<h4 class="subheader">Aired '+showData.airday+' at '+showData.airtime+'.</h4>');
  $('#show-info').append('<p>'+showData.overview+'</p>');
}

//--------------------
// ANALYSIS FUNCTIONS
//--------------------

// Determines whether the str is an emoji (str for emoji is usually two characters)
function isEmoji(str) {
  return emojis.indexOf(str) > -1;
}

// Determines if c is an uppercase letter
function isUpperCaseLetter(c) {
  return (c.toUpperCase() == c && c.toLowerCase() != c);
}

// Count occurrences of c in str
function countChar(c, str) {
  return countCharCond(str, function(char) {
    return char == c;
  });
}

// Return total number of characters that meet the condition
function countCharCond(str, callbackCond) {
  var inv = invCharacters(str);
  var count = 0;
  for (var item in inv) {
    if (callbackCond(item)) {
      count += inv[item];
    }
  }
  return count;
}

// Counts all emojis in a string
function countEmojis(str) {
  return countCharCond(str, function(item) {
    if (isEmoji(item)) {
      return item;
    }
  });
}

// Creates an object to inventory all emojis and characters in string
function invCharacters(str) {
  var charCounts = {};
  for (var i = 0; i<str.length; i++) {

    // First check if it's an emoji, which are length = 2. Add it as a key if it is, and count it
    if ((i < str.length-1) && (isEmoji(str[i].concat(str[i+1])))) {
      var nextTwoChar = str[i].concat(str[i+1]);
      charCounts[emojis[emojis.indexOf(nextTwoChar)]] = (charCounts[nextTwoChar]|| 0) + 1;
      i++;
    } else {
    // Otherwise, just add the character as the key and count it.
      charCounts[str[i]] = (charCounts[str[i]]|| 0) + 1;
    }
  }
  return charCounts;
}

// Maps array tweetsFormatted with mCallback, then
// reduces array with rCallback (given init), and finally
// returns an array with the result and saves the Tweet: [reduceResult, {tweetObj}];
function analyzeTweets(tweetsFormatted, init, mCallback, rCallback) {
  var mapped = tweetsFormatted.map(function(tweet){
    return [mCallback(tweet.text),tweet];
  });

  var reduced = mapped.reduce(rCallback, [init,'']);

  if (reduced[0] === 0) {
    if (debugging) {console.log('No tweets to display');}
    return;
  } else {
    if (debugging) {console.log('Tweet analysis result: '+reduced[0]);}
    return reduced[1];
  }
}

// Returns Tweet with most exclamation points (most excited!)
function mostExcited(tweetsFormatted) {
  return analyzeTweets(tweetsFormatted, 0,
  function(tweetText) { return countChar('!',tweetText); },
  function(a, b) {
    if (a[0] > b[0]) {
      return a;
    } else {
      return b;
    }
  });
}

// Returns Tweet with most CAPITAL LETTERS (LOUDEST)
function loudest(tweetsFormatted) {
  return analyzeTweets(tweetsFormatted, 0,
  function(tweetText) {
    return countCharCond(tweetText,function(c) {
      return isUpperCaseLetter(c);
    }); },
  function(a, b) {
    if (a[0] > b[0]) {
      return a;
    } else {
      return b;
    }
  });
}

// Returns Tweet with most emoji faces (most... expressive?)
function mostEmojis(tweetsFormatted) {
  return analyzeTweets(tweetsFormatted, 0,
  function(tweetText) { return countEmojis(tweetText); },
  function(a, b) {
    if (a[0] > b[0]) {
      return a;
    } else {
      return b;
    }
  });
}

// Returns an object with the results of functions above for easy access
function summarizeTweets(tweetsFormatted) {
  return {
    'mostExcited' : ['Most Excited',mostExcited(tweetsFormatted)],
    'loudest' : ['Loudest',loudest(tweetsFormatted)],
    'mostEmoji' : ['Most Emoji Faces',mostEmojis(tweetsFormatted)]
  };
}

// Basic form validation to prevent bad inputs
function inputsValid(sn, ht, ad) {
  sn = sn.trim();
  ht = ht.trim();
  ad = ad.trim();

  // Prevent blank input for show name
  if (sn === '') {
    showError('Please enter a show name.');
    return false;
  }

  // Check hashtag - can't be blank or contain symbols other than #
  // Initial # is optional (added on server side if not included)
  if (ht === '') {
    showError('Please enter a hashtag.');
    return false;
  } else {
    if (ht[0] == '#') {
      if (debugging) {
        console.log('first character is #');
      }

      // Hashtag has to be letter or number (used regex for this)
      if ((ht.slice(1) === '') || !(/^[a-zA-Z0-9]*$/.test(ht.slice(1)))) {
        showError('Invalid hashtag.');
        return false;
      }
    } else {
      if (!(/^[a-zA-Z0-9]*$/.test(ht.slice(0)))) {
        showError('Invalid hashtag.');
        return false;
      }

    }
  }

  // If airdate is not blank, perform checks and throw errors if the date is invalid
  if (ad !== '') {
    var yyyy;
    var mm;
    var dd;

    try {
      var dateArr = ad.split('-');
      if (dateArr.length !== 3) {
        throw 'Too many dashes.';
      }
      yyyy = parseInt(dateArr[2]);
      mm = parseInt(dateArr[0]);
      dd = parseInt(dateArr[1]);
      if (isNaN(yyyy)|| isNaN(mm) || isNaN(dd)) {
        throw 'Not numbers.';
      }
      if (mm < 0 || mm > 11) {
        throw 'Invalid month.';
      }
      if (dd < 1 || dd > 31) {
        throw 'Invalid day.';
      }
      if (yyyy < 1000 || yyyy > 9999) {
        showError('Enter four numbers for the year.');
        throw 'Invalid year.';
      }
      checkDate(yyyy, mm, dd);
    } catch (e) {
      showError('Invalid date. Note: Due to Twitter\'s limitations, only last week\'s Tweets are available.');
      return false;
    }
  }
  return true;
}

// Make sure date entered is valid
function checkDate(year, month, day) {
  var nw = new Date(Date.now());
  var dateEntered = new Date(year, month-1, day);
  if (debugging) {
    console.log(nw);
    console.log(dateEntered);
    console.log((nw - dateEntered)/1000/60/60/24);
  }
  if (nw - dateEntered < 0) {
    throw 'Date is in the future.';
  }

  // 604,800,000 milliseconds in a week + 86,400,000 milliseconds (1 day) to buffer for time difference
  // Twitter currently doesn't provide Tweet data more than a week in the past
  if (nw - dateEntered > 691200000) {
    throw 'More than a week and a day in the past.';
  }
}

$(document).ready(function() {

  // Initialize page
  showComment('Enter a Show Name and Hashtag to begin. Tweets will be shown here.');
  $('#play').prop("disabled", true);
  $('#get-tweets').prop("disabled", false);
  $('.more-info').hide();

  // Start playback when Play is clicked
  $('#play').click(function() {
      $('#play').prop("disabled", true);
      $('#get-tweets').prop("disabled", false);
      showComment('Started Tweet playback. The first Tweet should appear soon.');
      displayTweets(rawTweetData);
  });

  // Collect user input
  $( "#queryForm" ).submit(function( event ) {
    clearTweets();
    event.preventDefault();
    var showName = $('#show').val();
    var hashtag = $('#hashtag').val();
    var airdate = $('#airdate').val();

    // Make sure inputs are valid
    if (!inputsValid(showName, hashtag, airdate)) {
      return;
    }

    showComment('Loading Tweets for \"'+showName+'\". This could take a few minutes depending on your Internet connection.');
    $('#get-tweets').prop("disabled", true);

    // POST to server with user information
    $.ajax({
      type: 'POST',
      url: '/tweets',

      // Prevent timeouts for more popular shows. Node's default is 2 minutes.
      timeout: 0,
      data: {
        showName: showName,
        hashtag: hashtag,
        airdate: airdate
      },
      success: function(data, textStatus, jqXHR) {

        // Check data and don't display it if it's bad/blank
        if (!data) {
          showError('There was an error getting the Tweets.');
          if (debugging) {
            console.log('No data returned');
          }
          return;
        } else if (data.length === 1) {
          if (data[0].error) {
            showError('There was an error getting the Tweets.');
            if (debugging) {
              console.log('Error: ', data[0]);
            }
          }
          if (data[0].message) {
            showError('We couldn\'t find any Tweets for what you entered. Try a different search.');
            if (debugging) {
              console.log('Message: ', data[0].message);
            }
          }
          return;
        } else if (data[1].length === 0) {
          showError('We couldn\'t find any Tweets for what you entered. Try a different search.');
          return;
        } else {

          // In the normal case, server will return a two-item array with show data [0] and Tweet data [1]
          rawShowData = data[0];
          rawTweetData = data[1];
        }

        // Data is fine. Display it on the page.
        showComment(rawTweetData.length + ' Tweets loaded. Press Play to start.');
        $('#play').prop("disabled", false);
        displaySummary(rawTweetData);
        displayShowInfo(rawShowData);
        $('.more-info').show();
      },
      
      // Show an error if POST is not successful
      error: function(jqXHR, textStatus, errorThrown) {
        if (debugging) {
          console.log('Error getting data: ', errorThrown);
        }
        showError('There was an error getting the Tweets.');
      },
      dataType: 'json'
    });
  });
});
