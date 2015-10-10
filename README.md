# #LiveTweetViewer
<img src="http://i.imgur.com/ahjnq3c.gif" width="305px">

Have you ever missed out on Twitter commentary and reactions because you didn't watch a TV episode when it first aired?
<br/><br/>__\#LiveTweetViewer__ lets you play back "live" Tweets for a show that you stream online later.
This app combines Tweets from all timezones, so you can see reactions from the East Coast and West Coast at the same time - no more worrying about reading spoiler Tweets!

## Usage
1. Clone the repository.
2. Open server.js and add in your Twitter consumer key and consumer secret.
3. Navigate to the directory and start the server with ```node server.js```
4. Visit [http://localhost:3000](http://localhost:3000) in the browser.
5. Type in the name of a show, a hashtag, and (optionally) an airdate.
6. Click __Get Tweets__, wait for the Tweets to load, and click __Play__. (Don't forget to start playing the episode at the same time!)

__Note:__ Pausing Adblock during usage is recommended, as it may block certain elements of the page.

## How it works
Here's a high-level overview on how this web app works. Check out the comments in the code for more details.

1. A user requests a show, hashtag, and (optionally) an airdate from the __#LiveTweetViewer__ server and waits for the server to respond.
2. The server pulls TV show information from the [Trakt.tv API](http://docs.trakt.apiary.io/#) based on user input.
3. The server searches Twitter to find Tweets in that time range using the [Twitter API](https://dev.twitter.com/rest/public/search), 100 Tweets at a time.
4. The server filters out Tweets outside of the show's time range, as well as Retweets.
5. The server responds to the client with filtered Tweets and show information, and the client processes this data.
6. The client displays the Tweets with the correct timing and displays the show overview and the most interesting Tweets.

## Dependencies
__\#LiveTweetViewer__ uses [node.js](https://nodejs.org/en/) combined with the following modules, which are used minimally:
* [express](http://expressjs.com/): used for only two routes - the GET for the index page ('/') and the POST for Tweet data ('/tweets').
* [body-parser](https://www.npmjs.com/package/body-parser): used to access data entered into the browser form by the user.
* [request](https://www.npmjs.com/package/request): used to request data from the Trakt.tv API.
* [hbs](https://www.npmjs.com/package/hbs): used only for its familiar HTML syntax. Templating functionality, {{ }}, not used. I was unfamiliar with Jade.
* [twit](https://www.npmjs.com/package/twit): used to request Tweets via the Twitter API.
I was reluctant to use a module for getting Tweets, but could not find a way to access the Twitter API easily without running into CORS errors.
