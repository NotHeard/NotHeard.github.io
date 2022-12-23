var spotifyApi;
var deviceId = 0;

const useEmbeddedPlayer = false;
const usePrivateScope = !useEmbeddedPlayer;
const hideEmbed = false; //Obvs need to be true for release
const preventEmbedPlayerLoad = false; //Use this for UI testing to prevent 503 errors later
const grayScaleMode = false; //Uses symbols as well as colors for guess markers, aimed at people with Monochromacy
const useDevEnvi = false; //Use local redirect for testing

let state = "paused";
let uiDisabled = true;
let goButtonDisabled = true;
let loginButtonDisabled = false;
const times = [1,2,4,7,11,16];
let timesIndex = 0;
const maxTimesIndex = times.length;
//1,2,4,7,11,16
const embeddedPlayer = document.getElementById("sillylittleguy");
const progressBar = document.getElementById("progressBar");
const searchBox = document.getElementById("searchBox");
const guessArea = document.getElementById("guessArea");
const playlistInputBox = document.getElementById('playlistInputBox');
const goButton = document.getElementById("gobutton");
disableGoButton();
//Dots shown at the end
//const guessDotsArea = document.getElementById("guessDotsRow");
const timerDiv = document.getElementById("timer");
let intervalID = -1;
let intervalLength = 250;

var player=null;
var songLibrary;
var correctAnswer;
let fuseInst;

/**
 * BEGIN AUTH
 *  s/o https://stackoverflow.com/a/48660722
 *  Get the hash of the url
 */
const hash = window.location.hash
.substring(1)
.split('&')
.reduce(function (initial, item) {
  if (item) {
    var parts = item.split('=');
    initial[parts[0]] = decodeURIComponent(parts[1]);
  }
  return initial;
}, {});
window.location.hash = '';

// Set token
let _token = hash.access_token;

const authEndpoint = 'https://accounts.spotify.com/authorize';

// Replace with your app's client ID, redirect URI and desired scopes
const clientId = '57b0f934888642a1be294898d2ba21e7';

let redirectUri;
if (useDevEnvi){
    redirectUri = 'http://127.0.0.1:5555';
}else {
    redirectUri = 'https://NotHeard.github.io';
}
//If using the embed player, we don't need anything from the user's account, just enough auth to view public playlists
let scopes = []; 
//If we're using the WebPlaybackSDK, then this makes more sense
if (usePrivateScope == true){ 
    //The demo api key uses this streaming, user-read-email, user-modify-playback-state, user-read-private
    scopes = [
        'user-read-playback-state',
        'playlist-read-private',
        'user-modify-playback-state',
        'streaming'
    ];
}

// If there is no token, redirect to Spotify authorization
if (!_token) {
    document.getElementById('loginButton').style.cursor = 'pointer';
    document.getElementById('loginButton').onclick = login;
    console.log('no token found');
  } else {
    //TOKEN FOUND
    showPostLoginUI();
    const token = _token;
    spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(token);

    /**
     * END AUTH
     */

    if (useEmbeddedPlayer){
        document.getElementById('playbutton').onclick = function() {
            if (uiDisabled){
                return;
            }
            if (state=='playing'){
                embed_pause();
            } else { //state = 'paused'
                document.getElementById("playpauseicon").src = "pause.svg";
                state = 'playing';
                embed_playReset();
                //setTimeout(reset, times[timesIndex]*1000);
            }
        };
    }else {
        //USE WebPlaybackSDK
        window.onSpotifyWebPlaybackSDKReady = () => {
            //'[My access token]';
            console.log('webplayback sdk started');
            player = new Spotify.Player({
                name: 'NotHeard Player',
                getOAuthToken: cb => { cb(token); },
                volume: 0.5
            });

            // Ready
            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                deviceId = device_id;
            });

            // Not Ready
            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
            });

            player.addListener('initialization_error', ({ message }) => {
                console.error(message);
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error(message);
                console.warn("If you see an 'invalid token scopes' error above, just ignore it, I don't know why but the web streaming API thinks it needs very invasive permissions when it infact does not");
            });

            player.addListener('account_error', ({ message }) => {
                console.error(message);
            });

            //player.addListener('player_state_changed', ({ position, paused }) => {    
            //});

            document.getElementById('playbutton').onclick = function() {
                if (uiDisabled){
                    return;
                }
                if (state=='playing'){
                    player.pause().then( () => {
                        console.log("attempted to pause");
                        seekToZero(player);
                    });
                    reset(player);
                } else { //state = 'paused'
                    document.getElementById("playpauseicon").src = "pause.svg";
                    state = 'playing';
                    player.resume();
                    intervalID=setInterval(onTick, intervalLength, player);
                    //setTimeout(reset, times[timesIndex]*1000);
                }
            };

            function onTick(player){
                player.getCurrentState().then(state => {
                    if (!state) {
                        console.error('User is not playing music through the Web Playback SDK');
                        return;
                    }
                    position = state.position;
                    paused = state.paused;
                    buffering = state.loading;
                    if (buffering == false && paused == false){
                        percentage = (position/(times[maxTimesIndex-1]*1000))*100;
                        if (position > (times[timesIndex]*1000)){
                            console.log("resetCalled!");
                            player.pause().then( () => {
                                console.log("attempted to pause");
                                reset(player);
                            });
                            percentage = (times[timesIndex]/times[maxTimesIndex-1])*100;
                        }
                        updateProgressBar(percentage);
                    }
                });
            }

            function reset(player){
                seekToZero(player);
                if (state=='playing'){
                    state = 'paused';
                    document.getElementById("playpauseicon").src = "play.svg";
                    if (intervalID != -1){
                        clearInterval(intervalID);
                        intervalID=-1;
                    }
                }
            }

            player.connect();
        };
    }
}

/**
 * UI Functions
 */

function login(){
    if (loginButtonDisabled){
        return;
    }
    window.location = `${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token`;
}

function showPostLoginUI(){
    loginButtonDisabled = true;
    document.getElementById('playlistURLRow').style.opacity = '1';
    document.getElementById('playlistURLRow').style.cursor = 'default';
    //TODO check if that causes problems later /\
    playlistInputBox.placeholder = 'paste Spotify playlist url here';
    playlistInputBox.disabled = false;
    playlistInputBox.style.cursor = 'text';
    document.getElementById('loginButton').innerText = 'Logged in :)';
    showAllElementsOfClass('.showAfterLogin');
}

function showBaseUI(){
    uiDisabled = false;
    if (hideEmbed){
        embeddedPlayer.style.position = 'fixed';
        embeddedPlayer.style.left = '-101%';
    }
    showAllElementsOfClass('.startInactive');
    searchBox.disabled = false;
}

function showEmbed(){
    if (hideEmbed){
        embeddedPlayer.style.position = 'relative';
        embeddedPlayer.style.left = '0%';
        embeddedPlayer.style.width = '80%';
        embeddedPlayer.style.marginLeft = 'auto';
        embeddedPlayer.style.marginRight = 'auto';
    }
}

function addFailedGuess(failedGuessString, guessResult){
    if (timesIndex < maxTimesIndex){
        timesIndex += 1;
        if (!(["correctArtist","incorrect","skipped"].includes(guessResult))){guessResult="skipped";};

        guessDotDivName = "guessDot"+ (timesIndex).toString();
        guessDotDiv = document.getElementById(guessDotDivName);
        guessDotDiv.style.backgroundColor = "var(--"+guessResult+"GuessDotColor)";

        if (timesIndex==maxTimesIndex){
            document.getElementById("solutionTitle").innerText="Better luck next time";
            endGame();
        }else{
            progessDividerDivName = "progressDivider"+ (timesIndex+1).toString();
            document.getElementById( progessDividerDivName).style.backgroundColor = "var(--lightGrayOpaque)";
            guessHistoryDivName = "guess"+ (timesIndex).toString();
            guessHistoryDiv = document.getElementById(guessHistoryDivName);
            guessHistoryDiv.style.backgroundColor = "var(--cardLightGray)";
            if (grayScaleMode){
                switch(guessResult){
                    case "incorrect":
                        symbol = "✕";
                        break;
                    case "correctArtist":
                        symbol = "●";
                        break;
                    case "skipped":
                        symbol = "▶";
                        break;
                }
            }else{
                symbol = "✕";
            }   
            failedGuessString = "<span class=\""+guessResult+"Guess span\">"+symbol+"</span>&nbsp;&nbsp;"+failedGuessString;
            guessHistoryDiv.innerHTML = failedGuessString;
        }
    }
}

function updateProgressBar(percentage){
    progressBar.style.width = percentage.toString() + "%";
    const time = Math.floor((percentage/100)*16);
    timerDiv.innerText= "0:"+time.toString().padStart(2, '0');
}

goButton.onclick = go;

document.getElementById("skipbutton").onclick = function(){
    if (uiDisabled){
        return;
    }
    addFailedGuess("SKIPPED", "skipped");
};

document.getElementById("enterbutton").onclick = function(){
    if (uiDisabled){return;}
    if (!correctAnswer){return;}

    searchBoxString = searchBox.value;
    if (searchBoxString.length==0){return;}
    if (searchBoxString===" "){return;}
    if (searchBoxString.includes(";")){return;}
    if (searchBoxString.includes("\\")){return;}

    guessArea.innerHTML = '';
    searchBox.value = '';
    answerString = correctAnswer.name + " - " + correctAnswer.artists[0].name;
    if (searchBoxString===answerString){
        answerCorrect();
    }else{
        artistGuess = searchBoxString.split(" - ")[1];
        if (artistGuess===correctAnswer.artists[0].name){
            addFailedGuess(searchBoxString, "correctArtist");
        }else{
            addFailedGuess(searchBoxString, "incorrect");
        }
    }
};


function disableGoButton(){
    goButtonDisabled = true;
    goButton.style.opacity = '0.3';
    goButton.style.cursor = 'not-allowed';
}

function enableGoButton(){
    goButtonDisabled = false;
    goButton.style.opacity = '1';
    goButton.style.cursor = 'pointer';
}

function go(){
    urlString = 'https://open.spotify.com/playlist/' + playlistInputBox.value;
    playlistID = playlistURLSanitiser(urlString);
    if (!playlistID){
        return;
    }
    if (goButtonDisabled){
        return;
    }
    document.getElementById('playlistURLRow').style.cursor = 'default';
    disableGoButton();
    hideAllElementsOfClass(".hideAfterPlaylistSelect");
    playlistInputBox.disabled = true;
    //embeddedPlayer.innerHTML = embeddedPlayer.innerHTML.replace('START','FETCHING PLAYLIST 0%');
    embeddedPlayer.innerText = 'FETCHING PLAYLIST 0%';
    chooseAndSetSong(playlistID, player);
}

playlistInputBox.addEventListener('keypress', function(event){
    if (event.key === "Enter") {
        event.preventDefault();
        go();
      }
});

playlistInputBox.addEventListener('input', function(){
    disableGoButton();
    urlString = playlistInputBox.value;
    id = playlistURLSanitiser(urlString);
    if (!id){
        urlString = 'https://open.spotify.com/playlist/' + playlistInputBox.value;
        id = playlistURLSanitiser(urlString);
        if (!id){
            return;
        }
    }
    playlistInputBox.value = id;
    enableGoButton();
});

searchBox.addEventListener('input', function(){
    if (!songLibrary){return;}
    if (!correctAnswer){return;}

    guessArea.innerHTML = '';

    searchString = searchBox.value;
    if (searchString.includes(";")){return;}
    if (searchString.includes("\\")){return;}
    //if (searchString.length <= 2){return;}

    //searchString = searchString.replace(/ /g," \'");
    //searchString = "\'"+searchString; 
    if (searchString.includes(" ")){
        searchString = "\""+searchString+"\"";
    }
    searchString = "'"+searchString;

    searchResults = fuseInst.search(searchString);
    searchResults.forEach(function(result){
        const html = result.item.track.name + " - " + result.item.track.artists[0].name;
        const newResult = Object.assign(
            document.createElement(`div`), 
            { className: `autocompleteResult`, 
              innerHTML: html});
        guessArea.appendChild(newResult)
        newResult.onclick = function(event){
            searchBox.value = event.target.textContent;
            guessArea.innerHTML = '';
        }
    });
});

function endGame(){
    if (!useEmbeddedPlayer){
        //player.pause
        songURL = trackIDToURL(correctAnswer.id);
        if (!songURL){
            console.error("INVALID TRACK: ",songURL);
            return;
        }
        embed_changeSong(songURL);
        if (!player){
            //
        }else{
            player.pause().then( () => {
                console.log("attempted to pause");
            });
        }
    }
    showEmbed();
    uiDisabled = true;
    hideAllElementsOfClass('.hideWhenCorrect');
    showAllElementsOfClass('.showWhenCorrect');
    searchBox.disabled = true;
}

function answerCorrect(){
    guessDotDivName = "guessDot"+ (timesIndex+1).toString();
    guessDotDiv = document.getElementById(guessDotDivName);
    guessDotDiv.style.backgroundColor = "green";

    document.getElementById("solutionTitle").innerText="Congrats!";
    endGame();
}


/**
 * Actual WebPlayerAPI/WebAPI functions
 */

function moveToThisBrowser(callback, callbackp1, callbackp2) {
    console.log("evil function again")
    spotifyApi.getMyDevices()
    .then( function(value){
        if (value.devices.length==0){
            moveToThisBrowser(callback, callbackp1, callbackp2);
        } else {
            let i=0;
            let idFound = false;
            while ((i < value.devices.length) && (!idFound)) {
                if (value.devices[i].id == deviceId){
                    idFound = true;
                }
                i++; //bruh
            }
            if (idFound){
                spotifyApi.getMyCurrentPlaybackState()
                .then( function(value) {
                    //If nothing is playing AND there is no device, this will return null. (trust me)
                    let deviceIdArr = [deviceId.toString()]
                    if (!value) {
                        spotifyApi.transferMyPlayback(deviceIdArr, {})
                        .then(function(){
                            waitForSpotifyToCompleteDeviceTransfer(callback, callbackp1, callbackp2); 
                            return;
                        });
                    } else {
                        if(value.is_playing==true){
                            spotifyApi.pause().then(function() {
                                spotifyApi.transferMyPlayback(deviceIdArr, {})
                                .then(function(){
                                    waitForSpotifyToCompleteDeviceTransfer(callback, callbackp1, callbackp2); 
                                    return;
                                });
                            })
                        }else{
                            spotifyApi.transferMyPlayback(deviceIdArr, {})
                            .then(function(){
                                waitForSpotifyToCompleteDeviceTransfer(callback, callbackp1, callbackp2);
                                return;
                            });
                        }
                    }
                }).catch(function (error) {
                    console.error(error);
                });
            } else { //id not found in device list responce
                moveToThisBrowser(callback, callbackp1, callbackp2);
            }
        }
    }).catch(function (error) {
        console.error(error);
    });
}

function waitForSpotifyToCompleteDeviceTransfer(callback, callbackp1, callbackp2){
    console.log("waiting for device transfer to complete");
    spotifyApi.getMyCurrentPlaybackState()
    .then( function(value){
        console.log(value);
        if (!value){
            waitForSpotifyToCompleteDeviceTransfer(callback, callbackp1, callbackp2);
            return;
        }
        if (value.device.id == deviceId){
            callback(callbackp1,callbackp2);
            return;
        }else{
            waitForSpotifyToCompleteDeviceTransfer(callback, callbackp1, callbackp2);
            return;
        }
    }).catch(function (error) {
        console.error(error);
        //embeddedPlayer.innerText = 'LOADING PLAYER';
    });
}

function acquirePlaylist(playlistID, outarr, func, offset, player=null){

    options={offset:offset,fields:"offset,total,limit,items(track(name,id,artists(name)))"};

    spotifyApi.getPlaylistTracks(playlistID, options).then(
        function (data){
            offset = offset + data.limit;
            total = data.total;
            outarr = outarr.concat(data.items);
            
            const percentageString = (Math.floor((offset/total)*100)).toString() + '%';
            //embeddedPlayer.innerHTML = embeddedPlayer.innerHTML.replace(/[0-9]{1,2}%/,percentageString);
            embeddedPlayer.innerText = 'FETCHING PLAYLIST ' + percentageString;

            if (offset < total){
                acquirePlaylist(playlistID, outarr, func, offset, player);
            }
            if (outarr.length==total){
                func(outarr, player);
            }
        }
    ).catch(function(error){
        console.error(error);
    });

}

function chooseAndSetSong(playlistID, player){
    tracks = [];
    tracks = acquirePlaylist(playlistID,tracks, chooseAndSetSongAfter, offset=0, player=player);

}

function chooseAndSetSongAfter(trackArray, player){
    //embeddedPlayer.innerHTML = embeddedPlayer.innerHTML.replace(/FETCHING PLAYLIST [0-9]{1,2}%/,'LOADING PLAYER');
    embeddedPlayer.innerText = 'LOADING PLAYER';
    if (useEmbeddedPlayer){
        chooseAndSetSongAfterAfter(trackArray, player);
    }else{
        moveToThisBrowser(chooseAndSetSongAfterAfter, trackArray, player);
    }
    
}

function chooseAndSetSongAfterAfter(trackArray, player){

    randomIndex = getRandomInt(0,trackArray.length);
    
    songLibrary = trackArray;
    correctAnswer = trackArray[randomIndex].track;

    /*
    console.log(
        'Chosen song :', correctAnswer.name, 
        ' by ', correctAnswer.artists[0].name,
        ' with id :', correctAnswer.id);
    */

    initFuseInst();

    if (useEmbeddedPlayer){
        songURL = trackIDToURL(correctAnswer.id);
        if (!songURL){
            console.error("INVALID TRACK: ",songURL);
            return;
        }
        embed_changeSong(songURL, showBaseUI);
    } else{
        //Need to clear out the embeddedPlayer div  manually when not using it elsewhere
        embeddedPlayer.innerText = ''; 
        showBaseUI();
        trackURI = "spotify:track:"+correctAnswer.id;
        playSong(trackURI, player);
    }
}


function playSong(URI, player) {
    if (deviceId != 0){
        player.setVolume(0.0).then(() => { //Note the stupid workaround to not being able to prequeue a song
                                            //We mute the player, begin the track, unpause as soon as we can, unmute the player
                                            //The muting does not work on iOS bc why would it
            console.log('Volume updated!');
            spotifyApi.play({"device_id":deviceId, "uris": [URI]})
            .then(function() {
                //with web api, the local one ignores this first play for whatever reason
                spotifyApi.pause().then( function() {
                    player.setVolume(1.0).then(() => {
                        seekToZero(player);
                    });
                });
            }).catch(function(error) {
                console.error(error);
            });
        });
        
    }
}

function seekToZero(player) {
    player.seek(0).then(() => {
        console.log('Changed position!');
    });
    //web API version
    /*
    spotifyApi.seek(1).catch(function (error) {
        console.error(error);
    });
    */
}

/**
 * Embed player functions
 * 
 */

function embed_OnRecieveUpdate(event){
    if (!event.data.payload){
        return;
    }
    position = event.data.payload.position;
    if (event.data.payload.isBuffering == false && event.data.payload.isPaused == false){
        percentage = (position/(times[maxTimesIndex-1]*1000))*100;
        if (position > (times[timesIndex]*1000)){
            console.log("resetCalled!");
            embed_pause();
            percentage = (times[timesIndex]/times[maxTimesIndex-1])*100;
        }
        updateProgressBar(percentage);
    }
}

addEventListener('message', embed_OnRecieveUpdate);


// s/o to this legend https://community.spotify.com/t5/Spotify-for-Developers/iFrame-API-for-Tracks-not-podcasts/m-p/5470064/highlight/true#M7288
/**
 * play a song (given by url) on the embeddedPlayer
 * Note this only loads an embed with the song, it does not start actually playing yet
 * @see embed_playReset and @see embed_togglePlay for actually playing the music
 * @param {String} url the spotify url (NOT URI) to play. Note this function makes to attempt to validate this
 */
function embed_changeSong(url, callback=null) {
    if (preventEmbedPlayerLoad) {
        return;
    }
    fetch(`https://open.spotify.com/oembed?url=${url}`)
    .then((response) => response.json())
    .then((data) => {
        embeddedPlayer.innerHTML = data.html;
        if (!callback){
            return;
        }else{
            callback();
        }
    });
}

/**
 * Send a play command to the embedded player. Note this will RESET the player state.
 */
function embed_playReset() {
    const spotifyEmbedWindow = document.querySelector('iframe[src*="spotify.com/embed"]').contentWindow;
    spotifyEmbedWindow.postMessage({command: 'play'}, '*') //play
}

/**
 * Send a play/pause command to the embedded player.
 */
function embed_togglePlay() {
    const spotifyEmbedWindow = document.querySelector('iframe[src*="spotify.com/embed"]').contentWindow;
    spotifyEmbedWindow.postMessage({command: 'toggle'}, '*') //play
}

/**
 * Function to pause the player
 */
function embed_pause(){
    if (state=='playing'){
        console.log("inner pause called!")
        state = 'paused';
        document.getElementById("playpauseicon").src = "play.svg";
        embed_togglePlay();
    }
}

/**
 * Helper functions
 * 
 */

/**
 * unhides (sets opacity to 1) every DOM element of a given class
 * @param {String} className className that should be unhidden
 */
function showAllElementsOfClass(className){
    const elementsToShow = document.querySelectorAll(className);
    elementsToShow.forEach(element => {
        element.style.opacity = '1';
    }); 
}

/**
 * hides (sets opacity to 0) every DOM element of a given class
 * @param {String} className className that should be unhidden
 */
function hideAllElementsOfClass(className){
    const elementsToShow = document.querySelectorAll(className);
    elementsToShow.forEach(element => {
        element.style.opacity = '0';
    }); 
}

/**
 * Converts a track ID to a spotify URL
 * @param {String} trackID the trackID to convert
 * @returns {String} the url
 * @returns {null} if the trackID was invalid, note this only makes a brief client side check, it does not check if the ID exists on Spotifys servers
 */
function trackIDToURL(trackID){
    if (isAlphaNumeric(trackID)){
        return 'https://open.spotify.com/track/'+trackID;
    }else{
        return null;
    }
}

/**
 * Converts a spotify playlist URL into an ID
 * @param {String} playlistURL the playlist URL to convert & sanitise
 * @returns {String} the ID
 * @returns {null} if the URL was invalid
 */
function playlistURLSanitiser(playlistURL){
    urlStringArray = playlistURL.split("/");
    //'https://open.spotify.com/playlist/4SPnDFD7k21pGE1Xy2IMph?si=5e2403604a3e4c1f'
    if (urlStringArray.length != 5){return null};
    if (urlStringArray[0] != 'https:'){return null};
    if (urlStringArray[2] != 'open.spotify.com'){return null};
    if (urlStringArray[3] != 'playlist'){return null};
    idStringArray = urlStringArray[4].split("?");
    idString = idStringArray[0];
    if (!isAlphaNumeric(idString)){return null};
    return idString;
}

/**
 * Converts a spotify URI to a spotify URL
 * @param {String} uri the uri to convert
 * @returns {String} the converted url
 * @returns {null} if the uri was invalid
 */
function uriTourl(uri) {
    //https://open.spotify.com/track/6EO56btPzDF3LUrfwlXi2j
    if (isURIValid(uri)){
        uriArray = uri.split(":");
        url = 'https://open.spotify.com/'+uriArray[1]+'/'+uriArray[3];
        return url;
    } else {
        return null;
    }
}

/**
 * Quick (but non exhaustive) check for validity of spotify URIs
 * @param {String} uri to check validity of
 * @returns {Boolean} true if valid, false otherwise
 */
function isURIValid(uri) {
    //e.g. spotify:track:6EO56btPzDF3LUrfwlXi2j
    valid=false;
    uriArray = uri.split(":");
    if (uriArray.length == 3){
        if (uriArray[0]=='spotify'){
            if (['track','playlist','artist'].indexOf(uriArray[1])!=-1){
                if (isAlphaNumeric(uriArray[2])){
                    valid=true;
                }
            }
        }
    }
    return valid;
}

function initFuseInst(){
    if (!songLibrary){
        return;
    }
    fuseInst = new Fuse(songLibrary, {
        includeMatches: true,
        includeScore: true,
        shouldSort: true,
        useExtendedSearch: true,
        minMatchCharLength: 2,
        keys: ['track.name', 'track.artists.name']
    })
}

//Shamelessly stolen from
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
//Since this should be an included function
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

//Taken from this stackexchange post 
//https://stackoverflow.com/a/25352300
function isAlphaNumeric(str) {
    var code, i, len;
  
    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if (!(code > 47 && code < 58) && // numeric (0-9)
          !(code > 64 && code < 91) && // upper alpha (A-Z)
          !(code > 96 && code < 123)) { // lower alpha (a-z)
        return false;
      }
    }
    return true;
};
